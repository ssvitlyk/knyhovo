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
