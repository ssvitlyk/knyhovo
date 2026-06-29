/**
 * Alert notification ENQUEUE phase (W4b).
 *
 * Loads active alerts for the given books, evaluates the price-drop and
 * back-in-stock dedup rules, and ENQUEUES `notification_deliveries` rows for
 * alerts that should fire. Idempotent via the delivery `dedupKey`.
 *
 * Crucially this module does NOT update the price dedup markers on `notify`
 * (that happens in the email-dispatch phase, only after a successful send, so a
 * failed email never loses the notification). It only:
 *   - resets the price marker when the price condition no longer holds (re-arm), and
 *   - advances the back-in-stock observation marker (transition tracking).
 * No email is sent here.
 */

import type { PrismaClient } from '@prisma/client';
import {
  evaluateAlertNotification,
  evaluateBackInStockNotification,
  priceDropDedupKey,
  backInStockDedupKey,
} from './alert-dedup.js';
import {
  findActiveAlertsForBooks,
  findLowestInStockPriceByBook,
  updateAlertNotificationMarker,
  updateAlertStockMarker,
} from '../wishlist/alert/repository.js';
import { enqueueDelivery } from './notification-delivery.repository.js';

export interface EnqueuedDelivery {
  readonly alertId: string;
  readonly canonicalBookId: string;
  readonly type: 'PRICE_DROP' | 'BACK_IN_STOCK';
  readonly dedupKey: string;
  /** True when a new outbox row was inserted; false when the key already existed. */
  readonly created: boolean;
}

/**
 * For each ACTIVE alert on the given books: compute the book's lowest in-stock
 * price, evaluate the price-drop and back-in-stock rules, enqueue deliveries for
 * those that fire, and advance/reset the relevant markers.
 *
 * Returns [] when canonicalBookIds is empty. Results are sorted deterministically
 * by (alertId, type).
 */
export async function runAlertNotificationsForBooks(
  prisma: PrismaClient,
  canonicalBookIds: readonly string[],
  now: Date,
  deps?: {
    findActiveAlerts?: typeof findActiveAlertsForBooks;
    findLowestPrices?: typeof findLowestInStockPriceByBook;
    enqueue?: typeof enqueueDelivery;
    updatePriceMarker?: typeof updateAlertNotificationMarker;
    updateStockMarker?: typeof updateAlertStockMarker;
  },
): Promise<EnqueuedDelivery[]> {
  if (canonicalBookIds.length === 0) return [];

  const _findActiveAlerts = deps?.findActiveAlerts ?? findActiveAlertsForBooks;
  const _findLowestPrices = deps?.findLowestPrices ?? findLowestInStockPriceByBook;
  const _enqueue = deps?.enqueue ?? enqueueDelivery;
  const _updatePriceMarker = deps?.updatePriceMarker ?? updateAlertNotificationMarker;
  const _updateStockMarker = deps?.updateStockMarker ?? updateAlertStockMarker;

  const ids = Array.from(canonicalBookIds);

  const [alerts, lowestPriceMap] = await Promise.all([
    _findActiveAlerts(prisma, ids),
    _findLowestPrices(prisma, ids),
  ]);

  const enqueued: EnqueuedDelivery[] = [];

  for (const alert of alerts) {
    const lowestPriceAmount = lowestPriceMap.get(alert.canonicalBookId) ?? null;
    const currentlyInStock = lowestPriceAmount != null;

    // --- Price-drop -------------------------------------------------------
    const priceDecision = evaluateAlertNotification(
      {
        targetPriceAmount: alert.targetPriceAmount,
        lastNotifiedAt: alert.lastNotifiedAt,
        lastNotifiedPriceAmount: alert.lastNotifiedPriceAmount,
      },
      lowestPriceAmount,
      now,
    );

    if (priceDecision.action === 'notify') {
      const dedupKey = priceDropDedupKey(alert.alertId, priceDecision.lastNotifiedPriceAmount);
      const res = await _enqueue(prisma, {
        dedupKey,
        alertId: alert.alertId,
        userId: alert.userId,
        canonicalBookId: alert.canonicalBookId,
        type: 'PRICE_DROP',
        triggerPriceAmount: priceDecision.lastNotifiedPriceAmount,
      });
      enqueued.push({
        alertId: alert.alertId,
        canonicalBookId: alert.canonicalBookId,
        type: 'PRICE_DROP',
        dedupKey,
        created: res.created,
      });
    } else if (priceDecision.action === 'reset') {
      // Re-arm: the price condition no longer holds. Safe marker write (not a send).
      await _updatePriceMarker(prisma, alert.alertId, {
        lastNotifiedAt: null,
        lastNotifiedPriceAmount: null,
      });
    }

    // --- Back-in-stock ----------------------------------------------------
    const stockDecision = evaluateBackInStockNotification(
      { lastObservedAvailability: alert.lastObservedAvailability },
      currentlyInStock,
    );

    if (stockDecision.action === 'notify') {
      const dedupKey = backInStockDedupKey(alert.alertId, now);
      // Enqueue FIRST, then advance the marker — if enqueue fails, the marker
      // stays so the next run re-evaluates and re-enqueues (no lost notification).
      const res = await _enqueue(prisma, {
        dedupKey,
        alertId: alert.alertId,
        userId: alert.userId,
        canonicalBookId: alert.canonicalBookId,
        type: 'BACK_IN_STOCK',
        triggerPriceAmount: lowestPriceAmount,
      });
      await _updateStockMarker(prisma, alert.alertId, { lastNotifiedAvailability: stockDecision.observed });
      enqueued.push({
        alertId: alert.alertId,
        canonicalBookId: alert.canonicalBookId,
        type: 'BACK_IN_STOCK',
        dedupKey,
        created: res.created,
      });
    } else if (stockDecision.action === 'observe') {
      await _updateStockMarker(prisma, alert.alertId, {
        lastNotifiedAvailability: stockDecision.observed,
      });
    }
  }

  enqueued.sort((a, b) => {
    if (a.alertId !== b.alertId) return a.alertId < b.alertId ? -1 : 1;
    return a.type < b.type ? -1 : a.type > b.type ? 1 : 0;
  });

  return enqueued;
}
