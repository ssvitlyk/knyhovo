import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { SortOption } from './dto.js';
import { NEW_ARRIVALS_WINDOW_MS, PRICE_DROP_LOOKBACK_MS } from './feed-constants.js';

/**
 * Internal row shapes returned by the collections repository.
 *
 * These deliberately mirror only the fields the mapper/service need. They are
 * structurally compatible with the Prisma payload (so query results are
 * assignable without manual copying) while keeping `@prisma/client` types from
 * leaking into the mapper/service layers.
 */
export interface PriceHistoryPointRow {
  readonly priceAmount: number;
  readonly priceCurrency: 'UAH';
  readonly recordedAt: Date;
}

export interface CollectionListingRow {
  readonly provider: 'YAKABOO' | 'BOOK_CLUB' | 'VIVAT' | 'BOOK_YE' | 'BOOKCHEF' | 'LABORATORY' | 'KNIGOLAND';
  readonly priceAmount: number;
  readonly priceCurrency: 'UAH';
  readonly availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  readonly coverUrl: string | null;
  readonly priceHistory: readonly PriceHistoryPointRow[];
}

export interface CollectionBookRow {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly createdAt: Date;
  readonly genreId: string | null;
  readonly listings: readonly CollectionListingRow[];
}

export type CollectionTypeRow = 'DYNAMIC' | 'EDITORIAL' | 'TAXONOMIC';

export interface CollectionRow {
  readonly id: string;
  readonly slug: string;
  readonly type: CollectionTypeRow;
  readonly name: string;
  readonly description: string;
  readonly icon: string | null;
  readonly displayOrder: number;
  readonly isActive: boolean;
  readonly updatedAt: Date;
}

const CANONICAL_BOOK_SELECT = {
  id: true,
  title: true,
  author: true,
  createdAt: true,
  genreId: true,
  listings: {
    select: {
      provider: true,
      priceAmount: true,
      priceCurrency: true,
      availability: true,
      coverUrl: true,
      priceHistory: {
        select: {
          priceAmount: true,
          priceCurrency: true,
          recordedAt: true,
        },
      },
    },
  },
} as const;

const COLLECTION_SELECT = {
  id: true,
  slug: true,
  type: true,
  name: true,
  description: true,
  icon: true,
  displayOrder: true,
  isActive: true,
  updatedAt: true,
} as const;

/**
 * Fetch canonical books by id, preserving the order of `ids`.
 *
 * NOTE: `CollectionItem` has no Prisma relation to `CanonicalBook` (only a raw
 * `canonicalBookId` column), so collection→book resolution is always a two-step
 * fetch: read ordered ids from `CollectionItem`, then batch-fetch books here and
 * re-order in memory. Single query — no N+1.
 */
export async function findCanonicalBooksByIds(
  prisma: PrismaClient,
  ids: readonly string[],
): Promise<CollectionBookRow[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.canonicalBook.findMany({
    where: { id: { in: [...ids] } },
    select: CANONICAL_BOOK_SELECT,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered: CollectionBookRow[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row) ordered.push(row);
  }
  return ordered;
}

/** Fetch a single Collection row by slug. Returns null when not found. */
export async function findCollectionBySlug(
  prisma: PrismaClient,
  slug: string,
): Promise<CollectionRow | null> {
  return prisma.collection.findUnique({
    where: { slug },
    select: COLLECTION_SELECT,
  });
}

/** Fetch Collection rows for a batch of slugs in one query (unknown slugs are simply absent from the result). */
export async function findCollectionsBySlugs(
  prisma: PrismaClient,
  slugs: readonly string[],
): Promise<CollectionRow[]> {
  if (slugs.length === 0) return [];
  return prisma.collection.findMany({
    where: { slug: { in: [...slugs] } },
    select: COLLECTION_SELECT,
  });
}

/** Fetch active Collection rows by type, ordered by displayOrder. */
export async function findCollectionsByType(
  prisma: PrismaClient,
  type: CollectionTypeRow,
): Promise<CollectionRow[]> {
  return prisma.collection.findMany({
    where: { type, isActive: true },
    orderBy: { displayOrder: 'asc' },
    select: COLLECTION_SELECT,
  });
}

/** Fetch all active Collection rows, ordered by type then displayOrder. */
export async function findAllActiveCollections(prisma: PrismaClient): Promise<CollectionRow[]> {
  return prisma.collection.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }],
    select: COLLECTION_SELECT,
  });
}

/** Fetch ordered canonical book ids for a collection (by CollectionItem.sortOrder). */
export async function findCollectionItemBookIds(
  prisma: PrismaClient,
  collectionId: string,
): Promise<string[]> {
  const items = await prisma.collectionItem.findMany({
    where: { collectionId },
    orderBy: { sortOrder: 'asc' },
    select: { canonicalBookId: true },
  });
  return items.map((i) => i.canonicalBookId);
}

/** Count canonical books grouped by (taxonomic collection) genreId. */
export async function countBooksByGenre(prisma: PrismaClient): Promise<Map<string, number>> {
  const rows = await prisma.canonicalBook.groupBy({
    by: ['genreId'],
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.genreId) counts.set(row.genreId, row._count._all);
  }
  return counts;
}

/**
 * Wishlist counts for a specific set of canonical book ids (typically a
 * single 24-book page), computed via one indexed `groupBy` — never the whole
 * catalog. `wishlistCount` is intentionally never precomputed/cached
 * alongside scrape-derived data (PRD §3.2): it is always read live.
 */
export async function findWishlistCountsByIds(
  prisma: PrismaClient,
  ids: readonly string[],
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.wishlistItem.groupBy({
    by: ['canonicalBookId'],
    where: { canonicalBookId: { in: [...ids] } },
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.canonicalBookId, row._count._all);
  }
  return counts;
}

/** Resolve a taxonomic (genre) collection id from its public slug; `null` when not found or not taxonomic. */
export async function findGenreIdBySlug(prisma: PrismaClient, slug: string): Promise<string | null> {
  const row = await prisma.collection.findFirst({
    where: { slug, type: 'TAXONOMIC' },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Batch item-counts for a set of editorial/curated collections
 * (`CollectionItem` rows grouped by `collectionId`) — one `groupBy` instead
 * of one `findMany` per collection.
 */
export async function countCollectionItemsByCollectionIds(
  prisma: PrismaClient,
  collectionIds: readonly string[],
): Promise<Map<string, number>> {
  if (collectionIds.length === 0) return new Map();
  const rows = await prisma.collectionItem.groupBy({
    by: ['collectionId'],
    where: { collectionId: { in: [...collectionIds] } },
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.collectionId, row._count._all);
  }
  return counts;
}

/**
 * Book ids the given user has wishlisted, as a `Set` for O(1) membership
 * checks. Used to decorate `isWishlisted` on cached, user-agnostic payloads
 * — one query per request, never inside the collections cache.
 */
export async function findWishlistedBookIds(prisma: PrismaClient, userId: string): Promise<Set<string>> {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId },
    select: { canonicalBookId: true },
  });
  return new Set(rows.map((r) => r.canonicalBookId));
}

// ── SQL feed queries (Phase C1) ──────────────────────────────────────────────
//
// Every feed (dynamic/taxonomic/editorial) resolves via a page-of-ids query
// and a matching count query, sharing the same candidate-set WHERE. History-
// derived fields (discount%, 7-day-ago price, all-time-low) are computed via
// correlated subqueries against `price_history`, scoped to each candidate's
// single "cheapest listing" (indexes `(provider_listing_id, recorded_at)` and
// `(provider_listing_id, price_amount)` back these). This replaces the old
// full-catalog `findAllCanonicalBooks` + in-JS compute/sort/paginate.

export type DynamicFeedSlug =
  | 'populyarne-zaraz'
  | 'novynky'
  | 'znyzhky'
  | 'ponyzhena-tsina'
  | 'najbilsh-bazhani'
  | 'rekordno-nyzka-tsina';

/** Generic (`?genre=`/`?price_min=`/`?price_max=`/`?in_stock=`) filters, applied on top of a feed's own candidate-pool condition. */
export interface FeedFilterParams {
  /** Taxonomic (genre) collection id — only meaningful for non-taxonomic feeds (`?genre=slug` resolved by the caller). */
  readonly genreId?: string;
  readonly priceMin?: number;
  readonly priceMax?: number;
  readonly inStockOnly?: boolean;
}

export interface FeedPageParams extends FeedFilterParams {
  readonly sort: SortOption;
  readonly page: number;
  readonly perPage: number;
  readonly now: Date;
}

/**
 * `listing_pick`: the single "cheapest listing" per candidate book, mirroring
 * `mapper.ts`'s `cheapestListing` — in-stock priced listings preferred, tied
 * by ascending price, tied by `id` (a deterministic tie-break not present in
 * the old in-memory reduce, which relied on Prisma's unspecified natural
 * listing order — see the C1 report for this semantic note).
 *
 * `joinKind: 'INNER'` restricts the candidate set to books with at least one
 * listing (the "priced" pool every DYNAMIC feed uses); `'LEFT'` keeps
 * unpriced books too (with `NULL` price/listing fields), for TAXONOMIC/
 * EDITORIAL feeds whose pool is not priced-only.
 */
function candidateCte(joinKind: 'INNER' | 'LEFT', lookbackCutoff: Date): Prisma.Sql {
  const join = joinKind === 'INNER' ? Prisma.sql`JOIN` : Prisma.sql`LEFT JOIN`;
  return Prisma.sql`
    listing_pick AS (
      SELECT DISTINCT ON (cb.id)
        cb.id AS book_id,
        cb.created_at AS created_at,
        cb.genre_id AS genre_id,
        pl.id AS listing_id,
        pl.price_amount AS price_amount,
        COALESCE(pl.availability <> 'out-of-stock', false) AS in_stock
      FROM canonical_books cb
      ${join} provider_listings pl ON pl.canonical_book_id = cb.id
      ORDER BY cb.id, (pl.availability <> 'out-of-stock') DESC NULLS LAST, pl.price_amount ASC NULLS LAST, pl.id ASC NULLS LAST
    ),
    wishlist_counts AS (
      SELECT canonical_book_id, COUNT(*)::int AS c FROM wishlist_items GROUP BY canonical_book_id
    ),
    enriched AS (
      SELECT
        lp.book_id,
        lp.created_at,
        lp.genre_id,
        lp.listing_id,
        lp.price_amount,
        lp.in_stock,
        COALESCE(wc.c, 0) AS wishlist_count,
        (
          SELECT MAX(ph.price_amount) FROM price_history ph
          WHERE ph.provider_listing_id = lp.listing_id AND ph.price_amount > lp.price_amount
        ) AS highest_historical,
        (
          SELECT ph2.price_amount FROM price_history ph2
          WHERE ph2.provider_listing_id = lp.listing_id AND ph2.recorded_at <= ${lookbackCutoff}
          ORDER BY ph2.recorded_at DESC LIMIT 1
        ) AS lookback_price,
        (
          SELECT COUNT(*)::int FROM price_history ph3 WHERE ph3.provider_listing_id = lp.listing_id
        ) AS history_count,
        (
          SELECT MIN(ph4.price_amount) FROM price_history ph4 WHERE ph4.provider_listing_id = lp.listing_id
        ) AS min_historical
      FROM listing_pick lp
      LEFT JOIN wishlist_counts wc ON wc.canonical_book_id = lp.book_id
    ),
    scored AS (
      SELECT
        e.*,
        -- Exact (unrounded) discount ratio: the pre-C1 JS znyzhky order used the raw
        -- float pct, so ordering by a ROUND()ed value would turn near-ties (23.64% vs
        -- 24.0%) into false ties resolved by the id tie-break. The rounded display
        -- value stays a mapper concern (DTO discountPercent), never an ORDER BY key.
        CASE WHEN e.highest_historical IS NOT NULL
          THEN (e.highest_historical - e.price_amount)::float8 / e.highest_historical
          ELSE NULL END AS discount_exact,
        (e.history_count >= 2 AND LEAST(e.min_historical, e.price_amount) = e.price_amount) AS is_all_time_low
      FROM enriched e
    )
  `;
}

/** Generic `?genre=`/`?price_min=`/`?price_max=`/`?in_stock=` filters, ANDed onto a feed's own pool condition. */
function genericFilterSql(filters: FeedFilterParams): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (filters.genreId !== undefined) parts.push(Prisma.sql`e.genre_id = ${filters.genreId}`);
  if (filters.priceMin !== undefined) parts.push(Prisma.sql`e.price_amount >= ${filters.priceMin}`);
  if (filters.priceMax !== undefined) parts.push(Prisma.sql`e.price_amount <= ${filters.priceMax}`);
  if (filters.inStockOnly) parts.push(Prisma.sql`e.in_stock = true`);
  return parts.length > 0 ? Prisma.join(parts, ' AND ') : Prisma.sql`TRUE`;
}

/**
 * `?sort=` → `ORDER BY`. Out-of-stock is always sorted last: unlike the old
 * `outOfStockLast` (a stable post-sort pass), this is expressed as the
 * *leading* key (`in_stock DESC`) — equivalent final placement, since it
 * still partitions in-stock-before-out-of-stock and defers to `relevance`
 * (or the chosen sort) within each partition.
 */
function orderBySql(sort: SortOption, relevance: Prisma.Sql): Prisma.Sql {
  switch (sort) {
    case 'price_asc':
      return Prisma.sql`e.in_stock DESC, e.price_amount ASC NULLS LAST, e.book_id ASC`;
    case 'price_desc':
      return Prisma.sql`e.in_stock DESC, e.price_amount DESC NULLS LAST, e.book_id ASC`;
    case 'newest':
      return Prisma.sql`e.in_stock DESC, e.created_at DESC, e.book_id ASC`;
    case 'oldest':
      return Prisma.sql`e.in_stock DESC, e.created_at ASC, e.book_id ASC`;
    case 'discount_desc':
      return Prisma.sql`e.in_stock DESC, COALESCE(e.discount_exact, -1) DESC, e.book_id ASC`;
    case 'relevance':
    default:
      return Prisma.sql`e.in_stock DESC, ${relevance}, e.book_id ASC`;
  }
}

/** Feed-specific candidate-pool WHERE (before generic filters) + its "relevance" order expression. */
function dynamicFeedPoolSql(slug: DynamicFeedSlug): { where: Prisma.Sql; relevance: Prisma.Sql } {
  switch (slug) {
    case 'populyarne-zaraz':
      return { where: Prisma.sql`TRUE`, relevance: Prisma.sql`e.wishlist_count DESC, e.created_at DESC` };
    case 'najbilsh-bazhani':
      return { where: Prisma.sql`e.wishlist_count > 0`, relevance: Prisma.sql`e.wishlist_count DESC` };
    case 'rekordno-nyzka-tsina':
      return { where: Prisma.sql`e.is_all_time_low = true`, relevance: Prisma.sql`e.wishlist_count DESC` };
    case 'znyzhky':
      return {
        where: Prisma.sql`e.highest_historical IS NOT NULL`,
        relevance: Prisma.sql`COALESCE(e.discount_exact, -1) DESC`,
      };
    case 'ponyzhena-tsina':
      return {
        where: Prisma.sql`e.lookback_price IS NOT NULL AND e.price_amount < e.lookback_price`,
        relevance: Prisma.sql`(e.lookback_price - e.price_amount) DESC`,
      };
    case 'novynky':
      // novynky's pool is a two-step cap/fallback composition, not a plain
      // WHERE — handled entirely by `queryNovynkyIds`/`countNovynky` below.
      return { where: Prisma.sql`TRUE`, relevance: Prisma.sql`e.created_at DESC` };
    default:
      return { where: Prisma.sql`FALSE`, relevance: Prisma.sql`e.book_id ASC` };
  }
}

/** Page of book ids for a non-`novynky` dynamic feed (see {@link queryNovynkyIds} for `novynky`). */
export async function queryDynamicFeedIds(
  prisma: PrismaClient,
  slug: Exclude<DynamicFeedSlug, 'novynky'>,
  params: FeedPageParams,
): Promise<string[]> {
  const lookbackCutoff = new Date(params.now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const pool = dynamicFeedPoolSql(slug);
  const where = Prisma.sql`${pool.where} AND ${genericFilterSql(params)}`;
  const order = orderBySql(params.sort, pool.relevance);
  const offset = (params.page - 1) * params.perPage;
  const rows = await prisma.$queryRaw<{ book_id: string }[]>(Prisma.sql`
    WITH ${candidateCte('INNER', lookbackCutoff)}
    SELECT e.book_id FROM scored e WHERE ${where} ORDER BY ${order} LIMIT ${params.perPage} OFFSET ${offset}
  `);
  return rows.map((r) => r.book_id);
}

/** Total count for a non-`novynky` dynamic feed, matching {@link queryDynamicFeedIds}'s `WHERE`. */
export async function countDynamicFeed(
  prisma: PrismaClient,
  slug: Exclude<DynamicFeedSlug, 'novynky'>,
  filters: FeedFilterParams,
  now: Date,
): Promise<number> {
  const lookbackCutoff = new Date(now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const pool = dynamicFeedPoolSql(slug);
  const where = Prisma.sql`${pool.where} AND ${genericFilterSql(filters)}`;
  const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    WITH ${candidateCte('INNER', lookbackCutoff)}
    SELECT COUNT(*)::int AS count FROM scored e WHERE ${where}
  `);
  return rows[0]?.count ?? 0;
}

/**
 * `novynky`'s pool composition is a two-step cap/fallback (see
 * {@link planNovynkyPool}), computed over the full priced candidate set
 * *before* generic filters or pagination — the meta counts below (in-window
 * vs. total priced) drive that plan; the actual pool + generic filters +
 * pagination are then a single SQL statement using the plan's limits.
 */
export async function novynkyPoolMeta(
  prisma: PrismaClient,
  now: Date,
): Promise<{ windowCount: number; totalPriced: number }> {
  const cutoff = new Date(now.getTime() - NEW_ARRIVALS_WINDOW_MS);
  const rows = await prisma.$queryRaw<{ window_count: number; total_priced: number }[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE cb.created_at >= ${cutoff})::int AS window_count,
      COUNT(*)::int AS total_priced
    FROM canonical_books cb
    WHERE EXISTS (SELECT 1 FROM provider_listings pl WHERE pl.canonical_book_id = cb.id)
  `);
  return { windowCount: rows[0]?.window_count ?? 0, totalPriced: rows[0]?.total_priced ?? 0 };
}

function novynkyPoolCte(lookbackCutoff: Date, cutoff: Date, windowLimit: number, fallbackLimit: number): Prisma.Sql {
  const fallback =
    fallbackLimit > 0
      ? Prisma.sql`
          UNION ALL
          (SELECT * FROM scored e WHERE e.created_at < ${cutoff} ORDER BY e.created_at DESC, e.book_id ASC LIMIT ${fallbackLimit})
        `
      : Prisma.sql``;
  return Prisma.sql`
    WITH ${candidateCte('INNER', lookbackCutoff)},
    pool AS (
      (SELECT * FROM scored e WHERE e.created_at >= ${cutoff} ORDER BY e.created_at DESC, e.book_id ASC LIMIT ${windowLimit})
      ${fallback}
    )
  `;
}

/** Page of book ids for `novynky`, given its precomputed pool plan (see {@link novynkyPoolMeta} + {@link planNovynkyPool}). */
export async function queryNovynkyIds(
  prisma: PrismaClient,
  params: FeedPageParams,
  windowLimit: number,
  fallbackLimit: number,
): Promise<string[]> {
  const lookbackCutoff = new Date(params.now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const cutoff = new Date(params.now.getTime() - NEW_ARRIVALS_WINDOW_MS);
  const order = orderBySql(params.sort, Prisma.sql`e.created_at DESC`);
  const offset = (params.page - 1) * params.perPage;
  const rows = await prisma.$queryRaw<{ book_id: string }[]>(Prisma.sql`
    ${novynkyPoolCte(lookbackCutoff, cutoff, windowLimit, fallbackLimit)}
    SELECT e.book_id FROM pool e WHERE ${genericFilterSql(params)} ORDER BY ${order} LIMIT ${params.perPage} OFFSET ${offset}
  `);
  return rows.map((r) => r.book_id);
}

/** Total count for `novynky`, matching {@link queryNovynkyIds}'s pool + generic filters. */
export async function countNovynky(
  prisma: PrismaClient,
  filters: FeedFilterParams,
  now: Date,
  windowLimit: number,
  fallbackLimit: number,
): Promise<number> {
  const lookbackCutoff = new Date(now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const cutoff = new Date(now.getTime() - NEW_ARRIVALS_WINDOW_MS);
  const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    ${novynkyPoolCte(lookbackCutoff, cutoff, windowLimit, fallbackLimit)}
    SELECT COUNT(*)::int AS count FROM pool e WHERE ${genericFilterSql(filters)}
  `);
  return rows[0]?.count ?? 0;
}

/** Page of book ids for a TAXONOMIC (genre) collection. Pool is *not* priced-only — unpriced books stay, with `minPrice: null`. */
export async function queryTaxonomicFeedIds(
  prisma: PrismaClient,
  genreId: string,
  params: Omit<FeedPageParams, 'genreId'>,
): Promise<string[]> {
  const lookbackCutoff = new Date(params.now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const relevance = Prisma.sql`e.wishlist_count DESC, e.created_at DESC`;
  const order = orderBySql(params.sort, relevance);
  const offset = (params.page - 1) * params.perPage;
  const where = Prisma.sql`e.genre_id = ${genreId} AND ${genericFilterSql(params)}`;
  const rows = await prisma.$queryRaw<{ book_id: string }[]>(Prisma.sql`
    WITH ${candidateCte('LEFT', lookbackCutoff)}
    SELECT e.book_id FROM scored e WHERE ${where} ORDER BY ${order} LIMIT ${params.perPage} OFFSET ${offset}
  `);
  return rows.map((r) => r.book_id);
}

/** Total count for a TAXONOMIC (genre) collection, matching {@link queryTaxonomicFeedIds}'s `WHERE`. */
export async function countTaxonomicFeed(
  prisma: PrismaClient,
  genreId: string,
  filters: FeedFilterParams,
  now: Date,
): Promise<number> {
  const lookbackCutoff = new Date(now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const where = Prisma.sql`e.genre_id = ${genreId} AND ${genericFilterSql(filters)}`;
  const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    WITH ${candidateCte('LEFT', lookbackCutoff)}
    SELECT COUNT(*)::int AS count FROM scored e WHERE ${where}
  `);
  return rows[0]?.count ?? 0;
}

/** Page of book ids for an EDITORIAL collection. Relevance = `CollectionItem.sortOrder`; pool is not priced-only. */
export async function queryEditorialFeedIds(
  prisma: PrismaClient,
  collectionId: string,
  params: FeedPageParams,
): Promise<string[]> {
  const lookbackCutoff = new Date(params.now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const relevance = Prisma.sql`ci.sort_order ASC`;
  const order = orderBySql(params.sort, relevance);
  const offset = (params.page - 1) * params.perPage;
  const where = genericFilterSql(params);
  const rows = await prisma.$queryRaw<{ book_id: string }[]>(Prisma.sql`
    WITH ${candidateCte('LEFT', lookbackCutoff)}
    SELECT e.book_id
    FROM scored e
    JOIN collection_items ci ON ci.canonical_book_id = e.book_id AND ci.collection_id = ${collectionId}
    WHERE ${where}
    ORDER BY ${order}
    LIMIT ${params.perPage} OFFSET ${offset}
  `);
  return rows.map((r) => r.book_id);
}

/** Total count for an EDITORIAL collection, matching {@link queryEditorialFeedIds}'s `WHERE`. */
export async function countEditorialFeed(
  prisma: PrismaClient,
  collectionId: string,
  filters: FeedFilterParams,
  now: Date,
): Promise<number> {
  const lookbackCutoff = new Date(now.getTime() - PRICE_DROP_LOOKBACK_MS);
  const where = genericFilterSql(filters);
  const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    WITH ${candidateCte('LEFT', lookbackCutoff)}
    SELECT COUNT(*)::int AS count
    FROM scored e
    JOIN collection_items ci ON ci.canonical_book_id = e.book_id AND ci.collection_id = ${collectionId}
    WHERE ${where}
  `);
  return rows[0]?.count ?? 0;
}
