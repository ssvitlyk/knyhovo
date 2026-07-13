import type { PrismaClient } from '@prisma/client';
import { CollectionNotFoundError } from '../errors.js';
import {
  findCollectionBySlug,
  findCollectionsBySlugs,
  findCollectionsByType,
  findAllActiveCollections,
  findCollectionItemBookIds,
  countBooksByGenre,
  countCollectionItemsByCollectionIds,
  findGenreIdBySlug,
  findCanonicalBooksByIds,
  findWishlistCountsByIds,
  findWishlistedBookIds,
  queryDynamicFeedIds,
  countDynamicFeed,
  novynkyPoolMeta,
  queryNovynkyIds,
  countNovynky,
  queryTaxonomicFeedIds,
  countTaxonomicFeed,
  queryEditorialFeedIds,
  countEditorialFeed,
} from './repository.js';
import type { CollectionRow, DynamicFeedSlug, FeedFilterParams } from './repository.js';
import { toCollectionBookDto, toCollectionDto } from './mapper.js';
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
import { planNovynkyPool } from './feed-constants.js';
import { parseMinGenreBookCountFromEnv } from './genre-threshold-env.js';

const PER_PAGE = 24;

/** Redirect target for a taxonomic collection below the minimum genre book count. */
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

const KNOWN_DYNAMIC_SLUGS = new Set<DynamicFeedSlug>([
  'populyarne-zaraz',
  'novynky',
  'znyzhky',
  'ponyzhena-tsina',
  'najbilsh-bazhani',
  'rekordno-nyzka-tsina',
]);

/** Dynamic feeds whose sort/filter keys are scrape-derived (price/history) — cached longer, per PRD §3.1. */
const SCRAPE_DERIVED_DYNAMIC_SLUGS = new Set(['novynky', 'znyzhky', 'ponyzhena-tsina', 'rekordno-nyzka-tsina']);

const HUB_CACHE_TTL_MS = 5 * 60 * 1000;
/** wishlist-derived feeds (najbilsh-bazhani, populyarne-zaraz) + hub + collections list — freshness matters. */
const WISHLIST_DERIVED_CACHE_TTL_MS = 5 * 60 * 1000;
/** scrape-derived dynamic feeds (novynky/znyzhky/ponyzhena-tsina/rekordno-nyzka-tsina) — changes 1-2x/day. */
const SCRAPE_DERIVED_CACHE_TTL_MS = 30 * 60 * 1000;
/** editorial/taxonomic books — unchanged from pre-C1. */
const STATIC_BOOKS_CACHE_TTL_MS = 60 * 60 * 1000;

/** Placeholder id guaranteed to match no real collection — used when an unresolvable `?genre=` slug must exclude every book. */
const UNMATCHED_GENRE_ID = '00000000-0000-0000-0000-000000000000';

/** Cache TTL bucket for a collection's books/detail payload (PRD §3.1 table). */
export function booksTtlFor(row: CollectionRow): number {
  if (row.type === 'DYNAMIC') {
    return SCRAPE_DERIVED_DYNAMIC_SLUGS.has(row.slug) ? SCRAPE_DERIVED_CACHE_TTL_MS : WISHLIST_DERIVED_CACHE_TTL_MS;
  }
  return STATIC_BOOKS_CACHE_TTL_MS;
}

function defaultSort(type: CollectionRow['type']): SortOption {
  return type === 'TAXONOMIC' ? 'price_asc' : 'relevance';
}

// ── Feed resolution (SQL page/count per collection row) ─────────────────────

interface FeedResolution {
  readonly getPage: (filters: FeedFilterParams, sort: SortOption, page: number, perPage: number) => Promise<string[]>;
  readonly getCount: (filters: FeedFilterParams) => Promise<number>;
}

/**
 * Resolve a `CollectionRow` to its SQL feed page/count functions, for a fixed
 * `now`. Every read path goes through this — no full-catalog fetch (kills
 * `findAllCanonicalBooks` / `buildHubComputeContext`; C1 §1).
 */
async function resolveFeed(prisma: PrismaClient, row: CollectionRow, now: Date): Promise<FeedResolution> {
  if (row.type === 'TAXONOMIC') {
    return {
      getPage: (filters, sort, page, perPage) =>
        queryTaxonomicFeedIds(prisma, row.id, { priceMin: filters.priceMin, priceMax: filters.priceMax, inStockOnly: filters.inStockOnly, sort, page, perPage, now }),
      getCount: (filters) => countTaxonomicFeed(prisma, row.id, filters, now),
    };
  }

  if (row.type === 'DYNAMIC' && row.slug === 'novynky') {
    // `novynkyPoolMeta`/`planNovynkyPool` computed once here and captured by both
    // closures below — `getPage`/`getCount` run concurrently (Promise.all in
    // `buildCollectionBooksResponse`), so two independent calls would read the
    // window/total-priced counts at slightly different instants and could plan
    // a different window/fallback split for the page vs. the count.
    const meta = await novynkyPoolMeta(prisma, now);
    const plan = planNovynkyPool(meta.windowCount, meta.totalPriced);
    return {
      getPage: (filters, sort, page, perPage) =>
        queryNovynkyIds(prisma, { ...filters, sort, page, perPage, now }, plan.windowLimit, plan.fallbackLimit),
      getCount: (filters) => countNovynky(prisma, filters, now, plan.windowLimit, plan.fallbackLimit),
    };
  }

  if (row.type === 'DYNAMIC' && KNOWN_DYNAMIC_SLUGS.has(row.slug as DynamicFeedSlug)) {
    const slug = row.slug as Exclude<DynamicFeedSlug, 'novynky'>;
    return {
      getPage: (filters, sort, page, perPage) => queryDynamicFeedIds(prisma, slug, { ...filters, sort, page, perPage, now }),
      getCount: (filters) => countDynamicFeed(prisma, slug, filters, now),
    };
  }

  // EDITORIAL, or any DYNAMIC row without a known compute function: pool = CollectionItem membership.
  return {
    getPage: (filters, sort, page, perPage) => queryEditorialFeedIds(prisma, row.id, { ...filters, sort, page, perPage, now }),
    getCount: (filters) => countEditorialFeed(prisma, row.id, filters, now),
  };
}

async function feedTotalCount(prisma: PrismaClient, row: CollectionRow, now: Date): Promise<number> {
  const feed = await resolveFeed(prisma, row, now);
  return feed.getCount({});
}

function toBookDtos(rows: Awaited<ReturnType<typeof findCanonicalBooksByIds>>, wishlistCounts: Map<string, number>): CollectionBookDto[] {
  return rows.map((row) => toCollectionBookDto(row, { wishlistCounts }));
}

/** Fetch + map a page of book ids, preserving `ids`' order (SQL already sorted/paginated them). */
async function mapPage(prisma: PrismaClient, ids: readonly string[]): Promise<CollectionBookDto[]> {
  const [rows, wishlistCounts] = await Promise.all([
    findCanonicalBooksByIds(prisma, ids),
    findWishlistCountsByIds(prisma, ids),
  ]);
  return toBookDtos(rows, wishlistCounts);
}

/**
 * Re-read `wishlistCount` live for a page of (possibly cached) book DTOs.
 * `wishlistCount` is never allowed to sit stale for the books/hub cache's TTL
 * (up to 30 min for scrape-derived feeds, PRD §3.2 — it has a different
 * lifecycle than scrape data) — same "decorate after the cache read" pattern
 * already used for `isWishlisted` below.
 */
async function withLiveWishlistCounts(prisma: PrismaClient, books: readonly CollectionBookDto[]): Promise<CollectionBookDto[]> {
  if (books.length === 0) return [...books];
  const counts = await findWishlistCountsByIds(prisma, books.map((b) => b.id));
  return books.map((b) => ({ ...b, wishlistCount: counts.get(b.id) ?? 0 }));
}

// ── Hub ──────────────────────────────────────────────────────────────────────

async function buildHub(prisma: PrismaClient): Promise<HubResponseDto> {
  const now = new Date();
  const wantedSlugs = [...new Set([FEATURED_SLUG, ...EDITORIAL_SLUGS, ...WEEKLY_SLUGS, ...MOOD_SLUGS])];

  const [bySlugRows, dynamicRows, taxonomicRows, genreCounts] = await Promise.all([
    findCollectionsBySlugs(prisma, wantedSlugs),
    findCollectionsByType(prisma, 'DYNAMIC'),
    findCollectionsByType(prisma, 'TAXONOMIC'),
    countBooksByGenre(prisma),
  ]);
  const bySlug = new Map(bySlugRows.map((r) => [r.slug, r] as const));
  const itemCounts = await countCollectionItemsByCollectionIds(prisma, bySlugRows.map((r) => r.id));

  const featuredRow = bySlug.get(FEATURED_SLUG) ?? null;
  let featured: HubResponseDto['featured'] = null;
  if (featuredRow) {
    const featuredIds = await findCollectionItemBookIds(prisma, featuredRow.id);
    const previewBooks = await mapPage(prisma, featuredIds.slice(0, 3));
    const featuredCollection = toCollectionDto(featuredRow, itemCounts.get(featuredRow.id) ?? 0);
    featured = { collection: featuredCollection, previewBooks };
  }

  const dynamic = await Promise.all(
    dynamicRows.map(async (row) => toCollectionDto(row, await feedTotalCount(prisma, row, now))),
  );

  const bySlugDtos = (slugs: readonly string[]): CollectionDto[] =>
    slugs
      .map((slug) => bySlug.get(slug))
      .filter((row): row is CollectionRow => row !== undefined && row.isActive)
      .map((row) => toCollectionDto(row, itemCounts.get(row.id) ?? 0));

  const editorial = bySlugDtos(EDITORIAL_SLUGS);
  const weekly = bySlugDtos(WEEKLY_SLUGS);
  const moods = bySlugDtos(MOOD_SLUGS);

  const minGenreBookCount = parseMinGenreBookCountFromEnv(process.env);
  const eligibleGenreRows = taxonomicRows.filter((row) => (genreCounts.get(row.id) ?? 0) >= minGenreBookCount);
  const genres = eligibleGenreRows.map((row) => toCollectionDto(row, genreCounts.get(row.id) ?? 0));

  return { featured, dynamic, editorial, weekly, moods, genres };
}

/**
 * `userId` is decorated onto the (user-agnostic, cached) hub payload after
 * the cache read — `isWishlisted` is never part of the cache key/value.
 * `wishlistCount` is likewise re-read live after every cache hit (see
 * {@link withLiveWishlistCounts}) — it must never sit stale for the cache's
 * TTL, unlike `isWishlisted` this happens regardless of `userId`.
 */
export async function getHub(prisma: PrismaClient, userId: string | null): Promise<HubResponseDto> {
  const cached = await getOrSet('hub', HUB_CACHE_TTL_MS, () => buildHub(prisma));
  if (!cached.featured) return cached;

  const previewBooks = await withLiveWishlistCounts(prisma, cached.featured.previewBooks);
  if (!userId) return { ...cached, featured: { ...cached.featured, previewBooks } };

  const saved = await findWishlistedBookIds(prisma, userId);
  return {
    ...cached,
    featured: {
      ...cached.featured,
      previewBooks: previewBooks.map((b) => ({ ...b, isWishlisted: saved.has(b.id) })),
    },
  };
}

// ── Collection detail ────────────────────────────────────────────────────────

export interface CollectionDetailResult {
  readonly response: CollectionDetailResponseDto;
  readonly redirect?: string;
}

async function buildCollectionDetail(prisma: PrismaClient, row: CollectionRow, now: Date): Promise<CollectionDetailResult> {
  const count = await feedTotalCount(prisma, row, now);
  if (row.type === 'TAXONOMIC' && count < parseMinGenreBookCountFromEnv(process.env)) {
    return { response: { collection: toCollectionDto(row, count) }, redirect: THIN_GENRE_REDIRECT };
  }
  return { response: { collection: toCollectionDto(row, count) } };
}

export async function getCollectionDetail(prisma: PrismaClient, slug: string): Promise<CollectionDetailResult> {
  const row = await findCollectionBySlug(prisma, slug);
  if (!row) throw new CollectionNotFoundError();
  return getOrSet(`detail:${slug}`, booksTtlFor(row), () => buildCollectionDetail(prisma, row, new Date()));
}

// ── Collection books ─────────────────────────────────────────────────────────

/** Resolve `?genre=slug` to a `FeedFilterParams.genreId`; unresolvable/`TAXONOMIC` -> `undefined`/sentinel (see {@link UNMATCHED_GENRE_ID}). */
async function resolveGenreFilter(prisma: PrismaClient, row: CollectionRow, params: BooksQueryParams): Promise<string | undefined> {
  if (params.genre === undefined || row.type === 'TAXONOMIC') return undefined;
  const genreId = await findGenreIdBySlug(prisma, params.genre);
  return genreId ?? UNMATCHED_GENRE_ID;
}

async function buildCollectionBooksResponse(
  prisma: PrismaClient,
  row: CollectionRow,
  params: BooksQueryParams,
): Promise<CollectionBooksResponseDto> {
  const now = new Date();
  const genreId = await resolveGenreFilter(prisma, row, params);
  const filters: FeedFilterParams = {
    genreId,
    priceMin: params.price_min,
    priceMax: params.price_max,
    inStockOnly: params.in_stock === 1,
  };
  const sort = params.sort ?? defaultSort(row.type);
  const feed = await resolveFeed(prisma, row, now);

  const [ids, total] = await Promise.all([
    feed.getPage(filters, sort, params.page, PER_PAGE),
    feed.getCount(filters),
  ]);
  const books = await mapPage(prisma, ids);
  const totalPages = total === 0 ? 0 : Math.ceil(total / PER_PAGE);

  return { books, total, page: params.page, per_page: PER_PAGE, total_pages: totalPages };
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

  const ttl = booksTtlFor(row);
  const cacheKey = `books:${slug}:${JSON.stringify(params)}`;
  const cached = await getOrSet(cacheKey, ttl, () => buildCollectionBooksResponse(prisma, row, params));
  const books = await withLiveWishlistCounts(prisma, cached.books);
  if (!userId) return { ...cached, books };

  const saved = await findWishlistedBookIds(prisma, userId);
  return {
    ...cached,
    books: books.map((b) => ({ ...b, isWishlisted: saved.has(b.id) })),
  };
}

// ── All collections ──────────────────────────────────────────────────────────

async function buildAllCollections(prisma: PrismaClient, now: Date): Promise<CollectionsListResponseDto> {
  const rows = await findAllActiveCollections(prisma);
  const editorialIds = rows.filter((r) => r.type === 'EDITORIAL').map((r) => r.id);
  const [itemCounts, genreCounts] = await Promise.all([
    countCollectionItemsByCollectionIds(prisma, editorialIds),
    countBooksByGenre(prisma),
  ]);

  const collections = await Promise.all(
    rows.map(async (row) => {
      if (row.type === 'TAXONOMIC') return toCollectionDto(row, genreCounts.get(row.id) ?? 0);
      if (row.type === 'EDITORIAL') return toCollectionDto(row, itemCounts.get(row.id) ?? 0);
      return toCollectionDto(row, await feedTotalCount(prisma, row, now));
    }),
  );

  return { collections };
}

/** Contains wishlist-derived counts (najbilsh-bazhani/populyarne-zaraz) -> same 5-min TTL as the hub. */
export async function getAllCollections(prisma: PrismaClient): Promise<CollectionsListResponseDto> {
  return getOrSet('collections:list', WISHLIST_DERIVED_CACHE_TTL_MS, () => buildAllCollections(prisma, new Date()));
}
