import { z } from 'zod';
import { parseOrThrow } from '../http/parse.js';

const PER_PAGE = 24;

/**
 * Validation for `GET /api/collections/:slug/books` query parameters.
 *
 * Rules:
 * - `page`: integer >= 1; defaults to 1.
 * - `per_page`: if provided, must equal 24 (the only supported page size);
 *   otherwise 400 VALIDATION_ERROR. Defaults to 24 when omitted.
 * - `sort`: one of relevance|price_asc|price_desc|newest|oldest|discount_desc;
 *   the service applies a per-collection-type default when omitted.
 * - `genre`: optional slug filter (ignored for taxonomic collections).
 * - `price_min`/`price_max`: non-negative integer кopiyky.
 * - `in_stock`: 0|1; defaults to 0 (no filter — all books).
 *
 * Query string values arrive as strings, so numeric/boolean-ish params are coerced.
 */
const booksQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    per_page: z.coerce.number().int().refine((v) => v === PER_PAGE, {
      message: `per_page must be ${PER_PAGE}`,
    }).optional(),
    sort: z.enum(['relevance', 'price_asc', 'price_desc', 'newest', 'oldest', 'discount_desc']).optional(),
    genre: z.string().trim().min(1).optional(),
    price_min: z.coerce.number().int().min(0).optional(),
    price_max: z.coerce.number().int().min(0).optional(),
    in_stock: z.coerce.number().int().refine((v) => v === 0 || v === 1, {
      message: 'in_stock must be 0 or 1',
    }).default(0),
  })
  .refine((v) => v.price_min === undefined || v.price_max === undefined || v.price_min <= v.price_max, {
    message: 'price_min must not exceed price_max',
    path: ['price_min'],
  });

export type BooksQueryParams = z.infer<typeof booksQuerySchema>;

const slugParamsSchema = z.object({
  slug: z.string().trim().min(1),
});

/**
 * Parse and validate raw request query parameters for
 * `GET /api/collections/:slug/books`.
 * Throws `ValidationError` (→ HTTP 400) on any invalid input.
 */
export function parseBooksQuery(query: unknown): BooksQueryParams {
  return parseOrThrow(booksQuerySchema, query, 'Invalid query parameters');
}

/**
 * Parse and validate a `:slug` route parameter.
 * Throws `ValidationError` (→ HTTP 400) on any invalid input.
 */
export function parseSlugParams(params: unknown): z.infer<typeof slugParamsSchema> {
  return parseOrThrow(slugParamsSchema, params, 'Invalid route parameters');
}
