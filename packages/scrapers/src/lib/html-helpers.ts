import type * as cheerio from 'cheerio';

/** Inner HTML of the first selector (in order) whose first match has non-blank content, else null. */
export function firstNonEmptyHtml($: cheerio.CheerioAPI, selectors: readonly string[]): string | null {
  for (const selector of selectors) {
    const inner = $(selector).first().html();
    if (inner != null && inner.trim() !== '') return inner;
  }
  return null;
}

/** Trimmed text of the first selector (in order) whose first match is non-blank, else ''. */
export function firstNonEmptyText($: cheerio.CheerioAPI, selectors: readonly string[]): string {
  for (const selector of selectors) {
    const text = $(selector).first().text().trim();
    if (text) return text;
  }
  return '';
}

/** Build a resolver turning a catalog-card or product href into an absolute URL under `baseUrl`. */
export function makeResolveUrl(baseUrl: string): (href: string) => string {
  return (href) => {
    if (href.startsWith('http')) return href;
    return `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
  };
}

/**
 * Resolve a cover image URL from a catalog card's <img> `src` (callers fall back
 * to the lazy-load `data-src` first), normalising it to an absolute URL. Returns
 * null when the card has no usable image — a missing cover must never break the
 * listing (W9a F1).
 */
export function extractCoverUrl(
  src: string | undefined,
  resolveUrl: (href: string) => string,
): string | null {
  const raw = src?.trim();
  if (!raw) return null;
  if (raw.startsWith('//')) return `https:${raw}`;
  return resolveUrl(raw);
}
