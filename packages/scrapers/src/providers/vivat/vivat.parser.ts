import * as cheerio from 'cheerio';
import type { RawProviderListing, Availability, Money } from '@knyhovo/shared';
import {
  NEXT_DATA_SELECTOR,
  isPaperBookType,
  buildProductUrl,
  buildCoverUrl,
} from './constants.js';
import type { VivatSingleProduct } from './constants.js';
import type { ParsedProductState } from '../single-product.js';
import type { ExtractedListingMetadata, ExtractedProductDetails } from '../../lib/enrich-product-details.js';
import { sanitizeMetadataValue, parsePublicationYear } from '../../lib/sanitize-metadata.js';

export interface ParseResult {
  readonly listings: RawProviderListing[];
  readonly errors: string[];
  /** True when the page contained at least one product (paginator should fetch next page). */
  readonly hasNextPage: boolean;
}

/** Shape of a single product entry inside Vivat's `__NEXT_DATA__` payload. */
interface VivatProduct {
  readonly title?: unknown;
  readonly author?: unknown;
  readonly code?: unknown;
  readonly statusCode?: unknown;
  readonly stockLevel?: unknown;
  readonly preOrder?: unknown;
  readonly bookType?: unknown;
  readonly image?: unknown;
  readonly price?: {
    readonly retail?: unknown;
    readonly promotion?: unknown;
    readonly priceRebate?: unknown;
  };
}

/**
 * Convert a Vivat price (whole hryvnias as a number, e.g. 499 or 636) to a
 * Money amount in kopecks, or null when the value is not a usable price.
 *
 * Vivat exposes prices as numbers in the catalog JSON, so — unlike Yakaboo —
 * there is no currency text to strip; we only validate and scale.
 */
export function vivatPriceToKopecks(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100);
}

function toMoney(kopecks: number): Money {
  return { amount: kopecks, currency: 'UAH' };
}

/**
 * Map Vivat's stock signals to the shared Availability enum.
 * `active` and `preorder` are both buyable (preorder mirrors Yakaboo's
 * preorder → in-stock policy). A missing price means out-of-stock.
 */
function resolveAvailability(
  statusCode: string,
  stockLevel: number | null,
  hasPrice: boolean,
): Availability {
  if (!hasPrice) return 'out-of-stock';
  const code = statusCode.toLowerCase().trim();
  if (code === 'active' || code === 'preorder') return 'in-stock';
  if (code.includes('out') || code.includes('not') || code.includes('unavail')) {
    return 'out-of-stock';
  }
  if (stockLevel !== null && stockLevel > 0) return 'in-stock';
  return 'unknown';
}

/** Join Vivat's author field (string[] or string) into a single display string. */
function resolveAuthor(author: unknown): string | null {
  if (Array.isArray(author)) {
    const joined = author
      .filter((a): a is string => typeof a === 'string' && a.trim() !== '')
      .map((a) => a.trim())
      .join(', ');
    return joined !== '' ? joined : null;
  }
  if (typeof author === 'string' && author.trim() !== '') return author.trim();
  return null;
}

function readProducts(html: string): { products: VivatProduct[] | null; error: string | null } {
  const $ = cheerio.load(html);
  const raw = $(NEXT_DATA_SELECTOR).first().contents().text();
  if (!raw.trim()) {
    return { products: null, error: 'missing __NEXT_DATA__ script' };
  }
  try {
    const data = JSON.parse(raw) as { props?: { pageProps?: { products?: unknown } } };
    const products = data.props?.pageProps?.products;
    if (!Array.isArray(products)) {
      return { products: null, error: '__NEXT_DATA__ has no pageProps.products array' };
    }
    return { products: products as VivatProduct[], error: null };
  } catch (err) {
    return {
      products: null,
      error: `unparseable __NEXT_DATA__ JSON — ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Parse a Vivat catalog HTML page into raw provider listings.
 * Pure function — no IO, no side effects.
 *
 * Reads the `__NEXT_DATA__` JSON blob rather than CSS-classed cards.
 * ISBN is not present on the catalog payload (only on individual product
 * pages), so all returned listings have isbn: null — same as Yakaboo.
 */
export function parseVivatPage(html: string): ParseResult {
  const listings: RawProviderListing[] = [];
  const errors: string[] = [];

  const { products, error } = readProducts(html);
  if (products === null) {
    if (error) errors.push(error);
    return { listings, errors, hasNextPage: false };
  }

  products.forEach((product, index) => {
    try {
      const code = typeof product.code === 'string' ? product.code.trim() : '';
      if (!code) {
        errors.push(`Product ${index}: missing code, skipped`);
        return;
      }

      const title = typeof product.title === 'string' ? product.title.trim() : '';
      if (!title) {
        errors.push(`Product at ${code}: missing title, skipped`);
        return;
      }

      if (!isPaperBookType(product.bookType)) return;

      const priceKopecks =
        vivatPriceToKopecks(product.price?.promotion) ??
        vivatPriceToKopecks(product.price?.retail) ??
        vivatPriceToKopecks(product.price?.priceRebate);
      const price: Money | null = priceKopecks !== null ? toMoney(priceKopecks) : null;

      const statusCode = typeof product.statusCode === 'string' ? product.statusCode : '';
      const stockLevel = typeof product.stockLevel === 'number' ? product.stockLevel : null;
      const availability = resolveAvailability(statusCode, stockLevel, price !== null);

      listings.push({
        provider: 'vivat',
        title,
        author: resolveAuthor(product.author),
        isbn: null,
        price,
        url: buildProductUrl(code),
        availability,
        coverUrl: buildCoverUrl(product.image),
      });
    } catch (err) {
      errors.push(
        `Product ${index}: unexpected error — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

  return { listings, errors, hasNextPage: products.length > 0 };
}

/**
 * Strip heading elements (h1-h6) from an HTML description fragment.
 *
 * Vivat's `bookDescription` field is prefixed with a boilerplate heading
 * (e.g. `<h2>Анотація книги «…»</h2>`) that is not description content.
 * Returns the remaining HTML, or null when nothing but headings/whitespace
 * remains after stripping.
 */
function stripHeadings(html: string): string | null {
  const $ = cheerio.load(html);
  $('h1, h2, h3, h4, h5, h6').remove();
  const body = $('body');
  if (body.text().trim() === '') return null;
  return body.html() ?? '';
}

/**
 * Read `props.pageProps.product` from a Vivat *product* page's `__NEXT_DATA__`
 * payload once. Pure function — no IO, never throws. Shared by every
 * product-page reader (description, metadata, price/availability) so the
 * `__NEXT_DATA__` script is only located and JSON-parsed a single time per call site.
 */
function readProductObject(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);
  const raw = $(NEXT_DATA_SELECTOR).first().contents().text();
  if (!raw.trim()) return null;

  try {
    const data = JSON.parse(raw) as { props?: { pageProps?: { product?: unknown } } };
    const candidate = data.props?.pageProps?.product;
    return typeof candidate === 'object' && candidate !== null
      ? (candidate as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Extract the plain-text raw description from an already-read product object, or null. */
function extractDescription(product: Record<string, unknown>): string | null {
  for (const key of ['bookDescription', 'shortDescription']) {
    const value = product[key];
    if (typeof value !== 'string' || value.trim() === '') continue;
    if (key === 'bookDescription') {
      const stripped = stripHeadings(value);
      if (stripped !== null) return stripped;
      continue;
    }
    return value;
  }
  return null;
}

/** Shape of one `allCharacteristics` entry on a Vivat product page. */
interface VivatCharacteristic {
  readonly code?: unknown;
  readonly value?: unknown;
}

/** Vivat `allCharacteristics` codes mapped to edition-metadata fields (book-metadata PRD). */
const PUBLISHER_CODE = 'publisher_code_entityelement';
const LANGUAGE_CODE = 'language';
const FORMAT_CODE = 'book_cover';
const SERIES_CODE = 'product_series';
const PUB_YEAR_CODE = 'pub_year';
const ISBN_CODE = 'ean_isbn';

/**
 * Join a characteristic's `value[].text` entries (non-empty, trimmed) with
 * ", " — same joining spirit as {@link resolveAuthor} for the catalog payload.
 */
function joinCharacteristicText(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const texts = value
    .map((entry) =>
      typeof entry === 'object' && entry !== null && typeof (entry as { text?: unknown }).text === 'string'
        ? (entry as { text: string }).text.trim()
        : '',
    )
    .filter((text) => text !== '');
  return texts.length > 0 ? texts.join(', ') : null;
}

/**
 * Validate and normalize an ISBN-like string: strip hyphens/spaces, accept
 * only 13-digit or 9-digit+check-character (ISBN-10) forms, normalize a
 * trailing x to uppercase X. Returns null for anything else (graceful —
 * malformed provider ISBNs never reach the DB).
 */
function normalizeIsbn(raw: string): string | null {
  const stripped = raw.replace(/[-\s]/g, '');
  const normalized = /x$/i.test(stripped) ? `${stripped.slice(0, -1)}${stripped.slice(-1).toUpperCase()}` : stripped;
  return /^(\d{13}|\d{9}[\dX])$/.test(normalized) ? normalized : null;
}

/**
 * Extract edition metadata from an already-read product object's
 * `allCharacteristics` array (book-metadata PRD — Vivat v1 source).
 *
 * Verified live shape (recon 2026-07-10):
 * `{ code: "publisher_code_entityelement", value: [{ text: "Vivat", ... }] }`.
 * Missing/malformed `allCharacteristics` (not an array, or absent) returns
 * null gracefully — never throws.
 */
function extractMetadata(product: Record<string, unknown>): ExtractedListingMetadata | null {
  const list = product['allCharacteristics'];
  if (!Array.isArray(list)) return null;

  const byCode = new Map<string, string>();
  for (const entry of list as VivatCharacteristic[]) {
    if (typeof entry?.code !== 'string') continue;
    const text = joinCharacteristicText(entry.value);
    if (text !== null) byCode.set(entry.code, text);
  }

  const isbnRaw = byCode.get(ISBN_CODE);
  const pubYearRaw = byCode.get(PUB_YEAR_CODE);

  return {
    publisher: sanitizeMetadataValue(byCode.get(PUBLISHER_CODE) ?? null),
    language: sanitizeMetadataValue(byCode.get(LANGUAGE_CODE) ?? null),
    format: sanitizeMetadataValue(byCode.get(FORMAT_CODE) ?? null),
    series: sanitizeMetadataValue(byCode.get(SERIES_CODE) ?? null),
    publicationYear: pubYearRaw !== undefined ? parsePublicationYear(pubYearRaw) : null,
    isbn: isbnRaw !== undefined ? normalizeIsbn(isbnRaw) : null,
  };
}

/**
 * Extract description + edition metadata from a Vivat *product* page in a
 * single `__NEXT_DATA__` read (book-metadata PRD, generalizing W9a F2's
 * description-only pass — zero additional HTTP requests).
 * Pure function — no IO, never throws.
 */
export function extractVivatProductDetails(html: string): ExtractedProductDetails {
  const product = readProductObject(html);
  if (product === null) return { description: null, metadata: null };

  return {
    description: extractDescription(product),
    metadata: extractMetadata(product),
  };
}

/**
 * Parse price and availability from a Vivat *product* page (W10.4).
 * Pure function — no IO, no throwing. Reads the `__NEXT_DATA__` JSON
 * (same technique as extractVivatProductDetails).
 *
 * Field names in props.pageProps.product are representative — must be
 * re-verified against live product HTML before production use (W10.4).
 */
export function parseVivatProduct(html: string): ParsedProductState {
  const $ = cheerio.load(html);
  const raw = $(NEXT_DATA_SELECTOR).first().contents().text();
  if (!raw.trim()) return { price: null, availability: 'unknown' };

  let product: VivatSingleProduct | undefined;
  try {
    const data = JSON.parse(raw) as { props?: { pageProps?: { product?: unknown } } };
    const candidate = data.props?.pageProps?.product;
    product = typeof candidate === 'object' && candidate !== null
      ? (candidate as VivatSingleProduct)
      : undefined;
  } catch {
    return { price: null, availability: 'unknown' };
  }
  if (!product) return { price: null, availability: 'unknown' };

  const priceKopecks =
    vivatPriceToKopecks(product.price?.promotion) ??
    vivatPriceToKopecks(product.price?.retail) ??
    vivatPriceToKopecks(product.price?.priceRebate);
  const price: Money | null = priceKopecks !== null ? { amount: priceKopecks, currency: 'UAH' } : null;

  if (!price) return { price: null, availability: 'out-of-stock' };

  const statusCode = typeof product.statusCode === 'string' ? product.statusCode : '';
  const stockLevel = typeof product.stockLevel === 'number' ? product.stockLevel : null;
  const availability = resolveAvailability(statusCode, stockLevel, true);
  return { price, availability };
}
