/**
 * Single source of truth for live-search behaviour.
 *
 * Every search surface (global header capsule, mobile overlay, homepage hero,
 * `/search` typeahead) reads these values — there are deliberately no local
 * copies. Presentation may differ per surface; these numbers may not.
 */

/** Minimum number of normalized characters before any suggestion request runs. */
export const SEARCH_MIN_QUERY_LENGTH = 2;

/** Debounce applied to the normalized query before fetching suggestions. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Autocomplete fan-out — a short list, never a full results page. */
export const SEARCH_SUGGESTIONS_LIMIT = 8;

/** Canonical full-results route. Every submit lands here. */
export const SEARCH_RESULTS_PATH = '/search';

/** Build the canonical results URL for an already-normalized query. */
export function searchResultsHref(normalizedQuery: string): string {
  return normalizedQuery === ''
    ? SEARCH_RESULTS_PATH
    : `${SEARCH_RESULTS_PATH}?q=${encodeURIComponent(normalizedQuery)}`;
}
