import { z } from 'zod';
import { ValidationError } from '../../errors.js';
import { parseWishlistParams } from '../schema.js';
import type { AlertIntent } from './dto.js';

export { parseWishlistParams as parseAlertParams };

const ALERT_INTENTS: AlertIntent[] = [
  'any-drop',
  'below-current',
  'favourable-price',
  'custom-price',
];

/**
 * Validation for `PUT /api/wishlist/:bookId/alert` request body.
 *
 * Rules:
 * - `intent`: required; one of the 4 AlertIntent slugs.
 * - `targetPrice.amount`: required; positive integer (kopiyky).
 * - `targetPrice.currency`: required; literal 'UAH'.
 *
 * Throws {@link ValidationError} (→ HTTP 400) on any invalid input.
 */
const setAlertBody = z.object({
  intent: z.enum(ALERT_INTENTS as [AlertIntent, ...AlertIntent[]]),
  targetPrice: z.object({
    amount: z.number().int().positive(),
    currency: z.literal('UAH'),
  }),
});

export type SetAlertBody = z.infer<typeof setAlertBody>;

export function parseSetAlertBody(input: unknown): {
  intent: AlertIntent;
  targetPrice: { amount: number; currency: 'UAH' };
} {
  const result = setAlertBody.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid request body';
    throw new ValidationError(message);
  }
  return result.data;
}

/**
 * Validation for `PATCH /api/wishlist/:bookId/alert` request body.
 *
 * Rules:
 * - `paused`: required; boolean.
 *
 * Throws {@link ValidationError} (→ HTTP 400) on any invalid input.
 */
const pauseAlertBody = z.object({
  paused: z.boolean(),
});

export type PauseAlertBody = z.infer<typeof pauseAlertBody>;

export function parsePauseAlertBody(input: unknown): { paused: boolean } {
  const result = pauseAlertBody.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') ?? '';
    const message = issue ? `${path ? `${path}: ` : ''}${issue.message}` : 'Invalid request body';
    throw new ValidationError(message);
  }
  return result.data;
}
