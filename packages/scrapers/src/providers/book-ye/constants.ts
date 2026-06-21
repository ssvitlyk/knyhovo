export const BOOK_YE_BASE_URL = 'https://book-ye.com.ua';
/** Main books catalog. Pagination is Magento-style `?p=N`; ~20 products per page. */
export const BOOK_YE_CATALOG_URL = `${BOOK_YE_BASE_URL}/catalog/`;

/**
 * Книгарня «Є» sits behind a Cloudflare non-interactive JS Managed Challenge.
 * Headless Chromium solves it on its own, but it takes a few seconds — networkidle
 * fires on the lightweight challenge page too early. The PlaywrightHtmlFetcher is
 * told to wait for this selector (a real product link) so the challenge has time to
 * solve and redirect to the actual catalog before the HTML is read.
 */
export const PRODUCT_CARD_SELECTOR = 'a.product-item-link';

/**
 * CSS selectors for the Magento catalog listing page.
 * Verified against live Книгарня «Є» HTML (catalog grid cards).
 */
export const SELECTORS = {
  card: 'li.product-item',
  /** Title + product URL. The full title is on the link text and its `title` attr. */
  cardLink: 'a.product-item-link',
  /** Author block. `.formatted-authors.publishers` holds the publisher, so the
   *  author is the `.formatted-authors` that is NOT also `.publishers`. */
  author: '.formatted-authors:not(.publishers)',
  /** Magento renders the current selling price with data-price-type="finalPrice". */
  finalPrice: '[data-price-type="finalPrice"]',
  /** Preorder indicator present on the card. */
  preorder: '.pre-order',
  /** Magento renders the cover thumbnail as `img.product-image-photo`. */
  cover: 'img.product-image-photo',
} as const;

/**
 * Candidate containers for the description on a Книгарня «Є» *product* page
 * (W9a F2), tried in order; the first non-empty match wins. Standard Magento
 * description blocks. Representative selectors — must be re-verified against live
 * product HTML before description enrichment is enabled (opt-in, off by default).
 */
export const PRODUCT_DESCRIPTION_SELECTORS = [
  '.product.attribute.description .value',
  '#description .value',
  '[itemprop="description"]',
] as const;

export const OUT_OF_STOCK_KEYWORDS = [
  'немає в наявності',
  'нет в наличии',
  'закінчився',
  'розпродано',
  'немає в наяв',
];
export const PREORDER_KEYWORDS = ['передзамов', 'preorder', 'pre-order'];

/**
 * Title markers for non-paper editions. Книгарня «Є» is overwhelmingly paper, but
 * guard against the occasional electronic/audio entry (mirrors the Yakaboo/Vivat
 * paper-only policy — ISBN/price comparison is for physical books).
 */
const NON_PHYSICAL_TITLE_MARKERS = [
  'електронна книга',
  'електронна версія',
  'електронне видання',
  'аудіокнига',
  'аудіо книга',
  'ebook',
  'e-book',
  'audiobook',
  'mp3',
];

export function isNonPhysicalTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return NON_PHYSICAL_TITLE_MARKERS.some((kw) => lower.includes(kw));
}

/** Resolve a possibly-relative href to an absolute Книгарня «Є» URL. */
export function resolveUrl(href: string): string {
  if (href.startsWith('http')) return href;
  return `${BOOK_YE_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
}
