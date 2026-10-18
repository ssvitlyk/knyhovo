import { selectCoverUrl } from '../discovery/cover-selection.js';
import type { CanonicalBookRow } from './repository.js';
import { PROVIDER_SLUG } from '../pricing/provider-maps.js';
import { eligibleListings } from '../pricing/offers.js';
import type { ProviderOfferDto, SearchItemDto } from './dto.js';

/**
 * Map a canonical book row to a search item DTO.
 *
 * - Listings without a usable price are ignored (defensive — the DB column is
 *   non-null, but the contract requires skipping null prices).
 * - `providers` are sorted by ascending price; `lowestPrice` is the cheapest.
 * - Returns `null` when the book has no priced listings, so callers can exclude
 *   it from the results.
 */
export function toSearchItem(row: CanonicalBookRow): SearchItemDto | null {
  const eligible = eligibleListings(row.listings);

  const providers: ProviderOfferDto[] = eligible
    .map((listing) => ({
      provider: PROVIDER_SLUG[listing.provider],
      price: { amount: listing.priceAmount, currency: listing.priceCurrency },
    }))
    .sort((a, b) => a.price.amount - b.price.amount);

  if (providers.length === 0) {
    return null;
  }

  // Reuse the shared F1 selector so the displayed cover follows the approved
  // provider-priority rule and stays consistent with the offers shown.
  const coverUrl = selectCoverUrl(
    eligible.map((listing) => ({
      provider: PROVIDER_SLUG[listing.provider],
      coverUrl: listing.coverUrl,
      priceAmount: listing.priceAmount,
    })),
  );

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    lowestPrice: providers[0]!.price,
    offersCount: providers.length,
    providers,
    coverUrl,
  };
}
