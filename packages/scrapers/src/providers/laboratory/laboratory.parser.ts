import * as cheerio from 'cheerio';
import type { RawProviderListing, Money } from '@knyhovo/shared';
import { normalizeIsbn } from '../../canonical/isbn.js';
import { sanitizeDescription } from '../../lib/sanitize-description.js';
import { finalizeRawCategories } from '../../lib/extract-breadcrumbs.js';
import { buildCoverUrl } from './constants.js';
import type { ParsedProductState, ProductPageResult } from '../types.js';
import { priceToKopecks, toMoney } from '../../lib/price.js';
import { errMsg } from '../../lib/errors.js';
import { parseSitemapEntries } from '../../sitemap/parse-sitemap.js';
import { readJsonLdBlocks, readName, readString, resolveSchemaOrgAvailability } from '../../lib/json-ld.js';

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
  const $ = cheerio.load(html);
  const { found, errors } = readJsonLdBlocks($, ['Product', 'Book']);
  return {
    $,
    product: found['Product'] as LaboratoryProduct | null,
    book: found['Book'] as LaboratoryBook | null,
    errors,
  };
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
export function parseLaboratoryListing(html: string): ProductPageResult {
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

    const priceKopecks = priceToKopecks(offers.price);
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
      availability: resolveSchemaOrgAvailability(offers.availability, price !== null),
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
    errors.push(`unexpected error — ${errMsg(err)}`);
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

  const priceKopecks = priceToKopecks(offers.price);
  if (priceKopecks === null) return { price: null, availability: 'out-of-stock' };

  return {
    price: toMoney(priceKopecks),
    availability: resolveSchemaOrgAvailability(offers.availability, true),
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
  const { entries, error } = parseSitemapEntries(xml);
  return { urls: entries.map((entry) => entry.url), errors: error ? [error] : [] };
}
