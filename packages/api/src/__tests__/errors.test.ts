import { describe, it, expect } from 'vitest';
import {
  HttpError,
  ValidationError,
  BadRequestError,
  BookNotFoundError,
  UnauthorizedError,
  ForbiddenError,
  InvalidCredentialsError,
  RateLimitedError,
  WishlistItemNotFoundError,
  CollectionNotFoundError,
  AlertPolicyError,
} from '../errors.js';

describe('HttpError subclasses', () => {
  const cases: ReadonlyArray<readonly [HttpError, string, number]> = [
    [new ValidationError('x'), 'VALIDATION_ERROR', 400],
    [new BadRequestError('x'), 'BAD_REQUEST', 400],
    [new BookNotFoundError(), 'BOOK_NOT_FOUND', 404],
    [new UnauthorizedError(), 'AUTH_REQUIRED', 401],
    [new ForbiddenError(), 'FORBIDDEN', 403],
    [new InvalidCredentialsError(), 'AUTH_INVALID_CODE', 401],
    [new RateLimitedError(), 'RATE_LIMITED', 429],
    [new WishlistItemNotFoundError(), 'WISHLIST_ITEM_NOT_FOUND', 404],
    [new CollectionNotFoundError(), 'COLLECTION_NOT_FOUND', 404],
    [new AlertPolicyError('INSUFFICIENT_HISTORY', 'm'), 'INSUFFICIENT_HISTORY', 409],
    [new AlertPolicyError('NO_CANONICAL_PRICE', 'm'), 'NO_CANONICAL_PRICE', 422],
    [new AlertPolicyError('THRESHOLD_REQUIRED', 'm'), 'THRESHOLD_REQUIRED', 422],
  ];

  it.each(cases)('%o maps to code/status', (err, code, status) => {
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe(code);
    expect(err.httpStatus).toBe(status);
  });
});
