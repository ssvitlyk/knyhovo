import * as cheerio from 'cheerio';
import type { RawProviderListing, Availability, Money } from '@knyhovo/shared';
import {
  SELECTORS,
  OUT_OF_STOCK_KEYWORDS,
  PREORDER_KEYWORDS,
  isNonPhysicalTitle,
  resolveUrl,
} from './constants.js';

/**
 * Resolve a cover image URL from a catalog card's <img>.
 *
 * Reads `src`, falling back to the common Magento lazy-load `data-src`, then
 * normalises to an absolute URL. Returns null when the card has no usable
 * image — a missing cover must never break the listing (W9a F1).
 */
function extractCoverUrl(src: string | undefined): string | null {
  const raw = src?.trim();
  if (!raw) return null;
  if (raw.startsWith('//')) return `https:${raw}`;
  return resolveUrl(raw);
}

export interface ParseResult {
  readonly listings: RawProviderListing[];
  readonly errors: string[];
  /** True when the page contained at least one card element (paginator should fetch next page). */
  readonly hasNextPage: boolean;
}

/**
 * Convert a Magento `data-price-amount` value (whole hryvnias, e.g. "550" or
 * "550.5") to a Money amount in kopecks, or null when it is not a usable price.
 */
export function bookYePriceToKopecks(value: string | undefined): number | null {
  if (value === undefined) return null;
  const amount = parseFloat(value.trim());
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function toMoney(kopecks: number): Money {
  return { amount: kopecks, currency: 'UAH' };
}

/**
 * Map card text + price presence to the shared Availability enum.
 * A missing price means out-of-stock; preorder mirrors the Yakaboo/Vivat
 * preorder → in-stock policy; an explicit out-of-stock marker wins.
 */
function resolveAvailability(
  cardText: string,
  hasPreorder: boolean,
  hasPrice: boolean,
): Availability {
  if (!hasPrice) return 'out-of-stock';
  const lower = cardText.toLowerCase();
  if (OUT_OF_STOCK_KEYWORDS.some((kw) => lower.includes(kw))) return 'out-of-stock';
  if (hasPreorder || PREORDER_KEYWORDS.some((kw) => lower.includes(kw))) return 'in-stock';
  return 'in-stock';
}

/**
 * Parse a Книгарня «Є» catalog HTML page into raw provider listings.
 * Pure function — no IO, no side effects.
 *
 * ISBN is not present on catalog cards (only on individual product pages), so
 * all returned listings have isbn: null — same as Yakaboo and Vivat.
 */
export function parseBookYePage(html: string): ParseResult {
  const $ = cheerio.load(html);
  const listings: RawProviderListing[] = [];
  const errors: string[] = [];
  let rawCardCount = 0;

  $(SELECTORS.card).each((_i, el) => {
    rawCardCount++;
    try {
      const card = $(el);
      const link = card.find(SELECTORS.cardLink).first();

      const href = link.attr('href');
      if (!href) {
        errors.push(`Card ${rawCardCount}: missing href, skipped`);
        return;
      }

      const title = (link.attr('title')?.trim() || link.text().trim());
      if (!title) {
        errors.push(`Card at ${href}: missing title, skipped`);
        return;
      }

      if (isNonPhysicalTitle(title)) return;

      const authorText = card.find(SELECTORS.author).first().text().trim();
      const author = authorText !== '' ? authorText : null;

      const priceAttr = card.find(SELECTORS.finalPrice).first().attr('data-price-amount');
      const priceKopecks = bookYePriceToKopecks(priceAttr);
      // A present-but-non-numeric attribute is a real parse failure; a missing,
      // zero, or negative value is simply "no price" (treated as out-of-stock).
      if (priceAttr !== undefined && priceAttr.trim() !== '' && !Number.isFinite(parseFloat(priceAttr))) {
        errors.push(`Card at ${href}: unparseable price "${priceAttr}"`);
      }
      const price: Money | null = priceKopecks !== null ? toMoney(priceKopecks) : null;

      const hasPreorder = card.find(SELECTORS.preorder).length > 0;
      const availability = resolveAvailability(card.text(), hasPreorder, price !== null);

      const coverImg = card.find(SELECTORS.cover).first();
      const coverUrl = extractCoverUrl(coverImg.attr('src') ?? coverImg.attr('data-src'));

      listings.push({
        provider: 'book-ye',
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
