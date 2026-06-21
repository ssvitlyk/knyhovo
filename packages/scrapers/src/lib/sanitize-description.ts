import * as cheerio from 'cheerio';

/**
 * Description sanitization for product-page enrichment (W9a F2).
 *
 * Provider product pages expose descriptions as HTML. To satisfy the security
 * rule "user input is validated at the system boundary", the markup is reduced
 * to plain text at the scrape boundary so that no HTML ever reaches the DB or
 * the UI. This is the single XSS boundary for descriptions; the DB stores
 * markup-free plain text and the UI renders it as an (already escaped) text node.
 */

/**
 * Maximum stored description length, in characters (W9a F2).
 * A book blurb is well under this; the cap guards against bloated rows.
 */
export const DESCRIPTION_MAX_CHARS = 4000;

/** Collapse all runs of whitespace (incl. newlines) to single spaces and trim. */
function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Truncate to at most DESCRIPTION_MAX_CHARS, preferring a word boundary, and
 * append an ellipsis when content was dropped. Input is assumed already trimmed.
 */
function truncate(text: string): string {
  if (text.length <= DESCRIPTION_MAX_CHARS) return text;
  // Reserve one char for the ellipsis.
  const limit = DESCRIPTION_MAX_CHARS - 1;
  const slice = text.slice(0, limit);
  const lastSpace = slice.lastIndexOf(' ');
  // Cut on the last word boundary unless that would discard most of the text.
  const cut = lastSpace > limit * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

/**
 * Sanitize a raw HTML (or plain-text) description fragment into stored form.
 *
 * Steps (pure, deterministic, no network):
 *   1. parse with cheerio and extract text content — strips all tags/scripts;
 *   2. normalize whitespace and trim;
 *   3. return null when the result is empty;
 *   4. truncate to DESCRIPTION_MAX_CHARS on a word boundary with an ellipsis.
 *
 * Returns null for null/undefined/empty input so callers can pass through a
 * missing description without special-casing.
 */
export function sanitizeDescription(rawHtml: string | null | undefined): string | null {
  if (rawHtml == null) return null;

  const $ = cheerio.load(rawHtml);
  // Drop non-content elements before extracting text — their textual content
  // (e.g. inline scripts/styles) must never leak into the stored description.
  $('script, style, noscript, template, iframe').remove();

  const text = normalizeWhitespace($.root().text());
  if (text === '') return null;

  return truncate(text);
}
