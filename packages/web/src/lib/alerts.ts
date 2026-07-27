import type { AlertMode } from './api/types';

/**
 * Presentation-only copy for each selectable alert mode
 * (notifications-model-v2 §6). No threshold arithmetic, no state inference —
 * the server resolves policies and derives state; the client only renders.
 *
 * `good-price` and `my-price` have no static description: the configurator
 * shows the mode's own `alertPolicyPreview[].proof` string for `good-price`,
 * and no description at all for `my-price` until the user has typed and
 * confirmed a number (at which point the confirmation line itself is the
 * description).
 */
export interface AlertModeCopy {
  /** Short radio label shown in the mode selector. */
  readonly label: string;
  /** Static one-line description, or null when the description is data-driven or absent. */
  readonly description: string | null;
}

/** Copy for all three modes, in display order (any-drop, good-price, my-price). */
export const ALERT_MODE_COPY: Readonly<Record<AlertMode, AlertModeCopy>> = {
  'any-drop': { label: 'Будь-яке зниження', description: 'Щойно ціна впаде' },
  'good-price': { label: 'Вигідна ціна', description: null },
  'my-price': { label: 'Моя ціна', description: null },
};
