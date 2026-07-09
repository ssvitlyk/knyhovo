import * as cheerio from 'cheerio';
import type { RawProviderListing, Availability, Money } from '@knyhovo/shared';
import { normalizeIsbn } from '../../canonical/isbn.js';
import { sanitizeDescription } from '../../lib/sanitize-description.js';
import {
  JSON_LD_SELECTOR,
  CATALOG_PRODUCTS_SITEMAP_PATTERN,
  buildCoverUrl,
} from './constants.js';
import type { ParsedProductState } from '../single-product.js';

/** Result of parsing a single Knigoland product page into a raw listing. */
export interface ParseResult {
  /**
   * The parsed listing, or null when the page lacked a usable Product block OR
   * when the page is not a paper book (a silent skip — see {@link parseKnigolandListing}).
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
  readonly description?: unknown;
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

/**
 * Read the value next to a "Характеристики" spec-table label (e.g. `ISBN`) —
 * `<span class="whitespace-nowrap">{label}</span>` followed by a dashed-line div,
 * with the value living in the label's parent's next sibling. Returns the first
 * match in document order, or null when the label/value is absent.
 */
function readSpecValue($: cheerio.CheerioAPI, label: string): string | null {
  let value: string | null = null;
  $('span.whitespace-nowrap').each((_, el) => {
    if (value !== null) return;
    if ($(el).text().trim() !== label) return;
    const text = $(el).parent().next().text().trim();
    if (text !== '') value = text;
  });
  return value;
}

/**
 * Read the author from `<meta name="description">` (`"Купити книгу {title} автора
 * {author} арт: {sku} …"`). Deliberately NOT read from the visible "Автори:"
 * spec-table link(s): that section sometimes lists the same person twice under
 * two transliteration variants (e.g. "Курт Воннегут" and "Курт Воннеґут" — a
 * site data-quality quirk, verified against the live catalog), while the meta
 * description always carries one clean canonical name. Non-book pages ("Придбати
 * «…»") never match and yield null.
 */
function readAuthorFromMetaDescription($: cheerio.CheerioAPI): string | null {
  const content = $('meta[name="description"]').attr('content') ?? '';
  const match = /автора\s+(.+?)\s+арт:/u.exec(content);
  if (!match) return null;
  const author = match[1]!.replace(/\s+/g, ' ').trim();
  return author !== '' ? author : null;
}

/**
 * Whether a spec-table ISBN value is a real Bookland EAN-13 (`978`/`979` prefix).
 * Knigoland's ISBN spec row also carries plain product barcodes for non-books
 * (e.g. toys), which pass the same checksum as a real ISBN-13 — the Bookland
 * prefix is the only reliable discriminator once the prefix-agnostic checksum
 * alone would accept both.
 */
function isBooklandIsbn13(raw: string): boolean {
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length === 13 && (digits.startsWith('978') || digits.startsWith('979'));
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
 * Read the `@type:Product` JSON-LD block from a Knigoland product page, plus a
 * loaded cheerio document for reading spec-table fields (ISBN, authors) that
 * Knigoland no longer exposes as JSON-LD. Pure — no IO. Malformed JSON in a
 * block is recorded and skipped, never thrown.
 */
function readBlocks(html: string): {
  $: cheerio.CheerioAPI;
  product: KnigolandProduct | null;
  errors: string[];
} {
  const errors: string[] = [];
  const $ = cheerio.load(html);
  const blocks = $(JSON_LD_SELECTOR).toArray();
  if (blocks.length === 0) {
    return { $, product: null, errors: ['no JSON-LD script found'] };
  }

  let product: KnigolandProduct | null = null;

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
  }

  return { $, product, errors };
}

/**
 * Parse a Knigoland product page into a single raw provider listing from the
 * `@type:Product` JSON-LD block (price, availability, sku/mpn, image) merged with
 * the visible spec table (ISBN, authors) — Knigoland dropped the `@type:Book`
 * JSON-LD block from every product page (site migration, verified against the
 * live catalog); isbn/author are no longer available as structured data.
 *
 * Paper-book filter: a paper book is identified by a spec-table ISBN in the
 * Bookland range (`978`/`979` prefix). Non-books (gifts/stationery/toys) carry a
 * plain EAN-13 barcode in the same spec row, which passes the same checksum as a
 * real ISBN — the Bookland prefix is what distinguishes them. Non-books are
 * skipped silently — `{ listing: null, errors: [] }` — since a mixed catalog is
 * expected, not an error. A genuinely malformed/incomplete page yields
 * `listing: null` with a message in `errors`.
 */
export function parseKnigolandListing(html: string): ParseResult {
  const { $, product, errors } = readBlocks(html);
  if (product === null) {
    if (errors.length === 0) errors.push('no Product JSON-LD found');
    return { listing: null, errors };
  }

  const specIsbn = readSpecValue($, 'ISBN');

  // Paper-book filter — a non-book (no Bookland-prefixed ISBN) is skipped silently
  // (an expected outcome for a mixed catalog, not a scrape error).
  if (specIsbn === null || !isBooklandIsbn13(specIsbn)) {
    return { listing: null, errors };
  }

  try {
    const offers = asOffers(product.offers) ?? {};

    const title = readString(product.name) ?? '';
    if (!title) {
      errors.push('Product missing name, skipped');
      return { listing: null, errors };
    }

    const url = readString(offers.url) ?? '';
    if (!url) {
      errors.push(`Product "${title}": missing url, skipped`);
      return { listing: null, errors };
    }

    const priceKopecks = knigolandPriceToKopecks(offers.price);
    const price: Money | null = priceKopecks !== null ? toMoney(priceKopecks) : null;

    // ISBN cascade: spec-table ISBN → Product.sku → Product.mpn. sku/mpn are
    // numeric catalogue codes, so the fallback is defensive (usually fails the
    // checksum); the spec-table value already passed the Bookland gate above.
    const isbn =
      normalizeIsbn(specIsbn) ??
      normalizeIsbn(readString(product.sku)) ??
      normalizeIsbn(readString(product.mpn));

    const listing: RawProviderListing = {
      provider: 'knigoland',
      title,
      author: readAuthorFromMetaDescription($),
      isbn,
      price,
      url,
      availability: resolveAvailability(offers.availability, price !== null),
      coverUrl: buildCoverUrl(product.image),
      // Always-on extraction (not gated by the opt-in enrichDescriptions flag): this
      // sitemap-driven provider already fetches the product page for every listing,
      // so the description comes for free — no extra request like W9a F2 enrichment.
      description: sanitizeDescription(readString(product.description)),
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
  const { product } = readBlocks(html);
  const offers = asOffers(product?.offers);
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
