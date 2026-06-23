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
