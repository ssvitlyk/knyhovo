import * as cheerio from 'cheerio';

/**
 * Edition-metadata sanitization for product-page enrichment (book-metadata PRD).
 *
 * Mirrors sanitize-description.ts: values extracted from provider product pages
 * are reduced to plain text at the scrape boundary (security rule — user input
 * is validated at the system boundary) with sane length limits. Values are
 * stored as provider text as-is — no dictionary normalization in v1.
 */

/** Default maximum stored length for a single metadata field, in characters. */
export const METADATA_MAX_CHARS = 200;

/** Earliest plausible publication year accepted by {@link parsePublicationYear}. */
const MIN_PUBLICATION_YEAR = 1400;
/** Latest plausible publication year accepted by {@link parsePublicationYear}. */
const MAX_PUBLICATION_YEAR = 2100;

/** Collapse all runs of whitespace (incl. newlines) to single spaces and trim. */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Sanitize a single edition-metadata value (publisher, language, format, series)
 * to plain text.
 *
 * Steps (pure, deterministic, no network):
 *   1. accept strings only — any other type returns null;
 *   2. parse with cheerio and extract text content — strips all tags/scripts;
 *   3. normalize whitespace and trim;
 *   4. return null when the result is empty;
 *   5. hard-cap at `maxLen` characters (simple truncation, no ellipsis — these
 *      are short field values, not prose).
 */
export function sanitizeMetadataValue(value: unknown, maxLen = METADATA_MAX_CHARS): string | null {
  if (typeof value !== 'string') return null;

  const $ = cheerio.load(value);
  $('script, style, noscript, template, iframe').remove();
  const text = normalizeWhitespace($.root().text());
  if (text === '') return null;

  return text.length > maxLen ? text.slice(0, maxLen) : text;
}

/**
 * Parse a publication year out of a provider-supplied value.
 *
 * Accepts a string or number that resolves to a 4-digit year within a sane
 * range ({@link MIN_PUBLICATION_YEAR}–{@link MAX_PUBLICATION_YEAR}); anything
 * else (malformed text, out-of-range numbers, other types) returns null.
 */
export function parsePublicationYear(value: unknown): number | null {
  let year: number;
  if (typeof value === 'number') {
    year = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!/^\d{4}$/.test(trimmed)) return null;
    year = Number(trimmed);
  } else {
    return null;
  }

  if (!Number.isInteger(year)) return null;
  if (year < MIN_PUBLICATION_YEAR || year > MAX_PUBLICATION_YEAR) return null;
  return year;
}
