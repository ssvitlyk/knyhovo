import { z } from 'zod';
import { ValidationError } from '../errors.js';

function firstIssueMessage(error: z.ZodError, fallback: string): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  const path = issue.path.join('.');
  return `${path ? `${path}: ` : ''}${issue.message}`;
}

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
  const result = updatePreferencesBody.safeParse(input);
  if (!result.success) throw new ValidationError(firstIssueMessage(result.error, 'Invalid request body'));
  return result.data;
}

/** `GET /api/notifications/unsubscribe?token=` query. */
const unsubscribeQuery = z.object({ token: z.string().min(1) });

export function parseUnsubscribeQuery(input: unknown): { token: string } {
  const result = unsubscribeQuery.safeParse(input);
  if (!result.success) throw new ValidationError(firstIssueMessage(result.error, 'Invalid unsubscribe token'));
  return result.data;
}
