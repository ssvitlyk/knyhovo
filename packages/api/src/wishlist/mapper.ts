import { selectCoverUrl } from '../discovery/cover-selection.js';
import type { WishlistRow } from './repository.js';
import type { WishlistProviderDto, WishlistBookDto, WishlistItemDto, WishlistResponseDto, AlertDto, WishlistGenreDto } from './dto.js';
import type { MoneyDto } from '../pricing/money.js';
import { PROVIDER_SLUG } from '../pricing/provider-maps.js';
import { toOfferDtos } from '../pricing/offers.js';
import { deriveAlertState, toLifecycle, ALERT_MODE_SLUG } from './alert/service.js';
import { canonicalPriceAmount } from '../pricing/canonical-price.js';

/**
 * Map an array of wishlist rows to a wishlist response DTO.
 *
 * - Listings without a usable price are ignored (defensive — the DB column is
 *   non-null, but the contract requires skipping null prices).
 * - `providers` / `offersCount` are the offers we are willing to SHOW: everything
 *   except OUT_OF_STOCK (UNKNOWN included), sorted by ascending price.
 * - `lowestPrice` is the **canonical price** (notifications-model-v2 §4): the
 *   cheapest strictly-IN_STOCK offer, shared with the alert engine via
 *   `canonicalPriceAmount`. It is therefore not always `providers[0].price` — an
 *   UNKNOWN-availability listing may be displayed but can never define the price
 *   a promise is made about.
 * - Unlike the search mapper, books are NEVER dropped — even when all listings
 *   are OUT_OF_STOCK the book stays in the wishlist with providers: [],
 *   lowestPrice: null, offersCount: 0.
 */
export function toWishlistResponse(rows: WishlistRow[]): WishlistResponseDto {
  const items: WishlistItemDto[] = rows.map((row): WishlistItemDto => {
    const providers: WishlistProviderDto[] = toOfferDtos(row.canonicalBook.listings);

    const canonicalAmount = canonicalPriceAmount(row.canonicalBook.listings);
    const lowestPrice: MoneyDto | null =
      canonicalAmount === null
        ? null
        : { amount: canonicalAmount, currency: providers[0]?.price.currency ?? 'UAH' };
    const offersCount = providers.length;

    const alertRow = row.alert ?? null;
    const alert: AlertDto | null = alertRow
      ? {
          state: deriveAlertState(
            {
              lifecycle: toLifecycle(alertRow.status),
              lastNotifiedAt: alertRow.lastNotifiedAt,
            },
            canonicalAmount,
          ),
          mode: ALERT_MODE_SLUG[alertRow.mode],
          threshold: {
            amount: alertRow.targetPriceAmount,
            currency: alertRow.targetPriceCurrency,
          },
          baseline:
            alertRow.baselineAmount === null
              ? null
              : { amount: alertRow.baselineAmount, currency: alertRow.targetPriceCurrency },
          thresholdProof: alertRow.thresholdProof,
          pausedAt: alertRow.pausedAt ? alertRow.pausedAt.toISOString() : null,
          notifiedAt: alertRow.lastNotifiedAt ? alertRow.lastNotifiedAt.toISOString() : null,
        }
      : null;

    const coverUrl = selectCoverUrl(
      row.canonicalBook.listings.map((l) => ({
        provider: PROVIDER_SLUG[l.provider],
        coverUrl: l.coverUrl,
        priceAmount: l.priceAmount,
      })),
    );

    const genre: WishlistGenreDto | null = row.canonicalBook.genre
      ? { slug: row.canonicalBook.genre.slug, name: row.canonicalBook.genre.name }
      : null;

    const book: WishlistBookDto = {
      id: row.canonicalBook.id,
      title: row.canonicalBook.title,
      author: row.canonicalBook.author,
      isbn: row.canonicalBook.isbn ?? null,
      coverUrl,
      lowestPrice,
      offersCount,
      providers,
      genre,
    };

    return {
      book,
      createdAt: row.createdAt.toISOString(),
      alert,
    };
  });

  return { items };
}
