import * as cheerio from 'cheerio';
import type { RawProviderListing, Availability, Money } from '@knyhovo/shared';
import {
  YAKABOO_BASE_URL,
  SELECTORS,
  PRODUCT_DESCRIPTION_SELECTORS,
  PRODUCT_PRICE_SELECTORS,
  PRODUCT_STATUS_SELECTORS,
  OUT_OF_STOCK_KEYWORDS,
  IN_STOCK_KEYWORDS,
  PREORDER_KEYWORDS,
  detectFormat,
  stripBookPrefix,
} from './constants.js';
import type { ParsedProductState, CatalogPageResult } from '../types.js';
import { toMoney } from '../../lib/price.js';
import { errMsg } from '../../lib/errors.js';
import { extractCoverUrl, firstNonEmptyHtml, firstNonEmptyText, makeResolveUrl } from '../../lib/html-helpers.js';

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

const resolveUrl = makeResolveUrl(YAKABOO_BASE_URL);

/**
 * Parse a Yakaboo catalog HTML page into a list of raw provider listings.
 * Pure function — no IO, no side effects.
 *
 * ISBN is not available on catalog listing cards (only on individual book pages),
 * so all returned listings have isbn: null.
 */
export function parseYakabooPage(html: string): CatalogPageResult {
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
      const coverUrl = extractCoverUrl(coverImg.attr('src') ?? coverImg.attr('data-src'), resolveUrl);

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
        `Card ${rawCardCount}: unexpected error — ${errMsg(err)}`,
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
  return firstNonEmptyHtml(cheerio.load(html), PRODUCT_DESCRIPTION_SELECTORS);
}

/**
 * Parse price and availability from a Yakaboo *product* page (W10.4).
 * Pure function — no IO, no throwing.
 *
 * Selectors are representative and must be re-verified against live product
 * HTML before production use (same caveat as PRODUCT_DESCRIPTION_SELECTORS; W10.4).
 */
export function parseYakabooProduct(html: string): ParsedProductState {
  const $ = cheerio.load(html);

  const priceText = firstNonEmptyText($, PRODUCT_PRICE_SELECTORS);

  const priceKopecks = priceText ? parsePriceAsKopecks(priceText) : null;
  const price: Money | null = priceKopecks !== null ? toMoney(priceKopecks) : null;

  if (!price) return { price: null, availability: 'out-of-stock' };

  const statusText = firstNonEmptyText($, PRODUCT_STATUS_SELECTORS);

  const availability = resolveAvailability(statusText, true);
  return { price, availability };
}
