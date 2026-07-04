import type { CollectionBookRow, CollectionListingRow, CollectionRow } from './repository.js';
import type { BookCardDataDto, CollectionDto, CollectionTypeDto } from './dto.js';

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

const COLLECTION_TYPE_DTO: Record<CollectionRow['type'], CollectionTypeDto> = {
  DYNAMIC: 'dynamic',
  EDITORIAL: 'editorial',
  TAXONOMIC: 'taxonomic',
};

/** A listing counts as priced only when it carries a usable numeric amount. */
function hasPrice(listing: CollectionListingRow): boolean {
  return listing.priceAmount != null && Number.isFinite(listing.priceAmount);
}

/** Per-request context needed to map books without N+1 queries. */
export interface CollectionMapperContext {
  readonly wishlistCounts: ReadonlyMap<string, number>;
}

/**
 * Map a canonical book row (with listings + price history) to a
 * {@link BookCardDataDto}.
 *
 * - `price` is the cheapest listing's current price; `inStock` mirrors
 *   whether any listing is not OUT_OF_STOCK. When every listing is
 *   OUT_OF_STOCK, the cheapest OUT_OF_STOCK price is still surfaced as
 *   `price` (a book always has *some* displayable price), but `inStock`
 *   is false.
 * - `oldPrice`/`discountPct` reflect a *real* historical drop on the
 *   cheapest listing: the highest historical price strictly greater than
 *   the current cheapest price. Omitted when there is no such drop.
 * - `storeName` is the display name of the provider backing the cheapest
 *   listing.
 */
export function toBookCardDataDto(book: CollectionBookRow, ctx: CollectionMapperContext): BookCardDataDto {
  const priced = book.listings.filter(hasPrice).sort((a, b) => a.priceAmount - b.priceAmount);
  const inStockPriced = priced.filter((l) => l.availability !== 'OUT_OF_STOCK');
  const cheapest = inStockPriced[0] ?? priced[0] ?? null;
  const inStock = inStockPriced.length > 0;

  const coverUrl: string =
    priced.find((l) => l.coverUrl)?.coverUrl ?? book.listings.find((l) => l.coverUrl)?.coverUrl ?? '';

  let oldPrice: number | undefined;
  let discountPct: number | undefined;
  if (cheapest) {
    const highestHistorical = cheapest.priceHistory
      .filter((p) => p.priceAmount > cheapest.priceAmount)
      .reduce<number | null>((max, p) => (max === null || p.priceAmount > max ? p.priceAmount : max), null);
    if (highestHistorical !== null) {
      oldPrice = highestHistorical;
      discountPct = Math.round(((highestHistorical - cheapest.priceAmount) / highestHistorical) * 100);
    }
  }

  return {
    id: book.id,
    title: book.title,
    author: book.author,
    coverUrl,
    price: cheapest?.priceAmount ?? 0,
    ...(oldPrice !== undefined ? { oldPrice } : {}),
    storeName: cheapest ? PROVIDER_DISPLAY[cheapest.provider] : '',
    ...(discountPct !== undefined ? { discountPct } : {}),
    inStock,
    url: `/books/${book.id}`,
    catalogAddedAt: book.createdAt.toISOString(),
    wishlistCount: ctx.wishlistCounts.get(book.id) ?? 0,
  };
}

/** Map a Collection row to the public {@link CollectionDto}, given a live book count. */
export function toCollectionDto(row: CollectionRow, bookCount: number): CollectionDto {
  return {
    id: row.id,
    slug: row.slug,
    type: COLLECTION_TYPE_DTO[row.type],
    name: row.name,
    description: row.description,
    bookCount,
    updatedAt: row.updatedAt.toISOString(),
    isActive: row.isActive,
    ...(row.icon ? { icon: row.icon } : {}),
  };
}
