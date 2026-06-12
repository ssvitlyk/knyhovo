import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { listWishlist, addToWishlist, removeFromWishlist, isBookInWishlist } from '../service.js';
import { BookNotFoundError } from '../../errors.js';

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

const USER_ID = 'user-id-1';
const BOOK_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeFakePrisma(overrides: {
  wishlistItemFindMany?: ReturnType<typeof vi.fn>;
  wishlistItemUpsert?: ReturnType<typeof vi.fn>;
  wishlistItemDeleteMany?: ReturnType<typeof vi.fn>;
  wishlistItemCount?: ReturnType<typeof vi.fn>;
  canonicalBookCount?: ReturnType<typeof vi.fn>;
} = {}): PrismaClient {
  const db = {
    wishlistItem: {
      findMany: overrides.wishlistItemFindMany ?? vi.fn(async () => []),
      upsert: overrides.wishlistItemUpsert ?? vi.fn(async () => ({})),
      deleteMany: overrides.wishlistItemDeleteMany ?? vi.fn(async () => ({ count: 0 })),
      count: overrides.wishlistItemCount ?? vi.fn(async () => 0),
    },
    canonicalBook: {
      count: overrides.canonicalBookCount ?? vi.fn(async () => 0),
    },
  };
  return db as unknown as PrismaClient;
}

describe('listWishlist', () => {
  it('returns mapped items from repository', async () => {
    const row = {
      createdAt: FIXED_DATE,
      canonicalBook: {
        id: BOOK_UUID,
        title: 'Кобзар',
        author: 'Тарас Шевченко',
        isbn: null,
        listings: [
          {
            provider: 'YAKABOO',
            priceAmount: 34900,
            priceCurrency: 'UAH',
            availability: 'IN_STOCK',
            url: 'https://example.com',
            lastSeenAt: FIXED_DATE,
          },
        ],
      },
    };

    const prisma = makeFakePrisma({
      wishlistItemFindMany: vi.fn(async () => [row]),
    });

    const result = await listWishlist(prisma, USER_ID);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.book.id).toBe(BOOK_UUID);
    expect(result.items[0]!.book.lowestPrice).toEqual({ amount: 34900, currency: 'UAH' });
    expect(result.items[0]!.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns empty items when wishlist is empty', async () => {
    const prisma = makeFakePrisma({
      wishlistItemFindMany: vi.fn(async () => []),
    });

    const result = await listWishlist(prisma, USER_ID);

    expect(result.items).toEqual([]);
  });
});

describe('addToWishlist', () => {
  it('adds book when canonical book exists', async () => {
    const upsert = vi.fn(async () => ({}));
    const prisma = makeFakePrisma({
      canonicalBookCount: vi.fn(async () => 1),
      wishlistItemUpsert: upsert,
    });

    await addToWishlist(prisma, USER_ID, BOOK_UUID);

    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_canonicalBookId: { userId: USER_ID, canonicalBookId: BOOK_UUID } },
        create: { userId: USER_ID, canonicalBookId: BOOK_UUID },
        update: {},
      }),
    );
  });

  it('duplicate add succeeds (upsert is idempotent)', async () => {
    const upsert = vi.fn(async () => ({}));
    const prisma = makeFakePrisma({
      canonicalBookCount: vi.fn(async () => 1),
      wishlistItemUpsert: upsert,
    });

    await addToWishlist(prisma, USER_ID, BOOK_UUID);
    await addToWishlist(prisma, USER_ID, BOOK_UUID);

    expect(upsert).toHaveBeenCalledTimes(2);
  });

  it('throws BookNotFoundError when book does not exist', async () => {
    const prisma = makeFakePrisma({
      canonicalBookCount: vi.fn(async () => 0),
    });

    await expect(addToWishlist(prisma, USER_ID, BOOK_UUID)).rejects.toThrow(BookNotFoundError);
  });
});

describe('removeFromWishlist', () => {
  it('removes existing item', async () => {
    const deleteMany = vi.fn(async () => ({ count: 1 }));
    const prisma = makeFakePrisma({ wishlistItemDeleteMany: deleteMany });

    await removeFromWishlist(prisma, USER_ID, BOOK_UUID);

    expect(deleteMany).toHaveBeenCalledOnce();
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, canonicalBookId: BOOK_UUID },
    });
  });

  it('removing a non-existent item succeeds (idempotent)', async () => {
    const deleteMany = vi.fn(async () => ({ count: 0 }));
    const prisma = makeFakePrisma({ wishlistItemDeleteMany: deleteMany });

    await expect(removeFromWishlist(prisma, USER_ID, BOOK_UUID)).resolves.toBeUndefined();
    expect(deleteMany).toHaveBeenCalledOnce();
  });
});

describe('isBookInWishlist', () => {
  it('returns true when book is in wishlist', async () => {
    const prisma = makeFakePrisma({
      wishlistItemCount: vi.fn(async () => 1),
    });

    expect(await isBookInWishlist(prisma, USER_ID, BOOK_UUID)).toBe(true);
  });

  it('returns false when book is not in wishlist', async () => {
    const prisma = makeFakePrisma({
      wishlistItemCount: vi.fn(async () => 0),
    });

    expect(await isBookInWishlist(prisma, USER_ID, BOOK_UUID)).toBe(false);
  });
});
