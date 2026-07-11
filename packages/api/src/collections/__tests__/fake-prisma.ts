import { vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

/**
 * In-memory fake Prisma client for the collections endpoints.
 *
 * Implements just enough of the Prisma surface the collections repository
 * calls: canonicalBook.findMany/groupBy, collection.findUnique/findMany,
 * collectionItem.findMany, wishlistItem.groupBy. No real database — fully
 * deterministic, no network, no time dependency beyond what tests pass in.
 */

export type FakeProvider = 'YAKABOO' | 'BOOK_CLUB' | 'VIVAT' | 'BOOK_YE' | 'BOOKCHEF' | 'LABORATORY' | 'KNIGOLAND';
export type FakeAvailability = 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';

export interface FakePriceHistoryPoint {
  priceAmount: number;
  priceCurrency: 'UAH';
  recordedAt: Date;
}

export interface FakeListing {
  provider: FakeProvider;
  priceAmount: number;
  priceCurrency: 'UAH';
  availability: FakeAvailability;
  coverUrl: string | null;
  priceHistory: FakePriceHistoryPoint[];
}

export interface FakeBook {
  id: string;
  title: string;
  author: string;
  createdAt: Date;
  genreId: string | null;
  listings: FakeListing[];
}

export type FakeCollectionType = 'DYNAMIC' | 'EDITORIAL' | 'TAXONOMIC';

export interface FakeCollection {
  id: string;
  slug: string;
  type: FakeCollectionType;
  name: string;
  description: string;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
  updatedAt: Date;
}

export interface FakeCollectionItem {
  collectionId: string;
  canonicalBookId: string;
  sortOrder: number;
}

export interface FakeWishlistItem {
  userId: string;
  canonicalBookId: string;
}

export interface FakeSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface FakeUser {
  id: string;
  email: string;
  createdAt: Date;
  displayName?: string | null;
}

export interface FakeDb {
  books: FakeBook[];
  collections: FakeCollection[];
  collectionItems: FakeCollectionItem[];
  wishlistItems: FakeWishlistItem[];
  sessions: FakeSession[];
  users: FakeUser[];
}

export function emptyDb(): FakeDb {
  return { books: [], collections: [], collectionItems: [], wishlistItems: [], sessions: [], users: [] };
}

export function book(
  id: string,
  title: string,
  author: string,
  opts: {
    createdAt?: Date;
    genreId?: string | null;
    listings?: FakeListing[];
  } = {},
  fixedDate: Date = new Date('2026-07-03T00:00:00.000Z'),
): FakeBook {
  return {
    id,
    title,
    author,
    createdAt: opts.createdAt ?? fixedDate,
    genreId: opts.genreId ?? null,
    listings: opts.listings ?? [],
  };
}

export function listing(price: number, opts: Partial<FakeListing> = {}): FakeListing {
  return {
    provider: 'YAKABOO',
    priceAmount: price,
    priceCurrency: 'UAH',
    availability: 'IN_STOCK',
    coverUrl: null,
    priceHistory: [],
    ...opts,
  };
}

export function collection(
  id: string,
  slug: string,
  type: FakeCollectionType,
  opts: Partial<Omit<FakeCollection, 'id' | 'slug' | 'type'>> = {},
): FakeCollection {
  return {
    id,
    slug,
    type,
    name: opts.name ?? slug,
    description: opts.description ?? `Опис для ${slug}`,
    icon: opts.icon ?? null,
    displayOrder: opts.displayOrder ?? 0,
    isActive: opts.isActive ?? true,
    updatedAt: opts.updatedAt ?? new Date('2026-07-03T00:00:00.000Z'),
  };
}

export function itemsFor(collectionId: string, bookIds: string[]): FakeCollectionItem[] {
  return bookIds.map((id, i) => ({ collectionId, canonicalBookId: id, sortOrder: i }));
}

/** Backing `FakeDb` for a client built by {@link makeFakePrisma}, for test-only repository mocking (see `fake-feed-repository.ts`). */
const dbByClient = new WeakMap<object, FakeDb>();

/** Retrieve the `FakeDb` a fake Prisma client was built from. Throws if `prisma` isn't a fake client. */
export function fakeDbOf(prisma: unknown): FakeDb {
  const db = dbByClient.get(prisma as object);
  if (!db) throw new Error('fakeDbOf: not a fake Prisma client (was it built by makeFakePrisma?)');
  return db;
}

export function makeFakePrisma(db: FakeDb): PrismaClient {
  const client = {
    canonicalBook: {
      findMany: vi.fn(async (args: { where?: { id?: { in: string[] }; genreId?: string } }) => {
        let rows = db.books;
        if (args?.where?.id?.in) {
          const ids = new Set(args.where.id.in);
          rows = rows.filter((b) => ids.has(b.id));
        }
        if (args?.where?.genreId) {
          rows = rows.filter((b) => b.genreId === args.where?.genreId);
        }
        return rows.map((b) => ({ ...b }));
      }),
      groupBy: vi.fn(async () => {
        const counts = new Map<string, number>();
        for (const b of db.books) {
          if (b.genreId) counts.set(b.genreId, (counts.get(b.genreId) ?? 0) + 1);
        }
        return [...counts.entries()].map(([genreId, count]) => ({
          genreId,
          _count: { _all: count },
        }));
      }),
    },
    collection: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        return db.collections.find((c) => c.slug === where.slug) ?? null;
      }),
      findFirst: vi.fn(async ({ where }: { where: { slug?: string; type?: string } }) => {
        return (
          db.collections.find(
            (c) => (where.slug === undefined || c.slug === where.slug) && (where.type === undefined || c.type === where.type),
          ) ?? null
        );
      }),
      findMany: vi.fn(
        async (args: { where?: { type?: string; isActive?: boolean; slug?: { in: string[] } } }) => {
          let rows = db.collections;
          if (args?.where?.type) rows = rows.filter((c) => c.type === args.where?.type);
          if (args?.where?.isActive) rows = rows.filter((c) => c.isActive);
          if (args?.where?.slug?.in) {
            const slugs = new Set(args.where.slug.in);
            rows = rows.filter((c) => slugs.has(c.slug));
          }
          return [...rows].sort((a, b) => {
            if (a.type !== b.type) return a.type < b.type ? -1 : 1;
            return a.displayOrder - b.displayOrder;
          });
        },
      ),
    },
    collectionItem: {
      findMany: vi.fn(async ({ where }: { where: { collectionId: string } }) => {
        return db.collectionItems
          .filter((i) => i.collectionId === where.collectionId)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((i) => ({ canonicalBookId: i.canonicalBookId }));
      }),
      groupBy: vi.fn(async ({ where }: { where?: { collectionId?: { in: string[] } } } = {}) => {
        const ids = where?.collectionId?.in ? new Set(where.collectionId.in) : null;
        const counts = new Map<string, number>();
        for (const i of db.collectionItems) {
          if (ids && !ids.has(i.collectionId)) continue;
          counts.set(i.collectionId, (counts.get(i.collectionId) ?? 0) + 1);
        }
        return [...counts.entries()].map(([collectionId, count]) => ({
          collectionId,
          _count: { _all: count },
        }));
      }),
    },
    wishlistItem: {
      groupBy: vi.fn(async ({ where }: { where?: { canonicalBookId?: { in: string[] } } } = {}) => {
        const ids = where?.canonicalBookId?.in ? new Set(where.canonicalBookId.in) : null;
        const counts = new Map<string, number>();
        for (const w of db.wishlistItems) {
          if (ids && !ids.has(w.canonicalBookId)) continue;
          counts.set(w.canonicalBookId, (counts.get(w.canonicalBookId) ?? 0) + 1);
        }
        return [...counts.entries()].map(([canonicalBookId, count]) => ({
          canonicalBookId,
          _count: { _all: count },
        }));
      }),
      findMany: vi.fn(async ({ where }: { where: { userId: string }; select?: unknown }) => {
        return db.wishlistItems
          .filter((w) => w.userId === where.userId)
          .map((w) => ({ canonicalBookId: w.canonicalBookId }));
      }),
    },
    session: {
      findFirst: vi.fn(
        async ({
          where,
          include,
        }: {
          where: { tokenHash: string; expiresAt: { gt: Date } };
          include?: { user?: boolean };
        }) => {
          const session = db.sessions.find(
            (s) => s.tokenHash === where.tokenHash && s.expiresAt > where.expiresAt.gt,
          );
          if (!session) return null;
          if (include?.user) {
            const user = db.users.find((u) => u.id === session.userId);
            return { ...session, user: user ?? null };
          }
          return session;
        },
      ),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        return db.users.find((u) => u.id === where.id || u.email === where.email) ?? null;
      }),
    },
  };
  dbByClient.set(client, db);
  return client as unknown as PrismaClient;
}
