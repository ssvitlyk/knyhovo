import type { ProviderName, Availability } from '@knyhovo/shared';
import type { BookListingRow, BookDetailsRow } from './repository.js';
import type { BookProviderDto, BookDetailsDto, MoneyDto } from './dto.js';
import { selectDescription } from '../discovery/description-selection.js';

/** Reverse map from the persisted provider enum to its public slug. */
const PROVIDER_SLUG: Record<BookListingRow['provider'], ProviderName> = {
  YAKABOO: 'yakaboo',
  BOOK_CLUB: 'book-club',
  VIVAT: 'vivat',
  BOOK_YE: 'book-ye',
};

/** Reverse map from the persisted availability enum to its public slug. */
const AVAILABILITY_SLUG: Record<BookListingRow['availability'], Availability> = {
  IN_STOCK: 'in-stock',
  OUT_OF_STOCK: 'out-of-stock',
  UNKNOWN: 'unknown',
};

/** A listing counts as priced only when it carries a usable numeric amount. */
function hasPrice(listing: BookListingRow): boolean {
  return listing.priceAmount != null && Number.isFinite(listing.priceAmount);
}

/**
 * Map a canonical book row to a book details DTO.
 *
 * - Listings without a usable price are ignored (defensive — the DB column is
 *   non-null, but the contract requires skipping null prices).
 * - OUT_OF_STOCK listings are excluded from `providers`, `lowestPrice` and
 *   `offersCount`; UNKNOWN listings are included.
 * - `providers` are sorted by ascending price; `lowestPrice` is the cheapest.
 * - Unlike the search mapper, this function NEVER returns null — the book
 *   record itself is always returned, even when all its listings are
 *   out-of-stock or absent (`providers: [], lowestPrice: null, offersCount: 0`).
 *   This allows the UI to display the book detail page with an "unavailable"
 *   state rather than a 404.
 */
export function toBookDetails(row: BookDetailsRow): BookDetailsDto {
  const providers: BookProviderDto[] = row.listings
    .filter(hasPrice)
    .filter((l) => l.availability !== 'OUT_OF_STOCK')
    .map((l) => ({
      provider: PROVIDER_SLUG[l.provider],
      price: { amount: l.priceAmount, currency: l.priceCurrency } satisfies MoneyDto,
      availability: AVAILABILITY_SLUG[l.availability],
      url: l.url,
      lastSeenAt: l.lastSeenAt.toISOString(),
    }))
    .sort((a, b) => a.price.amount - b.price.amount);

  const lowestPrice: MoneyDto | null = providers[0]?.price ?? null;
  const offersCount = providers.length;

  // Description is selected across ALL listings (in-stock and out-of-stock alike,
  // W9a §8) by provider priority with an ascending-price tiebreak — independent
  // of the in-stock `providers` filtering above.
  const description = selectDescription(
    row.listings.map((l) => ({
      provider: PROVIDER_SLUG[l.provider],
      description: l.description,
      priceAmount: l.priceAmount,
    })),
  );

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    isbn: row.isbn ?? null,
    description,
    coverUrl: null,
    lowestPrice,
    offersCount,
    providers,
  };
}
