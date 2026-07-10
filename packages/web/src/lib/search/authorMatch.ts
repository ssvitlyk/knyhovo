import type { SearchItemDto } from '@/lib/api/types';
import { normalizeQuery } from './normalize';

/**
 * Detect a token-based author match from existing search results (W7a Author Jump).
 *
 * Individual authors are extracted from each item's `author` field by splitting on
 * commas (anthology items like "Іван Франко, Макс Кідрук" contribute one candidate
 * per name). A distinct author is a candidate when EVERY normalized query token is
 * present in that author's normalized token set — this makes a surname-only query
 * ("Кідрук") match a full name ("Макс Кідрук"), and a full-name query match
 * regardless of token order. No fuzzy/edit-distance matching — exact token
 * membership only.
 *
 * Returns a display author string ONLY when:
 * - `items` is non-empty, AND
 * - the (trimmed, normalized) query is non-empty, AND
 * - exactly ONE distinct author across all items qualifies as a candidate, AND
 * - that candidate's normalized form is NOT identical to the normalized query —
 *   otherwise the jump card would link to the exact search the user is already on
 *   (a self-referential no-op), so it must be hidden.
 *
 * Returns the original-cased, trimmed author string as first seen across items.
 * Returns `null` on zero/ambiguous candidates, empty input, empty items list, or a
 * self-referential match — the caller should hide the author-jump card in those cases.
 *
 * No fuzzy matching or external index lookups — pure, deterministic, in-memory.
 */
export function findAuthorMatch(
  query: string,
  items: readonly SearchItemDto[],
): string | null {
  if (items.length === 0) {
    return null;
  }

  const nq = normalizeQuery(query);
  if (nq === '') {
    return null;
  }

  const queryTokens = nq.split(' ');

  // Build the distinct set of individual authors (comma-split) seen across all items,
  // keyed by normalized form, keeping the first-seen original-cased display string.
  const distinctAuthors = new Map<string, string>();
  for (const item of items) {
    for (const rawPart of item.author.split(',')) {
      const part = rawPart.trim();
      if (part === '') {
        continue;
      }
      const key = normalizeQuery(part);
      if (!distinctAuthors.has(key)) {
        distinctAuthors.set(key, part);
      }
    }
  }

  // A candidate qualifies when every query token appears among the author's tokens.
  const candidates = [...distinctAuthors.entries()].filter(([key]) => {
    const authorTokens = new Set(key.split(' '));
    return queryTokens.every((token) => authorTokens.has(token));
  });

  if (candidates.length !== 1) {
    return null;
  }

  const [candidateKey, candidateDisplay] = candidates[0];

  // Self-referential guard: the query already IS this author, so jumping would be a no-op.
  if (candidateKey === nq) {
    return null;
  }

  return candidateDisplay;
}
