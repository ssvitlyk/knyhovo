import { z } from 'zod';
import { ValidationError } from '../errors.js';

/**
 * Validation for `GET /api/collections/*​/books` query parameters.
 *
 * Rules:
 * - `page`: integer >= 1; defaults to 1.
 * - `sort`: one of relevance|price_asc|price_desc|newest|discount_desc; defaults to relevance.
 * - `limit`: integer in [1, 24]; defaults to 12.
 *
 * Query string values arrive as strings, so numeric params are coerced.
 */
const booksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  sort: z
    .enum(['relevance', 'price_asc', 'price_desc', 'newest', 'discount_desc'])
    .default('relevance'),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});

export type BooksQueryParams = z.infer<typeof booksQuerySchema>;

const slugParamsSchema = z.object({
  slug: z.string().trim().min(1),
});

export type SlugParams = z.infer<typeof slugParamsSchema>;

/**
 * Parse and validate raw request query parameters for book-listing endpoints.
 * Throws {@link ValidationError} (→ HTTP 400) on any invalid input.
 */
export function parseBooksQuery(query: unknown): BooksQueryParams {
  const result = booksQuerySchema.safeParse(query);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid query parameters';
    throw new ValidationError(message);
  }
  return result.data;
}

/**
 * Parse and validate a `:slug` route parameter.
 * Throws {@link ValidationError} (→ HTTP 400) on any invalid input.
 */
export function parseSlugParams(params: unknown): SlugParams {
  const result = slugParamsSchema.safeParse(params);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid route parameters';
    throw new ValidationError(message);
  }
  return result.data;
}
