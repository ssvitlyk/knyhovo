/**
 * Pure alert deduplication logic — no Prisma, no I/O, no knowledge of UX modes.
 *
 * Operates only on an AlertPolicy (notifications-model-v2 §9.1–9.2):
 * - notify when the canonical price reaches the policy threshold, the drop is
 *   significant for follow-down policies, and the price is strictly lower than
 *   the last notified one;
 * - reset the dedup marker when the threshold is no longer reached.
 */
import type { AlertPolicy, SignificanceConfig } from '../wishlist/alert/policy.js';
import { isSignificantDrop } from '../wishlist/alert/policy.js';

export interface AlertNotificationState {
  /** The policy the engine evaluates — no mode, no UX vocabulary (§9.1). */
  readonly policy: Pick<AlertPolicy, 'threshold' | 'baseline' | 'rearmPolicy'>;
  readonly lastNotifiedAt: Date | null;
  readonly lastNotifiedPriceAmount: number | null;
}

export type AlertNotificationDecision =
  | {
      readonly action: 'notify';
      readonly lastNotifiedAt: Date;
      readonly lastNotifiedPriceAmount: number;
    }
  | { readonly action: 'reset' } // marker was set but condition no longer holds -> clear to re-arm
  | { readonly action: 'none' }; // no change

/**
 * Decide whether a delivered price-drop notification is due.
 *
 * `canonicalPriceAmount` = the book's canonical price (cheapest strictly IN_STOCK
 * offer, `src/pricing/canonical-price.ts`); null = nothing buyable right now.
 *
 * Rules (notifications-model-v2 §9.2):
 * - thresholdReached = price != null && price <= policy.threshold.
 * - a follow-down policy additionally requires the drop below `policy.baseline`
 *   to be significant under `significance` — that is what keeps «будь-яке
 *   зниження» from emailing about jitter.
 * - if due: notify when no marker exists, or when the price is strictly lower
 *   than the last notified one; otherwise 'none'.
 * - if not due: clear an existing marker ('reset') so the alert can re-arm.
 *
 * The function is pure and knows nothing about modes.
 */
export function evaluateAlertNotification(
  state: AlertNotificationState,
  canonicalPriceAmount: number | null,
  now: Date,
  significance: SignificanceConfig,
): AlertNotificationDecision {
  const { policy } = state;
  const hasMarker = state.lastNotifiedAt != null || state.lastNotifiedPriceAmount != null;

  const thresholdReached =
    canonicalPriceAmount != null && canonicalPriceAmount <= policy.threshold;

  const significantEnough =
    thresholdReached &&
    (policy.rearmPolicy !== 'follow-down' ||
      isSignificantDrop(canonicalPriceAmount as number, policy.baseline, significance));

  if (thresholdReached && significantEnough) {
    const price = canonicalPriceAmount as number;

    if (!hasMarker) {
      // First notification — no prior marker.
      return { action: 'notify', lastNotifiedAt: now, lastNotifiedPriceAmount: price };
    }

    // Notify only on a strictly lower price. A null lastNotifiedPriceAmount is a
    // partial marker (only the timestamp survived) — treat it as "no prior price".
    if (state.lastNotifiedPriceAmount == null || price < state.lastNotifiedPriceAmount) {
      return { action: 'notify', lastNotifiedAt: now, lastNotifiedPriceAmount: price };
    }

    return { action: 'none' };
  }

  // Threshold no longer reached (or the drop is noise) — clear the marker so the
  // alert re-arms. A significant-but-suppressed drop keeps its marker: the
  // threshold IS still reached, so resetting would re-fire the same email.
  if (!thresholdReached && hasMarker) {
    return { action: 'reset' };
  }

  return { action: 'none' };
}

// ---------------------------------------------------------------------------
// Back-in-stock dedup (W4b) — pure, no I/O.
// ---------------------------------------------------------------------------

export type BookAvailability = 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';

export interface BackInStockState {
  /**
   * Book availability observed at the previous evaluation (the `last_notified_availability`
   * marker). Null until the first observation — the first sighting never fires a
   * notification, it only records the baseline, so an already-in-stock book added to the
   * wishlist does not produce a spurious "back in stock" alert.
   */
  readonly lastObservedAvailability: BookAvailability | null;
}

export type BackInStockDecision =
  /** A genuine OUT→IN transition: enqueue a notification AND advance the marker to IN_STOCK. */
  | { readonly action: 'notify'; readonly observed: 'IN_STOCK' }
  /** No notification, but the observed availability changed — advance the marker only. */
  | { readonly action: 'observe'; readonly observed: BookAvailability }
  /** Marker already matches the current observation — nothing to do. */
  | { readonly action: 'none' };

/**
 * Decide whether a book's transition into stock should fire a back-in-stock alert.
 *
 * `currentlyInStock` = the book has at least one in-stock provider listing right now.
 *
 * Rules:
 * - First ever observation (marker null): record the baseline, never notify.
 * - currentlyInStock AND marker !== IN_STOCK: NOTIFY (rising edge) and advance marker to IN_STOCK.
 * - marker differs from the current observation otherwise: just advance the marker.
 * - marker equals the current observation: no-op.
 *
 * Because a notify advances the marker to IN_STOCK in the same evaluation, the alert
 * fires exactly once per OUT→IN episode and re-arms only after the book is observed
 * out of stock again.
 */
export function evaluateBackInStockNotification(
  state: BackInStockState,
  currentlyInStock: boolean,
): BackInStockDecision {
  const current: BookAvailability = currentlyInStock ? 'IN_STOCK' : 'OUT_OF_STOCK';

  if (state.lastObservedAvailability == null) {
    // First observation — establish baseline, never notify on first sight.
    return { action: 'observe', observed: current };
  }

  if (currentlyInStock && state.lastObservedAvailability !== 'IN_STOCK') {
    return { action: 'notify', observed: 'IN_STOCK' };
  }

  if (state.lastObservedAvailability !== current) {
    return { action: 'observe', observed: current };
  }

  return { action: 'none' };
}

// ---------------------------------------------------------------------------
// Dedup keys (W4b) — stable idempotency keys for the notification outbox.
// ---------------------------------------------------------------------------

/** Price-drop key: a new (lower) price yields a new delivery; repeats at the same price collide. */
export function priceDropDedupKey(alertId: string, lowestPriceAmount: number): string {
  return `${alertId}:price:${lowestPriceAmount}`;
}

/**
 * Back-in-stock key: scoped to the run timestamp so each OUT→IN episode (which fires
 * in a distinct run) gets its own delivery, while in-run retries collide. Since the
 * rising-edge logic advances the marker to IN_STOCK on notify, only one run per episode
 * produces a back-in-stock decision.
 */
export function backInStockDedupKey(alertId: string, now: Date): string {
  return `${alertId}:stock:${now.toISOString()}`;
}
