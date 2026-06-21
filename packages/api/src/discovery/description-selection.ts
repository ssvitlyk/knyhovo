import type { ProviderName } from '@knyhovo/shared';

/**
 * Discovery description-selection (W9a F2).
 *
 * Deterministic, pure display-description selection for Book Details. A canonical
 * book may carry several provider listings, each with its own (possibly null)
 * description; this picks exactly one to display.
 *
 * Mirrors the provider-priority + price-tiebreak rule of cover-selection.ts, but
 * is intentionally standalone — it neither imports nor alters selectCoverUrl.
 */

/**
 * Fixed provider priority for display-description selection (W9a §9).
 * Lower index wins. Providers absent from this list sort last.
 * Same order as cover selection so the two features stay consistent.
 */
export const DESCRIPTION_PROVIDER_PRIORITY: readonly ProviderName[] = ['yakaboo', 'vivat', 'book-ye'];

/** A single listing's contribution to description selection. */
export interface DescriptionCandidate {
  readonly provider: ProviderName;
  /** Description from the listing, or null/undefined when none was enriched. */
  readonly description?: string | null;
  /**
   * Price in the smallest currency unit (kopecks). Optional deterministic
   * tiebreak (ascending) between candidates of the same provider; candidates
   * without a price sort last within their provider.
   */
  readonly priceAmount?: number | null;
}

function priorityIndex(provider: ProviderName): number {
  const index = DESCRIPTION_PROVIDER_PRIORITY.indexOf(provider);
  return index === -1 ? DESCRIPTION_PROVIDER_PRIORITY.length : index;
}

function hasDescription(text: string | null | undefined): text is string {
  return typeof text === 'string' && text.trim() !== '';
}

function priceOrLast(amount: number | null | undefined): number {
  return typeof amount === 'number' && Number.isFinite(amount)
    ? amount
    : Number.POSITIVE_INFINITY;
}

/**
 * Select the display description from a set of listing candidates.
 *
 * Rule (deterministic — no random, no time dependency):
 *   1. sort candidates by provider priority (yakaboo → vivat → book-ye), then
 *      by ascending price as a stable tiebreak;
 *   2. return the first candidate that carries a non-empty description;
 *   3. return null when no candidate has a usable description.
 *
 * Book Details passes ALL listings (in-stock and out-of-stock alike).
 */
export function selectDescription(candidates: readonly DescriptionCandidate[]): string | null {
  const ordered = [...candidates].sort((a, b) => {
    const byPriority = priorityIndex(a.provider) - priorityIndex(b.provider);
    if (byPriority !== 0) return byPriority;
    return priceOrLast(a.priceAmount) - priceOrLast(b.priceAmount);
  });

  for (const candidate of ordered) {
    if (hasDescription(candidate.description)) {
      return candidate.description.trim();
    }
  }
  return null;
}
