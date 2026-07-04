import type { PrismaClient } from '@prisma/client';
import { CollectionNotFoundError } from '../errors.js';
import {
  findCanonicalBooksByIds,
  findAllCanonicalBooks,
  findCanonicalBooksByGenreId,
  findCollectionBySlug,
  findCollectionsByType,
  findAllActiveCollections,
  findCollectionItemBookIds,
  countBooksByGenre,
  findTaxonomicSlugById,
  findWishlistCounts,
} from './repository.js';
import type { CollectionBookRow, CollectionRow } from './repository.js';
import { toBookCardDataDto, toCollectionDto } from './mapper.js';
import type { CollectionMapperContext } from './mapper.js';
import type {
  BookCardDataDto,
  CollectionDto,
  HubResponseDto,
  CollectionDetailResponseDto,
  CollectionBooksResponseDto,
  CollectionsListResponseDto,
  SortOption,
} from './dto.js';
import type { BooksQueryParams } from './schema.js';
import { getOrSet } from './cache.js';

const PER_PAGE = 24;

/** Minimum live book count for a taxonomic (genre) collection to be publicly browsable. */
const MIN_GENRE_BOOK_COUNT = 30;

/** Redirect target for a taxonomic collection below {@link MIN_GENRE_BOOK_COUNT}. */
export const THIN_GENRE_REDIRECT = '/dobirky';

export const FEATURED_SLUG = 'knyhovyk-radyt';

export const EDITORIAL_SLUGS = ['knyhovyk-radyt', 'pryhovani-skarby'];

export const WEEKLY_SLUGS = ['buker-2026', 'ukr-fentezi', 'non-fikshn'];

export const MOOD_SLUGS = [
  'zatyshnyj-vechir',
  'pered-snom',
  'pryhody',
  'vidpustka',
  'natkhnennia',
  'korotki',
];

const DYNAMIC_SLUGS = new Set([
  'populyarne-zaraz',
  'novynky',
  'znyzhky',
  'ponyzhena-tsina',
  'najbilsh-bazhani',
  'rekordno-nyzka-tsina',
]);

const NEW_ARRIVALS_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const PRICE_DROP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

const HUB_CACHE_TTL_MS = 5 * 60 * 1000;
const DYNAMIC_BOOKS_CACHE_TTL_MS = 5 * 60 * 1000;
const STATIC_BOOKS_CACHE_TTL_MS = 60 * 60 * 1000;

// ── Context / mapping helpers ────────────────────────────────────────────────

async function buildContext(prisma: PrismaClient): Promise<CollectionMapperContext> {
  const wishlistCounts = await findWishlistCounts(prisma);
  return { wishlistCounts };
}

function toBookDtos(rows: CollectionBookRow[], ctx: CollectionMapperContext): BookCardDataDto[] {
  return rows.map((row) => toBookCardDataDto(row, ctx));
}

// ── Sorting ──────────────────────────────────────────────────────────────────

/** Stable sort: OUT_OF_STOCK books always last, relative order otherwise preserved. */
function outOfStockLast(books: BookCardDataDto[]): BookCardDataDto[] {
  return [...books]
    .map((book, index) => ({ book, index }))
    .sort((a, b) => {
      if (a.book.inStock !== b.book.inStock) return a.book.inStock ? -1 : 1;
      return a.index - b.index;
    })
    .map((x) => x.book);
}

function sortByWishlistCountDesc(books: BookCardDataDto[]): BookCardDataDto[] {
  return [...books].sort((a, b) => b.wishlistCount - a.wishlistCount);
}

function sortByNewestDesc(books: BookCardDataDto[]): BookCardDataDto[] {
  return [...books].sort(
    (a, b) => new Date(b.catalogAddedAt).getTime() - new Date(a.catalogAddedAt).getTime(),
  );
}

/**
 * Taxonomic (genre) "relevance" order: a proxy for popularity — wishlistCount
 * DESC, tie-broken by recency. // TODO: incorporate page_view_count_7d once tracked.
 */
function sortTaxonomicRelevance(books: BookCardDataDto[]): BookCardDataDto[] {
  return [...books].sort((a, b) => {
    if (b.wishlistCount !== a.wishlistCount) return b.wishlistCount - a.wishlistCount;
    return new Date(b.catalogAddedAt).getTime() - new Date(a.catalogAddedAt).getTime();
  });
}

function applySort(
  books: BookCardDataDto[],
  sort: SortOption,
  relevanceOrder: readonly string[],
): BookCardDataDto[] {
  let sorted: BookCardDataDto[];
  switch (sort) {
    case 'price_asc':
      sorted = [...books].sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      sorted = [...books].sort((a, b) => b.price - a.price);
      break;
    case 'newest':
      sorted = sortByNewestDesc(books);
      break;
    case 'oldest':
      sorted = [...books].sort(
        (a, b) => new Date(a.catalogAddedAt).getTime() - new Date(b.catalogAddedAt).getTime(),
      );
      break;
    case 'discount_desc':
      sorted = [...books].sort((a, b) => (b.discountPct ?? -1) - (a.discountPct ?? -1));
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
  // Out-of-stock is always last, regardless of the requested sort.
  return outOfStockLast(sorted);
}

function paginate<T>(items: readonly T[], page: number, perPage: number): readonly T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

// ── Dynamic feed pools ───────────────────────────────────────────────────────

/** Highest historical price strictly greater than the given listing's current price. */
function highestHistoricalAbove(listing: CollectionBookRow['listings'][number]): number | null {
  return listing.priceHistory
    .filter((p) => p.priceAmount > listing.priceAmount)
    .reduce<number | null>((max, p) => (max === null || p.priceAmount > max ? p.priceAmount : max), null);
}

/** The cheapest currently-priced listing on a book row (in-stock preferred). */
function cheapestListing(book: CollectionBookRow): CollectionBookRow['listings'][number] | null {
  const priced = book.listings.filter((l) => Number.isFinite(l.priceAmount)).sort((a, b) => a.priceAmount - b.priceAmount);
  const inStock = priced.filter((l) => l.availability !== 'OUT_OF_STOCK');
  return inStock[0] ?? priced[0] ?? null;
}

/** Price recorded at/just-before `now - lookbackMs`, or null if no point is old enough. */
function priceAroundLookback(
  listing: CollectionBookRow['listings'][number],
  now: Date,
  lookbackMs: number,
): number | null {
  const cutoff = now.getTime() - lookbackMs;
  const eligible = listing.priceHistory.filter((p) => p.recordedAt.getTime() <= cutoff);
  if (eligible.length === 0) return null;
  // Most recent point at/before the cutoff — the price "as of ~lookback days ago".
  const latest = eligible.reduce((a, b) => (b.recordedAt.getTime() > a.recordedAt.getTime() ? b : a));
  return latest.priceAmount;
}

/** Whether the cheapest listing's current price equals its historical minimum (all-time low). */
function isAllTimeLow(listing: CollectionBookRow['listings'][number]): boolean {
  const min = listing.priceHistory.reduce<number | null>(
    (acc, p) => (acc === null || p.priceAmount < acc ? p.priceAmount : acc),
    listing.priceAmount,
  );
  return min === listing.priceAmount;
}

interface DynamicResult {
  readonly rows: CollectionBookRow[];
  readonly order: readonly string[];
}

/**
 * Compute a dynamic feed's pool + its natural ("relevance") order, over the
 * full canonical book set.
 */
function computeDynamicPool(slug: string, allRows: CollectionBookRow[], now: Date): DynamicResult {
  switch (slug) {
    case 'populyarne-zaraz': {
      // Pool = every book with any priced listing; order handled via wishlistCount
      // in applySort's relevance branch (computed from DTOs upstream), so here we
      // just pass the full pool through in wishlistCount-agnostic id order — the
      // caller re-derives relevance order once DTOs (with wishlistCount) exist.
      return { rows: allRows, order: allRows.map((r) => r.id) };
    }
    case 'novynky': {
      const cutoff = now.getTime() - NEW_ARRIVALS_WINDOW_MS;
      const recent = allRows.filter((r) => r.createdAt.getTime() >= cutoff);
      const ordered = [...recent].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return { rows: ordered, order: ordered.map((r) => r.id) };
    }
    case 'znyzhky': {
      const withDrop = allRows.filter((r) => {
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
      const withRecentDrop = allRows.filter((r) => {
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
      // Pool/order both depend on wishlistCount — resolved by the caller once
      // DTOs exist (see resolveDynamicFeed).
      return { rows: allRows, order: allRows.map((r) => r.id) };
    }
    case 'rekordno-nyzka-tsina': {
      const atLow = allRows.filter((r) => {
        const cheapest = cheapestListing(r);
        return cheapest !== null && isAllTimeLow(cheapest);
      });
      // Order depends on wishlistCount — resolved by the caller.
      return { rows: atLow, order: atLow.map((r) => r.id) };
    }
    default:
      return { rows: [], order: [] };
  }
}

/** Resolve a dynamic feed's book DTOs, already in their natural ("relevance") order. */
async function resolveDynamicFeed(
  prisma: PrismaClient,
  slug: string,
  ctx: CollectionMapperContext,
  now: Date,
): Promise<BookCardDataDto[]> {
  const allRows = await findAllCanonicalBooks(prisma);
  const { rows } = computeDynamicPool(slug, allRows, now);
  let dtos = toBookDtos(rows, ctx);

  if (slug === 'populyarne-zaraz' || slug === 'najbilsh-bazhani') {
    if (slug === 'najbilsh-bazhani') {
      dtos = dtos.filter((b) => b.wishlistCount > 0);
    }
    dtos = sortByWishlistCountDesc(dtos);
  } else if (slug === 'rekordno-nyzka-tsina') {
    dtos = sortByWishlistCountDesc(dtos);
  }

  return dtos;
}

// ── Collection resolution (metadata + book pool) ────────────────────────────

interface ResolvedCollection {
  readonly row: CollectionRow;
  readonly books: BookCardDataDto[];
  /** Natural ("relevance") id order for this collection's pool. */
  readonly relevanceOrder: readonly string[];
  /** book id → taxonomic (genre) collection id, for the `?genre=slug` filter. */
  readonly genreIdByBookId: ReadonlyMap<string, string>;
}

function genreIdMap(rows: readonly CollectionBookRow[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.genreId) map.set(row.id, row.genreId);
  }
  return map;
}

/**
 * Resolve a collection's DB row + its book pool (already de-duplicated, with
 * `relevanceOrder` capturing the natural order per FR-DYN / curated / taxonomic
 * semantics). Throws {@link CollectionNotFoundError} when the slug is unknown.
 */
async function resolveCollection(prisma: PrismaClient, slug: string): Promise<ResolvedCollection> {
  const row = await findCollectionBySlug(prisma, slug);
  if (!row) throw new CollectionNotFoundError();

  const ctx = await buildContext(prisma);

  if (row.type === 'TAXONOMIC') {
    const rows = await findCanonicalBooksByGenreId(prisma, row.id);
    const books = toBookDtos(rows, ctx);
    const relevanceOrder = sortTaxonomicRelevance(books).map((b) => b.id);
    return { row, books, relevanceOrder, genreIdByBookId: genreIdMap(rows) };
  }

  if (row.type === 'DYNAMIC' && DYNAMIC_SLUGS.has(row.slug)) {
    const allRows = await findAllCanonicalBooks(prisma);
    const books = await resolveDynamicFeed(prisma, row.slug, ctx, new Date());
    return { row, books, relevanceOrder: books.map((b) => b.id), genreIdByBookId: genreIdMap(allRows) };
  }

  // EDITORIAL (and any DYNAMIC row without a known compute function): curated
  // order = CollectionItem.sortOrder.
  const ids = await findCollectionItemBookIds(prisma, row.id);
  const rows = await findCanonicalBooksByIds(prisma, ids);
  const books = toBookDtos(rows, ctx);
  return { row, books, relevanceOrder: ids, genreIdByBookId: genreIdMap(rows) };
}

/** Live book count for a collection row (dynamic pool size / editorial item count / taxonomic genre count). */
async function liveBookCount(prisma: PrismaClient, row: CollectionRow): Promise<number> {
  if (row.type === 'TAXONOMIC') {
    const counts = await countBooksByGenre(prisma);
    return counts.get(row.id) ?? 0;
  }
  if (row.type === 'DYNAMIC' && DYNAMIC_SLUGS.has(row.slug)) {
    const ctx = await buildContext(prisma);
    const books = await resolveDynamicFeed(prisma, row.slug, ctx, new Date());
    return books.length;
  }
  const ids = await findCollectionItemBookIds(prisma, row.id);
  return ids.length;
}

// ── Hub ──────────────────────────────────────────────────────────────────────

async function collectionDtoWithCount(prisma: PrismaClient, row: CollectionRow): Promise<CollectionDto> {
  const count = await liveBookCount(prisma, row);
  return toCollectionDto(row, count);
}

async function bySlugList(prisma: PrismaClient, slugs: readonly string[]): Promise<CollectionDto[]> {
  const dtos: CollectionDto[] = [];
  for (const slug of slugs) {
    const row = await findCollectionBySlug(prisma, slug);
    if (row && row.isActive) dtos.push(await collectionDtoWithCount(prisma, row));
  }
  return dtos;
}

async function buildHub(prisma: PrismaClient): Promise<HubResponseDto> {
  const featuredRow = await findCollectionBySlug(prisma, FEATURED_SLUG);
  if (!featuredRow) throw new CollectionNotFoundError();
  const ctx = await buildContext(prisma);
  const featuredIds = await findCollectionItemBookIds(prisma, featuredRow.id);
  const featuredBooks = toBookDtos(await findCanonicalBooksByIds(prisma, featuredIds), ctx);
  const featuredCollection = await collectionDtoWithCount(prisma, featuredRow);

  const dynamicRows = await findCollectionsByType(prisma, 'DYNAMIC');
  const dynamic = await Promise.all(dynamicRows.map((row) => collectionDtoWithCount(prisma, row)));

  const editorial = await bySlugList(prisma, EDITORIAL_SLUGS);
  const weekly = await bySlugList(prisma, WEEKLY_SLUGS);
  const moods = await bySlugList(prisma, MOOD_SLUGS);

  const taxonomicRows = await findCollectionsByType(prisma, 'TAXONOMIC');
  const genreCounts = await countBooksByGenre(prisma);
  const eligibleGenreRows = taxonomicRows.filter((row) => (genreCounts.get(row.id) ?? 0) >= MIN_GENRE_BOOK_COUNT);
  const genres = eligibleGenreRows.map((row) => toCollectionDto(row, genreCounts.get(row.id) ?? 0));

  return {
    featured: { collection: featuredCollection, previewBooks: featuredBooks.slice(0, 3) },
    dynamic,
    editorial,
    weekly,
    moods,
    genres,
  };
}

export async function getHub(prisma: PrismaClient): Promise<HubResponseDto> {
  return getOrSet('hub', HUB_CACHE_TTL_MS, () => buildHub(prisma));
}

// ── Collection detail ────────────────────────────────────────────────────────

export interface CollectionDetailResult {
  readonly response: CollectionDetailResponseDto;
  readonly redirect?: string;
}

export async function getCollectionDetail(prisma: PrismaClient, slug: string): Promise<CollectionDetailResult> {
  const row = await findCollectionBySlug(prisma, slug);
  if (!row) throw new CollectionNotFoundError();

  const count = await liveBookCount(prisma, row);
  if (row.type === 'TAXONOMIC' && count < MIN_GENRE_BOOK_COUNT) {
    return { response: { collection: toCollectionDto(row, count) }, redirect: THIN_GENRE_REDIRECT };
  }

  return { response: { collection: toCollectionDto(row, count) } };
}

// ── Collection books ─────────────────────────────────────────────────────────

function defaultSort(type: CollectionRow['type']): SortOption {
  return type === 'TAXONOMIC' ? 'price_asc' : 'relevance';
}

function applyFilters(
  books: BookCardDataDto[],
  row: CollectionRow,
  params: BooksQueryParams,
  genreIdByBookId: ReadonlyMap<string, string>,
  taxonomicSlugById: ReadonlyMap<string, string>,
): BookCardDataDto[] {
  let result = books;

  // `genre` filters non-taxonomic collections by the book's assigned genre
  // slug; ignored for taxonomic collections (they're already genre-scoped).
  if (params.genre !== undefined && row.type !== 'TAXONOMIC') {
    const targetSlug = params.genre;
    result = result.filter((b) => {
      const genreId = genreIdByBookId.get(b.id);
      return genreId !== undefined && taxonomicSlugById.get(genreId) === targetSlug;
    });
  }

  if (params.price_min !== undefined) {
    result = result.filter((b) => b.price >= (params.price_min as number));
  }
  if (params.price_max !== undefined) {
    result = result.filter((b) => b.price <= (params.price_max as number));
  }
  if (params.in_stock === 1) {
    result = result.filter((b) => b.inStock);
  }

  return result;
}

async function buildCollectionBooksResponse(
  prisma: PrismaClient,
  slug: string,
  params: BooksQueryParams,
): Promise<CollectionBooksResponseDto> {
  const { row, books, relevanceOrder, genreIdByBookId } = await resolveCollection(prisma, slug);

  const taxonomicSlugById =
    params.genre !== undefined && row.type !== 'TAXONOMIC' ? await findTaxonomicSlugById(prisma) : new Map<string, string>();

  const filtered = applyFilters(books, row, params, genreIdByBookId, taxonomicSlugById);
  const sort = params.sort ?? defaultSort(row.type);
  const sorted = applySort(filtered, sort, relevanceOrder);

  const total = sorted.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / PER_PAGE);
  const pageBooks = paginate(sorted, params.page, PER_PAGE);

  return {
    books: pageBooks,
    total,
    page: params.page,
    per_page: PER_PAGE,
    total_pages: totalPages,
  };
}

export async function getCollectionBooks(
  prisma: PrismaClient,
  slug: string,
  params: BooksQueryParams,
): Promise<CollectionBooksResponseDto> {
  const row = await findCollectionBySlug(prisma, slug);
  if (!row) throw new CollectionNotFoundError();

  const ttl = row.type === 'DYNAMIC' ? DYNAMIC_BOOKS_CACHE_TTL_MS : STATIC_BOOKS_CACHE_TTL_MS;
  const cacheKey = `books:${slug}:${JSON.stringify(params)}`;
  return getOrSet(cacheKey, ttl, () => buildCollectionBooksResponse(prisma, slug, params));
}

// ── All collections ──────────────────────────────────────────────────────────

export async function getAllCollections(prisma: PrismaClient): Promise<CollectionsListResponseDto> {
  const rows = await findAllActiveCollections(prisma);
  const collections = await Promise.all(rows.map((row) => collectionDtoWithCount(prisma, row)));
  return { collections };
}
