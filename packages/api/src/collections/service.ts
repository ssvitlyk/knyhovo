import type { PrismaClient } from '@prisma/client';
import { CollectionNotFoundError } from '../errors.js';
import {
  findAllCanonicalBooks,
  findCollectionBySlug,
  findCollectionsByType,
  findAllActiveCollections,
  findCollectionItemBookIds,
  countBooksByGenre,
  findTaxonomicSlugById,
  findWishlistCounts,
  findWishlistedBookIds,
} from './repository.js';
import type { CollectionBookRow, CollectionRow } from './repository.js';
import { toCollectionBookDto, toCollectionDto, hasPricedListing } from './mapper.js';
import type { CollectionMapperContext } from './mapper.js';
import type {
  CollectionBookDto,
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

const NEW_ARRIVALS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
/** Minimum size for the novynky pool before falling back to older priced books. */
const NOVYNKY_MIN_POOL = 24;
/**
 * Upper bound on the novynky pool, expressed as a share of the whole priced
 * catalog rather than a flat count — so it scales with catalog size instead
 * of needing re-tuning as the catalog grows. `createdAt` is the ingestion
 * (scrape) timestamp, not the book's actual publish date — it's the only
 * "new" signal available, but a bulk backfill/re-scrape run makes it cluster
 * within the 30-day window for most of the catalog at once. New arrivals are,
 * by definition, a minority of an established catalog; if the window's real
 * size exceeds this share, that's the backfill artifact, not organic growth.
 */
const NOVYNKY_MAX_SHARE = 0.25;
const PRICE_DROP_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

const HUB_CACHE_TTL_MS = 5 * 60 * 1000;
const DYNAMIC_BOOKS_CACHE_TTL_MS = 5 * 60 * 1000;
const STATIC_BOOKS_CACHE_TTL_MS = 60 * 60 * 1000;

// ── Compute context ─────────────────────────────────────────────────────────

/**
 * Per-request compute context, built exactly once per {@link buildHub},
 * {@link getAllCollections}, or {@link resolveCollection} call.
 *
 * Fetches the full canonical book set, wishlist counts, and genre counts in
 * a single round each — this replaces the previous pattern where
 * `liveBookCount` (called once per collection) re-ran a full
 * `findAllCanonicalBooks` + `findWishlistCounts` for *every* dynamic
 * collection on the hub.
 */
interface HubComputeContext {
  readonly allRows: readonly CollectionBookRow[];
  /** `allRows` filtered to books with at least one priced listing. */
  readonly pricedRows: readonly CollectionBookRow[];
  readonly byId: ReadonlyMap<string, CollectionBookRow>;
  readonly mapperCtx: CollectionMapperContext;
  readonly genreCounts: ReadonlyMap<string, number>;
  readonly now: Date;
}

async function buildHubComputeContext(prisma: PrismaClient, now: Date = new Date()): Promise<HubComputeContext> {
  const [allRows, wishlistCounts, genreCounts] = await Promise.all([
    findAllCanonicalBooks(prisma),
    findWishlistCounts(prisma),
    countBooksByGenre(prisma),
  ]);
  const pricedRows = allRows.filter(hasPricedListing);
  const byId = new Map(allRows.map((r) => [r.id, r]));
  return { allRows, pricedRows, byId, mapperCtx: { wishlistCounts }, genreCounts, now };
}

/** Resolve rows for `ids`, preserving order, from an already-fetched context (no extra query). */
function rowsByIds(ctx: HubComputeContext, ids: readonly string[]): CollectionBookRow[] {
  const rows: CollectionBookRow[] = [];
  for (const id of ids) {
    const row = ctx.byId.get(id);
    if (row) rows.push(row);
  }
  return rows;
}

function toBookDtos(rows: readonly CollectionBookRow[], mapperCtx: CollectionMapperContext): CollectionBookDto[] {
  return rows.map((row) => toCollectionBookDto(row, mapperCtx));
}

// ── Sorting ──────────────────────────────────────────────────────────────────

/** `catalogAddedAt` as epoch millis; `null` is treated as epoch 0 (never `NaN`). */
function catalogAddedAtMs(book: CollectionBookDto): number {
  return book.catalogAddedAt ? new Date(book.catalogAddedAt).getTime() : 0;
}

/** `minPrice.amount`, or `+Infinity` when unpriced — sorts unpriced books last under `price_asc`. */
function priceAscValue(book: CollectionBookDto): number {
  return book.minPrice?.amount ?? Number.POSITIVE_INFINITY;
}

/** `minPrice.amount`, or `-Infinity` when unpriced — sorts unpriced books last under `price_desc`. */
function priceDescValue(book: CollectionBookDto): number {
  return book.minPrice?.amount ?? Number.NEGATIVE_INFINITY;
}

/** Stable sort: OUT_OF_STOCK books always last, relative order otherwise preserved. */
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

/**
 * Taxonomic (genre) "relevance" order: a proxy for popularity — wishlistCount
 * DESC, tie-broken by recency. // TODO: incorporate page_view_count_7d once tracked.
 */
function sortTaxonomicRelevance(books: CollectionBookDto[]): CollectionBookDto[] {
  return [...books].sort((a, b) => {
    if (b.wishlistCount !== a.wishlistCount) return b.wishlistCount - a.wishlistCount;
    return catalogAddedAtMs(b) - catalogAddedAtMs(a);
  });
}

/**
 * populyarne-zaraz composite order: wishlistCount DESC → in-stock first →
 * catalogAddedAt DESC.
 * // TODO: incorporate real view/interaction tracking once available.
 */
function sortPopulyarneZaraz(books: CollectionBookDto[]): CollectionBookDto[] {
  return [...books].sort((a, b) => {
    if (b.wishlistCount !== a.wishlistCount) return b.wishlistCount - a.wishlistCount;
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    return catalogAddedAtMs(b) - catalogAddedAtMs(a);
  });
}

function applySort(
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

/**
 * Whether the cheapest listing's current price equals its historical minimum
 * (all-time low). Requires at least 2 recorded price points — a listing
 * scraped only once has a single price_history row matching its current
 * price, which would otherwise make it trivially "record low" with no real
 * history to back the claim.
 */
function isAllTimeLow(listing: CollectionBookRow['listings'][number]): boolean {
  if (listing.priceHistory.length < 2) return false;
  const min = listing.priceHistory.reduce(
    (acc, p) => (p.priceAmount < acc ? p.priceAmount : acc),
    listing.priceAmount,
  );
  return min === listing.priceAmount;
}

interface DynamicResult {
  readonly rows: readonly CollectionBookRow[];
  readonly order: readonly string[];
}

/**
 * Compute a dynamic feed's pool + its natural ("relevance") order, over the
 * priced subset of the canonical book set (`pricedRows` — unpriced books are
 * excluded from every dynamic feed).
 */
function computeDynamicPool(slug: string, pricedRows: readonly CollectionBookRow[], now: Date): DynamicResult {
  switch (slug) {
    case 'populyarne-zaraz': {
      // Pool = every priced book; composite order is resolved by the caller
      // once DTOs (with wishlistCount/inStock) exist (see resolveDynamicFeed).
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
      // Fallback: top up with the newest remaining priced books (older than
      // the window), newest first, until NOVYNKY_MIN_POOL or exhausted.
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
      // Pool/order both depend on wishlistCount — resolved by the caller once
      // DTOs exist (see resolveDynamicFeed).
      return { rows: pricedRows, order: pricedRows.map((r) => r.id) };
    }
    case 'rekordno-nyzka-tsina': {
      const atLow = pricedRows.filter((r) => {
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

/**
 * Resolve a dynamic feed's book DTOs, already in their natural ("relevance")
 * order. Pure function over an already-built {@link HubComputeContext} — no
 * database access, so it is safe to call once per collection without
 * re-querying (fixes the previous double `findAllCanonicalBooks` fetch for
 * dynamic slugs).
 */
function resolveDynamicFeed(slug: string, ctx: HubComputeContext): CollectionBookDto[] {
  const { rows } = computeDynamicPool(slug, ctx.pricedRows, ctx.now);
  let dtos = toBookDtos(rows, ctx.mapperCtx);

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

// ── Collection resolution (metadata + book pool) ────────────────────────────

interface ResolvedCollection {
  readonly row: CollectionRow;
  readonly books: CollectionBookDto[];
  /** Natural ("relevance") id order for this collection's pool. */
  readonly relevanceOrder: readonly string[];
  /** book id → taxonomic (genre) collection id, for the `?genre=slug` filter. */
  readonly genreIdByBookId: ReadonlyMap<string, string>;
}

function genreIdMap(ctx: HubComputeContext): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of ctx.allRows) {
    if (row.genreId) map.set(row.id, row.genreId);
  }
  return map;
}

/**
 * Resolve a collection's DB row + its book pool (already de-duplicated, with
 * `relevanceOrder` capturing the natural order per FR-DYN / curated / taxonomic
 * semantics). Throws {@link CollectionNotFoundError} when the slug is unknown.
 *
 * Builds exactly one {@link HubComputeContext} for the call.
 */
async function resolveCollection(prisma: PrismaClient, slug: string): Promise<ResolvedCollection> {
  const row = await findCollectionBySlug(prisma, slug);
  if (!row) throw new CollectionNotFoundError();

  const ctx = await buildHubComputeContext(prisma);
  const genreIdByBookId = genreIdMap(ctx);

  if (row.type === 'TAXONOMIC') {
    const rows = ctx.allRows.filter((r) => r.genreId === row.id);
    const books = toBookDtos(rows, ctx.mapperCtx);
    const relevanceOrder = sortTaxonomicRelevance(books).map((b) => b.id);
    return { row, books, relevanceOrder, genreIdByBookId };
  }

  if (row.type === 'DYNAMIC' && DYNAMIC_SLUGS.has(row.slug)) {
    const books = resolveDynamicFeed(row.slug, ctx);
    return { row, books, relevanceOrder: books.map((b) => b.id), genreIdByBookId };
  }

  // EDITORIAL (and any DYNAMIC row without a known compute function): curated
  // order = CollectionItem.sortOrder.
  const ids = await findCollectionItemBookIds(prisma, row.id);
  const rows = rowsByIds(ctx, ids);
  const books = toBookDtos(rows, ctx.mapperCtx);
  return { row, books, relevanceOrder: ids, genreIdByBookId };
}

/** Live book count for a collection row (dynamic pool size / editorial item count / taxonomic genre count). */
async function liveBookCount(prisma: PrismaClient, ctx: HubComputeContext, row: CollectionRow): Promise<number> {
  if (row.type === 'TAXONOMIC') {
    return ctx.genreCounts.get(row.id) ?? 0;
  }
  if (row.type === 'DYNAMIC' && DYNAMIC_SLUGS.has(row.slug)) {
    return resolveDynamicFeed(row.slug, ctx).length;
  }
  const ids = await findCollectionItemBookIds(prisma, row.id);
  return ids.length;
}

// ── Hub ──────────────────────────────────────────────────────────────────────

async function collectionDtoWithCount(
  prisma: PrismaClient,
  ctx: HubComputeContext,
  row: CollectionRow,
): Promise<CollectionDto> {
  const count = await liveBookCount(prisma, ctx, row);
  return toCollectionDto(row, count);
}

async function bySlugList(
  prisma: PrismaClient,
  ctx: HubComputeContext,
  slugs: readonly string[],
): Promise<CollectionDto[]> {
  const dtos: CollectionDto[] = [];
  for (const slug of slugs) {
    const row = await findCollectionBySlug(prisma, slug);
    if (row && row.isActive) dtos.push(await collectionDtoWithCount(prisma, ctx, row));
  }
  return dtos;
}

async function buildHub(prisma: PrismaClient): Promise<HubResponseDto> {
  const [featuredRow, ctx] = await Promise.all([
    findCollectionBySlug(prisma, FEATURED_SLUG),
    buildHubComputeContext(prisma),
  ]);

  // `featuredRow` is absent on an unseeded DB (e.g. staging before the
  // collection-metadata migration runs, or before any editorial curation
  // happens) — the rest of the hub is still built and returned normally.
  let featured: HubResponseDto['featured'] = null;
  if (featuredRow) {
    const featuredIds = await findCollectionItemBookIds(prisma, featuredRow.id);
    const featuredBooks = toBookDtos(rowsByIds(ctx, featuredIds), ctx.mapperCtx);
    const featuredCollection = await collectionDtoWithCount(prisma, ctx, featuredRow);
    featured = { collection: featuredCollection, previewBooks: featuredBooks.slice(0, 3) };
  }

  const dynamicRows = await findCollectionsByType(prisma, 'DYNAMIC');
  const dynamic = await Promise.all(dynamicRows.map((row) => collectionDtoWithCount(prisma, ctx, row)));

  const editorial = await bySlugList(prisma, ctx, EDITORIAL_SLUGS);
  const weekly = await bySlugList(prisma, ctx, WEEKLY_SLUGS);
  const moods = await bySlugList(prisma, ctx, MOOD_SLUGS);

  const taxonomicRows = await findCollectionsByType(prisma, 'TAXONOMIC');
  const eligibleGenreRows = taxonomicRows.filter((row) => (ctx.genreCounts.get(row.id) ?? 0) >= MIN_GENRE_BOOK_COUNT);
  const genres = eligibleGenreRows.map((row) => toCollectionDto(row, ctx.genreCounts.get(row.id) ?? 0));

  return {
    featured,
    dynamic,
    editorial,
    weekly,
    moods,
    genres,
  };
}

/**
 * `userId` is decorated onto the (user-agnostic, cached) hub payload after
 * the cache read — `isWishlisted` is never part of the cache key/value.
 * `null` (guest, or no `authDeps` configured) short-circuits to the cached
 * payload as-is (`isWishlisted: false` on every book, from the mapper).
 */
export async function getHub(prisma: PrismaClient, userId: string | null): Promise<HubResponseDto> {
  const cached = await getOrSet('hub', HUB_CACHE_TTL_MS, () => buildHub(prisma));
  if (!userId || !cached.featured) return cached;

  const saved = await findWishlistedBookIds(prisma, userId);
  return {
    ...cached,
    featured: {
      ...cached.featured,
      previewBooks: cached.featured.previewBooks.map((b) => ({ ...b, isWishlisted: saved.has(b.id) })),
    },
  };
}

// ── Collection detail ────────────────────────────────────────────────────────

export interface CollectionDetailResult {
  readonly response: CollectionDetailResponseDto;
  readonly redirect?: string;
}

export async function getCollectionDetail(prisma: PrismaClient, slug: string): Promise<CollectionDetailResult> {
  const row = await findCollectionBySlug(prisma, slug);
  if (!row) throw new CollectionNotFoundError();

  const ctx = await buildHubComputeContext(prisma);
  const count = await liveBookCount(prisma, ctx, row);
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
  books: CollectionBookDto[],
  row: CollectionRow,
  params: BooksQueryParams,
  genreIdByBookId: ReadonlyMap<string, string>,
  taxonomicSlugById: ReadonlyMap<string, string>,
): CollectionBookDto[] {
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

  // Unpriced books (minPrice: null) never match a price bound.
  if (params.price_min !== undefined) {
    const min = params.price_min;
    result = result.filter((b) => b.minPrice !== null && b.minPrice.amount >= min);
  }
  if (params.price_max !== undefined) {
    const max = params.price_max;
    result = result.filter((b) => b.minPrice !== null && b.minPrice.amount <= max);
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

/**
 * `userId` is decorated onto the (user-agnostic, cached) books payload after
 * the cache read — see {@link getHub} for the same pattern.
 */
export async function getCollectionBooks(
  prisma: PrismaClient,
  slug: string,
  params: BooksQueryParams,
  userId: string | null,
): Promise<CollectionBooksResponseDto> {
  const row = await findCollectionBySlug(prisma, slug);
  if (!row) throw new CollectionNotFoundError();

  const ttl = row.type === 'DYNAMIC' ? DYNAMIC_BOOKS_CACHE_TTL_MS : STATIC_BOOKS_CACHE_TTL_MS;
  const cacheKey = `books:${slug}:${JSON.stringify(params)}`;
  const cached = await getOrSet(cacheKey, ttl, () => buildCollectionBooksResponse(prisma, slug, params));
  if (!userId) return cached;

  const saved = await findWishlistedBookIds(prisma, userId);
  return {
    ...cached,
    books: cached.books.map((b) => ({ ...b, isWishlisted: saved.has(b.id) })),
  };
}

// ── All collections ──────────────────────────────────────────────────────────

export async function getAllCollections(prisma: PrismaClient): Promise<CollectionsListResponseDto> {
  const rows = await findAllActiveCollections(prisma);
  const ctx = await buildHubComputeContext(prisma);
  const collections = await Promise.all(rows.map((row) => collectionDtoWithCount(prisma, ctx, row)));
  return { collections };
}
