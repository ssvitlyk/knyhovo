export const KNIGOLAND_BASE_URL = 'https://knigoland.com.ua';

/**
 * Knigoland's sitemap index — a `<urlset>` whose `<loc>` entries point at
 * sub-sitemaps (`sitemaps/images/*`, `sitemaps/sections/*`). Declared in
 * robots.txt. Discovery fetches this index and keeps only the product
 * sub-sitemaps (see {@link CATALOG_PRODUCTS_SITEMAP_PATTERN}).
 *
 * NOT part of the provider contract — Knigoland may rename the sitemap without
 * any architectural change; this constant is the single place to update.
 */
export const KNIGOLAND_SITEMAP_INDEX_URL = `${KNIGOLAND_BASE_URL}/sitemaps/sitemap.xml`;

/**
 * Matches the product sub-sitemaps inside the index — `sections/catalog-products-1..5.xml`
 * (~10k product `<loc>` each, ~50k total). Deliberately anchored to `\d+\.xml$`
 * so it never matches the image sub-sitemaps (`catalog-products-images-N.xml`).
 */
export const CATALOG_PRODUCTS_SITEMAP_PATTERN = /\/sections\/catalog-products-\d+\.xml$/;

/**
 * Provider-local default cap on how many product pages a single scrape fetches.
 * Uncapped by default so production runs pull the full ~50k-URL catalog; pass a
 * finite `ScraperOptions.maxPages` (treated as a product cap) to bound manual/test runs.
 */
export const DEFAULT_MAX_PRODUCTS = Number.POSITIVE_INFINITY;

/**
 * Knigoland product pages are server-rendered (Next.js, no Cloudflare/WAF) with
 * several JSON-LD blocks; the parser reads `@type:Product` (price, availability,
 * sku/mpn, image) and ignores the rest (LocalBusiness, WebSite, BreadcrumbList,
 * ImageObject). Knigoland dropped the `@type:Book` block from every product page
 * (site migration, verified 2026-07-05) — isbn now comes from the visible
 * "Характеристики" spec table, and author from `<meta name="description">`
 * (see `readSpecValue` / `readAuthorFromMetaDescription` in knigoland.parser.ts).
 *
 * Paper-book filter: Knigoland exposes no `bookFormat`, and its catalog mixes books
 * with gifts/stationery/toys ("Канцтовари та ігри"). The spec table's ISBN row is
 * populated for both books (a real ISBN-13) and non-books (a plain EAN-13
 * barcode) — both pass the same checksum, so the reliable discriminator is the
 * Bookland prefix (`978`/`979`), not checksum validity alone. A breadcrumb
 * allowlist was rejected because the book root category varies per section
 * (Книги, Комікси та манга, Навчальна література, …) and would silently drop
 * whole categories.
 */
export const JSON_LD_SELECTOR = 'script[type="application/ld+json"]';

/**
 * Resolve a Knigoland `image` value to an absolute cover URL.
 *
 * The JSON-LD `image` is an array of strings (`Product.image`) or a single string
 * (`Book.image`); the first usable string wins. Absolute URLs pass through
 * (covers are served from `admin.knigoland.com.ua/assets/...`), protocol-relative
 * `//host/...` get an `https:` scheme, and site-relative `/a.jpg` are prefixed with
 * the base URL. Returns null for missing/blank/non-string values — a missing cover
 * must never break the listing.
 */
export function buildCoverUrl(image: unknown): string | null {
  const raw = firstNonEmptyString(image);
  if (raw === null) return null;
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `${KNIGOLAND_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

function firstNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.trim() !== '') return item.trim();
    }
  }
  return null;
}
