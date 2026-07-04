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

export interface FakeDb {
  books: FakeBook[];
  collections: FakeCollection[];
  collectionItems: FakeCollectionItem[];
  wishlistItems: FakeWishlistItem[];
}

export function emptyDb(): FakeDb {
  return { books: [], collections: [], collectionItems: [], wishlistItems: [] };
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
      findMany: vi.fn(
        async (args: { where?: { type?: string; isActive?: boolean } }) => {
          let rows = db.collections;
          if (args?.where?.type) rows = rows.filter((c) => c.type === args.where?.type);
          if (args?.where?.isActive) rows = rows.filter((c) => c.isActive);
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
    },
    wishlistItem: {
      groupBy: vi.fn(async () => {
        const counts = new Map<string, number>();
        for (const w of db.wishlistItems) {
          counts.set(w.canonicalBookId, (counts.get(w.canonicalBookId) ?? 0) + 1);
        }
        return [...counts.entries()].map(([canonicalBookId, count]) => ({
          canonicalBookId,
          _count: { _all: count },
        }));
      }),
    },
  };
  return client as unknown as PrismaClient;
}
