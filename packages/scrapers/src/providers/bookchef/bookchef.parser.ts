import * as cheerio from 'cheerio';
import type { RawProviderListing, Availability, Money } from '@knyhovo/shared';
import { normalizeIsbn } from '../../canonical/isbn.js';
import { sanitizeDescription } from '../../lib/sanitize-description.js';
import { extractBreadcrumbs } from '../../lib/extract-breadcrumbs.js';
import { parseSitemapEntries } from '../../sitemap/parse-sitemap.js';
import { buildCoverUrl } from './constants.js';
import type { ParsedProductState, ProductPageResult } from '../types.js';
import { priceToKopecks, toMoney } from '../../lib/price.js';
import { errMsg } from '../../lib/errors.js';
import { readJsonLdBlocks, readName, resolveSchemaOrgAvailability } from '../../lib/json-ld.js';

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
  readonly description?: unknown;
}

interface BookChefOffers {
  readonly url?: unknown;
  readonly price?: unknown;
  readonly priceCurrency?: unknown;
  readonly availability?: unknown;
}

// BookChef's JSON-LD never uses `discontinued`, so it stays `unknown` here.
function resolveAvailability(availability: unknown, hasPrice: boolean): Availability {
  return resolveSchemaOrgAvailability(availability, hasPrice, { discontinued: false });
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

/**
 * Read the `@type:Product` JSON-LD block from a BookChef product page, plus the
 * loaded cheerio document so callers can reuse it. Pure — no IO. Malformed JSON
 * in a block is recorded and skipped, never thrown.
 */
function readProduct(html: string): {
  $: cheerio.CheerioAPI;
  product: BookChefProduct | null;
  errors: string[];
} {
  const $ = cheerio.load(html);
  const { found, errors } = readJsonLdBlocks($, ['Product'], { stopWhenFound: true });
  return { $, product: found['Product'] as BookChefProduct | null, errors };
}

/**
 * Parse a BookChef product page into a single raw provider listing.
 * Pure function — no IO, never throws. Any parse failure is collected into
 * `errors` and yields `listing: null`.
 */
export function parseBookChefListing(html: string): ProductPageResult {
  const { $, product, errors } = readProduct(html);
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

    const priceKopecks = priceToKopecks(offers.price);
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
      // Always-on extraction (not gated by the opt-in enrichDescriptions flag): this
      // sitemap-driven provider already fetches the product page for every listing,
      // so the description comes for free — no extra request like W9a F2 enrichment.
      description: sanitizeDescription(
        typeof product.description === 'string' ? product.description : null,
      ),
      rawCategories: extractBreadcrumbs($, title),
    };
    return { listing, errors };
  } catch (err) {
    errors.push(`unexpected error — ${errMsg(err)}`);
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

  const priceKopecks = priceToKopecks(offers.price);
  if (priceKopecks === null) return { price: null, availability: 'out-of-stock' };

  return {
    price: toMoney(priceKopecks),
    availability: resolveAvailability(offers.availability, true),
  };
}

/** Result of parsing a BookChef product sitemap into product-page URLs. */
export interface SitemapResult {
  /** Unique product-page URLs in document order. */
  readonly urls: string[];
  readonly errors: string[];
}

/**
 * Parse a BookChef product sitemap (`<urlset>` of `<loc>` product URLs, with
 * optional `<lastmod>`) into a deduplicated list of product-page URLs.
 * Pure function — no IO, never throws. Empty/blank input or a sitemap with no
 * `<loc>` entries yields `urls: []` and an error message.
 *
 * Thin backward-compat wrapper over the shared {@link parseSitemapEntries} —
 * kept for callers that only need URLs (lastmod is dropped here). The scraper
 * itself uses `parseSitemapEntries` directly to keep the lastmod signal for
 * incremental fetching.
 */
export function parseBookChefSitemap(xml: string): SitemapResult {
  const { entries, error } = parseSitemapEntries(xml);
  return { urls: entries.map((entry) => entry.url), errors: error ? [error] : [] };
}
