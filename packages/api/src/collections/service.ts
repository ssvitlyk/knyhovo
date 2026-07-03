import type { PrismaClient } from '@prisma/client';
import { CollectionNotFoundError } from '../errors.js';
import {
  findCanonicalBooksByIds,
  findAllCanonicalBooks,
  findCanonicalBooksByGenreId,
  findCollectionBySlug,
  findCollectionsByType,
  findCollectionItemBookIds,
  findAllGenres,
  findGenreBySlug,
  countBooksByGenre,
  findAllMoods,
  findMoodBySlug,
  findWishlistCounts,
  findWishlistedBookIds,
} from './repository.js';
import type { CollectionBookRow, CollectionRow } from './repository.js';
import { toCollectionBookDto } from './mapper.js';
import type { CollectionMapperContext } from './mapper.js';
import { collectionHref } from './dto.js';
import type {
  CollectionBookDto,
  CollectionSummaryDto,
  CollectionDetailDto,
  GenreDto,
  MoodDto,
  HomeResponseDto,
  Section,
  BooksPageDto,
  SimilarDto,
} from './dto.js';
import type { BooksQueryParams } from './schema.js';

const NEW_ARRIVALS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Max books per shelf on the aggregated /home response. */
const HOME_SHELF_LIMIT = 12;

const FEATURED_SLUG = 'knyhovyk-radyt';
const WISHLIST_POPULAR_SLUG = 'najbilsh-bazhani';
const POPULAR_SLUG = 'populyarne-zaraz';
const NEW_ARRIVALS_SLUG = 'novynky';
const BIGGEST_DISCOUNTS_SLUG = 'znyzhky';
const UNDERRATED_SLUG = 'pryhovani-skarby';

const DYNAMIC_SLUGS = new Set([
  WISHLIST_POPULAR_SLUG,
  POPULAR_SLUG,
  NEW_ARRIVALS_SLUG,
  BIGGEST_DISCOUNTS_SLUG,
]);

/** Build the per-request wishlist context once (no N+1 across a handler). */
async function buildContext(prisma: PrismaClient, userId: string | null): Promise<CollectionMapperContext> {
  const [wishlistCounts, wishlistedIds] = await Promise.all([
    findWishlistCounts(prisma),
    userId ? findWishlistedBookIds(prisma, userId) : Promise.resolve(new Set<string>()),
  ]);
  return { wishlistCounts, wishlistedIds };
}

function toBookDtos(rows: CollectionBookRow[], ctx: CollectionMapperContext): CollectionBookDto[] {
  return rows.map((row) => toCollectionBookDto(row, ctx));
}

/** Sort books by descending wishlist count (stable). */
function sortByWishlistCountDesc(books: CollectionBookDto[]): CollectionBookDto[] {
  return [...books].sort((a, b) => b.wishlistCount - a.wishlistCount);
}

/**
 * Popular-right-now ranking: no views data source yet (// TODO: incorporate
 * views once tracked). Ranked by wishlist count, then in-stock, then recency.
 */
function sortPopular(books: CollectionBookDto[]): CollectionBookDto[] {
  return [...books].sort((a, b) => {
    if (b.wishlistCount !== a.wishlistCount) return b.wishlistCount - a.wishlistCount;
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    return new Date(b.catalogAddedAt).getTime() - new Date(a.catalogAddedAt).getTime();
  });
}

function sortNewArrivals(books: CollectionBookDto[], now: Date): CollectionBookDto[] {
  const cutoff = now.getTime() - NEW_ARRIVALS_WINDOW_MS;
  const recent = books.filter((b) => new Date(b.catalogAddedAt).getTime() >= cutoff);
  const pool = recent.length > 0 ? recent : books;
  return [...pool].sort(
    (a, b) => new Date(b.catalogAddedAt).getTime() - new Date(a.catalogAddedAt).getTime(),
  );
}

function biggestDiscountsPool(books: CollectionBookDto[]): CollectionBookDto[] {
  return books
    .filter((b) => b.minPrice !== null && b.oldPrice !== null && b.oldPrice.amount > b.minPrice.amount)
    .sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));
}

/** Stable sort: OUT_OF_STOCK books always last, in-stock order preserved otherwise. */
function outOfStockLast(books: CollectionBookDto[]): CollectionBookDto[] {
  return [...books]
    .map((book, index) => ({ book, index }))
    .sort((a, b) => {
      if (a.book.inStock !== b.book.inStock) return a.book.inStock ? -1 : 1;
      return a.index - b.index;
    })
    .map((x) => x.book);
}

function applySort(books: CollectionBookDto[], sort: BooksQueryParams['sort']): CollectionBookDto[] {
  let sorted: CollectionBookDto[];
  switch (sort) {
    case 'price_asc':
      sorted = [...books].sort((a, b) => (a.minPrice?.amount ?? Infinity) - (b.minPrice?.amount ?? Infinity));
      break;
    case 'price_desc':
      sorted = [...books].sort((a, b) => (b.minPrice?.amount ?? -Infinity) - (a.minPrice?.amount ?? -Infinity));
      break;
    case 'newest':
      sorted = [...books].sort(
        (a, b) => new Date(b.catalogAddedAt).getTime() - new Date(a.catalogAddedAt).getTime(),
      );
      break;
    case 'discount_desc':
      sorted = [...books].sort((a, b) => (b.discountPercent ?? -1) - (a.discountPercent ?? -1));
      break;
    case 'relevance':
    default:
      sorted = books;
      break;
  }
  // OUT_OF_STOCK is always last, regardless of the requested sort.
  return outOfStockLast(sorted);
}

function paginate<T>(items: readonly T[], page: number, limit: number): readonly T[] {
  const start = (page - 1) * limit;
  return items.slice(start, start + limit);
}

function toCollectionDetailDto(row: CollectionRow, bookCount: number): CollectionDetailDto {
  return {
    slug: row.slug,
    type: row.type,
    title: row.title,
    eyebrow: row.eyebrow,
    description: row.description,
    statusLabel: row.statusLabel,
    icon: row.icon,
    bookCount,
  };
}

function toCollectionSummaryDto(
  row: CollectionRow,
  books: CollectionBookDto[],
  previewCount: number,
): CollectionSummaryDto {
  return {
    slug: row.slug,
    type: row.type,
    title: row.title,
    eyebrow: row.eyebrow,
    description: row.description,
    statusLabel: row.statusLabel,
    icon: row.icon,
    bookCount: books.length,
    previewBooks: books.slice(0, previewCount),
  };
}

// ── Dynamic feed resolution ─────────────────────────────────────────────────

interface DynamicFeed {
  readonly slug: string;
  readonly title: string;
  readonly eyebrow: string | null;
  readonly description: string | null;
  readonly statusLabel: string;
}

const DYNAMIC_FEED_META: Record<string, DynamicFeed> = {
  [WISHLIST_POPULAR_SLUG]: {
    slug: WISHLIST_POPULAR_SLUG,
    title: 'Обране читачами',
    eyebrow: null,
    description: null,
    statusLabel: 'На основі активності читачів',
  },
  [POPULAR_SLUG]: {
    slug: POPULAR_SLUG,
    title: 'Популярне зараз',
    eyebrow: null,
    description: null,
    statusLabel: 'Популярне серед читачів',
  },
  [NEW_ARRIVALS_SLUG]: {
    slug: NEW_ARRIVALS_SLUG,
    title: 'Новинки',
    eyebrow: null,
    description: null,
    statusLabel: 'Нові надходження',
  },
  [BIGGEST_DISCOUNTS_SLUG]: {
    slug: BIGGEST_DISCOUNTS_SLUG,
    title: 'Найбільші знижки',
    eyebrow: null,
    description: null,
    statusLabel: 'Актуальні пропозиції',
  },
};

async function computeDynamicFeed(
  prisma: PrismaClient,
  slug: string,
  ctx: CollectionMapperContext,
  now: Date,
): Promise<CollectionBookDto[]> {
  const allRows = await findAllCanonicalBooks(prisma);
  const allBooks = toBookDtos(allRows, ctx);

  switch (slug) {
    case WISHLIST_POPULAR_SLUG:
      return sortByWishlistCountDesc(allBooks);
    case POPULAR_SLUG:
      return sortPopular(allBooks);
    case NEW_ARRIVALS_SLUG:
      return sortNewArrivals(allBooks, now);
    case BIGGEST_DISCOUNTS_SLUG:
      return biggestDiscountsPool(allBooks);
    default:
      return [];
  }
}

/** Merge DB metadata (title/eyebrow/etc.) for a dynamic slug with static fallbacks. */
async function dynamicFeedMeta(prisma: PrismaClient, slug: string): Promise<DynamicFeed> {
  const dbRow = await findCollectionBySlug(prisma, slug);
  const fallback = DYNAMIC_FEED_META[slug];
  if (!dbRow) return fallback;
  return {
    slug: dbRow.slug,
    title: dbRow.title,
    eyebrow: dbRow.eyebrow,
    description: dbRow.description,
    statusLabel: dbRow.statusLabel ?? fallback.statusLabel,
  };
}

// ── Section builders ────────────────────────────────────────────────────────

async function buildFeatured(
  prisma: PrismaClient,
  ctx: CollectionMapperContext,
): Promise<CollectionSummaryDto> {
  const row = await findCollectionBySlug(prisma, FEATURED_SLUG);
  if (!row) throw new CollectionNotFoundError();
  const ids = await findCollectionItemBookIds(prisma, row.id);
  const books = toBookDtos(await findCanonicalBooksByIds(prisma, ids), ctx);
  return toCollectionSummaryDto(row, books, books.length);
}

async function buildGenres(prisma: PrismaClient): Promise<GenreDto[]> {
  const [genres, counts] = await Promise.all([findAllGenres(prisma), countBooksByGenre(prisma)]);
  return genres.map((g) => ({
    slug: g.slug,
    name: g.name,
    icon: g.icon,
    bookCount: counts.get(g.id) ?? 0,
  }));
}

async function buildMoods(prisma: PrismaClient): Promise<MoodDto[]> {
  const moods = await findAllMoods(prisma);
  return Promise.all(
    moods.map(async (m) => {
      const collectionRow = await findCollectionBySlug(prisma, m.slug);
      const ids = collectionRow ? await findCollectionItemBookIds(prisma, collectionRow.id) : [];
      return {
        slug: m.slug,
        name: m.name,
        description: m.description,
        icon: m.icon,
        bookCount: ids.length,
      };
    }),
  );
}

async function buildEditorial(
  prisma: PrismaClient,
  ctx: CollectionMapperContext,
): Promise<CollectionSummaryDto[]> {
  const rows = await findCollectionsByType(prisma, 'EDITORIAL');
  return Promise.all(
    rows.map(async (row) => {
      const ids = await findCollectionItemBookIds(prisma, row.id);
      const books = toBookDtos(await findCanonicalBooksByIds(prisma, ids), ctx);
      return toCollectionSummaryDto(row, books, 4);
    }),
  );
}

async function buildUnderrated(
  prisma: PrismaClient,
  ctx: CollectionMapperContext,
): Promise<CollectionBookDto[]> {
  const row = await findCollectionBySlug(prisma, UNDERRATED_SLUG);
  if (!row) return [];
  const ids = await findCollectionItemBookIds(prisma, row.id);
  // TODO: no ratings data source yet — ordering is purely curated (CollectionItem.sortOrder).
  return toBookDtos(await findCanonicalBooksByIds(prisma, ids), ctx);
}

/**
 * Assemble the Home/Hub response.
 *
 * Section order: wishlist-popular, genres, new-arrivals, biggest-discounts,
 * moods, popular, editorial, underrated.
 *
 * Cross-section dedup: a canonical book appears in at most one *book* section
 * (greedy allocation in the order above, via an accumulating `usedIds` set).
 * genres/moods/editorial sections are metadata/summary sections and are not
 * deduplicated against book sections.
 */
export async function getHome(prisma: PrismaClient, userId: string | null): Promise<HomeResponseDto> {
  const now = new Date();
  const ctx = await buildContext(prisma, userId);

  const featured = await buildFeatured(prisma, ctx);

  const usedIds = new Set<string>();
  // Take up to HOME_SHELF_LIMIT not-yet-used books so each shelf is bounded and a
  // book appears on at most one home book-section (greedy cross-section dedup).
  function allocate(books: CollectionBookDto[]): CollectionBookDto[] {
    const picked: CollectionBookDto[] = [];
    for (const b of books) {
      if (picked.length >= HOME_SHELF_LIMIT) break;
      if (usedIds.has(b.id)) continue;
      usedIds.add(b.id);
      picked.push(b);
    }
    return picked;
  }

  const allRows = await findAllCanonicalBooks(prisma);
  const allBooks = toBookDtos(allRows, ctx);

  const wishlistPopularMeta = await dynamicFeedMeta(prisma, WISHLIST_POPULAR_SLUG);
  const wishlistPopular = allocate(sortByWishlistCountDesc(allBooks));

  const newArrivalsMeta = await dynamicFeedMeta(prisma, NEW_ARRIVALS_SLUG);
  const newArrivals = allocate(sortNewArrivals(allBooks, now));

  const biggestDiscountsMeta = await dynamicFeedMeta(prisma, BIGGEST_DISCOUNTS_SLUG);
  const biggestDiscounts = allocate(biggestDiscountsPool(allBooks));

  const popularMeta = await dynamicFeedMeta(prisma, POPULAR_SLUG);
  const popular = allocate(sortPopular(allBooks));

  const genres = await buildGenres(prisma);
  const moods = await buildMoods(prisma);
  const editorial = await buildEditorial(prisma, ctx);
  const underrated = await buildUnderrated(prisma, ctx);

  const sections: Section[] = [
    {
      type: 'wishlist-popular',
      slug: wishlistPopularMeta.slug,
      title: wishlistPopularMeta.title,
      eyebrow: wishlistPopularMeta.eyebrow,
      description: wishlistPopularMeta.description,
      statusLabel: wishlistPopularMeta.statusLabel,
      href: collectionHref(wishlistPopularMeta.slug),
      items: wishlistPopular,
    },
    {
      type: 'genres',
      slug: 'genres',
      title: 'Жанри',
      eyebrow: null,
      description: null,
      statusLabel: null,
      href: collectionHref('genres'),
      items: genres,
    },
    {
      type: 'new-arrivals',
      slug: newArrivalsMeta.slug,
      title: newArrivalsMeta.title,
      eyebrow: newArrivalsMeta.eyebrow,
      description: newArrivalsMeta.description,
      statusLabel: newArrivalsMeta.statusLabel,
      href: collectionHref(newArrivalsMeta.slug),
      items: newArrivals,
    },
    {
      type: 'biggest-discounts',
      slug: biggestDiscountsMeta.slug,
      title: biggestDiscountsMeta.title,
      eyebrow: biggestDiscountsMeta.eyebrow,
      description: biggestDiscountsMeta.description,
      statusLabel: biggestDiscountsMeta.statusLabel,
      href: collectionHref(biggestDiscountsMeta.slug),
      items: biggestDiscounts,
    },
    {
      type: 'moods',
      slug: 'moods',
      title: 'Настрій',
      eyebrow: null,
      description: null,
      statusLabel: null,
      href: collectionHref('moods'),
      items: moods,
    },
    {
      type: 'popular',
      slug: popularMeta.slug,
      title: popularMeta.title,
      eyebrow: popularMeta.eyebrow,
      description: popularMeta.description,
      statusLabel: popularMeta.statusLabel,
      href: collectionHref(popularMeta.slug),
      items: popular,
    },
    {
      type: 'editorial',
      slug: 'editorial',
      title: 'Тематичні добірки',
      eyebrow: null,
      description: null,
      statusLabel: null,
      href: collectionHref('editorial'),
      items: editorial,
    },
    {
      type: 'underrated',
      slug: UNDERRATED_SLUG,
      title: 'Приховані скарби',
      eyebrow: null,
      description: null,
      statusLabel: null,
      href: collectionHref(UNDERRATED_SLUG),
      items: underrated,
    },
  ];

  return { featured, sections };
}

export async function getFeaturedSection(
  prisma: PrismaClient,
  userId: string | null,
): Promise<CollectionSummaryDto> {
  const ctx = await buildContext(prisma, userId);
  return buildFeatured(prisma, ctx);
}

export async function getWishlistPopularSection(
  prisma: PrismaClient,
  userId: string | null,
): Promise<CollectionBookDto[]> {
  const ctx = await buildContext(prisma, userId);
  return computeDynamicFeed(prisma, WISHLIST_POPULAR_SLUG, ctx, new Date());
}

export async function getPopularSection(
  prisma: PrismaClient,
  userId: string | null,
): Promise<CollectionBookDto[]> {
  const ctx = await buildContext(prisma, userId);
  return computeDynamicFeed(prisma, POPULAR_SLUG, ctx, new Date());
}

export async function getNewArrivalsSection(
  prisma: PrismaClient,
  userId: string | null,
): Promise<CollectionBookDto[]> {
  const ctx = await buildContext(prisma, userId);
  return computeDynamicFeed(prisma, NEW_ARRIVALS_SLUG, ctx, new Date());
}

export async function getBiggestDiscountsSection(
  prisma: PrismaClient,
  userId: string | null,
): Promise<CollectionBookDto[]> {
  const ctx = await buildContext(prisma, userId);
  return computeDynamicFeed(prisma, BIGGEST_DISCOUNTS_SLUG, ctx, new Date());
}

export async function getUnderratedSection(
  prisma: PrismaClient,
  userId: string | null,
): Promise<CollectionBookDto[]> {
  const ctx = await buildContext(prisma, userId);
  return buildUnderrated(prisma, ctx);
}

export async function getGenresSection(prisma: PrismaClient): Promise<GenreDto[]> {
  return buildGenres(prisma);
}

export async function getMoodsSection(prisma: PrismaClient): Promise<MoodDto[]> {
  return buildMoods(prisma);
}

export async function getEditorialSection(
  prisma: PrismaClient,
  userId: string | null,
): Promise<CollectionSummaryDto[]> {
  const ctx = await buildContext(prisma, userId);
  return buildEditorial(prisma, ctx);
}

// ── Detail / books / similar ────────────────────────────────────────────────

/**
 * Resolve a collection's book pool + a display-metadata descriptor for a
 * given slug, dispatching across: Genre slugs, known dynamic feed slugs, and
 * Collection rows (FEATURED/EDITORIAL/CURATED/MOOD). Throws
 * {@link CollectionNotFoundError} when the slug matches nothing.
 */
async function resolveSlugBooks(
  prisma: PrismaClient,
  slug: string,
  ctx: CollectionMapperContext,
): Promise<{ meta: CollectionDetailDto; books: CollectionBookDto[] }> {
  const genre = await findGenreBySlug(prisma, slug);
  if (genre) {
    const rows = await findCanonicalBooksByGenreId(prisma, genre.id);
    const books = toBookDtos(rows, ctx);
    return {
      meta: {
        slug: genre.slug,
        type: 'GENRE',
        title: genre.name,
        eyebrow: null,
        description: null,
        statusLabel: null,
        icon: genre.icon,
        bookCount: books.length,
      },
      books,
    };
  }

  if (DYNAMIC_SLUGS.has(slug)) {
    const meta = await dynamicFeedMeta(prisma, slug);
    const books = await computeDynamicFeed(prisma, slug, ctx, new Date());
    return {
      meta: {
        slug: meta.slug,
        type: 'DYNAMIC',
        title: meta.title,
        eyebrow: meta.eyebrow,
        description: meta.description,
        statusLabel: meta.statusLabel,
        icon: null,
        bookCount: books.length,
      },
      books,
    };
  }

  const collectionRow = await findCollectionBySlug(prisma, slug);
  if (collectionRow) {
    const ids = await findCollectionItemBookIds(prisma, collectionRow.id);
    const books = toBookDtos(await findCanonicalBooksByIds(prisma, ids), ctx);
    return { meta: toCollectionDetailDto(collectionRow, books.length), books };
  }

  const mood = await findMoodBySlug(prisma, slug);
  if (mood) {
    const moodCollectionRow = await findCollectionBySlug(prisma, mood.slug);
    const ids = moodCollectionRow ? await findCollectionItemBookIds(prisma, moodCollectionRow.id) : [];
    const books = toBookDtos(await findCanonicalBooksByIds(prisma, ids), ctx);
    return {
      meta: {
        slug: mood.slug,
        type: 'MOOD',
        title: mood.name,
        eyebrow: null,
        description: mood.description,
        statusLabel: null,
        icon: mood.icon,
        bookCount: books.length,
      },
      books,
    };
  }

  throw new CollectionNotFoundError();
}

export async function getCollectionDetail(
  prisma: PrismaClient,
  slug: string,
): Promise<CollectionDetailDto> {
  const ctx: CollectionMapperContext = { wishlistCounts: new Map(), wishlistedIds: new Set() };
  const { meta } = await resolveSlugBooks(prisma, slug, ctx);
  return meta;
}

export async function getCollectionBooksPage(
  prisma: PrismaClient,
  slug: string,
  params: BooksQueryParams,
  userId: string | null,
): Promise<BooksPageDto> {
  const ctx = await buildContext(prisma, userId);
  const { meta, books } = await resolveSlugBooks(prisma, slug, ctx);
  const sorted = applySort(books, params.sort);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / params.limit));
  const pageBooks = paginate(sorted, params.page, params.limit);

  return {
    collection: meta,
    books: pageBooks,
    page: params.page,
    perPage: params.limit,
    total,
    totalPages,
  };
}

export async function getGenreBooksPage(
  prisma: PrismaClient,
  slug: string,
  params: BooksQueryParams,
  userId: string | null,
): Promise<BooksPageDto> {
  return getCollectionBooksPage(prisma, slug, params, userId);
}

export async function getMoodBooksPage(
  prisma: PrismaClient,
  slug: string,
  params: BooksQueryParams,
  userId: string | null,
): Promise<BooksPageDto> {
  return getCollectionBooksPage(prisma, slug, params, userId);
}

/**
 * Suggest similar collections: same-type collections first, then others, max
 * 3, excluding the current slug. // TODO: smarter ranking (shared genre/mood
 * overlap, co-wishlist signals) once available.
 */
export async function getSimilarCollections(
  prisma: PrismaClient,
  slug: string,
  userId: string | null,
): Promise<SimilarDto> {
  const current = await findCollectionBySlug(prisma, slug);
  const ctx = await buildContext(prisma, userId);

  const types: CollectionRow['type'][] = ['FEATURED', 'EDITORIAL', 'CURATED', 'MOOD'];
  const allCollections: CollectionRow[] = [];
  for (const type of types) {
    allCollections.push(...(await findCollectionsByType(prisma, type)));
  }

  const others = allCollections.filter((c) => c.slug !== slug);
  const sameType = current ? others.filter((c) => c.type === current.type) : [];
  const rest = current ? others.filter((c) => c.type !== current.type) : others;
  const chosen = [...sameType, ...rest].slice(0, 3);

  const collections = await Promise.all(
    chosen.map(async (row) => {
      const ids = await findCollectionItemBookIds(prisma, row.id);
      const books = toBookDtos(await findCanonicalBooksByIds(prisma, ids), ctx);
      return toCollectionSummaryDto(row, books, 4);
    }),
  );

  return { collections };
}
