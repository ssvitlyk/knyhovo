/**
 * Pure alert deduplication logic — no Prisma, no I/O.
 *
 * Implements the W10 PRD §4 notification rule:
 * - Notify when price drops to/below target AND is strictly lower than last notified price.
 * - Reset the dedup marker when the price condition no longer holds.
 */

export interface AlertNotificationState {
  readonly targetPriceAmount: number;
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
 * lowestPriceAmount = lowest IN-STOCK price (копійки) across the book's listings; null = no in-stock offer.
 *
 * Rules (W10 PRD §4):
 * - targetReached = lowestPriceAmount != null && lowestPriceAmount <= targetPriceAmount.
 * - if targetReached:
 *     notify when (lastNotifiedAt == null) OR (lowestPriceAmount < lastNotifiedPriceAmount);
 *     otherwise 'none'.
 * - if NOT targetReached:
 *     if a marker is set (lastNotifiedAt != null || lastNotifiedPriceAmount != null) => 'reset';
 *     else 'none'.
 */
export function evaluateAlertNotification(
  state: AlertNotificationState,
  lowestPriceAmount: number | null,
  now: Date,
): AlertNotificationDecision {
  const targetReached =
    lowestPriceAmount != null && lowestPriceAmount <= state.targetPriceAmount;

  if (targetReached) {
    // lowestPriceAmount is non-null here (targetReached guard above).
    const lowest = lowestPriceAmount as number;

    const hasMarker = state.lastNotifiedAt != null || state.lastNotifiedPriceAmount != null;

    if (!hasMarker) {
      // First notification — no prior marker.
      return { action: 'notify', lastNotifiedAt: now, lastNotifiedPriceAmount: lowest };
    }

    // Notify only on a strictly lower price.
    // lastNotifiedPriceAmount may be null when only lastNotifiedAt is set (partial marker);
    // treat null as "no prior price" → fire notify.
    if (state.lastNotifiedPriceAmount == null || lowest < state.lastNotifiedPriceAmount) {
      return { action: 'notify', lastNotifiedAt: now, lastNotifiedPriceAmount: lowest };
    }

    // Same or higher price with existing marker — suppress.
    return { action: 'none' };
  }

  // Target not reached — reset marker if one exists so the alert can re-arm later.
  const hasMarker = state.lastNotifiedAt != null || state.lastNotifiedPriceAmount != null;
  if (hasMarker) {
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
