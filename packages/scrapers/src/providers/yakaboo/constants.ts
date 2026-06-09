export const YAKABOO_BASE_URL = 'https://www.yakaboo.ua';
export const YAKABOO_CATALOG_URL = `${YAKABOO_BASE_URL}/ua/books.html`;

/** CSS selectors for the catalog listing page. Verified against live Yakaboo HTML. */
export const SELECTORS = {
  card: 'div.category-card.category-layout',
  cardLink: 'a.category-card__image',
  title: 'a.ui-card-title.category-card__name',
  author: '.ui-card-author .creator-label',
  authorsMultiple: '.ui-card-author .creators-label',
  price: '.product-price',
  statusText: '.ui-shipment-status__text',
  formatLabel: '.ui-display-book-type__text, .ui-display-book-type, .card-label, .product-type-label, .book-format-label',
} as const;

export const OUT_OF_STOCK_KEYWORDS = ['нет в наличии', 'немає в наявності'];
export const IN_STOCK_KEYWORDS = ['в наличии', 'в наявності'];
export const PREORDER_KEYWORDS = ['передзамовити', 'передзамовлення', 'preorder', 'pre-order'];
export const COMING_SOON_KEYWORDS = ['очікується', 'незабаром'];

const NON_PHYSICAL_TITLE_MARKERS = [
  'електронна книга', 'електронна версія',
  'аудіокнига', 'аудіо книга',
  'ebook', 'e-book', 'audiobook', 'audio book',
  'epub', 'pdf', 'fb2', 'mobi', 'mp3',
];

const AUDIO_MARKER = /аудіо|аудио|audio|mp3/i;

export function isNonPhysical(title: string, formatLabel: string): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerLabel = formatLabel.toLowerCase();

  if (
    lowerLabel &&
    !lowerLabel.includes('паперов') &&
    !lowerLabel.includes('paper') &&
    !lowerLabel.includes('тверд') &&
    !lowerLabel.includes("м'як") &&
    !lowerLabel.includes('друкован')
  ) {
    if (
      lowerLabel.includes('електронн') ||
      lowerLabel.includes('электронн') ||
      lowerLabel.includes('аудіо') ||
      lowerLabel.includes('аудио') ||
      lowerLabel.includes('ebook') ||
      lowerLabel.includes('e-book') ||
      lowerLabel.includes('audio')
    ) {
      return true;
    }
  }

  return NON_PHYSICAL_TITLE_MARKERS.some((kw) => lowerTitle.includes(kw));
}

export function detectFormat(title: string, formatLabel: string): 'paper' | 'ebook' | 'audio' | 'unknown' {
  if (isNonPhysical(title, formatLabel)) {
    return AUDIO_MARKER.test(`${title} ${formatLabel}`) ? 'audio' : 'ebook';
  }
  const lowerLabel = formatLabel.toLowerCase();
  if (
    lowerLabel.includes('паперов') ||
    lowerLabel.includes('paper') ||
    lowerLabel.includes('тверд') ||
    lowerLabel.includes("м'як")
  ) {
    return 'paper';
  }
  return 'unknown';
}

/**
 * Yakaboo sometimes prepends "Книга " to product titles as a category label.
 * Strip it when redundant (multi-word remainder, not starting with digit or Roman numeral).
 */
export function stripBookPrefix(title: string): string {
  const match = /^книга\s+(.+)$/iu.exec(title);
  if (!match) return title;
  const rest = match[1]!;
  if (/^\d|^[IVXLCDM]+[\s,.]/iu.test(rest)) return title;
  if (!rest.includes(' ')) return title;
  return rest;
}
