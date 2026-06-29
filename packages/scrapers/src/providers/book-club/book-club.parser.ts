import type { RawProviderListing, Availability, Money } from '@knyhovo/shared';
import { normalizeIsbn } from '../../canonical/isbn.js';
import type { GraphqlResponse } from './graphql-client.js';
import { buildProductUrl, buildCoverUrl } from './constants.js';

// ─── Price ───────────────────────────────────────────────────────────────────

/**
 * Convert a KSD price (number like 540 or numeric string) to a kopeck amount,
 * or null when the value is missing, zero, negative, NaN, or Infinity.
 */
export function bookClubPriceToKopecks(value: unknown): number | null {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Join a KSD authors array (objects with `name` and optional `surname`) into a
 * single comma-separated string. Returns null when the array is absent or empty.
 */
function resolveAuthors(authors: unknown): string | null {
  if (!Array.isArray(authors)) return null;
  const names: string[] = [];
  for (const entry of authors) {
    if (typeof entry !== 'object' || entry === null) continue;
    const a = entry as { name?: unknown; surname?: unknown };
    const namePart = readString(a.name);
    const surnamePart = readString(a.surname);
    const full = [namePart, surnamePart].filter(Boolean).join(' ').trim();
    if (full) names.push(full);
  }
  return names.length > 0 ? names.join(', ') : null;
}

// ─── Catalog discovery ───────────────────────────────────────────────────────

/** Result of parsing a single `catalogProducts` GraphQL response page. */
export interface CatalogResult {
  /** Deduplicated paper-book slugs found on this page, in document order. */
  readonly slugs: string[];
  /** Whether the API reported more pages after this one. */
  readonly hasMorePages: boolean;
  /** Non-fatal errors encountered while parsing. */
  readonly errors: string[];
}

/**
 * Parse a `catalogProducts` GraphQL response into a list of slugs.
 *
 * Pure function — no IO, never throws. Errors (e.g. top-level GraphQL errors,
 * malformed data) are collected in `errors` and do not cause exceptions.
 */
export function parseCatalogProducts(response: GraphqlResponse): CatalogResult {
  const errors: string[] = [];

  // Surface any top-level GraphQL errors
  if (Array.isArray(response.errors)) {
    for (const err of response.errors) {
      if (typeof err?.message === 'string') errors.push(err.message);
    }
  }

  const catalogProducts =
    typeof response.data === 'object' && response.data !== null
      ? (response.data as Record<string, unknown>)['catalogProducts']
      : undefined;

  if (typeof catalogProducts !== 'object' || catalogProducts === null) {
    return { slugs: [], hasMorePages: false, errors };
  }

  const cp = catalogProducts as Record<string, unknown>;

  // has_more_pages — read defensively
  const meta = typeof cp['meta'] === 'object' && cp['meta'] !== null
    ? (cp['meta'] as Record<string, unknown>)
    : null;
  const hasMorePages = meta !== null && meta['has_more_pages'] === true;

  const dataArr = Array.isArray(cp['data']) ? (cp['data'] as unknown[]) : [];
  const seen = new Set<string>();
  const slugs: string[] = [];

  for (const item of dataArr) {
    if (typeof item !== 'object' || item === null) continue;
    const card = item as Record<string, unknown>;
    const slug = readString(card['slug']);
    if (slug !== null && !seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }
  }

  return { slugs, hasMorePages, errors };
}

// ─── Batch enrichment ────────────────────────────────────────────────────────

/** Result of parsing an alias-batch `productPage` GraphQL response. */
export interface BatchResult {
  /** Successfully mapped paper-book listings. */
  readonly listings: RawProviderListing[];
  /** Non-fatal errors encountered while parsing (GraphQL errors, missing names, etc.). */
  readonly errors: string[];
}

/** Internal return type for mapProductPage. */
interface MappedProduct {
  readonly listing: RawProviderListing | null;
  readonly error: string | null;
}

/**
 * Map a single raw `productPage` object to a `RawProviderListing`.
 *
 * Returns `{ listing: null, error: '<message>' }` when the product is unusable
 * (e.g. missing name). Callers are responsible for type filtering before calling.
 * Never throws.
 */
function mapProductPage(raw: Record<string, unknown>, slug: string): MappedProduct {
  const title = readString(raw['name']);
  if (title === null) {
    return { listing: null, error: `productPage[${slug}]: missing name` };
  }

  const author = resolveAuthors(raw['authors']);
  const isbn = normalizeIsbn(readString(raw['isbn']));

  const priceKopecks = bookClubPriceToKopecks(raw['cost']);
  const price: Money | null = priceKopecks !== null ? toMoney(priceKopecks) : null;

  let availability: Availability;
  if (price === null) {
    availability = 'out-of-stock';
  } else if (raw['available'] === true) {
    availability = 'in-stock';
  } else if (raw['available'] === false) {
    availability = 'out-of-stock';
  } else {
    availability = 'unknown';
  }

  const listing: RawProviderListing = {
    provider: 'book-club',
    title,
    author,
    isbn,
    price,
    url: buildProductUrl(slug),
    availability,
    coverUrl: buildCoverUrl(raw['image']),
    description: null,
  };

  return { listing, error: null };
}

/**
 * Parse an alias-batch `productPage` GraphQL response into a list of listings.
 *
 * For each slug at index `i`, the alias `p${i}` is looked up in `response.data`.
 * - Alias present in `errors[].path` AND data is null → an error is recorded.
 * - Alias absent from errors AND data is null/undefined → silent skip (no such product).
 * - `type !== 'paper'` → silent skip (no error).
 * - `name` missing → error recorded.
 *
 * Pure function — no IO, never throws.
 */
export function parseProductPageBatch(response: GraphqlResponse, slugs: string[]): BatchResult {
  const errors: string[] = [];
  const listings: RawProviderListing[] = [];

  // Build a map of alias → error message for aliases that appear in response.errors
  const aliasErrors = new Map<string, string>();
  if (Array.isArray(response.errors)) {
    let hasNonPathError = false;
    for (const err of response.errors) {
      if (typeof err?.message !== 'string') continue;
      const path = err.path;
      if (Array.isArray(path) && typeof path[0] === 'string') {
        aliasErrors.set(path[0] as string, err.message);
      } else {
        if (!hasNonPathError) {
          errors.push(err.message);
          hasNonPathError = true;
        }
      }
    }
  }

  const data =
    typeof response.data === 'object' && response.data !== null
      ? (response.data as Record<string, unknown>)
      : {};

  for (let i = 0; i < slugs.length; i++) {
    const slug = slugs[i] as string;
    const alias = `p${i}`;
    const raw = data[alias];

    if (raw === null || raw === undefined) {
      const errMsg = aliasErrors.get(alias);
      if (errMsg !== undefined) {
        errors.push(`productPage[${slug}]: ${errMsg}`);
      }
      // silent skip when not in errors (non-existent slug)
      continue;
    }

    if (typeof raw !== 'object') continue;
    const rawObj = raw as Record<string, unknown>;

    // Type filter — only paper books
    if (rawObj['type'] !== 'paper') continue;

    const { listing, error } = mapProductPage(rawObj, slug);
    if (error !== null) {
      errors.push(error);
    } else if (listing !== null) {
      listings.push(listing);
    }
  }

  return { listings, errors };
}
