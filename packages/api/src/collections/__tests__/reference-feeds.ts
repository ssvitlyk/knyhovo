/**
 * Reference copy of the pre-C1 in-JS feed computation (service.ts:146-354 on
 * `develop` before the SQL-first Phase A rewrite). Used ONLY by
 * `feeds.pg.test.ts` to prove SQL/JS equivalence on a seeded fixture — never
 * imported by production code.
 *
 * Deliberately duplicated rather than imported: the whole point is an
 * independent re-derivation of "what the old code would have returned" to
 * compare against the new SQL path.
 */
import type { CollectionBookRow } from '../repository.js';
import type { CollectionBookDto, SortOption } from '../dto.js';
import { toCollectionBookDto, hasPricedListing } from '../mapper.js';
import type { CollectionMapperContext } from '../mapper.js';

const NEW_ARRIVALS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const NOVYNKY_MIN_POOL = 24;
const NOVYNKY_MAX_SHARE = 0.25;
const PRICE_DROP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

function catalogAddedAtMs(book: CollectionBookDto): number {
  return book.catalogAddedAt ? new Date(book.catalogAddedAt).getTime() : 0;
}

function priceAscValue(book: CollectionBookDto): number {
  return book.minPrice?.amount ?? Number.POSITIVE_INFINITY;
}

function priceDescValue(book: CollectionBookDto): number {
  return book.minPrice?.amount ?? Number.NEGATIVE_INFINITY;
}

function outOfStockLast(books: CollectionBookDto[]): CollectionBookDto[] {
  return [...books]
    .map((book, index) => ({ book, index }))
    .sort((a, b) => {
      if (a.book.inStock !== b.book.inStock) return a.book.inStock ? -1 : 1;
      return a.index - b.index;
    })
    .map((x) => x.book);
}

function sortByWishlistCountDesc(books: CollectionBookDto[]): CollectionBookDto[] {
  return [...books].sort((a, b) => b.wishlistCount - a.wishlistCount);
}

function sortByNewestDesc(books: CollectionBookDto[]): CollectionBookDto[] {
  return [...books].sort((a, b) => catalogAddedAtMs(b) - catalogAddedAtMs(a));
}

function sortTaxonomicRelevance(books: CollectionBookDto[]): CollectionBookDto[] {
  return [...books].sort((a, b) => {
    if (b.wishlistCount !== a.wishlistCount) return b.wishlistCount - a.wishlistCount;
    return catalogAddedAtMs(b) - catalogAddedAtMs(a);
  });
}

function sortPopulyarneZaraz(books: CollectionBookDto[]): CollectionBookDto[] {
  return [...books].sort((a, b) => {
    if (b.wishlistCount !== a.wishlistCount) return b.wishlistCount - a.wishlistCount;
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    return catalogAddedAtMs(b) - catalogAddedAtMs(a);
  });
}

export function applySort(
  books: CollectionBookDto[],
  sort: SortOption,
  relevanceOrder: readonly string[],
): CollectionBookDto[] {
  let sorted: CollectionBookDto[];
  switch (sort) {
    case 'price_asc':
      sorted = [...books].sort((a, b) => priceAscValue(a) - priceAscValue(b));
      break;
    case 'price_desc':
      sorted = [...books].sort((a, b) => priceDescValue(b) - priceDescValue(a));
      break;
    case 'newest':
      sorted = sortByNewestDesc(books);
      break;
    case 'oldest':
      sorted = [...books].sort((a, b) => catalogAddedAtMs(a) - catalogAddedAtMs(b));
      break;
    case 'discount_desc':
      sorted = [...books].sort((a, b) => (b.discountPercent ?? -1) - (a.discountPercent ?? -1));
      break;
    case 'relevance':
    default: {
      const orderIndex = new Map(relevanceOrder.map((id, i) => [id, i]));
      sorted = [...books].sort(
        (a, b) => (orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
      break;
    }
  }
  return outOfStockLast(sorted);
}

function highestHistoricalAbove(listing: CollectionBookRow['listings'][number]): number | null {
  return listing.priceHistory
    .filter((p) => p.priceAmount > listing.priceAmount)
    .reduce<number | null>((max, p) => (max === null || p.priceAmount > max ? p.priceAmount : max), null);
}

function cheapestListing(book: CollectionBookRow): CollectionBookRow['listings'][number] | null {
  const priced = book.listings.filter((l) => Number.isFinite(l.priceAmount)).sort((a, b) => a.priceAmount - b.priceAmount);
  const inStock = priced.filter((l) => l.availability !== 'OUT_OF_STOCK');
  return inStock[0] ?? priced[0] ?? null;
}

function priceAroundLookback(
  listing: CollectionBookRow['listings'][number],
  now: Date,
  lookbackMs: number,
): number | null {
  const cutoff = now.getTime() - lookbackMs;
  const eligible = listing.priceHistory.filter((p) => p.recordedAt.getTime() <= cutoff);
  if (eligible.length === 0) return null;
  const latest = eligible.reduce((a, b) => (b.recordedAt.getTime() > a.recordedAt.getTime() ? b : a));
  return latest.priceAmount;
}

function isAllTimeLow(listing: CollectionBookRow['listings'][number]): boolean {
  if (listing.priceHistory.length < 2) return false;
  const min = listing.priceHistory.reduce(
    (acc, p) => (p.priceAmount < acc ? p.priceAmount : acc),
    listing.priceAmount,
  );
  return min === listing.priceAmount;
}

export interface DynamicResult {
  readonly rows: readonly CollectionBookRow[];
  readonly order: readonly string[];
}

export function computeDynamicPool(slug: string, pricedRows: readonly CollectionBookRow[], now: Date): DynamicResult {
  switch (slug) {
    case 'populyarne-zaraz': {
      return { rows: pricedRows, order: pricedRows.map((r) => r.id) };
    }
    case 'novynky': {
      const cutoff = now.getTime() - NEW_ARRIVALS_WINDOW_MS;
      const windowRows = pricedRows.filter((r) => r.createdAt.getTime() >= cutoff);
      const windowSorted = [...windowRows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (windowSorted.length >= NOVYNKY_MIN_POOL) {
        const maxPool = Math.max(NOVYNKY_MIN_POOL, Math.floor(pricedRows.length * NOVYNKY_MAX_SHARE));
        const capped = windowSorted.slice(0, maxPool);
        return { rows: capped, order: capped.map((r) => r.id) };
      }
      const windowIds = new Set(windowSorted.map((r) => r.id));
      const remaining = pricedRows.filter((r) => !windowIds.has(r.id));
      const remainingSorted = [...remaining].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const fill = remainingSorted.slice(0, NOVYNKY_MIN_POOL - windowSorted.length);
      const combined = [...windowSorted, ...fill];
      return { rows: combined, order: combined.map((r) => r.id) };
    }
    case 'znyzhky': {
      const withDrop = pricedRows.filter((r) => {
        const cheapest = cheapestListing(r);
        return cheapest !== null && highestHistoricalAbove(cheapest) !== null;
      });
      const scored = withDrop.map((r) => {
        const cheapest = cheapestListing(r) as NonNullable<ReturnType<typeof cheapestListing>>;
        const highest = highestHistoricalAbove(cheapest) as number;
        const pct = ((highest - cheapest.priceAmount) / highest) * 100;
        return { row: r, pct };
      });
      scored.sort((a, b) => b.pct - a.pct);
      return { rows: scored.map((s) => s.row), order: scored.map((s) => s.row.id) };
    }
    case 'ponyzhena-tsina': {
      const withRecentDrop = pricedRows.filter((r) => {
        const cheapest = cheapestListing(r);
        if (!cheapest) return false;
        const then = priceAroundLookback(cheapest, now, PRICE_DROP_LOOKBACK_MS);
        return then !== null && cheapest.priceAmount < then;
      });
      const scored = withRecentDrop.map((r) => {
        const cheapest = cheapestListing(r) as NonNullable<ReturnType<typeof cheapestListing>>;
        const then = priceAroundLookback(cheapest, now, PRICE_DROP_LOOKBACK_MS) as number;
        return { row: r, drop: then - cheapest.priceAmount };
      });
      scored.sort((a, b) => b.drop - a.drop);
      return { rows: scored.map((s) => s.row), order: scored.map((s) => s.row.id) };
    }
    case 'najbilsh-bazhani': {
      return { rows: pricedRows, order: pricedRows.map((r) => r.id) };
    }
    case 'rekordno-nyzka-tsina': {
      const atLow = pricedRows.filter((r) => {
        const cheapest = cheapestListing(r);
        return cheapest !== null && isAllTimeLow(cheapest);
      });
      return { rows: atLow, order: atLow.map((r) => r.id) };
    }
    default:
      return { rows: [], order: [] };
  }
}

function toBookDtos(rows: readonly CollectionBookRow[], mapperCtx: CollectionMapperContext): CollectionBookDto[] {
  return rows.map((row) => toCollectionBookDto(row, mapperCtx));
}

export function resolveDynamicFeed(
  slug: string,
  allRows: readonly CollectionBookRow[],
  mapperCtx: CollectionMapperContext,
  now: Date,
): CollectionBookDto[] {
  const pricedRows = allRows.filter(hasPricedListing);
  const { rows } = computeDynamicPool(slug, pricedRows, now);
  let dtos = toBookDtos(rows, mapperCtx);

  switch (slug) {
    case 'najbilsh-bazhani':
      dtos = sortByWishlistCountDesc(dtos.filter((b) => b.wishlistCount > 0));
      break;
    case 'rekordno-nyzka-tsina':
      dtos = sortByWishlistCountDesc(dtos);
      break;
    case 'populyarne-zaraz':
      dtos = sortPopulyarneZaraz(dtos);
      break;
    default:
      break;
  }

  return dtos;
}

export function resolveTaxonomicFeed(
  allRows: readonly CollectionBookRow[],
  genreId: string,
  mapperCtx: CollectionMapperContext,
): CollectionBookDto[] {
  const rows = allRows.filter((r) => r.genreId === genreId);
  const books = toBookDtos(rows, mapperCtx);
  return sortTaxonomicRelevance(books);
}

export function resolveEditorialFeed(
  allRows: readonly CollectionBookRow[],
  orderedIds: readonly string[],
  mapperCtx: CollectionMapperContext,
): CollectionBookDto[] {
  const byId = new Map(allRows.map((r) => [r.id, r]));
  const rows: CollectionBookRow[] = [];
  for (const id of orderedIds) {
    const row = byId.get(id);
    if (row) rows.push(row);
  }
  return toBookDtos(rows, mapperCtx);
}

/** Generic post-pool filters (`?genre=`/`?price_min=`/`?price_max=`/`?in_stock=`), mirroring `service.ts`'s `applyFilters`. */
export interface ReferenceFilterParams {
  readonly genreSlug?: string;
  readonly priceMin?: number;
  readonly priceMax?: number;
  readonly inStockOnly?: boolean;
}

export function applyFilters(
  books: CollectionBookDto[],
  isTaxonomic: boolean,
  params: ReferenceFilterParams,
  genreIdByBookId: ReadonlyMap<string, string>,
  taxonomicSlugById: ReadonlyMap<string, string>,
): CollectionBookDto[] {
  let result = books;
  if (params.genreSlug !== undefined && !isTaxonomic) {
    const targetSlug = params.genreSlug;
    result = result.filter((b) => {
      const genreId = genreIdByBookId.get(b.id);
      return genreId !== undefined && taxonomicSlugById.get(genreId) === targetSlug;
    });
  }
  if (params.priceMin !== undefined) {
    const min = params.priceMin;
    result = result.filter((b) => b.minPrice !== null && b.minPrice.amount >= min);
  }
  if (params.priceMax !== undefined) {
    const max = params.priceMax;
    result = result.filter((b) => b.minPrice !== null && b.minPrice.amount <= max);
  }
  if (params.inStockOnly) {
    result = result.filter((b) => b.inStock);
  }
  return result;
}

export function paginate<T>(items: readonly T[], page: number, perPage: number): readonly T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}
