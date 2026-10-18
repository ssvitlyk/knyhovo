import { z } from 'zod';
import { parseOrThrow } from '../../http/parse.js';
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
 * Throws `ValidationError` (→ HTTP 400) on malformed input.
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

export function parseSetAlertBody(input: unknown): {
  mode: AlertMode;
  threshold?: { amount: number; currency: 'UAH' };
} {
  return parseOrThrow(setAlertBody, input, 'Invalid request body');
}

/**
 * Validation for `PATCH /api/wishlist/:bookId/alert` request body.
 *
 * Rules:
 * - `paused`: required; boolean.
 *
 * Throws `ValidationError` (→ HTTP 400) on any invalid input.
 */
const pauseAlertBody = z.object({
  paused: z.boolean(),
});

export function parsePauseAlertBody(input: unknown): { paused: boolean } {
  return parseOrThrow(pauseAlertBody, input, 'Invalid request body');
}
