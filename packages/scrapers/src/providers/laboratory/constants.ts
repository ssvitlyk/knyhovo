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
 * Provider-local default cap on how many product pages a single scrape fetches.
 * Uncapped by default so production runs pull the full ~6k-URL sitemap; pass a
 * finite `ScraperOptions.maxPages` (treated as a product cap) to bound manual/test runs.
 *
 * ~6k is the LEGITIMATE catalog size (the `/catalog/books` listing is ~258 pages
 * of ~24 books), not sitemap bloat — so the fix for the post-cap hang is to fetch
 * these pages FASTER (bounded concurrency, see `DEFAULT_CONCURRENCY`), not to cap
 * how many we fetch.
 */
export const DEFAULT_MAX_PRODUCTS = Number.POSITIVE_INFINITY;

/**
 * How many product pages the scraper fetches in parallel. The sitemap yields ~6k
 * independent product URLs; fetching them one-at-a-time with a per-request delay
 * stretched a full run to ~50min–hours (the post-PR-#72 hang). A bounded pool of
 * 8 keeps the run to minutes while staying polite to Laboratory's origin — it is
 * CDN-fronted (Cloudflare) with no JS challenge, so modest concurrency is safe.
 */
export const DEFAULT_CONCURRENCY = 8;

/**
 * Emergency wall-clock ceiling for a single scrape() call. This is a SAFETY NET,
 * not the normal completion path: a healthy full run finishes in minutes well
 * under this. If a run somehow blows past it (origin degradation, mass timeouts),
 * the scraper stops dispatching new fetches and returns the products collected so
 * far as a partial result plus an error — never a hang.
 */
export const DEFAULT_MAX_RUNTIME_MS = 30 * 60 * 1000;

/** Per-request HTTP timeout for the sitemap and each product page. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Throttle applied by each worker after a request. With `DEFAULT_CONCURRENCY`
 * workers in flight the aggregate gap between requests is `delay / concurrency`,
 * so this stays polite without serializing the run. Overridable via `ScraperOptions.delayMs`.
 */
export const DEFAULT_DELAY_MS = 500;

/** Retries (after the first attempt) for a transient per-request failure (429 / timeout / reset). */
export const DEFAULT_MAX_RETRIES = 3;

/** Exponential-backoff base for retries: the nth retry waits `base * 2**(n-1)`, capped below. */
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;

/** Upper bound on a single backoff wait, so a long retry chain cannot stall a worker for minutes. */
export const DEFAULT_RETRY_MAX_DELAY_MS = 8_000;

/** Emit a `processed X/Y` progress line every this-many product pages. */
export const DEFAULT_PROGRESS_INTERVAL = 500;

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
