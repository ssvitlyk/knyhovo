import { z } from 'zod';
import { parseOrThrow } from '../http/parse.js';

/**
 * Validation for `POST /api/wishlist` request body.
 *
 * Rules (Wishlist API v1.0):
 * - `bookId`: required; must be a valid UUID v4.
 *
 * Throws `ValidationError` (→ HTTP 400) on any invalid input.
 */
const addWishlistBody = z.object({ bookId: z.string().uuid() });

/**
 * Parse and validate the POST /api/wishlist request body.
 * Throws `ValidationError` (→ HTTP 400) when `bookId` is missing or not a valid UUID.
 */
export function parseAddWishlistBody(input: unknown): { bookId: string } {
  return parseOrThrow(addWishlistBody, input, 'Invalid request body');
}

/**
 * Validation for `GET /api/wishlist/status/:bookId` and `DELETE /api/wishlist/:bookId` path params.
 *
 * Rules (Wishlist API v1.0):
 * - `bookId`: required; must be a valid UUID v4.
 *
 * Throws `ValidationError` (→ HTTP 400) on any invalid input.
 */
const wishlistParams = z.object({ bookId: z.string().uuid() });

/**
 * Parse and validate wishlist route parameters.
 * Throws `ValidationError` (→ HTTP 400) when `bookId` is not a valid UUID.
 */
export function parseWishlistParams(params: unknown): { bookId: string } {
  return parseOrThrow(wishlistParams, params, 'Invalid route parameters');
}
