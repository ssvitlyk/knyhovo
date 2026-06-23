/**
 * Alert notification orchestration — W10.4 dedup phase.
 *
 * Loads active alerts for the given books, evaluates the dedup rule, persists
 * marker changes, and returns NotificationEvent records for alerts that fired.
 *
 * NO email is sent here — this module only manages dedup state.
 * Injectable deps enable unit-testing without a real database.
 */

import type { PrismaClient } from '@prisma/client';
import { evaluateAlertNotification } from './alert-dedup.js';
import {
  findActiveAlertsForBooks,
  findLowestInStockPriceByBook,
  updateAlertNotificationMarker,
} from '../wishlist/alert/repository.js';

export interface NotificationEvent {
  readonly alertId: string;
  readonly canonicalBookId: string;
  readonly lowestPriceAmount: number;
  readonly targetPriceAmount: number;
  readonly notifiedAt: Date;
}

/**
 * For each ACTIVE alert on the given books: compute the book's lowest in-stock
 * price, evaluate the dedup rule, persist the marker change, and return a
 * NotificationEvent for each alert that fired.
 *
 * Returns [] when canonicalBookIds is empty.
 * Results are sorted deterministically by alertId.
 */
export async function runAlertNotificationsForBooks(
  prisma: PrismaClient,
  canonicalBookIds: readonly string[],
  now: Date,
  deps?: {
    findActiveAlerts?: typeof findActiveAlertsForBooks;
    findLowestPrices?: typeof findLowestInStockPriceByBook;
    updateMarker?: typeof updateAlertNotificationMarker;
  },
): Promise<NotificationEvent[]> {
  if (canonicalBookIds.length === 0) return [];

  const _findActiveAlerts = deps?.findActiveAlerts ?? findActiveAlertsForBooks;
  const _findLowestPrices = deps?.findLowestPrices ?? findLowestInStockPriceByBook;
  const _updateMarker = deps?.updateMarker ?? updateAlertNotificationMarker;

  const ids = Array.from(canonicalBookIds);

  const [alerts, lowestPriceMap] = await Promise.all([
    _findActiveAlerts(prisma, ids),
    _findLowestPrices(prisma, ids),
  ]);

  const events: NotificationEvent[] = [];

  for (const alert of alerts) {
    const lowestPriceAmount = lowestPriceMap.get(alert.canonicalBookId) ?? null;

    const decision = evaluateAlertNotification(
      {
        targetPriceAmount: alert.targetPriceAmount,
        lastNotifiedAt: alert.lastNotifiedAt,
        lastNotifiedPriceAmount: alert.lastNotifiedPriceAmount,
      },
      lowestPriceAmount,
      now,
    );

    if (decision.action === 'notify') {
      await _updateMarker(prisma, alert.alertId, {
        lastNotifiedAt: decision.lastNotifiedAt,
        lastNotifiedPriceAmount: decision.lastNotifiedPriceAmount,
      });
      events.push({
        alertId: alert.alertId,
        canonicalBookId: alert.canonicalBookId,
        lowestPriceAmount: decision.lastNotifiedPriceAmount,
        targetPriceAmount: alert.targetPriceAmount,
        notifiedAt: decision.lastNotifiedAt,
      });
    } else if (decision.action === 'reset') {
      await _updateMarker(prisma, alert.alertId, {
        lastNotifiedAt: null,
        lastNotifiedPriceAmount: null,
      });
    }
    // 'none' => no DB write
  }

  events.sort((a, b) => (a.alertId < b.alertId ? -1 : a.alertId > b.alertId ? 1 : 0));

  return events;
}
