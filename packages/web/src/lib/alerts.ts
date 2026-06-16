import type { AlertDto, AlertIntent, AlertStatus } from './api/types';

/**
 * Derived UI representation of an alert's visual state.
 * Used to select bell glyph, chip label and row treatment in all alert surfaces.
 *
 * - `'saved'`      — item is in the wishlist but has no alert configured.
 * - `'watch'`      — alert is active; price has not yet reached the target.
 * - `'triggered'`  — price has dropped to or below the target (email sent).
 * - `'paused'`     — user temporarily muted the alert.
 * - `'unavailable'`— book is out of stock; alert cannot fire.
 */
export type AlertUiState = 'saved' | 'watch' | 'triggered' | 'paused' | 'unavailable';

/**
 * Full definition of a selectable alert intent for display in the config form.
 * All copy is in Ukrainian, from the frozen W4 design (`al-data.jsx`).
 */
export interface AlertIntentDef {
  /** The API key for this intent. */
  readonly key: AlertIntent;
  /** Short radio label shown in the intent selector. */
  readonly label: string;
  /** One-sentence description shown below the radio label. */
  readonly desc: string;
  /**
   * True when this intent requires Price History `typicalRange` data to resolve
   * a target price. The UI should disable the option and show a
   * «Збираємо історію цін…» note when `typicalRange` is unavailable.
   */
  readonly needsHistory: boolean;
}

/**
 * The three primary intents shown as radios in the alert configuration form,
 * in display order (frozen W4 design, `al-data.jsx`).
 * `'custom-price'` is the quiet secondary disclosure — it is intentionally
 * absent from this list but accessible via {@link getIntentDef} with `undefined`
 * as its return sentinel.
 */
export const ALERT_INTENTS: readonly AlertIntentDef[] = [
  {
    key: 'any-drop',
    label: 'Будь-яке зниження',
    desc: 'Книговик напише, щойно ціна впаде.',
    needsHistory: false,
  },
  {
    key: 'below-current',
    label: 'Нижче за поточну',
    desc: 'Повідомимо, коли стане дешевше за сьогодні.',
    needsHistory: false,
  },
  {
    key: 'favourable-price',
    label: 'Вигідна ціна',
    desc: 'Коли ціна впаде до вигідного діапазону книги.',
    needsHistory: true,
  },
] as const;

/**
 * Map a server-returned {@link AlertDto} (or `null`) to the UI state used for
 * selecting bell glyph, chip label and row colouring.
 *
 * - `null`               → `'saved'`  (no alert configured)
 * - `status 'active'`    → `'watch'`
 * - all other statuses   → map 1:1 to their {@link AlertUiState} equivalent
 *
 * The mapping is pure and has no side effects.
 */
export function alertUiState(alert: AlertDto | null): AlertUiState {
  if (alert === null) return 'saved';

  const STATUS_MAP: Readonly<Record<AlertStatus, AlertUiState>> = {
    active: 'watch',
    paused: 'paused',
    triggered: 'triggered',
    unavailable: 'unavailable',
  };

  return STATUS_MAP[alert.status];
}

/**
 * Resolve the target price **amount** (integer kopiyky) to send to the API for
 * a chosen intent and context values.
 *
 * Returns `null` when the amount cannot be resolved — the caller **must** disable
 * the submit action in that case to prevent an invalid API request:
 * - `'any-drop'`         → `currentAmount` (per W4b decision: sends current best
 *                          price; API requires `amount > 0`, so null when no price)
 * - `'below-current'`    → `currentAmount`
 * - `'favourable-price'` → `typicalRangeMin` (null when Price History has no range)
 * - `'custom-price'`     → `customAmount` (null when user has not entered a value)
 *
 * All amounts are in kopiyky (integer). 240 ₴ → 24000.
 */
export function resolveTargetAmount(
  intent: AlertIntent,
  ctx: {
    readonly currentAmount: number | null;
    readonly typicalRangeMin: number | null;
    readonly customAmount: number | null;
  },
): number | null {
  switch (intent) {
    case 'any-drop':
      return ctx.currentAmount;
    case 'below-current':
      return ctx.currentAmount;
    case 'favourable-price':
      return ctx.typicalRangeMin;
    case 'custom-price':
      return ctx.customAmount;
  }
}

/**
 * Look up an intent definition by its API key.
 *
 * Returns `undefined` for `'custom-price'` — that intent has no radio definition
 * in {@link ALERT_INTENTS} and is exposed only as a quiet secondary disclosure
 * in the config form.
 */
export function getIntentDef(key: AlertIntent): AlertIntentDef | undefined {
  return ALERT_INTENTS.find((def) => def.key === key);
}
