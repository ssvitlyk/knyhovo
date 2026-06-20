import type { ProviderName } from '@knyhovo/shared';

/**
 * Discovery cover-selection foundation (W9a F1).
 *
 * Deterministic, pure display-cover selection shared by Search, Wishlist and
 * Book Details. A canonical book may carry several provider listings, each with
 * its own (possibly null) cover; this picks exactly one cover URL to display.
 *
 * Not wired into any DTO yet — this is the reusable foundation layer only.
 */

/**
 * Fixed provider priority for display-cover selection (W9a §9).
 * Lower index wins. Providers absent from this list sort last.
 */
export const COVER_PROVIDER_PRIORITY: readonly ProviderName[] = ['yakaboo', 'vivat', 'book-ye'];

/** A single listing's contribution to cover selection. */
export interface CoverCandidate {
  readonly provider: ProviderName;
  /** Cover URL from the listing, or null/undefined when none was scraped. */
  readonly coverUrl?: string | null;
  /**
   * Price in the smallest currency unit (kopecks). Optional deterministic
   * tiebreak (ascending) between candidates of the same provider; candidates
   * without a price sort last within their provider.
   */
  readonly priceAmount?: number | null;
}

function priorityIndex(provider: ProviderName): number {
  const index = COVER_PROVIDER_PRIORITY.indexOf(provider);
  return index === -1 ? COVER_PROVIDER_PRIORITY.length : index;
}

function hasCover(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.trim() !== '';
}

function priceOrLast(amount: number | null | undefined): number {
  return typeof amount === 'number' && Number.isFinite(amount)
    ? amount
    : Number.POSITIVE_INFINITY;
}

/**
 * Select the display cover URL from a set of listing candidates.
 *
 * Rule (deterministic — no random, no time dependency):
 *   1. sort candidates by provider priority (yakaboo → vivat → book-ye), then
 *      by ascending price as a stable tiebreak;
 *   2. return the first candidate that carries a non-empty cover URL;
 *   3. return null when no candidate has a usable cover.
 *
 * The caller decides which listings are eligible (e.g. Search passes only
 * in-stock listings; Book Details passes all of them).
 */
export function selectCoverUrl(candidates: readonly CoverCandidate[]): string | null {
  const ordered = [...candidates].sort((a, b) => {
    const byPriority = priorityIndex(a.provider) - priorityIndex(b.provider);
    if (byPriority !== 0) return byPriority;
    return priceOrLast(a.priceAmount) - priceOrLast(b.priceAmount);
  });

  for (const candidate of ordered) {
    if (hasCover(candidate.coverUrl)) {
      return candidate.coverUrl.trim();
    }
  }
  return null;
}
