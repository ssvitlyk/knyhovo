import { z } from 'zod';
import { parseOrThrow } from '../http/parse.js';

/**
 * `PATCH /api/notifications/preferences` body. At least one field must be present.
 */
const updatePreferencesBody = z
  .object({
    priceDropEnabled: z.boolean().optional(),
    backInStockEnabled: z.boolean().optional(),
    resubscribe: z.boolean().optional(),
  })
  .refine(
    (b) => b.priceDropEnabled != null || b.backInStockEnabled != null || b.resubscribe != null,
    { message: 'at least one of priceDropEnabled, backInStockEnabled, resubscribe is required' },
  );

export type UpdatePreferencesBody = z.infer<typeof updatePreferencesBody>;

export function parseUpdatePreferencesBody(input: unknown): UpdatePreferencesBody {
  return parseOrThrow(updatePreferencesBody, input, 'Invalid request body');
}

/** `GET /api/notifications/unsubscribe?token=` query. */
const unsubscribeQuery = z.object({ token: z.string().min(1) });

export function parseUnsubscribeQuery(input: unknown): { token: string } {
  return parseOrThrow(unsubscribeQuery, input, 'Invalid unsubscribe token');
}
