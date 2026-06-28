import * as cheerio from 'cheerio';
import type { RawProviderListing, Availability, Money } from '@knyhovo/shared';
import { normalizeIsbn } from '../../canonical/isbn.js';
import {
  JSON_LD_SELECTOR,
  CATALOG_PRODUCTS_SITEMAP_PATTERN,
  buildCoverUrl,
} from './constants.js';
import type { ParsedProductState } from '../single-product.js';

/** Result of parsing a single Knigoland product page into a raw listing. */
export interface ParseResult {
  /**
   * The parsed listing, or null when the page lacked a usable Product/Book block
   * OR when the page is not a paper book (a silent skip — see {@link parseKnigolandListing}).
   */
  readonly listing: RawProviderListing | null;
  readonly errors: string[];
}

/** Shape of a Knigoland JSON-LD `@type:Product` block (all fields untrusted). */
interface KnigolandProduct {
  readonly '@type'?: unknown;
  readonly name?: unknown;
  readonly image?: unknown;
  readonly sku?: unknown;
  readonly mpn?: unknown;
  readonly offers?: unknown;
}

/** Shape of a Knigoland JSON-LD `@type:Book` block (all fields untrusted). */
interface KnigolandBook {
  readonly '@type'?: unknown;
  readonly name?: unknown;
  readonly image?: unknown;
  readonly isbn?: unknown;
  readonly author?: unknown;
  readonly url?: unknown;
  readonly offers?: unknown;
}

interface KnigolandOffers {
  readonly url?: unknown;
  readonly price?: unknown;
  readonly priceCurrency?: unknown;
  readonly availability?: unknown;
}

/**
 * Convert a Knigoland price (a number like 200 or a numeric string "200") to a
 * Money amount in kopecks, or null when the value is not a usable price.
 *
 * Returns null for 0, negative, NaN, Infinity, null and undefined.
 */
export function knigolandPriceToKopecks(value: unknown): number | null {
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

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function asOffers(value: unknown): KnigolandOffers | null {
  return typeof value === 'object' && value !== null ? (value as KnigolandOffers) : null;
}

/**
 * Map a schema.org availability value (e.g. `https://schema.org/InStock`) to the
 * shared Availability enum. A missing price always wins → out-of-stock.
 */
function resolveAvailability(availability: unknown, hasPrice: boolean): Availability {
  if (!hasPrice) return 'out-of-stock';
  if (typeof availability !== 'string') return 'unknown';
  const suffix = availability.split('/').pop()?.toLowerCase().trim() ?? '';
  if (suffix === 'instock' || suffix === 'preorder') return 'in-stock';
  if (suffix === 'outofstock' || suffix === 'soldout' || suffix === 'discontinued') {
    return 'out-of-stock';
  }
  return 'unknown';
}

/** Join Knigoland's Book.author field (Person object / array / string) into one string. */
function resolveAuthor(author: unknown): string | null {
  if (typeof author === 'string') {
    return author.trim() !== '' ? author.trim() : null;
  }
  if (Array.isArray(author)) {
    const names = author
      .map((entry) => readName(entry))
      .filter((name): name is string => name !== null);
    return names.length > 0 ? names.join(', ') : null;
  }
  return readName(author);
}

function readName(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() !== '' ? value.trim() : null;
  if (typeof value === 'object' && value !== null) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim() !== '') return name.trim();
  }
  return null;
}

function matchesType(type: unknown, wanted: string): boolean {
  if (type === wanted) return true;
  if (Array.isArray(type)) return type.includes(wanted);
  return false;
}

/**
 * Find the first object with the given `@type` within a parsed JSON-LD value.
 * Handles single objects, arrays of objects and `@graph` containers.
 */
function findByType(parsed: unknown, wanted: string): Record<string, unknown> | null {
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      const found = findByType(entry, wanted);
      if (found) return found;
    }
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (matchesType(obj['@type'], wanted)) return obj;
  if (Array.isArray(obj['@graph'])) return findByType(obj['@graph'], wanted);
  return null;
}

/**
 * Read the `@type:Product` and `@type:Book` JSON-LD blocks from a Knigoland product
 * page. Pure — no IO. Malformed JSON in a block is recorded and skipped, never thrown.
 */
function readBlocks(html: string): {
  product: KnigolandProduct | null;
  book: KnigolandBook | null;
  errors: string[];
} {
  const errors: string[] = [];
  const $ = cheerio.load(html);
  const blocks = $(JSON_LD_SELECTOR).toArray();
  if (blocks.length === 0) {
    return { product: null, book: null, errors: ['no JSON-LD script found'] };
  }

  let product: KnigolandProduct | null = null;
  let book: KnigolandBook | null = null;

  for (const block of blocks) {
    const raw = $(block).contents().text().trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      errors.push(`malformed JSON-LD — ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (product === null) product = findByType(parsed, 'Product') as KnigolandProduct | null;
    if (book === null) book = findByType(parsed, 'Book') as KnigolandBook | null;
  }

  return { product, book, errors };
}

/**
 * Parse a Knigoland product page into a single raw provider listing by merging the
 * `@type:Product` block (price, availability, sku/mpn) with the `@type:Book` block
 * (isbn, author). Pure function — no IO, never throws.
 *
 * Paper-book filter (verified against the live catalog): a paper book is identified by
 * the presence of a `@type:Book` block. Non-books (gifts/stationery/toys) carry only a
 * `@type:Product` block and are skipped silently — `{ listing: null, errors: [] }` —
 * since a mixed catalog is expected, not an error. Breadcrumb root categories vary per
 * section (Книги, Комікси та манга, Навчальна література, …) so they are NOT used to
 * gate. A genuinely malformed/incomplete page yields `listing: null` with a message in
 * `errors`.
 */
export function parseKnigolandListing(html: string): ParseResult {
  const { product, book, errors } = readBlocks(html);
  if (product === null && book === null) {
    if (errors.length === 0) errors.push('no Product/Book JSON-LD found');
    return { listing: null, errors };
  }

  // Paper-book filter — a non-book (Product without a Book block) is skipped silently
  // (an expected outcome for a mixed catalog, not a scrape error).
  if (book === null) {
    return { listing: null, errors };
  }

  try {
    const offers = asOffers(product?.offers) ?? asOffers(book?.offers) ?? {};

    const title = readString(product?.name) ?? readString(book?.name) ?? '';
    if (!title) {
      errors.push('Product missing name, skipped');
      return { listing: null, errors };
    }

    const url = readString(offers.url) ?? readString(book?.url) ?? '';
    if (!url) {
      errors.push(`Product "${title}": missing url, skipped`);
      return { listing: null, errors };
    }

    const priceKopecks = knigolandPriceToKopecks(offers.price);
    const price: Money | null = priceKopecks !== null ? toMoney(priceKopecks) : null;

    // ISBN cascade: Book.isbn → Product.sku → Product.mpn. sku/mpn are numeric
    // catalogue codes, so the fallback is defensive (usually fails the checksum).
    const isbn =
      normalizeIsbn(readString(book?.isbn)) ??
      normalizeIsbn(readString(product?.sku)) ??
      normalizeIsbn(readString(product?.mpn));

    const listing: RawProviderListing = {
      provider: 'knigoland',
      title,
      author: resolveAuthor(book?.author),
      isbn,
      price,
      url,
      availability: resolveAvailability(offers.availability, price !== null),
      coverUrl: buildCoverUrl(product?.image ?? book?.image),
      description: null,
    };
    return { listing, errors };
  } catch (err) {
    errors.push(`unexpected error — ${err instanceof Error ? err.message : String(err)}`);
    return { listing: null, errors };
  }
}

/**
 * Parse price and availability from a Knigoland product page.
 * Pure function — no IO, never throws. Missing/unparseable data yields
 * `{ price: null, availability: 'unknown' }`; a present-but-priceless product
 * yields `{ price: null, availability: 'out-of-stock' }`.
 */
export function parseKnigolandProduct(html: string): ParsedProductState {
  const { product, book } = readBlocks(html);
  const offers = asOffers(product?.offers) ?? asOffers(book?.offers);
  if (offers === null) return { price: null, availability: 'unknown' };

  const priceKopecks = knigolandPriceToKopecks(offers.price);
  if (priceKopecks === null) return { price: null, availability: 'out-of-stock' };

  return {
    price: toMoney(priceKopecks),
    availability: resolveAvailability(offers.availability, true),
  };
}

/** Result of parsing a Knigoland sitemap index into product sub-sitemap URLs. */
export interface SitemapIndexResult {
  /** Product sub-sitemap URLs (`sections/catalog-products-N.xml`), deduped in document order. */
  readonly sitemapUrls: string[];
  readonly errors: string[];
}

/**
 * Parse a Knigoland sitemap index (`<urlset>` of `<loc>` sub-sitemap URLs) into the
 * product sub-sitemaps only (`sections/catalog-products-N.xml`). Pure function — no
 * IO, never throws. Empty/blank input, invalid XML or no matching sub-sitemaps yields
 * `sitemapUrls: []` and an error message.
 */
export function parseKnigolandSitemapIndex(xml: string): SitemapIndexResult {
  const trimmed = typeof xml === 'string' ? xml.trim() : '';
  if (!trimmed) {
    return { sitemapUrls: [], errors: ['empty sitemap index'] };
  }

  const $ = cheerio.load(trimmed, { xml: true });
  const sitemapUrls: string[] = [];
  const seen = new Set<string>();
  $('loc').each((_, el) => {
    const loc = $(el).text().trim();
    if (loc && CATALOG_PRODUCTS_SITEMAP_PATTERN.test(loc) && !seen.has(loc)) {
      seen.add(loc);
      sitemapUrls.push(loc);
    }
  });

  const errors =
    sitemapUrls.length === 0 ? ['no catalog-products sub-sitemaps found in index'] : [];
  return { sitemapUrls, errors };
}

/** Result of parsing a Knigoland product sub-sitemap into product-page URLs. */
export interface SitemapResult {
  /** Unique product-page URLs in document order. */
  readonly urls: string[];
  readonly errors: string[];
}

/**
 * Parse a Knigoland product sub-sitemap (`<urlset>` of `<loc>` product URLs) into a
 * deduplicated list of product-page URLs. Pure function — no IO, never throws.
 * Empty/blank input or a sitemap with no `<loc>` entries yields `urls: []` and an
 * error message.
 */
export function parseKnigolandSitemap(xml: string): SitemapResult {
  const trimmed = typeof xml === 'string' ? xml.trim() : '';
  if (!trimmed) {
    return { urls: [], errors: ['empty sitemap'] };
  }

  const $ = cheerio.load(trimmed, { xml: true });
  const urls: string[] = [];
  const seen = new Set<string>();
  $('loc').each((_, el) => {
    const loc = $(el).text().trim();
    if (loc && !seen.has(loc)) {
      seen.add(loc);
      urls.push(loc);
    }
  });

  const errors = urls.length === 0 ? ['no <loc> entries found in sitemap'] : [];
  return { urls, errors };
}
