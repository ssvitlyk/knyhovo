import { z } from 'zod';
import { BadRequestError, ValidationError } from '../../errors.js';
import type { PriceHistoryPeriod } from './dto.js';

/**
 * Validation for `GET /api/books/:id/price-history` route parameters.
 *
 * Rules:
 * - `id`: required; must be a valid UUID v4.
 *
 * Throws {@link BadRequestError} (→ HTTP 400) when the id is not a valid UUID.
 * Consistent with `GET /api/books/:id` which uses the same error type for an
 * invalid book id.
 */
const priceHistoryParamsSchema = z.object({ id: z.string().uuid() });

export type PriceHistoryParams = z.infer<typeof priceHistoryParamsSchema>;

/**
 * Parse and validate raw request route parameters.
 * Throws {@link BadRequestError} (→ HTTP 400) when `id` is not a valid UUID.
 */
export function parsePriceHistoryParams(params: unknown): PriceHistoryParams {
  const result = priceHistoryParamsSchema.safeParse(params);
  if (!result.success) {
    throw new BadRequestError('Invalid book id');
  }
  return result.data;
}

/**
 * Validation for `GET /api/books/:id/price-history` query parameters.
 *
 * Rules:
 * - `period`: optional; must be one of `30d`, `90d`, `1y`, `all`. Defaults to `90d`.
 *
 * Throws {@link ValidationError} (→ HTTP 400 VALIDATION_ERROR) on invalid period.
 */
const priceHistoryQuerySchema = z.object({
  period: z.enum(['30d', '90d', '1y', 'all']).default('90d'),
});

export interface PriceHistoryQuery {
  readonly period: PriceHistoryPeriod;
}

/**
 * Parse and validate raw request query parameters.
 * Throws {@link ValidationError} (→ HTTP 400) when `period` is not a valid enum value.
 */
export function parsePriceHistoryQuery(query: unknown): PriceHistoryQuery {
  const result = priceHistoryQuerySchema.safeParse(query);
  if (!result.success) {
    throw new ValidationError(`Invalid period. Must be one of: 30d, 90d, 1y, all.`);
  }
  return result.data;
}
