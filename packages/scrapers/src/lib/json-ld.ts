import type * as cheerio from 'cheerio';
import type { Availability } from '@knyhovo/shared';
import { errMsg } from './errors.js';

/** Selector for every JSON-LD `<script>` block on a page. */
export const JSON_LD_SELECTOR = 'script[type="application/ld+json"]';

export function matchesType(type: unknown, wanted: string): boolean {
  if (type === wanted) return true;
  if (Array.isArray(type)) return type.includes(wanted);
  return false;
}

/**
 * Find the first object with the given `@type` within a parsed JSON-LD value.
 * Handles single objects, arrays of objects and `@graph` containers.
 */
export function findByType(parsed: unknown, wanted: string): Record<string, unknown> | null {
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

export interface JsonLdBlocksOptions {
  /**
   * Return as soon as every wanted type has been found, without inspecting (or
   * recording malformed JSON in) the remaining blocks. Default: scan all blocks.
   */
  readonly stopWhenFound?: boolean;
}

export interface JsonLdBlocksResult {
  /** First object found per wanted `@type` (null when absent), keyed by type. */
  readonly found: Record<string, Record<string, unknown> | null>;
  readonly errors: string[];
}

/**
 * Read the first object of each wanted `@type` out of a page's JSON-LD blocks.
 * Pure — no IO. Malformed JSON in a block is recorded and skipped, never thrown;
 * a page without any JSON-LD script yields the error `no JSON-LD script found`.
 */
export function readJsonLdBlocks(
  $: cheerio.CheerioAPI,
  types: readonly string[],
  options: JsonLdBlocksOptions = {},
): JsonLdBlocksResult {
  const found: Record<string, Record<string, unknown> | null> = {};
  for (const type of types) found[type] = null;

  const errors: string[] = [];
  const blocks = $(JSON_LD_SELECTOR).toArray();
  if (blocks.length === 0) {
    return { found, errors: ['no JSON-LD script found'] };
  }

  for (const block of blocks) {
    const raw = $(block).contents().text().trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      errors.push(`malformed JSON-LD — ${errMsg(err)}`);
      continue;
    }
    for (const type of types) {
      if (found[type] === null) found[type] = findByType(parsed, type);
    }
    if (options.stopWhenFound === true && types.every((type) => found[type] !== null)) break;
  }

  return { found, errors };
}

export function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Read a schema.org name: a plain string or an object with a `name` string. */
export function readName(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() !== '' ? value.trim() : null;
  if (typeof value === 'object' && value !== null) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string' && name.trim() !== '') return name.trim();
  }
  return null;
}

/** First non-blank string out of a string or an array of strings. */
export function firstNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed !== '' ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.trim() !== '') return item.trim();
    }
  }
  return null;
}

/**
 * Build a resolver turning a JSON-LD `image` value (string or array of strings)
 * into an absolute cover URL: absolute URLs pass through, protocol-relative
 * `//host/...` get an `https:` scheme, site-relative paths are prefixed with
 * `baseUrl`. Returns null for missing/blank/non-string values.
 */
export function makeCoverUrlBuilder(baseUrl: string): (image: unknown) => string | null {
  return (image) => {
    const raw = firstNonEmptyString(image);
    if (raw === null) return null;
    if (raw.startsWith('http')) return raw;
    if (raw.startsWith('//')) return `https:${raw}`;
    return `${baseUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;
  };
}

export interface SchemaOrgAvailabilityOptions {
  /** Treat `discontinued` as out-of-stock (default true). BookChef leaves it `unknown`. */
  readonly discontinued?: boolean;
}

/**
 * Map a schema.org availability value (e.g. `https://schema.org/InStock`) to the
 * shared Availability enum. A missing price always wins → out-of-stock.
 */
export function resolveSchemaOrgAvailability(
  availability: unknown,
  hasPrice: boolean,
  options: SchemaOrgAvailabilityOptions = {},
): Availability {
  if (!hasPrice) return 'out-of-stock';
  if (typeof availability !== 'string') return 'unknown';
  const suffix = availability.split('/').pop()?.toLowerCase().trim() ?? '';
  if (suffix === 'instock' || suffix === 'preorder') return 'in-stock';
  if (
    suffix === 'outofstock' ||
    suffix === 'soldout' ||
    (options.discontinued !== false && suffix === 'discontinued')
  ) {
    return 'out-of-stock';
  }
  return 'unknown';
}
