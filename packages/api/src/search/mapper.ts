import type { ProviderName } from '@knyhovo/shared';
import type { CanonicalBookRow, ListingRow } from './repository.js';
import type { ProviderOfferDto, SearchItemDto } from './dto.js';

/** Reverse map from the persisted provider enum to its public slug. */
const PROVIDER_SLUG: Record<ListingRow['provider'], ProviderName> = {
  YAKABOO: 'yakaboo',
  BOOK_CLUB: 'book-club',
};

/** A listing counts as priced only when it carries a usable numeric amount. */
function hasPrice(listing: ListingRow): boolean {
  return listing.priceAmount != null && Number.isFinite(listing.priceAmount);
}

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
  const providers: ProviderOfferDto[] = row.listings
    .filter(hasPrice)
    .map((listing) => ({
      provider: PROVIDER_SLUG[listing.provider],
      price: { amount: listing.priceAmount, currency: listing.priceCurrency },
    }))
    .sort((a, b) => a.price.amount - b.price.amount);

  if (providers.length === 0) {
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    lowestPrice: providers[0]!.price,
    offersCount: providers.length,
    providers,
  };
}
