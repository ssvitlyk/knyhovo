import * as cheerio from 'cheerio';
import type { RawProviderListing, Money } from '@knyhovo/shared';
import { normalizeIsbn } from '../../canonical/isbn.js';
import { sanitizeDescription } from '../../lib/sanitize-description.js';
import { extractBreadcrumbs } from '../../lib/extract-breadcrumbs.js';
import { CATALOG_PRODUCTS_SITEMAP_PATTERN, buildCoverUrl } from './constants.js';
import type { ParsedProductState, ProductPageResult } from '../types.js';
import { priceToKopecks, toMoney } from '../../lib/price.js';
import { errMsg } from '../../lib/errors.js';
import { parseSitemapEntries, parseSitemapIndexEntries } from '../../sitemap/parse-sitemap.js';
import { readJsonLdBlocks, readString, resolveSchemaOrgAvailability } from '../../lib/json-ld.js';

/**
 * Shape of a Knigoland JSON-LD `@type:Product` block (all fields untrusted).
 * `Product.genre` is deliberately not modeled here — it is a fixed store
 * tagline ("Книголенд - Інтернет-магазин книг, подарунків і дитячих товарів."),
 * not a real category signal, verified across every fixture.
 */
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

function asOffers(value: unknown): KnigolandOffers | null {
  return typeof value === 'object' && value !== null ? (value as KnigolandOffers) : null;
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
  const $ = cheerio.load(html);
  const { found, errors } = readJsonLdBlocks($, ['Product']);
  return { $, product: found['Product'] as KnigolandProduct | null, errors };
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
export function parseKnigolandListing(html: string): ProductPageResult {
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

    const priceKopecks = priceToKopecks(offers.price);
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
      availability: resolveSchemaOrgAvailability(offers.availability, price !== null),
      coverUrl: buildCoverUrl(product.image),
      // Always-on extraction (not gated by the opt-in enrichDescriptions flag): this
      // sitemap-driven provider already fetches the product page for every listing,
      // so the description comes for free — no extra request like W9a F2 enrichment.
      description: sanitizeDescription(readString(product.description)),
      rawCategories: extractBreadcrumbs($, title),
    };
    return { listing, errors };
  } catch (err) {
    errors.push(`unexpected error — ${errMsg(err)}`);
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

  const priceKopecks = priceToKopecks(offers.price);
  if (priceKopecks === null) return { price: null, availability: 'out-of-stock' };

  return {
    price: toMoney(priceKopecks),
    availability: resolveSchemaOrgAvailability(offers.availability, true),
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
  const { sitemaps } = parseSitemapIndexEntries(
    xml,
    (loc) => CATALOG_PRODUCTS_SITEMAP_PATTERN.test(loc),
    'loc',
  );
  if (sitemaps.length > 0) return { sitemapUrls: sitemaps, errors: [] };
  const blank = (typeof xml === 'string' ? xml.trim() : '') === '';
  return {
    sitemapUrls: [],
    errors: [blank ? 'empty sitemap index' : 'no catalog-products sub-sitemaps found in index'],
  };
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
  const { entries, error } = parseSitemapEntries(xml);
  return { urls: entries.map((entry) => entry.url), errors: error ? [error] : [] };
}
