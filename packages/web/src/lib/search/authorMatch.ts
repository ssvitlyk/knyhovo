import type { SearchItemDto } from '@/lib/api/types';
import { normalizeQuery } from './normalize';

/**
 * Detect an EXACT author match from existing search results only (W7a Author Jump).
 *
 * Returns a display author string ONLY when:
 * - `items` is non-empty, AND
 * - exactly ONE distinct normalized author value across all items equals the normalized query.
 *
 * Returns the original-cased `author` from the first matching item.
 * Returns `null` on zero matches, ambiguous matches, empty input, or empty items list —
 * the caller should hide the author-jump card in those cases.
 *
 * No fuzzy matching or external index lookups — pure, deterministic, in-memory.
 */
export function findAuthorExactMatch(
  query: string,
  items: readonly SearchItemDto[],
): string | null {
  if (items.length === 0) {
    return null;
  }

  const normalizedQuery = normalizeQuery(query);

  // Collect all distinct normalized authors from the result set.
  const distinctAuthors = new Set<string>();
  for (const item of items) {
    distinctAuthors.add(normalizeQuery(item.author));
  }

  // The query must match exactly one distinct normalized author.
  const matchingAuthors = [...distinctAuthors].filter((a) => a === normalizedQuery);

  if (matchingAuthors.length !== 1) {
    return null;
  }

  // Return the original-cased author from the first item whose normalized author matches.
  const firstMatch = items.find((item) => normalizeQuery(item.author) === normalizedQuery);
  return firstMatch?.author ?? null;
}
