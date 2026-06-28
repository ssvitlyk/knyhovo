import type { ProviderName, Availability } from '@knyhovo/shared';
import { selectCoverUrl } from '../discovery/cover-selection.js';
import type { WishlistRow, WishlistListingRow } from './repository.js';
import type { WishlistProviderDto, WishlistBookDto, WishlistItemDto, WishlistResponseDto, MoneyDto, AlertDto } from './dto.js';
import { deriveAlertStatus, ALERT_INTENT_SLUG } from './alert/service.js';

/** Reverse map from the persisted provider enum to its public slug. */
const PROVIDER_SLUG: Record<WishlistListingRow['provider'], ProviderName> = {
  YAKABOO: 'yakaboo',
  BOOK_CLUB: 'book-club',
  VIVAT: 'vivat',
  BOOK_YE: 'book-ye',
  BOOKCHEF: 'bookchef',
  LABORATORY: 'laboratory',
};

/** Reverse map from the persisted availability enum to its public slug. */
const AVAILABILITY_SLUG: Record<WishlistListingRow['availability'], Availability> = {
  IN_STOCK: 'in-stock',
  OUT_OF_STOCK: 'out-of-stock',
  UNKNOWN: 'unknown',
};

/** A listing counts as priced only when it carries a usable numeric amount. */
function hasPrice(listing: WishlistListingRow): boolean {
  return listing.priceAmount != null && Number.isFinite(listing.priceAmount);
}

/**
 * Map an array of wishlist rows to a wishlist response DTO.
 *
 * - Listings without a usable price are ignored (defensive — the DB column is
 *   non-null, but the contract requires skipping null prices).
 * - OUT_OF_STOCK listings are excluded from `providers`, `lowestPrice` and
 *   `offersCount`; UNKNOWN listings are included.
 * - `providers` are sorted by ascending price; `lowestPrice` is the cheapest.
 * - Unlike the search mapper, books are NEVER dropped — even when all listings
 *   are OUT_OF_STOCK the book stays in the wishlist with providers: [],
 *   lowestPrice: null, offersCount: 0.
 */
export function toWishlistResponse(rows: WishlistRow[]): WishlistResponseDto {
  const items: WishlistItemDto[] = rows.map((row): WishlistItemDto => {
    const providers: WishlistProviderDto[] = row.canonicalBook.listings
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

    const alertRow = row.alert ?? null;
    const alert: AlertDto | null = alertRow
      ? {
          status: deriveAlertStatus(
            { status: alertRow.status, targetPriceAmount: alertRow.targetPriceAmount },
            lowestPrice,
            offersCount,
          ),
          intent: ALERT_INTENT_SLUG[alertRow.intent],
          targetPrice: { amount: alertRow.targetPriceAmount, currency: alertRow.targetPriceCurrency },
          pausedAt: alertRow.pausedAt ? alertRow.pausedAt.toISOString() : null,
        }
      : null;

    const coverUrl = selectCoverUrl(
      row.canonicalBook.listings.map((l) => ({
        provider: PROVIDER_SLUG[l.provider],
        coverUrl: l.coverUrl,
        priceAmount: l.priceAmount,
      })),
    );

    const book: WishlistBookDto = {
      id: row.canonicalBook.id,
      title: row.canonicalBook.title,
      author: row.canonicalBook.author,
      isbn: row.canonicalBook.isbn ?? null,
      coverUrl,
      lowestPrice,
      offersCount,
      providers,
    };

    return {
      book,
      createdAt: row.createdAt.toISOString(),
      alert,
    };
  });

  return { items };
}
