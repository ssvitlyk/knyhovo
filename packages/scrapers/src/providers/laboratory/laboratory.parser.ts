import * as cheerio from 'cheerio';
import type { RawProviderListing, Availability, Money } from '@knyhovo/shared';
import { normalizeIsbn } from '../../canonical/isbn.js';
import { sanitizeDescription } from '../../lib/sanitize-description.js';
import { finalizeRawCategories } from '../../lib/extract-breadcrumbs.js';
import { JSON_LD_SELECTOR, buildCoverUrl } from './constants.js';
import type { ParsedProductState } from '../single-product.js';

/** Result of parsing a single Laboratory product page into a raw listing. */
export interface ParseResult {
  /** The parsed listing, or null when the page lacked a usable Product/Book block. */
  readonly listing: RawProviderListing | null;
  readonly errors: string[];
}

/** Shape of a Laboratory JSON-LD `@type:Product` block (all fields untrusted). */
interface LaboratoryProduct {
  readonly '@type'?: unknown;
  readonly name?: unknown;
  readonly image?: unknown;
  readonly sku?: unknown;
  readonly mpn?: unknown;
  readonly offers?: unknown;
  readonly description?: unknown;
}

/** Shape of a Laboratory JSON-LD `@type:Book` block (all fields untrusted). */
interface LaboratoryBook {
  readonly '@type'?: unknown;
  readonly name?: unknown;
  readonly image?: unknown;
  readonly isbn?: unknown;
  readonly author?: unknown;
  readonly bookFormat?: unknown;
  readonly url?: unknown;
  readonly description?: unknown;
  readonly genre?: unknown;
}

/**
 * Decode a Laboratory description that is double entity-encoded in the JSON-LD
 * source (live-verified 2026-07-09, e.g. `garri-potter-i-napivkrovnyj-prynts`):
 * the JSON string literal already contains escaped entities such as
 * `&amp;mdash;`, `&amp;laquo;`, `&amp;nbsp;`. A single HTML-entity decode (via
 * cheerio, already used throughout this parser) turns those into `&mdash;` /
 * `&laquo;` / `&nbsp;` as literal text, so a second decode is required to reach
 * the intended `—` / `«…»` / non-breaking space. `sanitizeDescription` itself
 * only strips tags — it does not decode entities twice — so this must happen
 * before handing the value to it.
 */
function decodeDoubleEncodedDescription(raw: string): string {
  const once = cheerio.load(raw).text();
  return cheerio.load(once).text();
}

interface LaboratoryOffers {
  readonly url?: unknown;
  readonly price?: unknown;
  readonly priceCurrency?: unknown;
  readonly availability?: unknown;
}

/**
 * Convert a Laboratory price (a numeric string like "990" or a number) to a
 * Money amount in kopecks, or null when the value is not a usable price.
 *
 * Returns null for 0, negative, NaN, Infinity, null and undefined.
 */
export function laboratoryPriceToKopecks(value: unknown): number | null {
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

/**
 * Map a schema.org availability value (e.g. `http://schema.org/InStock`) to the
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

/** Join Laboratory's Book.author field (array of {name} / string) into one string. */
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
 * Read the `@type:Product` and `@type:Book` JSON-LD blocks from a Laboratory
 * product page. Pure — no IO. Malformed JSON in a block is recorded and skipped,
 * never thrown.
 */
function readBlocks(html: string): {
  $: cheerio.CheerioAPI;
  product: LaboratoryProduct | null;
  book: LaboratoryBook | null;
  errors: string[];
} {
  const errors: string[] = [];
  const $ = cheerio.load(html);
  const blocks = $(JSON_LD_SELECTOR).toArray();
  if (blocks.length === 0) {
    return { $, product: null, book: null, errors: ['no JSON-LD script found'] };
  }

  let product: LaboratoryProduct | null = null;
  let book: LaboratoryBook | null = null;

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
    if (product === null) product = findByType(parsed, 'Product') as LaboratoryProduct | null;
    if (book === null) book = findByType(parsed, 'Book') as LaboratoryBook | null;
  }

  return { $, product, book, errors };
}

/**
 * Resolve a Laboratory JSON-LD `Book.genre` value to raw category strings.
 * Real pages always carry a single string (e.g. "Військова справа"), but the
 * schema.org `Book.genre` property also permits an array of strings — trivial
 * to support without extra scope, so both shapes are handled.
 */
function resolveGenre(genre: unknown): string[] {
  if (typeof genre === 'string') {
    const trimmed = genre.trim();
    return trimmed !== '' ? [trimmed] : [];
  }
  if (Array.isArray(genre)) {
    return finalizeRawCategories(genre.filter((g): g is string => typeof g === 'string'));
  }
  return [];
}

/**
 * Fallback extraction of raw categories from Laboratory's HTML breadcrumb
 * microdata (schema.org `ListItem` with `itemprop="position"`/`itemprop="name"`),
 * used only when `Book.genre` carries no signal. Not the JSON-LD `BreadcrumbList`
 * shape handled by extract-breadcrumbs.ts — Laboratory genuinely uses old-style
 * microdata markup (confirmed in fixtures).
 */
function extractBreadcrumbMicrodata($: cheerio.CheerioAPI, title: string): string[] {
  const entries: { name: string; position: number | null }[] = [];
  $('[itemtype$="ListItem"], [itemtype*="schema.org/ListItem"]').each((_, el) => {
    const name = $(el).find('[itemprop="name"]').first().text().trim();
    if (!name) return;
    const posAttr = $(el).find('[itemprop="position"]').first().attr('content');
    const position =
      posAttr != null && posAttr.trim() !== '' && Number.isFinite(Number(posAttr))
        ? Number(posAttr)
        : null;
    entries.push({ name, position });
  });
  const allHavePosition = entries.length > 0 && entries.every((e) => e.position !== null);
  const ordered = allHavePosition
    ? [...entries].sort((a, b) => (a.position as number) - (b.position as number))
    : entries;
  let names = ordered.map((e) => e.name);
  names = names.slice(1); // drop the home/store crumb — always first
  if (names.length > 0 && names[names.length - 1]!.trim().toLowerCase() === title.trim().toLowerCase()) {
    names = names.slice(0, -1);
  }
  return finalizeRawCategories(names);
}

/**
 * Parse a Laboratory product page into a single raw provider listing by merging
 * the `@type:Product` block (price, availability, sku/mpn) with the `@type:Book`
 * block (isbn, author, url). Pure function — no IO, never throws. Any parse
 * failure is collected into `errors` and yields `listing: null`.
 */
export function parseLaboratoryListing(html: string): ParseResult {
  const { $, product, book, errors } = readBlocks(html);
  if (product === null && book === null) {
    if (errors.length === 0) errors.push('no Product/Book JSON-LD found');
    return { listing: null, errors };
  }

  try {
    const offers = (product && typeof product.offers === 'object' && product.offers !== null
      ? product.offers
      : {}) as LaboratoryOffers;

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

    const priceKopecks = laboratoryPriceToKopecks(offers.price);
    const price: Money | null = priceKopecks !== null ? toMoney(priceKopecks) : null;

    // ISBN cascade: Book.isbn → Product.sku → Product.mpn. The fallback is real:
    // some products ship an empty Book.isbn but a valid sku (e.g. abrykosy-donbasu).
    const isbn =
      normalizeIsbn(readString(book?.isbn)) ??
      normalizeIsbn(readString(product?.sku)) ??
      normalizeIsbn(readString(product?.mpn));

    // Description cascade: Product.description → Book.description.
    const rawDescription = readString(product?.description) ?? readString(book?.description);

    const genreCategories = resolveGenre(book?.genre);
    const rawCategories =
      genreCategories.length > 0 ? genreCategories : extractBreadcrumbMicrodata($, title);

    const listing: RawProviderListing = {
      provider: 'laboratory',
      title,
      author: resolveAuthor(book?.author),
      isbn,
      price,
      url,
      availability: resolveAvailability(offers.availability, price !== null),
      coverUrl: buildCoverUrl(product?.image ?? book?.image),
      // Always-on extraction (not gated by the opt-in enrichDescriptions flag): this
      // sitemap-driven provider already fetches the product page for every listing,
      // so the description comes for free — no extra request like W9a F2 enrichment.
      // Cascade: Product.description → Book.description (Book's block is sometimes
      // absent for this field even when the Product block carries one).
      description: sanitizeDescription(
        rawDescription !== null ? decodeDoubleEncodedDescription(rawDescription) : null,
      ),
      rawCategories,
    };
    return { listing, errors };
  } catch (err) {
    errors.push(`unexpected error — ${err instanceof Error ? err.message : String(err)}`);
    return { listing: null, errors };
  }
}

/**
 * Parse price and availability from a Laboratory product page.
 * Pure function — no IO, never throws. Missing/unparseable data yields
 * `{ price: null, availability: 'unknown' }`; a present-but-priceless product
 * yields `{ price: null, availability: 'out-of-stock' }`.
 */
export function parseLaboratoryProduct(html: string): ParsedProductState {
  const { product } = readBlocks(html);
  if (product === null) return { price: null, availability: 'unknown' };

  const offers = (typeof product.offers === 'object' && product.offers !== null
    ? product.offers
    : {}) as LaboratoryOffers;

  const priceKopecks = laboratoryPriceToKopecks(offers.price);
  if (priceKopecks === null) return { price: null, availability: 'out-of-stock' };

  return {
    price: toMoney(priceKopecks),
    availability: resolveAvailability(offers.availability, true),
  };
}

/** Result of parsing a Laboratory product sitemap into product-page URLs. */
export interface SitemapResult {
  /** Unique product-page URLs in document order. */
  readonly urls: string[];
  readonly errors: string[];
}

/**
 * Parse a Laboratory product sitemap (`<urlset>` of `<loc>` product URLs) into a
 * deduplicated list of product-page URLs. Pure function — no IO, never throws.
 * Empty/blank input or a sitemap with no `<loc>` entries yields `urls: []` and
 * an error message.
 */
export function parseLaboratorySitemap(xml: string): SitemapResult {
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
