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
 * Extract the raw description from a Vivat *product* page (W9a F2).
 * Pure function — no IO. Reads the `__NEXT_DATA__` JSON (same technique as the
 * catalog parser) and returns the first non-empty description-like field on
 * `props.pageProps.product`, or null when none is present.
 *
 * Field names are representative — must be re-verified against a live product
 * page before description enrichment is enabled (opt-in, off by default).
 * The value may contain HTML; sanitization happens at the enrichment boundary.
 */
export function extractVivatProductDescription(html: string): string | null {
  const $ = cheerio.load(html);
  const raw = $(NEXT_DATA_SELECTOR).first().contents().text();
  if (!raw.trim()) return null;

  let product: Record<string, unknown> | undefined;
  try {
    const data = JSON.parse(raw) as {
      props?: { pageProps?: { product?: unknown } };
    };
    const candidate = data.props?.pageProps?.product;
    product = typeof candidate === 'object' && candidate !== null
      ? (candidate as Record<string, unknown>)
      : undefined;
  } catch {
    return null;
  }
  if (!product) return null;

  for (const key of ['description', 'descriptionFull', 'annotation', 'text']) {
    const value = product[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
}

/**
 * Parse price and availability from a Vivat *product* page (W10.4).
 * Pure function — no IO, no throwing. Reads the `__NEXT_DATA__` JSON
 * (same technique as extractVivatProductDescription).
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
