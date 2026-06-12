import { z } from 'zod';
import { ValidationError } from '../errors.js';

/**
 * Validation for `POST /api/wishlist` request body.
 *
 * Rules (Wishlist API v1.0):
 * - `bookId`: required; must be a valid UUID v4.
 *
 * Throws {@link ValidationError} (→ HTTP 400) on any invalid input.
 */
const addWishlistBody = z.object({ bookId: z.string().uuid() });

export type AddWishlistBody = z.infer<typeof addWishlistBody>;

/**
 * Parse and validate the POST /api/wishlist request body.
 * Throws {@link ValidationError} (→ HTTP 400) when `bookId` is missing or not a valid UUID.
 */
export function parseAddWishlistBody(input: unknown): { bookId: string } {
  const result = addWishlistBody.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid request body';
    throw new ValidationError(message);
  }
  return result.data;
}

/**
 * Validation for `GET /api/wishlist/status/:bookId` and `DELETE /api/wishlist/:bookId` path params.
 *
 * Rules (Wishlist API v1.0):
 * - `bookId`: required; must be a valid UUID v4.
 *
 * Throws {@link ValidationError} (→ HTTP 400) on any invalid input.
 */
const wishlistParams = z.object({ bookId: z.string().uuid() });

export type WishlistParams = z.infer<typeof wishlistParams>;

/**
 * Parse and validate wishlist route parameters.
 * Throws {@link ValidationError} (→ HTTP 400) when `bookId` is not a valid UUID.
 */
export function parseWishlistParams(params: unknown): { bookId: string } {
  const result = wishlistParams.safeParse(params);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid route parameters';
    throw new ValidationError(message);
  }
  return result.data;
}
