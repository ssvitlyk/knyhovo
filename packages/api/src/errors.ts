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
