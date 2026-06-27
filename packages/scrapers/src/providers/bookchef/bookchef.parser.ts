import * as cheerio from 'cheerio';
import type { RawProviderListing, Availability, Money } from '@knyhovo/shared';
import { normalizeIsbn } from '../../canonical/isbn.js';
import { JSON_LD_SELECTOR, buildCoverUrl } from './constants.js';
import type { ParsedProductState } from '../single-product.js';

/** Result of parsing a single BookChef product page into a raw listing. */
export interface ParseResult {
  /** The parsed listing, or null when the page lacked a usable Product block. */
  readonly listing: RawProviderListing | null;
  readonly errors: string[];
}

/** Shape of a BookChef JSON-LD `@type:Product` block (all fields untrusted). */
interface BookChefProduct {
  readonly '@type'?: unknown;
  readonly name?: unknown;
  readonly image?: unknown;
  readonly isbn?: unknown;
  readonly gtin13?: unknown;
  readonly brand?: unknown;
  readonly author?: unknown;
  readonly offers?: unknown;
}

interface BookChefOffers {
  readonly url?: unknown;
  readonly price?: unknown;
  readonly priceCurrency?: unknown;
  readonly availability?: unknown;
}

/**
 * Convert a BookChef price (a numeric string like "320.00" or a number) to a
 * Money amount in kopecks, or null when the value is not a usable price.
 *
 * Returns null for 0, negative, NaN, Infinity, null and undefined.
 */
export function bookChefPriceToKopecks(value: unknown): number | null {
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
 * Map a schema.org availability value (e.g. `https://schema.org/InStock`) to the
 * shared Availability enum. A missing price always wins → out-of-stock.
 */
function resolveAvailability(availability: unknown, hasPrice: boolean): Availability {
  if (!hasPrice) return 'out-of-stock';
  if (typeof availability !== 'string') return 'unknown';
  const suffix = availability.split('/').pop()?.toLowerCase().trim() ?? '';
  if (suffix === 'instock' || suffix === 'preorder') return 'in-stock';
  if (suffix === 'outofstock' || suffix === 'soldout') return 'out-of-stock';
  return 'unknown';
}

/** Join BookChef's author field (array of {name} / string) into one string. */
function resolveAuthor(author: unknown, brand: unknown): string | null {
  const fromAuthor = joinNames(author);
  if (fromAuthor !== null) return fromAuthor;
  return readName(brand);
}

function joinNames(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() !== '' ? value.trim() : null;
  }
  if (Array.isArray(value)) {
    const names = value
      .map((entry) => readName(entry))
      .filter((name): name is string => name !== null);
    return names.length > 0 ? names.join(', ') : null;
  }
  return readName(value);
}

function readName(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() !== '' ? value.trim() : null;
  if (typeof value === 'object' && value !== null) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim() !== '') return name.trim();
  }
  return null;
}

function isProductType(type: unknown): boolean {
  if (type === 'Product') return true;
  if (Array.isArray(type)) return type.includes('Product');
  return false;
}

/**
 * Find the first `@type:Product` object within a parsed JSON-LD value. Handles
 * single objects, arrays of objects and `@graph` containers.
 */
function findProduct(parsed: unknown): BookChefProduct | null {
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      const found = findProduct(entry);
      if (found) return found;
    }
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (isProductType(obj['@type'])) return obj as BookChefProduct;
  if (Array.isArray(obj['@graph'])) return findProduct(obj['@graph']);
  return null;
}

/**
 * Read the `@type:Product` JSON-LD block from a BookChef product page.
 * Pure — no IO. Malformed JSON in a block is recorded and skipped, never thrown.
 */
function readProduct(html: string): { product: BookChefProduct | null; errors: string[] } {
  const errors: string[] = [];
  const $ = cheerio.load(html);
  const blocks = $(JSON_LD_SELECTOR).toArray();
  if (blocks.length === 0) {
    return { product: null, errors: ['no JSON-LD script found'] };
  }

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
    const product = findProduct(parsed);
    if (product) return { product, errors };
  }

  return { product: null, errors };
}

/**
 * Parse a BookChef product page into a single raw provider listing.
 * Pure function — no IO, never throws. Any parse failure is collected into
 * `errors` and yields `listing: null`.
 */
export function parseBookChefListing(html: string): ParseResult {
  const { product, errors } = readProduct(html);
  if (product === null) {
    if (errors.length === 0) errors.push('no Product JSON-LD found');
    return { listing: null, errors };
  }

  try {
    const offers = (typeof product.offers === 'object' && product.offers !== null
      ? product.offers
      : {}) as BookChefOffers;

    const title = typeof product.name === 'string' ? product.name.trim() : '';
    if (!title) {
      errors.push('Product missing name, skipped');
      return { listing: null, errors };
    }

    const url = typeof offers.url === 'string' ? offers.url.trim() : '';
    if (!url) {
      errors.push(`Product "${title}": missing offers.url, skipped`);
      return { listing: null, errors };
    }

    const priceKopecks = bookChefPriceToKopecks(offers.price);
    const price: Money | null = priceKopecks !== null ? toMoney(priceKopecks) : null;

    const isbn =
      normalizeIsbn(typeof product.isbn === 'string' ? product.isbn : null) ??
      normalizeIsbn(typeof product.gtin13 === 'string' ? product.gtin13 : null);

    const listing: RawProviderListing = {
      provider: 'bookchef',
      title,
      author: resolveAuthor(product.author, product.brand),
      isbn,
      price,
      url,
      availability: resolveAvailability(offers.availability, price !== null),
      coverUrl: buildCoverUrl(product.image),
      description: null,
    };
    return { listing, errors };
  } catch (err) {
    errors.push(`unexpected error — ${err instanceof Error ? err.message : String(err)}`);
    return { listing: null, errors };
  }
}

/**
 * Parse price and availability from a BookChef product page.
 * Pure function — no IO, never throws. Missing/unparseable data yields
 * `{ price: null, availability: 'unknown' }`; a present-but-priceless product
 * yields `{ price: null, availability: 'out-of-stock' }`.
 */
export function parseBookChefProduct(html: string): ParsedProductState {
  const { product } = readProduct(html);
  if (product === null) return { price: null, availability: 'unknown' };

  const offers = (typeof product.offers === 'object' && product.offers !== null
    ? product.offers
    : {}) as BookChefOffers;

  const priceKopecks = bookChefPriceToKopecks(offers.price);
  if (priceKopecks === null) return { price: null, availability: 'out-of-stock' };

  return {
    price: toMoney(priceKopecks),
    availability: resolveAvailability(offers.availability, true),
  };
}
