/**
 * Normalize a raw input value into the search **request/cache key**: leading and
 * trailing whitespace is dropped and inner runs collapse to a single space, so
 * `"ab "`, `" ab"` and `"ab"` are one query and never cause an extra request.
 *
 * This is the ONLY normalization applied to what the user typed before it is
 * sent, cached or put in `?q=` — every surface uses it. Deliberately distinct
 * from {@link normalizeQuery} below, which lowercases and folds apostrophes for
 * *comparison* (author matching, corrections) and would change what the user
 * sees in the URL.
 */
export function normalizeSearchInput(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * Normalize a free-text query for case/whitespace/apostrophe-insensitive comparison.
 *
 * Steps applied in order:
 * 1. Coerce to string and apply Unicode NFC normalization.
 * 2. Lowercase with Ukrainian locale.
 * 3. Collapse all internal whitespace runs to a single ASCII space and trim.
 * 4. Convert apostrophe variants (’ ‘ ʼ ` ´ ′) to a straight apostrophe `'`.
 */
export function normalizeQuery(input: string): string {
  // U+2019 ’ · U+2018 ‘ · U+02BC ʼ (Ukrainian) · U+0060 ` · U+00B4 ´ · U+2032 ′
  const APOSTROPHE_RE = /[\u2018\u2019\u02BC\u0060\u00B4\u2032]/g;

  return String(input)
    .normalize('NFC')
    .toLocaleLowerCase('uk')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(APOSTROPHE_RE, "'");
}
