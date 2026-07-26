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
 * All four intents shown as radios in the alert configuration form, in display
 * order. `'custom-price'` used to be a text-link disclosure below the group; it
 * is a first-class fourth mode now (its own radio + an inline price field), so
 * the form has exactly one control model for "how should the threshold be
 * chosen" instead of two competing ones.
 */
export const ALERT_INTENTS: readonly AlertIntentDef[] = [
  {
    key: 'any-drop',
    label: 'Будь-яке зниження',
    desc: 'Повідомимо при першому падінні ціни.',
    needsHistory: false,
  },
  {
    key: 'below-current',
    label: 'Нижче за поточну',
    desc: 'Коли стане дешевше, ніж зараз.',
    needsHistory: false,
  },
  {
    key: 'favourable-price',
    label: 'Вигідна ціна',
    desc: 'Коли книга повернеться до історично вигідної ціни.',
    needsHistory: true,
  },
  {
    key: 'custom-price',
    label: 'Вказати свою ціну',
    desc: 'Оберіть власний поріг.',
    needsHistory: false,
  },
] as const;

/**
 * Minimum number of recorded price points before the API's `typicalRange` is a
 * real "typical" band rather than a restatement of the only prices we have.
 *
 * The API trims one min and one max before computing the range, but only when it
 * has ≥5 points; below that it collapses `typicalRange` to `lowest`/`highest`
 * (packages/api/.../price-history/mapper.ts). For a freshly-ingested book that
 * makes `typicalRange.min` equal to the current price — which is why the form
 * used to show the same number for «Нижче за поточну» and «Вигідна ціна».
 */
export const FAVOURABLE_MIN_POINTS = 5;

/** Why the favourable-price mode has no threshold to offer. */
export type FavourableState = 'ready' | 'collecting';

/**
 * Resolve the favourable-price threshold from a Price History response.
 *
 * Returns `'collecting'` — never a price — unless the range is backed by enough
 * recorded points AND actually sits below today's price. A "target" at or above
 * the current price is not a target: it would fire the moment it is saved and
 * tells the reader nothing that «Нижче за поточну» doesn't already say.
 */
export function resolveFavourableTarget(ctx: {
  readonly typicalRangeMin: number | null;
  readonly pointCount: number;
  readonly currentAmount: number | null;
}): { state: 'ready'; amount: number } | { state: 'collecting'; amount: null } {
  const { typicalRangeMin, pointCount, currentAmount } = ctx;
  if (typicalRangeMin == null || pointCount < FAVOURABLE_MIN_POINTS) {
    return { state: 'collecting', amount: null };
  }
  if (currentAmount != null && typicalRangeMin >= currentAmount) {
    return { state: 'collecting', amount: null };
  }
  return { state: 'ready', amount: typicalRangeMin };
}

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
 * - `'any-drop'`         → one kopiyka below `currentAmount` (see below)
 * - `'below-current'`    → one kopiyka below `currentAmount`
 * - `'favourable-price'` → `typicalRangeMin`, already gated by
 *                          {@link resolveFavourableTarget} (null while collecting)
 * - `'custom-price'`     → `customAmount` (null when user has not entered a value)
 *
 * All amounts are in kopiyky (integer). 240 ₴ → 24000.
 */
/** One kopiyka below the current price, or null when there is no price. */
function belowCurrent(currentAmount: number | null): number | null {
  if (currentAmount == null) return null;
  return Math.max(1, currentAmount - 1);
}

export function resolveTargetAmount(
  intent: AlertIntent,
  ctx: {
    readonly currentAmount: number | null;
    readonly typicalRangeMin: number | null;
    readonly customAmount: number | null;
  },
): number | null {
  switch (intent) {
    // The server derives `triggered` from `lowestPrice <= targetPrice`
    // (deriveAlertStatus, packages/api/src/wishlist/alert/service.ts), so storing
    // the current price verbatim made both of these modes read back as
    // «Ціль досягнута» the moment they were saved, at an unchanged price.
    // One kopiyka below the current price makes `<=` mean "strictly cheaper than
    // today" — which is what both labels promise — without an API change.
    // The alternative (a per-intent `<` comparison server-side) is the cleaner
    // fix and belongs to trigger-engine work.
    case 'any-drop':
      return belowCurrent(ctx.currentAmount);
    case 'below-current':
      return belowCurrent(ctx.currentAmount);
    case 'favourable-price':
      return ctx.typicalRangeMin;
    case 'custom-price':
      return ctx.customAmount;
  }
}

/**
 * Look up an intent definition by its API key. All four API intents — including
 * `'custom-price'` — have a definition, so this only returns `undefined` for a
 * key outside {@link AlertIntent}.
 */
export function getIntentDef(key: AlertIntent): AlertIntentDef | undefined {
  return ALERT_INTENTS.find((def) => def.key === key);
}
