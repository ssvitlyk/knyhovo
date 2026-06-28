export const LABORATORY_BASE_URL = 'https://laboratory.ua';

/**
 * Full public sitemap of Laboratory product pages — a flat `<urlset>` of `<loc>`
 * product URLs (`/products/<slug>`), refreshed daily (`changefreq: daily`,
 * per-URL `lastmod`). The root `sitemap.xml` is a `<sitemapindex>`; this constant
 * points DIRECTLY at the `type-products` sub-sitemap so discovery never has to
 * traverse the index. Allowed by robots.txt.
 *
 * NOT part of the provider contract — Laboratory may rename the sitemap without
 * any architectural change; this constant is the single place to update.
 */
export const LABORATORY_PRODUCTS_SITEMAP_URL = `${LABORATORY_BASE_URL}/sitemap.xml/type-products`;

/**
 * Provider-local default cap on how many product pages a single scrape fetches,
 * so manual/test runs do not pull the entire ~6k-URL sitemap. `ScraperOptions.maxPages`
 * overrides it (treated as a product cap) without changing the shared contract.
 */
export const DEFAULT_MAX_PRODUCTS = 50;

/**
 * Laboratory product pages are server-rendered with TWO JSON-LD blocks:
 * `@type:Product` (price, availability, sku/mpn) and `@type:Book` (isbn, author,
 * bookFormat). The parser reads both script tags and merges them — far more
 * stable than CSS selectors.
 */
export const JSON_LD_SELECTOR = 'script[type="application/ld+json"]';

/**
 * Markers in a schema.org `bookFormat` value (e.g. `https://schema.org/EBook`)
 * that identify a listing as NOT a physical paper book. Provided for the
 * scraper/discovery layer to apply (mirrors the Yakaboo/Vivat paper-only policy);
 * the Laboratory catalog is paper-only at recon time, so this is defensive.
 */
const NON_PAPER_BOOK_FORMAT = /ebook|e-book|audiobook|audio/i;

/** True unless `bookFormat` carries an explicit non-paper marker. */
export function isPaperBookType(bookFormat: unknown): boolean {
  if (typeof bookFormat !== 'string' || bookFormat.trim() === '') return true;
  return !NON_PAPER_BOOK_FORMAT.test(bookFormat);
}

/** Build an absolute Laboratory product URL from a product slug. */
export function buildProductUrl(slug: string): string {
  const clean = slug.trim().replace(/^\/+/, '');
  return `${LABORATORY_BASE_URL}/${clean}`;
}

/**
 * Resolve a Laboratory `image` value to an absolute cover URL.
 *
 * The JSON-LD `image` is a string (or, defensively, an array of strings); the
 * first usable string wins. Absolute URLs pass through, protocol-relative
 * `//host/...` get an `https:` scheme, and site-relative `/files/a.jpg` are
 * prefixed with the base URL. Returns null for missing/blank/non-string values —
 * a missing cover must never break the listing.
 */
export function buildCoverUrl(image: unknown): string | null {
  const raw = firstNonEmptyString(image);
  if (raw === null) return null;
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `${LABORATORY_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
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
