import { z } from 'zod';
import { ValidationError } from '../../errors.js';
import { parseWishlistParams } from '../schema.js';
import type { AlertMode } from './dto.js';

export { parseWishlistParams as parseAlertParams };

const ALERT_MODES: AlertMode[] = ['any-drop', 'good-price', 'my-price'];

/**
 * Validation for `PUT /api/wishlist/:bookId/alert` request body
 * (notifications-model-v2 §10).
 *
 * Rules:
 * - `mode`: required; one of the three modes.
 * - `threshold`: OPTIONAL and only meaningful for `my-price`. The server owns the
 *   threshold for every other mode; supplying one there is rejected by the
 *   resolver (422), not silently ignored.
 *
 * Throws {@link ValidationError} (→ HTTP 400) on malformed input.
 */
const setAlertBody = z.object({
  mode: z.enum(ALERT_MODES as [AlertMode, ...AlertMode[]]),
  threshold: z
    .object({
      amount: z.number().int().positive(),
      currency: z.literal('UAH'),
    })
    .optional(),
});

export type SetAlertBody = z.infer<typeof setAlertBody>;

export function parseSetAlertBody(input: unknown): {
  mode: AlertMode;
  threshold?: { amount: number; currency: 'UAH' };
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
