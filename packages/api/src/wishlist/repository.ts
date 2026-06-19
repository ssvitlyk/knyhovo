import type { PrismaClient } from '@prisma/client';
import type { WishlistAlertRow } from './alert/repository.js';

export type { WishlistAlertRow };

/**
 * Internal row shapes returned by the wishlist repository.
 *
 * These deliberately mirror only the fields the mapper needs. They are
 * structurally compatible with the Prisma payload (so the query result is
 * assignable without manual copying) while keeping `@prisma/client` types from
 * leaking into the mapper/service layers.
 */
export interface WishlistListingRow {
  readonly provider: 'YAKABOO' | 'BOOK_CLUB' | 'VIVAT' | 'BOOK_YE';
  readonly priceAmount: number;
  readonly priceCurrency: 'UAH';
  readonly availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  readonly url: string;
  readonly lastSeenAt: Date;
}

export interface WishlistCanonicalBookRow {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly isbn: string | null;
  readonly listings: readonly WishlistListingRow[];
}

export interface WishlistRow {
  readonly createdAt: Date;
  readonly canonicalBook: WishlistCanonicalBookRow;
  readonly alert: WishlistAlertRow | null;
}

/**
 * Fetch all wishlist items for a user with their canonical book data and listings
 * eagerly loaded in a single query. Returns them ordered newest-first.
 *
 * This is the only place that issues a Prisma query for wishlist items. All
 * filtering, aggregation and slug mapping happen in the mapper so they remain
 * unit-testable and no N+1 queries are possible.
 */
export async function findWishlistItemsByUserId(
  prisma: PrismaClient,
  userId: string,
): Promise<WishlistRow[]> {
  return prisma.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      canonicalBook: {
        select: {
          id: true,
          title: true,
          author: true,
          isbn: true,
          listings: {
            select: {
              provider: true,
              priceAmount: true,
              priceCurrency: true,
              availability: true,
              url: true,
              lastSeenAt: true,
            },
          },
        },
      },
      alert: {
        select: {
          status: true,
          intent: true,
          targetPriceAmount: true,
          targetPriceCurrency: true,
          pausedAt: true,
        },
      },
    },
  });
}

/**
 * Returns true when a canonical book with the given id exists in the database.
 */
export async function canonicalBookExists(
  prisma: PrismaClient,
  bookId: string,
): Promise<boolean> {
  const count = await prisma.canonicalBook.count({ where: { id: bookId } });
  return count > 0;
}

/**
 * Add a book to the user's wishlist. Idempotent — safe to call multiple times
 * for the same user/book pair (upsert with no-op update).
 */
export async function addWishlistItem(
  prisma: PrismaClient,
  userId: string,
  bookId: string,
): Promise<void> {
  await prisma.wishlistItem.upsert({
    where: { userId_canonicalBookId: { userId, canonicalBookId: bookId } },
    create: { userId, canonicalBookId: bookId },
    update: {},
  });
}

/**
 * Remove a book from the user's wishlist. Idempotent — safe to call even when
 * the item does not exist.
 */
export async function removeWishlistItem(
  prisma: PrismaClient,
  userId: string,
  bookId: string,
): Promise<void> {
  await prisma.wishlistItem.deleteMany({
    where: { userId, canonicalBookId: bookId },
  });
}

/**
 * Returns true when the user's wishlist contains the given book.
 */
export async function wishlistContains(
  prisma: PrismaClient,
  userId: string,
  bookId: string,
): Promise<boolean> {
  const count = await prisma.wishlistItem.count({
    where: { userId, canonicalBookId: bookId },
  });
  return count > 0;
}
