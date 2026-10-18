import type { ProviderName } from '@knyhovo/shared';

/**
 * Shared ordering for the discovery selectors (cover, description, metadata).
 * Deterministic and pure — no random, no time dependency.
 */

/**
 * Fixed provider priority for display selection (W9a §9, book-metadata PRD).
 * Lower index wins. Providers absent from this list sort last.
 */
export const PROVIDER_PRIORITY: readonly ProviderName[] = ['yakaboo', 'vivat', 'book-ye'];

/** The minimum a candidate must expose to be ordered. */
export interface OrderableCandidate {
  readonly provider: ProviderName;
  /** Price in kopecks; missing/non-finite sorts last within a provider. */
  readonly priceAmount?: number | null;
}

function priorityIndex(provider: ProviderName): number {
  const index = PROVIDER_PRIORITY.indexOf(provider);
  return index === -1 ? PROVIDER_PRIORITY.length : index;
}

function priceOrLast(amount: number | null | undefined): number {
  return typeof amount === 'number' && Number.isFinite(amount)
    ? amount
    : Number.POSITIVE_INFINITY;
}

/** Return a copy sorted by provider priority, then ascending price (stable tiebreak). */
export function orderByProviderThenPrice<T extends OrderableCandidate>(
  candidates: readonly T[],
): T[] {
  return [...candidates].sort((a, b) => {
    const byPriority = priorityIndex(a.provider) - priorityIndex(b.provider);
    if (byPriority !== 0) return byPriority;
    return priceOrLast(a.priceAmount) - priceOrLast(b.priceAmount);
  });
}
