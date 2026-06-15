/**
 * Domain-level error raised when request input fails validation at the API
 * boundary. The Fastify error handler in `app.ts` maps this to HTTP 400.
 */
export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Domain-level error raised when a request parameter is syntactically invalid
 * (e.g. a non-UUID book id). The Fastify error handler maps this to HTTP 400.
 */
export class BadRequestError extends Error {
  readonly code = 'BAD_REQUEST';

  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

/**
 * Domain-level error raised when a canonical book cannot be found by id.
 * The Fastify error handler maps this to HTTP 404.
 */
export class BookNotFoundError extends Error {
  readonly code = 'BOOK_NOT_FOUND';

  constructor(message = 'Book not found') {
    super(message);
    this.name = 'BookNotFoundError';
  }
}

/**
 * Domain-level error raised when a request requires authentication but no
 * valid session was found. The Fastify error handler maps this to HTTP 401.
 */
export class UnauthorizedError extends Error {
  readonly code = 'AUTH_REQUIRED';

  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Domain-level error raised when login code verification fails for any reason.
 * A generic message is used so callers cannot distinguish between "code wrong",
 * "code expired", "user not found", etc. (no oracle).
 * The Fastify error handler maps this to HTTP 401.
 */
export class InvalidCredentialsError extends Error {
  readonly code = 'AUTH_INVALID_CODE';

  constructor(message = 'Invalid or expired code.') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * Domain-level error raised when the login-code rate limit is exceeded.
 * The Fastify error handler maps this to HTTP 429.
 */
export class RateLimitedError extends Error {
  readonly code = 'RATE_LIMITED';

  constructor(message = 'Too many requests. Please try again later.') {
    super(message);
    this.name = 'RateLimitedError';
  }
}

/**
 * Domain-level error raised when a wishlist item cannot be found for the given
 * user + book combination. The Fastify error handler maps this to HTTP 404.
 */
export class WishlistItemNotFoundError extends Error {
  readonly code = 'WISHLIST_ITEM_NOT_FOUND';

  constructor(message = 'Book is not in your wishlist.') {
    super(message);
    this.name = 'WishlistItemNotFoundError';
  }
}
