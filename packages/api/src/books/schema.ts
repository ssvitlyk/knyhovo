import { z } from 'zod';
import { BadRequestError } from '../errors.js';

/**
 * Validation for `GET /api/books/:id` route parameters.
 *
 * Rules (Book Details v1.0):
 * - `id`: required; must be a valid UUID v4.
 *
 * Throws {@link BadRequestError} (→ HTTP 400) when the id is not a valid UUID.
 */
const bookParamsSchema = z.object({ id: z.string().uuid() });

export type BookParams = z.infer<typeof bookParamsSchema>;

/**
 * Parse and validate raw request route parameters.
 * Throws {@link BadRequestError} (→ HTTP 400) when `id` is not a valid UUID.
 */
export function parseBookParams(params: unknown): BookParams {
  const result = bookParamsSchema.safeParse(params);
  if (!result.success) {
    throw new BadRequestError('Invalid book id');
  }
  return result.data;
}
