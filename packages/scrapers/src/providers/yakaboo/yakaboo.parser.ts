import * as cheerio from 'cheerio';
import type { RawProviderListing, Availability, Money } from '@knyhovo/shared';
import {
  YAKABOO_BASE_URL,
  SELECTORS,
  PRODUCT_DESCRIPTION_SELECTORS,
  OUT_OF_STOCK_KEYWORDS,
  IN_STOCK_KEYWORDS,
  PREORDER_KEYWORDS,
  detectFormat,
  stripBookPrefix,
} from './constants.js';

export interface ParseResult {
  readonly listings: RawProviderListing[];
  readonly errors: string[];
  /** True when the page contained at least one card element (paginator should fetch next page). */
  readonly hasNextPage: boolean;
}

/**
 * Convert a Yakaboo price string (e.g. "620 грн", "2 450 грн", "199,50 грн")
 * to a Money value in kopecks, or null when the string is not a valid price.
 */
export function parsePriceAsKopecks(text: string): number | null {
  const cleaned = text
    .replace(/\s/g, '')
    .replace(/грн/gi, '')
    .replace(/,/g, '.');
  const value = parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

function toMoney(kopecks: number): Money {
  return { amount: kopecks, currency: 'UAH' };
}

function resolveAvailability(
  statusText: string,
  hasPrice: boolean,
): Availability {
  if (!hasPrice) return 'out-of-stock';
  const lower = statusText.toLowerCase().trim();
  if (!lower) return 'in-stock';
  if (OUT_OF_STOCK_KEYWORDS.some((kw) => lower.includes(kw))) return 'out-of-stock';
  if (PREORDER_KEYWORDS.some((kw) => lower.includes(kw))) return 'in-stock';
  if (IN_STOCK_KEYWORDS.some((kw) => lower.includes(kw))) return 'in-stock';
  if (lower.includes('доставка') || lower.includes('доставки')) return 'in-stock';
  return 'unknown';
}

function resolveUrl(href: string): string {
  if (href.startsWith('http')) return href;
  return `${YAKABOO_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
}

/**
 * Resolve a cover image URL from a catalog card's <img>.
 *
 * Reads `src`, falling back to the common lazy-load `data-src` attribute, then
 * normalises it to an absolute URL. Returns null when the card has no usable
 * image — a missing cover must never break the listing (W9a F1).
 */
function extractCoverUrl(src: string | undefined): string | null {
  const raw = src?.trim();
  if (!raw) return null;
  if (raw.startsWith('//')) return `https:${raw}`;
  return resolveUrl(raw);
}

/**
 * Parse a Yakaboo catalog HTML page into a list of raw provider listings.
 * Pure function — no IO, no side effects.
 *
 * ISBN is not available on catalog listing cards (only on individual book pages),
 * so all returned listings have isbn: null.
 */
export function parseYakabooPage(html: string): ParseResult {
  const $ = cheerio.load(html);
  const listings: RawProviderListing[] = [];
  const errors: string[] = [];
  let rawCardCount = 0;

  $(SELECTORS.card).each((_i, el) => {
    rawCardCount++;
    try {
      const card = $(el);

      const href = card.find(SELECTORS.cardLink).attr('href');
      if (!href) {
        errors.push(`Card ${rawCardCount}: missing href, skipped`);
        return;
      }

      const rawTitle = card.find(SELECTORS.title).text().trim();
      if (!rawTitle) {
        errors.push(`Card at ${href}: missing title, skipped`);
        return;
      }
      const title = stripBookPrefix(rawTitle);

      const formatLabel = card.find(SELECTORS.formatLabel).text().trim();
      const format = detectFormat(title, formatLabel);
      if (format === 'ebook' || format === 'audio') return;

      const authorText =
        card.find(SELECTORS.author).first().text().trim() ||
        card.find(SELECTORS.authorsMultiple).first().text().trim() ||
        null;
      const author = authorText !== '' ? authorText : null;

      const priceText = card.find(SELECTORS.price).first().text().trim();
      const priceKopecks = parsePriceAsKopecks(priceText);

      if (priceText !== '' && priceKopecks === null) {
        errors.push(`Card at ${href}: unparseable price "${priceText}"`);
      }

      const price: Money | null =
        priceKopecks !== null ? toMoney(priceKopecks) : null;

      const statusText = card.find(SELECTORS.statusText).first().text().trim();
      const availability = resolveAvailability(statusText, price !== null);

      const coverImg = card.find(SELECTORS.cover).first();
      const coverUrl = extractCoverUrl(coverImg.attr('src') ?? coverImg.attr('data-src'));

      listings.push({
        provider: 'yakaboo',
        title,
        author,
        isbn: null,
        price,
        url: resolveUrl(href),
        availability,
        coverUrl,
      });
    } catch (err) {
      errors.push(
        `Card ${rawCardCount}: unexpected error — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  return { listings, errors, hasNextPage: rawCardCount > 0 };
}

/**
 * Extract the raw description HTML from a Yakaboo *product* page (W9a F2).
 * Pure function — no IO. Tries each candidate container in order and returns the
 * first non-empty inner HTML, or null when none is present. Sanitization to
 * plain text happens at the enrichment boundary (sanitizeDescription).
 */
export function extractYakabooProductDescription(html: string): string | null {
  const $ = cheerio.load(html);
  for (const selector of PRODUCT_DESCRIPTION_SELECTORS) {
    const inner = $(selector).first().html();
    if (inner != null && inner.trim() !== '') return inner;
  }
  return null;
}
