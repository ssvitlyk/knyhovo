import { z } from 'zod';
import { ValidationError } from '../errors.js';

/**
 * Validation for `GET /api/search` query parameters.
 *
 * Rules (Search Results v1.0):
 * - `q`: required; trimmed; must be non-empty after trimming.
 * - `page`: integer >= 1; defaults to 1.
 * - `pageSize`: integer in [1, 50]; defaults to 20.
 *
 * Query string values arrive as strings, so numeric params are coerced.
 */
const searchQuerySchema = z.object({
  q: z.string().trim().min(1),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchParams = z.infer<typeof searchQuerySchema>;

/**
 * Parse and validate raw request query parameters.
 * Throws {@link ValidationError} (→ HTTP 400) on any invalid input.
 */
export function parseSearchQuery(query: unknown): SearchParams {
  const result = searchQuerySchema.safeParse(query);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid query parameters';
    throw new ValidationError(message);
  }
  return result.data;
}
