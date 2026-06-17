import type { BookProviderDto } from '@/lib/api/types';

/**
 * Client-side store-offers intelligence (W6a). Pure helpers over the existing
 * `BookProviderDto` contract — no backend, schema, or API changes. Best-offer
 * derivation, display ordering, and the panel state are all computed here so
 * OffersPanel can reason about availability and price ties using only fields the
 * API already returns.
 *
 * Money is compared in `price.amount` (kopiyky). `availability: 'unknown'` is
 * treated conservatively as NOT out-of-stock (a valid candidate), but is never
 * ranked ahead of an equal-priced offer beyond the deterministic
 * price-then-provider ordering below.
 */

/** Panel presentation state derived from the current offer set. */
export type OfferState = 'empty' | 'cheapest-but-oos' | 'same-price' | 'cheapest-best' | 'normal';

/** An offer counts as available unless it is explicitly out-of-stock. */
function isAvailable(offer: BookProviderDto): boolean {
  return offer.availability !== 'out-of-stock';
}

/**
 * Deterministic comparator: ascending price, then provider name as a stable
 * tie-break so ordering never depends on input order or runtime state.
 */
function byPriceThenProvider(a: BookProviderDto, b: BookProviderDto): number {
  if (a.price.amount !== b.price.amount) {
    return a.price.amount - b.price.amount;
  }
  return a.provider.localeCompare(b.provider);
}

/** Pick the single cheapest offer from a non-empty list using the deterministic comparator. */
function pickCheapest(offers: readonly BookProviderDto[]): BookProviderDto {
  return offers.reduce((best, offer) => (byPriceThenProvider(offer, best) < 0 ? offer : best));
}

/** Absolute lowest-priced offer across ALL offers, regardless of availability. */
export function getCheapestOffer(offers: readonly BookProviderDto[]): BookProviderDto | null {
  if (offers.length === 0) return null;
  return pickCheapest(offers);
}

/** Lowest-priced offer among those that are not out-of-stock (`unknown` counts as available). */
export function getCheapestAvailableOffer(
  offers: readonly BookProviderDto[],
): BookProviderDto | null {
  const available = offers.filter(isAvailable);
  if (available.length === 0) return null;
  return pickCheapest(available);
}

/**
 * The recommended offer: the cheapest available one when any offer is in stock /
 * unknown; otherwise it falls back to the cheapest out-of-stock offer (callers
 * must not present that fallback as available).
 */
export function getBestOffer(offers: readonly BookProviderDto[]): BookProviderDto | null {
  return getCheapestAvailableOffer(offers) ?? getCheapestOffer(offers);
}

/**
 * Derive the panel state. Precedence is fixed and documented:
 *   empty → cheapest-but-oos → same-price → cheapest-best → normal.
 */
export function getOfferState(offers: readonly BookProviderDto[]): OfferState {
  if (offers.length === 0) return 'empty';

  const cheapest = getCheapestOffer(offers)!;
  const cheapestAvailable = getCheapestAvailableOffer(offers);

  // The cheapest listing isn't buyable, but a pricier available one exists.
  if (
    !isAvailable(cheapest) &&
    cheapestAvailable !== null &&
    cheapestAvailable.price.amount > cheapest.price.amount
  ) {
    return 'cheapest-but-oos';
  }

  // More than one available offer shares the lowest available price.
  const available = offers.filter(isAvailable);
  if (available.length > 0) {
    const lowest = pickCheapest(available).price.amount;
    const atLowest = available.filter((offer) => offer.price.amount === lowest);
    if (atLowest.length > 1) return 'same-price';
  }

  // The cheapest offer is also the recommended one.
  if (getBestOffer(offers) === cheapest) return 'cheapest-best';

  return 'normal';
}

/**
 * Return a NEW array ordered for display: available/unknown offers first
 * (ascending price), then out-of-stock offers (ascending price). Equal prices
 * break on provider name. Never mutates the input.
 */
export function sortOffers(offers: readonly BookProviderDto[]): BookProviderDto[] {
  return [...offers].sort((a, b) => {
    const aOut = a.availability === 'out-of-stock';
    const bOut = b.availability === 'out-of-stock';
    if (aOut !== bOut) return aOut ? 1 : -1;
    return byPriceThenProvider(a, b);
  });
}
