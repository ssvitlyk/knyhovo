/**
 * Test-only stand-ins for the C1 SQL feed-query functions in `repository.ts`
 * (`queryDynamicFeedIds`, `countDynamicFeed`, `queryNovynkyIds`, `countNovynky`,
 * `novynkyPoolMeta`, `queryTaxonomicFeedIds`, `countTaxonomicFeed`,
 * `queryEditorialFeedIds`, `countEditorialFeed`).
 *
 * The existing route/unit test suites drive the app through `fake-prisma.ts`
 * (`FakeDb`, no real Postgres), so `prisma.$queryRaw` has nothing to run
 * against. Per the C1 task's test-seam guidance, these functions are mocked
 * at the repository boundary via `vi.mock('../repository.js', ...)` in each
 * affected test file, replaced with the pure-JS equivalents below — computed
 * directly over `FakeDb`, matching the SQL's candidate-pool/order/tie-break
 * semantics (see `repository.ts`'s `candidateCte`/`orderBySql`).
 *
 * Real SQL/JS equivalence is proved separately (against a real Postgres
 * fixture) in `feeds.pg.test.ts`, using `reference-feeds.ts` — a verbatim
 * copy of the pre-C1 in-JS logic.
 */
import type { SortOption } from '../dto.js';
import type { DynamicFeedSlug, FeedFilterParams, FeedPageParams } from '../repository.js';
import { NEW_ARRIVALS_WINDOW_MS, PRICE_DROP_LOOKBACK_MS } from '../feed-constants.js';
import { fakeDbOf } from './fake-prisma.js';
import type { FakeBook, FakeDb, FakeListing } from './fake-prisma.js';

interface Derived {
  readonly bookId: string;
  readonly createdAt: number;
  readonly genreId: string | null;
  readonly priceAmount: number | null;
  readonly inStock: boolean;
  readonly wishlistCount: number;
  readonly highestHistorical: number | null;
  readonly lookbackPrice: number | null;
  readonly historyCount: number;
  /** Exact (unrounded) discount ratio — mirrors SQL's `discount_exact`, never the rounded DTO `discountPercent`. */
  readonly discountExact: number | null;
  readonly isAllTimeLow: boolean;
}

type Comparator = (a: Derived, b: Derived) => number;

function wishlistCountMap(db: FakeDb): Map<string, number> {
  const counts = new Map<string, number>();
  for (const w of db.wishlistItems) counts.set(w.canonicalBookId, (counts.get(w.canonicalBookId) ?? 0) + 1);
  return counts;
}

function hasAnyListing(book: FakeBook): boolean {
  return book.listings.length > 0;
}

/** Mirrors `candidateCte`'s `listing_pick`: in-stock priced listings preferred, tied by ascending price, tied by array index (stand-in for `id ASC`). */
function pickCheapestListing(book: FakeBook): FakeListing | null {
  const withIndex = book.listings.map((l, i) => ({ l, i }));
  withIndex.sort((a, b) => {
    const aIn = a.l.availability !== 'OUT_OF_STOCK';
    const bIn = b.l.availability !== 'OUT_OF_STOCK';
    if (aIn !== bIn) return aIn ? -1 : 1;
    if (a.l.priceAmount !== b.l.priceAmount) return a.l.priceAmount - b.l.priceAmount;
    return a.i - b.i;
  });
  return withIndex[0]?.l ?? null;
}

/** Mirrors `candidateCte`'s `enriched`/`scored` CTEs for a single book. */
function deriveBook(book: FakeBook, wishlistCounts: Map<string, number>, lookbackCutoff: Date): Derived {
  const wishlistCount = wishlistCounts.get(book.id) ?? 0;
  const cheapest = pickCheapestListing(book);
  if (!cheapest) {
    return {
      bookId: book.id,
      createdAt: book.createdAt.getTime(),
      genreId: book.genreId,
      priceAmount: null,
      inStock: false,
      wishlistCount,
      highestHistorical: null,
      lookbackPrice: null,
      historyCount: 0,
      discountExact: null,
      isAllTimeLow: false,
    };
  }
  const inStock = cheapest.availability !== 'OUT_OF_STOCK';
  const historyCount = cheapest.priceHistory.length;
  const highestHistorical = cheapest.priceHistory
    .filter((p) => p.priceAmount > cheapest.priceAmount)
    .reduce<number | null>((max, p) => (max === null || p.priceAmount > max ? p.priceAmount : max), null);
  const eligible = cheapest.priceHistory.filter((p) => p.recordedAt.getTime() <= lookbackCutoff.getTime());
  const lookbackPrice = eligible.length
    ? eligible.reduce((a, b) => (b.recordedAt.getTime() > a.recordedAt.getTime() ? b : a)).priceAmount
    : null;
  const minHistorical = historyCount
    ? cheapest.priceHistory.reduce((m, p) => (p.priceAmount < m ? p.priceAmount : m), cheapest.priceAmount)
    : null;
  const discountExact =
    highestHistorical !== null ? (highestHistorical - cheapest.priceAmount) / highestHistorical : null;
  const isAllTimeLow = historyCount >= 2 && minHistorical !== null && Math.min(minHistorical, cheapest.priceAmount) === cheapest.priceAmount;
  return {
    bookId: book.id,
    createdAt: book.createdAt.getTime(),
    genreId: book.genreId,
    priceAmount: cheapest.priceAmount,
    inStock,
    wishlistCount,
    highestHistorical,
    lookbackPrice,
    historyCount,
    discountExact,
    isAllTimeLow,
  };
}

function genericFilterPass(d: Derived, filters: FeedFilterParams): boolean {
  if (filters.genreId !== undefined && d.genreId !== filters.genreId) return false;
  if (filters.priceMin !== undefined && (d.priceAmount === null || d.priceAmount < filters.priceMin)) return false;
  if (filters.priceMax !== undefined && (d.priceAmount === null || d.priceAmount > filters.priceMax)) return false;
  if (filters.inStockOnly && !d.inStock) return false;
  return true;
}

function priceAscCmp(a: Derived, b: Derived): number {
  return (a.priceAmount ?? Number.POSITIVE_INFINITY) - (b.priceAmount ?? Number.POSITIVE_INFINITY);
}
function priceDescCmp(a: Derived, b: Derived): number {
  return (b.priceAmount ?? Number.NEGATIVE_INFINITY) - (a.priceAmount ?? Number.NEGATIVE_INFINITY);
}

function orderComparator(sort: SortOption, relevance: Comparator): Comparator {
  switch (sort) {
    case 'price_asc':
      return priceAscCmp;
    case 'price_desc':
      return priceDescCmp;
    case 'newest':
      return (a, b) => b.createdAt - a.createdAt;
    case 'oldest':
      return (a, b) => a.createdAt - b.createdAt;
    case 'discount_desc':
      return (a, b) => (b.discountExact ?? -1) - (a.discountExact ?? -1);
    case 'relevance':
    default:
      return relevance;
  }
}

/** `in_stock DESC` leading key + the sort's own key + `book_id ASC` tie-break — mirrors `orderBySql`. */
function fullComparator(sort: SortOption, relevance: Comparator): Comparator {
  const key = orderComparator(sort, relevance);
  return (a, b) => {
    const leading = Number(b.inStock) - Number(a.inStock);
    if (leading !== 0) return leading;
    const k = key(a, b);
    if (k !== 0) return k;
    return a.bookId < b.bookId ? -1 : a.bookId > b.bookId ? 1 : 0;
  };
}

function resolvePage(
  derivedList: readonly Derived[],
  poolFilter: (d: Derived) => boolean,
  relevance: Comparator,
  filters: FeedFilterParams,
  sort: SortOption,
  page: number,
  perPage: number,
): { ids: string[]; total: number } {
  const candidates = derivedList.filter((d) => poolFilter(d) && genericFilterPass(d, filters));
  const sorted = [...candidates].sort(fullComparator(sort, relevance));
  const total = sorted.length;
  const start = (page - 1) * perPage;
  return { ids: sorted.slice(start, start + perPage).map((d) => d.bookId), total };
}

function resolveCount(
  derivedList: readonly Derived[],
  poolFilter: (d: Derived) => boolean,
  filters: FeedFilterParams,
): number {
  return derivedList.filter((d) => poolFilter(d) && genericFilterPass(d, filters)).length;
}

/** Mirrors `dynamicFeedPoolSql`. */
function dynamicPoolFor(slug: Exclude<DynamicFeedSlug, 'novynky'>): { filter: (d: Derived) => boolean; relevance: Comparator } {
  switch (slug) {
    case 'populyarne-zaraz':
      return { filter: () => true, relevance: (a, b) => b.wishlistCount - a.wishlistCount || b.createdAt - a.createdAt };
    case 'najbilsh-bazhani':
      return { filter: (d) => d.wishlistCount > 0, relevance: (a, b) => b.wishlistCount - a.wishlistCount };
    case 'rekordno-nyzka-tsina':
      return { filter: (d) => d.isAllTimeLow, relevance: (a, b) => b.wishlistCount - a.wishlistCount };
    case 'znyzhky':
      return { filter: (d) => d.highestHistorical !== null, relevance: (a, b) => (b.discountExact ?? -1) - (a.discountExact ?? -1) };
    case 'ponyzhena-tsina':
      return {
        filter: (d) => d.lookbackPrice !== null && d.priceAmount !== null && d.priceAmount < d.lookbackPrice,
        relevance: (a, b) => (b.lookbackPrice! - b.priceAmount!) - (a.lookbackPrice! - a.priceAmount!),
      };
    default:
      return { filter: () => false, relevance: () => 0 };
  }
}

function derivedForDynamic(db: FakeDb, now: Date): Derived[] {
  const wishlistCounts = wishlistCountMap(db);
  const lookbackCutoff = new Date(now.getTime() - PRICE_DROP_LOOKBACK_MS);
  return db.books.filter(hasAnyListing).map((b) => deriveBook(b, wishlistCounts, lookbackCutoff));
}

export async function fakeQueryDynamicFeedIds(
  prisma: unknown,
  slug: Exclude<DynamicFeedSlug, 'novynky'>,
  params: FeedPageParams,
): Promise<string[]> {
  const db = fakeDbOf(prisma);
  const { filter, relevance } = dynamicPoolFor(slug);
  return resolvePage(derivedForDynamic(db, params.now), filter, relevance, params, params.sort, params.page, params.perPage).ids;
}

export async function fakeCountDynamicFeed(
  prisma: unknown,
  slug: Exclude<DynamicFeedSlug, 'novynky'>,
  filters: FeedFilterParams,
  now: Date,
): Promise<number> {
  const db = fakeDbOf(prisma);
  const { filter } = dynamicPoolFor(slug);
  return resolveCount(derivedForDynamic(db, now), filter, filters);
}

export async function fakeNovynkyPoolMeta(prisma: unknown, now: Date): Promise<{ windowCount: number; totalPriced: number }> {
  const db = fakeDbOf(prisma);
  const cutoff = now.getTime() - NEW_ARRIVALS_WINDOW_MS;
  const priced = db.books.filter(hasAnyListing);
  return { windowCount: priced.filter((b) => b.createdAt.getTime() >= cutoff).length, totalPriced: priced.length };
}

function novynkyPoolBooks(db: FakeDb, now: Date, windowLimit: number, fallbackLimit: number): FakeBook[] {
  const cutoff = now.getTime() - NEW_ARRIVALS_WINDOW_MS;
  const priced = db.books.filter(hasAnyListing);
  const windowPart = priced
    .filter((b) => b.createdAt.getTime() >= cutoff)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, windowLimit);
  const fallbackPart =
    fallbackLimit > 0
      ? priced
          .filter((b) => b.createdAt.getTime() < cutoff)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, fallbackLimit)
      : [];
  return [...windowPart, ...fallbackPart];
}

const novynkyRelevance: Comparator = (a, b) => b.createdAt - a.createdAt;

export async function fakeQueryNovynkyIds(
  prisma: unknown,
  params: FeedPageParams,
  windowLimit: number,
  fallbackLimit: number,
): Promise<string[]> {
  const db = fakeDbOf(prisma);
  const wishlistCounts = wishlistCountMap(db);
  const lookbackCutoff = new Date(params.now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const derivedList = novynkyPoolBooks(db, params.now, windowLimit, fallbackLimit).map((b) =>
    deriveBook(b, wishlistCounts, lookbackCutoff),
  );
  return resolvePage(derivedList, () => true, novynkyRelevance, params, params.sort, params.page, params.perPage).ids;
}

export async function fakeCountNovynky(
  prisma: unknown,
  filters: FeedFilterParams,
  now: Date,
  windowLimit: number,
  fallbackLimit: number,
): Promise<number> {
  const db = fakeDbOf(prisma);
  const wishlistCounts = wishlistCountMap(db);
  const lookbackCutoff = new Date(now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const derivedList = novynkyPoolBooks(db, now, windowLimit, fallbackLimit).map((b) => deriveBook(b, wishlistCounts, lookbackCutoff));
  return resolveCount(derivedList, () => true, filters);
}

export async function fakeQueryTaxonomicFeedIds(
  prisma: unknown,
  genreId: string,
  params: Omit<FeedPageParams, 'genreId'>,
): Promise<string[]> {
  const db = fakeDbOf(prisma);
  const wishlistCounts = wishlistCountMap(db);
  const lookbackCutoff = new Date(params.now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const derivedList = db.books.filter((b) => b.genreId === genreId).map((b) => deriveBook(b, wishlistCounts, lookbackCutoff));
  const relevance: Comparator = (a, b) => b.wishlistCount - a.wishlistCount || b.createdAt - a.createdAt;
  return resolvePage(derivedList, () => true, relevance, params, params.sort, params.page, params.perPage).ids;
}

export async function fakeCountTaxonomicFeed(
  prisma: unknown,
  genreId: string,
  filters: FeedFilterParams,
  now: Date,
): Promise<number> {
  const db = fakeDbOf(prisma);
  const wishlistCounts = wishlistCountMap(db);
  const lookbackCutoff = new Date(now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const derivedList = db.books.filter((b) => b.genreId === genreId).map((b) => deriveBook(b, wishlistCounts, lookbackCutoff));
  return resolveCount(derivedList, () => true, filters);
}

export async function fakeQueryEditorialFeedIds(
  prisma: unknown,
  collectionId: string,
  params: FeedPageParams,
): Promise<string[]> {
  const db = fakeDbOf(prisma);
  const wishlistCounts = wishlistCountMap(db);
  const lookbackCutoff = new Date(params.now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const items = db.collectionItems.filter((i) => i.collectionId === collectionId);
  const sortOrderById = new Map(items.map((i) => [i.canonicalBookId, i.sortOrder]));
  const bookById = new Map(db.books.map((b) => [b.id, b]));
  const derivedList = items
    .map((i) => bookById.get(i.canonicalBookId))
    .filter((b): b is FakeBook => !!b)
    .map((b) => deriveBook(b, wishlistCounts, lookbackCutoff));
  const relevance: Comparator = (a, b) => (sortOrderById.get(a.bookId) ?? 0) - (sortOrderById.get(b.bookId) ?? 0);
  return resolvePage(derivedList, () => true, relevance, params, params.sort, params.page, params.perPage).ids;
}

export async function fakeCountEditorialFeed(
  prisma: unknown,
  collectionId: string,
  filters: FeedFilterParams,
  now: Date,
): Promise<number> {
  const db = fakeDbOf(prisma);
  const wishlistCounts = wishlistCountMap(db);
  const lookbackCutoff = new Date(now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const items = db.collectionItems.filter((i) => i.collectionId === collectionId);
  const bookById = new Map(db.books.map((b) => [b.id, b]));
  const derivedList = items
    .map((i) => bookById.get(i.canonicalBookId))
    .filter((b): b is FakeBook => !!b)
    .map((b) => deriveBook(b, wishlistCounts, lookbackCutoff));
  return resolveCount(derivedList, () => true, filters);
}

/** Convenience: the full set of overrides to pass to `vi.mock('../repository.js', ...)`. */
export function fakeFeedRepositoryOverrides() {
  return {
    queryDynamicFeedIds: fakeQueryDynamicFeedIds,
    countDynamicFeed: fakeCountDynamicFeed,
    novynkyPoolMeta: fakeNovynkyPoolMeta,
    queryNovynkyIds: fakeQueryNovynkyIds,
    countNovynky: fakeCountNovynky,
    queryTaxonomicFeedIds: fakeQueryTaxonomicFeedIds,
    countTaxonomicFeed: fakeCountTaxonomicFeed,
    queryEditorialFeedIds: fakeQueryEditorialFeedIds,
    countEditorialFeed: fakeCountEditorialFeed,
  };
}
