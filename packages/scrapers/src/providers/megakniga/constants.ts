export const MEGAKNIGA_BASE_URL = 'https://www.megakniga.com.ua';

/** Books catalog root. Pagination is path-style `pageN`, e.g. `/catalog/knigi/page2`. */
export const MEGAKNIGA_CATALOG_URL = `${MEGAKNIGA_BASE_URL}/catalog/knigi`;

/**
 * Items per listing page. 64 is the maximum the site's `per-page` GET param
 * accepts (recon §7) — minimizes the number of requests for a full catalog pass.
 */
export const PER_PAGE = 64;

/** Build an absolute catalog listing page URL. */
export function buildListingUrl(page: number): string {
  return `${MEGAKNIGA_CATALOG_URL}/page${page}?per-page=${PER_PAGE}`;
}

/**
 * Provider-local default cap on how many catalog listing pages a single scrape
 * fetches. The full books catalog is ~26–28k products at per-page=64, i.e.
 * ~410–440 pages (recon §8); 450 covers that with a small margin. Override via
 * `ScraperOptions.maxPages` for manual/test runs.
 */
export const DEFAULT_MAX_PAGES = 450;

/** Per-request HTTP timeout (recon §11: p50 ~1s, ample margin for CDN tail latency). */
export const DEFAULT_TIMEOUT_MS = 15_000;

/** Delay between consecutive catalog listing page requests (recon §11). */
export const DEFAULT_DELAY_MS = 400;

/**
 * Delay between consecutive product-page requests during the opt-in enrichment
 * pass (recon §11). Deliberately NOT derived from `delayMs` (unlike Vivat/Yakaboo,
 * which fall back to the catalog delay) — Megakniga's suggested defaults are two
 * distinct values, and enrichment is a separate, much longer-running pass.
 */
export const DEFAULT_ENRICHMENT_DELAY_MS = 300;

/** Retries (after the first attempt) for a transient per-request failure (429 / timeout / reset). */
export const DEFAULT_MAX_RETRIES = 2;

/** Exponential-backoff base for retries: the nth retry waits `base * 2**(n-1)`, capped below. */
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;

/** Upper bound on a single backoff wait, so a long retry chain cannot stall a run for minutes. */
export const DEFAULT_RETRY_MAX_DELAY_MS = 8_000;

/**
 * Megakniga's catalog and product pages are server-rendered Yii2 (PHP) with
 * semantic, hand-authored CSS classes (recon §3, §13) — no JSON-LD, no
 * `__NEXT_DATA__`. The parser reads these classes directly; the product page's
 * schema.org *microdata* (not JSON-LD) is the second, independent source for
 * price/availability/ISBN and is treated as untrusted like every other provider
 * (laboratory/knigoland pattern) — validated before use, never assumed present.
 */
export const CARD_SELECTOR = '.product-list-item';
export const TITLE_SELECTOR = '.product-list-name';
export const AUTHOR_SELECTOR = '.authors-block a';
export const AVAILABILITY_SELECTOR = '.product-available-container';
export const PRICE_FORM_SELECTOR = 'form[data-price]';
/** Excludes `.price-old` — the old (pre-discount) price must never win (PRD §2). */
export const PRICE_TEXT_SELECTOR = '.price:not(.price-old)';

/** Listing-card availability text/class markers (PRD §4). */
export const IN_STOCK_CLASS_MARKER = 'in_stock';
export const IN_STOCK_TEXT_MARKER = 'Є в наявності';
export const OUT_OF_STOCK_TEXT_MARKER = 'Товар очікується';

/** Marks a product page as a physical paper book (PRD §2.3 / recon §3). */
export const PAPER_BOOK_MARKER = 'Паперова книга';

/**
 * Resolve a Megakniga catalog-card image (`data-src`/`data-original`) to an
 * absolute cover URL.
 *
 * Values are site-relative (`/uploads/cache/...`); absolute and protocol-relative
 * (`//host/...`) forms are passed through defensively. Returns null for
 * missing/blank/non-string values — a missing cover must never break the listing.
 */
export function buildCoverUrl(image: unknown): string | null {
  if (typeof image !== 'string') return null;
  const raw = image.trim();
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `${MEGAKNIGA_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

/** Resolve a catalog-card or product href to an absolute Megakniga URL. */
export function resolveUrl(href: string): string {
  if (href.startsWith('http')) return href;
  return `${MEGAKNIGA_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
}
