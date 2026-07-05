import type { PrismaClient } from '@prisma/client';

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

/** Fetch all canonical books (used for dynamic feeds computed in application code). */
export async function findAllCanonicalBooks(prisma: PrismaClient): Promise<CollectionBookRow[]> {
  return prisma.canonicalBook.findMany({ select: CANONICAL_BOOK_SELECT });
}

/** Fetch canonical books belonging to a given taxonomic (genre) collection id. */
export async function findCanonicalBooksByGenreId(
  prisma: PrismaClient,
  genreId: string,
): Promise<CollectionBookRow[]> {
  return prisma.canonicalBook.findMany({
    where: { genreId },
    select: CANONICAL_BOOK_SELECT,
  });
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

/** Map of taxonomic (genre) collection id → slug, for filtering books by `?genre=slug`. */
export async function findTaxonomicSlugById(prisma: PrismaClient): Promise<Map<string, string>> {
  const rows = await prisma.collection.findMany({
    where: { type: 'TAXONOMIC' },
    select: { id: true, slug: true },
  });
  return new Map(rows.map((r) => [r.id, r.slug]));
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

/** Wishlist counts per canonical book, computed once per request (no N+1). */
export async function findWishlistCounts(prisma: PrismaClient): Promise<Map<string, number>> {
  const rows = await prisma.wishlistItem.groupBy({
    by: ['canonicalBookId'],
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.canonicalBookId, row._count._all);
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
