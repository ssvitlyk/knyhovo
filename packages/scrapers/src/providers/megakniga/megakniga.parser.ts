import * as cheerio from 'cheerio';
import type { RawProviderListing, Availability, Money } from '@knyhovo/shared';
import { normalizeIsbn } from '../../canonical/isbn.js';
import { finalizeRawCategories } from '../../lib/extract-breadcrumbs.js';
import {
  CARD_SELECTOR,
  TITLE_SELECTOR,
  AUTHOR_SELECTOR,
  AVAILABILITY_SELECTOR,
  PRICE_FORM_SELECTOR,
  PRICE_TEXT_SELECTOR,
  IN_STOCK_CLASS_MARKER,
  IN_STOCK_TEXT_MARKER,
  OUT_OF_STOCK_TEXT_MARKER,
  PAPER_BOOK_MARKER,
  buildCoverUrl,
  resolveUrl,
} from './constants.js';
import type { ParsedProductState } from '../single-product.js';
import type { ExtractedListingMetadata, ExtractedProductDetails } from '../../lib/enrich-product-details.js';

export interface ParseResult {
  readonly listings: RawProviderListing[];
  readonly errors: string[];
  /** True when the page contained at least one card element (paginator should fetch next page). */
  readonly hasNextPage: boolean;
}

/**
 * Convert a Megakniga price (e.g. `"432.10"` from a `data-price` attribute or a
 * `.price` element's text, or a plain number) to a Money amount in kopecks, or
 * null when the value is not a usable price.
 *
 * Returns null for 0, negative, NaN, Infinity, null and undefined.
 */
export function megaknigaPriceToKopecks(value: unknown): number | null {
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : NaN;
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

function toMoney(kopecks: number): Money {
  return { amount: kopecks, currency: 'UAH' };
}

/**
 * Map a Megakniga catalog card's availability container (class + text) to the
 * shared Availability enum (PRD §4). A missing price always wins → out-of-stock
 * (shared invariant, guide §2.6), checked before any text/class marker.
 */
function resolveCardAvailability(
  classAttr: string,
  text: string,
  hasPrice: boolean,
): Availability {
  if (!hasPrice) return 'out-of-stock';
  if (classAttr.includes(IN_STOCK_CLASS_MARKER) || text.includes(IN_STOCK_TEXT_MARKER)) {
    return 'in-stock';
  }
  if (text.includes(OUT_OF_STOCK_TEXT_MARKER)) return 'out-of-stock';
  return 'unknown';
}

/**
 * Map a schema.org microdata availability value (e.g.
 * `http://schema.org/OutOfStock`) to the shared Availability enum. Used only for
 * the product-page microdata (parseMegaknigaProduct) — the catalog card uses its
 * own text/class markers (see {@link resolveCardAvailability}).
 */
function resolveMicrodataAvailability(availability: unknown, hasPrice: boolean): Availability {
  if (!hasPrice) return 'out-of-stock';
  if (typeof availability !== 'string') return 'unknown';
  const suffix = availability.split('/').pop()?.toLowerCase().trim() ?? '';
  if (suffix === 'instock' || suffix === 'preorder') return 'in-stock';
  if (suffix === 'outofstock' || suffix === 'soldout' || suffix === 'discontinued') {
    return 'out-of-stock';
  }
  return 'unknown';
}

/**
 * Parse a Megakniga catalog listing HTML page into raw provider listings.
 * Pure function — no IO, no side effects.
 *
 * ISBN is not present on catalog cards (only on individual product pages), so
 * all returned listings have isbn: null (PRD §4) — filled in later by the
 * opt-in enrichment pass ({@link extractMegaknigaProductDetails}).
 */
export function parseMegaknigaListing(html: string): ParseResult {
  const $ = cheerio.load(html);
  const listings: RawProviderListing[] = [];
  const errors: string[] = [];
  let rawCardCount = 0;

  $(CARD_SELECTOR).each((_i, el) => {
    rawCardCount++;
    try {
      const card = $(el);

      const titleEl = card.find(TITLE_SELECTOR).first();
      const href = titleEl.attr('href');
      if (!href) {
        errors.push(`Card ${rawCardCount}: missing url, skipped`);
        return;
      }

      const title = titleEl.text().trim();
      if (!title) {
        errors.push(`Card at ${href}: missing title, skipped`);
        return;
      }

      const authorText = card.find(AUTHOR_SELECTOR).first().text().trim();
      const author = authorText !== '' ? authorText : null;

      // Price cascade: the buy-form's `data-price` attribute (reliable, always the
      // current retail price — PRD §2) → the visible `.price` text, excluding
      // `.price-old` (the pre-discount price must never win).
      const formPrice = card.find(PRICE_FORM_SELECTOR).first().attr('data-price');
      const priceKopecks =
        megaknigaPriceToKopecks(formPrice) ??
        megaknigaPriceToKopecks(card.find(PRICE_TEXT_SELECTOR).first().text().trim());
      const price: Money | null = priceKopecks !== null ? toMoney(priceKopecks) : null;

      const availabilityEl = card.find(AVAILABILITY_SELECTOR).first();
      const availability = resolveCardAvailability(
        availabilityEl.attr('class') ?? '',
        availabilityEl.text(),
        price !== null,
      );

      const img = card.find('img').first();
      const coverUrl = buildCoverUrl(img.attr('data-src') ?? img.attr('data-original'));

      listings.push({
        provider: 'megakniga',
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
 * Parse price and availability from a Megakniga product page's schema.org
 * *microdata* (not JSON-LD — Megakniga carries no Product JSON-LD, recon §3).
 * Pure function — no IO, never throws. Missing/unparseable data yields
 * `{ price: null, availability: 'unknown' }`; a present-but-priceless product
 * yields `{ price: null, availability: 'out-of-stock' }`.
 */
export function parseMegaknigaProduct(html: string): ParsedProductState {
  const $ = cheerio.load(html);

  const priceContent = $('meta[itemprop="price"]').first().attr('content');
  const priceKopecks = megaknigaPriceToKopecks(priceContent);
  if (priceKopecks === null) {
    // No usable microdata price at all (missing meta tag) is indistinguishable
    // here from an explicit zero/invalid price; both yield 'unknown' unless the
    // page has no price markup whatsoever, in which case there is nothing to
    // report either way.
    if (priceContent == null) return { price: null, availability: 'unknown' };
    return { price: null, availability: 'out-of-stock' };
  }

  const availabilityHref = $('link[itemprop="availability"]').first().attr('href');
  return {
    price: toMoney(priceKopecks),
    availability: resolveMicrodataAvailability(availabilityHref, true),
  };
}

/** Read a `<meta itemprop="...">` tag's `content` attribute, or null when absent/blank. */
function readMetaContent($: cheerio.CheerioAPI, itemprop: string): string | null {
  const content = $(`meta[itemprop="${itemprop}"]`).first().attr('content');
  return content != null && content.trim() !== '' ? content.trim() : null;
}

/**
 * Fallback ISBN/product-code source: the visible `<p class="card-product-code">
 * <span class="bold-text">Код товару / ISBN:</span>9789662909944</p>` block.
 * Strips the label span and returns the trailing text. May yield a plain
 * product code rather than an ISBN — the caller normalizes/validates via
 * `normalizeIsbn`, which rejects non-ISBN-shaped values gracefully.
 */
function readCardProductCode($: cheerio.CheerioAPI): string | null {
  const el = $('.card-product-code').first();
  if (el.length === 0) return null;
  const clone = el.clone();
  clone.find('span').remove();
  const text = clone.text().trim();
  return text !== '' ? text : null;
}

/**
 * Read the value next to an `.authors-block` text label (e.g. `Виробник:`) —
 * `<span class="bold-text">{label}</span>` followed by an `<a>` whose text is
 * the value. Returns the first match in document order, or null when the
 * label/value is absent. Deliberately scoped to `.authors-block` (shared with
 * the "Автор:" block) rather than a generic label scan, since the DOM offers no
 * more specific hook for "Виробник:" (recon §3).
 */
function readAuthorsBlockValue($: cheerio.CheerioAPI, label: string): string | null {
  let value: string | null = null;
  $('.authors-block').each((_, el) => {
    if (value !== null) return;
    const labelText = $(el).find('span.bold-text').first().text().trim();
    if (labelText !== label) return;
    const text = $(el).find('a').first().text().trim();
    if (text !== '') value = text;
  });
  return value;
}

/**
 * Read the cover format ("Обкладинка: Тверда/М'яка") from a `<p class="mb-0">
 * <span class="bold-text"> Обкладинка: </span>Тверда</p>` block. Strips the
 * label span and returns the trailing text, or null when the label is absent.
 */
function readCoverFormat($: cheerio.CheerioAPI): string | null {
  let value: string | null = null;
  $('p.mb-0').each((_, el) => {
    if (value !== null) return;
    const labelText = $(el).find('span.bold-text').first().text().trim();
    if (labelText !== 'Обкладинка:') return;
    const clone = $(el).clone();
    clone.find('span').remove();
    const text = clone.text().trim();
    if (text !== '') value = text;
  });
  return value;
}

/**
 * Read the raw (possibly HTML) description from the "Опис товару" block —
 * the `.wrapper.read-more` div immediately following the
 * `.product-description-title` heading. Sanitized to plain text by the shared
 * enrichment pass ({@link sanitizeDescription}), not here.
 */
function readDescriptionHtml($: cheerio.CheerioAPI): string | null {
  const title = $('.product-description-title').first();
  if (title.length === 0) return null;
  const wrapper = title.next();
  if (wrapper.length === 0) return null;
  const inner = wrapper.html();
  return inner != null && inner.trim() !== '' ? inner : null;
}

/**
 * Extract raw category names (root→leaf) from the semantic breadcrumb block
 * (`ul.breadcrumb li`), excluding the "Головна" and "Каталог" crumbs (PRD §4).
 * Category crumbs are links; the trailing crumb (`li.active`, no `<a>`) is the
 * product itself, not a category — dropped so the book's own title never leaks
 * into `rawCategories` (it would be noise for the genre mapping engine).
 */
function extractMegaknigaCategories($: cheerio.CheerioAPI): string[] {
  const names: string[] = [];
  $('ul.breadcrumb li').each((_, el) => {
    const li = $(el);
    if (li.find('a').length === 0) return;
    // Each crumb's text also includes a trailing `<span class="separator">/</span>`
    // — strip it before reading the name.
    const clone = li.clone();
    clone.find('.separator').remove();
    const text = clone.text().trim();
    if (text !== '' && text !== 'Головна' && text !== 'Каталог') names.push(text);
  });
  return finalizeRawCategories(names);
}

/** True when the product page carries the "Паперова книга" type marker (PRD §2.3). */
function isPaperBookPage($: cheerio.CheerioAPI): boolean {
  let found = false;
  $('p').each((_, el) => {
    if (found) return;
    if ($(el).text().trim() === PAPER_BOOK_MARKER) found = true;
  });
  return found;
}

/**
 * Extract description + edition metadata + raw categories from a Megakniga
 * *product* page (opt-in enrichment pass, PRD §2.3/§4). Pure function — no IO,
 * never throws.
 *
 * A product page without the "Паперова книга" marker is not a book (PRD §2.3)
 * — its metadata must not be applied to the listing, so this returns
 * `{ description: null, metadata: null }` (rawCategories omitted) and the
 * shared enrichment pass leaves the listing unchanged.
 *
 * All microdata/text is untrusted (laboratory/knigoland pattern) — every field
 * is validated before use; a missing/malformed source yields null for that
 * field only, never a thrown error.
 */
export function extractMegaknigaProductDetails(html: string): ExtractedProductDetails {
  const $ = cheerio.load(html);

  if (!isPaperBookPage($)) return { description: null, metadata: null };

  // ISBN cascade: microdata `mpn` → microdata `identifier` → visible "Код товару
  // / ISBN:" text (PRD §4). All three are validated by normalizeIsbn, which
  // rejects non-ISBN-shaped values (e.g. a plain product code) gracefully.
  const isbn =
    normalizeIsbn(readMetaContent($, 'mpn')) ??
    normalizeIsbn(readMetaContent($, 'identifier')) ??
    normalizeIsbn(readCardProductCode($));

  const metadata: ExtractedListingMetadata = {
    isbn,
    publisher: readAuthorsBlockValue($, 'Виробник:'),
    format: readCoverFormat($),
    language: null,
    series: null,
    publicationYear: null,
  };

  return {
    description: readDescriptionHtml($),
    metadata,
    rawCategories: extractMegaknigaCategories($),
  };
}
