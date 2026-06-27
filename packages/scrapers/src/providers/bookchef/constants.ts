export const BOOKCHEF_BASE_URL = 'https://bookchef.ua';

/** Publisher/brand name as exposed in BookChef JSON-LD (`brand.name`). */
export const BRAND = 'BookChef';

/**
 * BookChef product pages are server-rendered with a JSON-LD `@type:Product`
 * block carrying the full record (isbn, gtin13, price, availability, author).
 * Parsing that JSON is far more stable than CSS selectors, so the parser reads
 * these script tags instead of scraping the DOM.
 */
export const JSON_LD_SELECTOR = 'script[type="application/ld+json"]';

/**
 * Markers that identify a listing as NOT a physical paper book. BookChef's
 * JSON-LD does not currently expose a reliable format field, so this helper is
 * provided for the scraper/discovery layer to apply once such a signal is
 * confirmed (mirrors the Yakaboo/Vivat paper-only policy).
 */
const NON_PAPER_BOOK_TYPE = /electron|ebook|e-book|digital|audio|mp3/i;

/** True unless `bookType` carries an explicit non-paper marker. */
export function isPaperBookType(bookType: unknown): boolean {
  if (typeof bookType !== 'string' || bookType.trim() === '') return true;
  return !NON_PAPER_BOOK_TYPE.test(bookType);
}

/** Build an absolute BookChef product URL from a product slug. */
export function buildProductUrl(slug: string): string {
  const clean = slug.trim().replace(/^\/+/, '');
  return `${BOOKCHEF_BASE_URL}/${clean}`;
}

/**
 * Resolve a BookChef `image` value to an absolute cover URL.
 *
 * The JSON-LD `image` may be a string or an array of strings; the first usable
 * string wins. Absolute URLs pass through, protocol-relative `//host/...` get an
 * `https:` scheme, and site-relative `/storage/a.jpg` are prefixed with the base
 * URL. Returns null for missing/blank/non-string values — a missing cover must
 * never break the listing.
 */
export function buildCoverUrl(image: unknown): string | null {
  const raw = firstNonEmptyString(image);
  if (raw === null) return null;
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `${BOOKCHEF_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
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
