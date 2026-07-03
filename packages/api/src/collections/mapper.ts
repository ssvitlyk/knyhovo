import type { CollectionBookRow, CollectionListingRow } from './repository.js';
import type { CollectionBookDto, MoneyDto } from './dto.js';

/** Display name shown to users for the store backing the cheapest listing. */
const PROVIDER_DISPLAY: Record<CollectionListingRow['provider'], string> = {
  YAKABOO: 'Yakaboo',
  BOOK_CLUB: 'BookClub',
  VIVAT: 'Vivat',
  BOOK_YE: 'Книгарня Є',
  BOOKCHEF: 'BookChef',
  LABORATORY: 'Лабораторія',
  KNIGOLAND: 'Книголенд',
};

/** A listing counts as priced only when it carries a usable numeric amount. */
function hasPrice(listing: CollectionListingRow): boolean {
  return listing.priceAmount != null && Number.isFinite(listing.priceAmount);
}

/** Per-request context needed to map books without N+1 queries. */
export interface CollectionMapperContext {
  readonly wishlistedIds: ReadonlySet<string>;
  readonly wishlistCounts: ReadonlyMap<string, number>;
}

/**
 * Map a canonical book row (with listings + price history) to a
 * {@link CollectionBookDto}.
 *
 * - `minPrice` is the cheapest listing with a usable price that is not
 *   OUT_OF_STOCK; `inStock` mirrors whether `minPrice` is non-null.
 * - `oldPrice` is the highest historical price recorded for the *cheapest*
 *   listing that is strictly greater than its current price; `discountPercent`
 *   is derived from that pair. Both are null when there is no real drop.
 * - `storeName` is the display name of the provider backing the cheapest
 *   listing; null when there is no available offer.
 * - `rating`/`reviewsCount` are always null at MVP (no data source yet).
 */
export function toCollectionBookDto(
  book: CollectionBookRow,
  ctx: CollectionMapperContext,
): CollectionBookDto {
  const pricedInStock = book.listings
    .filter(hasPrice)
    .filter((l) => l.availability !== 'OUT_OF_STOCK')
    .sort((a, b) => a.priceAmount - b.priceAmount);

  const cheapest = pricedInStock[0] ?? null;

  const minPrice: MoneyDto | null = cheapest
    ? { amount: cheapest.priceAmount, currency: cheapest.priceCurrency }
    : null;

  const storeName: string | null = cheapest ? PROVIDER_DISPLAY[cheapest.provider] : null;

  const coverUrl: string | null =
    pricedInStock.find((l) => l.coverUrl)?.coverUrl ??
    book.listings.find((l) => l.coverUrl)?.coverUrl ??
    null;

  let oldPrice: MoneyDto | null = null;
  let discountPercent: number | null = null;
  if (cheapest) {
    const highestHistorical = cheapest.priceHistory
      .filter((p) => p.priceAmount > cheapest.priceAmount)
      .reduce<number | null>((max, p) => (max === null || p.priceAmount > max ? p.priceAmount : max), null);
    if (highestHistorical !== null) {
      oldPrice = { amount: highestHistorical, currency: cheapest.priceCurrency };
      discountPercent = Math.round(((highestHistorical - cheapest.priceAmount) / highestHistorical) * 100);
    }
  }

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    coverUrl,
    minPrice,
    oldPrice,
    discountPercent,
    storeName,
    rating: null, // TODO: no ratings data source yet (MVP)
    reviewsCount: null, // TODO: no reviews data source yet (MVP)
    wishlistCount: ctx.wishlistCounts.get(book.id) ?? 0,
    isWishlisted: ctx.wishlistedIds.has(book.id),
    inStock: minPrice !== null,
    catalogAddedAt: book.createdAt.toISOString(),
  };
}
