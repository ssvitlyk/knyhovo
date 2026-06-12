import type { PrismaClient } from '@prisma/client';
import { BookNotFoundError } from '../errors.js';
import {
  findWishlistItemsByUserId,
  canonicalBookExists,
  addWishlistItem,
  removeWishlistItem,
  wishlistContains,
} from './repository.js';
import { toWishlistResponse } from './mapper.js';
import type { WishlistResponseDto } from './dto.js';

/**
 * Return the current user's wishlist with live provider prices.
 */
export async function listWishlist(
  prisma: PrismaClient,
  userId: string,
): Promise<WishlistResponseDto> {
  const rows = await findWishlistItemsByUserId(prisma, userId);
  return toWishlistResponse(rows);
}

/**
 * Add a canonical book to the user's wishlist.
 * Throws {@link BookNotFoundError} when the book does not exist.
 * Idempotent — adding the same book twice is safe.
 */
export async function addToWishlist(
  prisma: PrismaClient,
  userId: string,
  bookId: string,
): Promise<void> {
  if (!(await canonicalBookExists(prisma, bookId))) {
    throw new BookNotFoundError();
  }
  await addWishlistItem(prisma, userId, bookId);
}

/**
 * Remove a canonical book from the user's wishlist.
 * Idempotent — removing a book that is not in the wishlist is safe.
 */
export async function removeFromWishlist(
  prisma: PrismaClient,
  userId: string,
  bookId: string,
): Promise<void> {
  await removeWishlistItem(prisma, userId, bookId);
}

/**
 * Returns true when the user's wishlist contains the given book.
 */
export async function isBookInWishlist(
  prisma: PrismaClient,
  userId: string,
  bookId: string,
): Promise<boolean> {
  return wishlistContains(prisma, userId, bookId);
}
