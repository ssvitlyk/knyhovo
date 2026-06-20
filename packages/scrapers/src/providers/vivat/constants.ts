export const VIVAT_BASE_URL = 'https://vivat.com.ua';
/** Main books catalog. Pagination is `?page=N`; ~24 products per page. */
export const VIVAT_CATALOG_URL = `${VIVAT_BASE_URL}/category/knyhy/`;

/**
 * Vivat is a Next.js app: catalog products are server-rendered into the
 * `__NEXT_DATA__` JSON blob (`props.pageProps.products[]`) rather than into
 * CSS-classed cards. Parsing that JSON is far more stable than hashed module
 * classes, so the parser reads this script tag instead of using selectors.
 */
export const NEXT_DATA_SELECTOR = 'script#__NEXT_DATA__';

/**
 * `bookType` values that are NOT physical paper books. Catalog cards carry an
 * explicit `bookType`; anything matching these markers is skipped (mirrors the
 * Yakaboo paper-only policy — ISBN/price comparison is for physical books).
 */
export const NON_PAPER_BOOK_TYPE = /electron|ebook|e-book|digital|audio|mp3/i;

export function isPaperBookType(bookType: unknown): boolean {
  if (typeof bookType !== 'string' || bookType.trim() === '') return true;
  return !NON_PAPER_BOOK_TYPE.test(bookType);
}

/** Build an absolute product URL from a Vivat product `code` (slug). */
export function buildProductUrl(code: string): string {
  return `${VIVAT_BASE_URL}/product/${code}/`;
}

/**
 * Resolve a Vivat catalog `image` value to an absolute cover URL.
 *
 * The catalog JSON exposes images as site-relative paths (e.g. `/storage/a.jpg`);
 * absolute URLs and protocol-relative `//host/...` forms are passed through.
 * Returns null for missing/blank values — a missing cover must never break the
 * listing (W9a F1).
 */
export function buildCoverUrl(image: unknown): string | null {
  if (typeof image !== 'string') return null;
  const raw = image.trim();
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `${VIVAT_BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
}
