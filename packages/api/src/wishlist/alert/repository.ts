import type { PrismaClient } from '@prisma/client';

/**
 * Internal row shape for an Alert as returned by the wishlist repository.
 *
 * Deliberately mirrors only the fields the mapper needs. Structurally compatible
 * with the Prisma payload so query results are assignable without manual copying.
 */
export interface WishlistAlertRow {
  readonly status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'UNAVAILABLE';
  readonly intent: 'ANY_DROP' | 'BELOW_CURRENT' | 'FAVOURABLE_PRICE' | 'CUSTOM_PRICE';
  readonly targetPriceAmount: number;
  readonly targetPriceCurrency: 'UAH';
  readonly pausedAt: Date | null;
}

/**
 * Find the wishlist item id for a given user + canonical book combination.
 * Returns null when no such wishlist item exists.
 */
export async function findWishlistItemId(
  prisma: PrismaClient,
  userId: string,
  canonicalBookId: string,
): Promise<string | null> {
  const item = await prisma.wishlistItem.findUnique({
    where: { userId_canonicalBookId: { userId, canonicalBookId } },
    select: { id: true },
  });
  return item?.id ?? null;
}

/**
 * Upsert an alert for a wishlist item. Creates the alert if it does not exist,
 * or replaces it fully if it does.
 */
export async function upsertAlert(
  prisma: PrismaClient,
  wishlistItemId: string,
  data: {
    status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'UNAVAILABLE';
    intent: 'ANY_DROP' | 'BELOW_CURRENT' | 'FAVOURABLE_PRICE' | 'CUSTOM_PRICE';
    targetPriceAmount: number;
    targetPriceCurrency: 'UAH';
    pausedAt: Date | null;
  },
): Promise<void> {
  await prisma.alert.upsert({
    where: { wishlistItemId },
    create: { wishlistItemId, ...data },
    update: { ...data },
  });
}

/**
 * Update the status and pausedAt of an existing alert.
 * Uses updateMany so it is a no-op (rather than a throw) when no alert exists.
 */
export async function setAlertStatus(
  prisma: PrismaClient,
  wishlistItemId: string,
  data: {
    status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'UNAVAILABLE';
    pausedAt: Date | null;
  },
): Promise<void> {
  await prisma.alert.updateMany({
    where: { wishlistItemId },
    data,
  });
}

/**
 * Delete the alert for a wishlist item. Idempotent — safe to call even when
 * no alert exists (deleteMany returns count 0 rather than throwing).
 */
export async function deleteAlert(
  prisma: PrismaClient,
  wishlistItemId: string,
): Promise<void> {
  await prisma.alert.deleteMany({ where: { wishlistItemId } });
}

// ---------------------------------------------------------------------------
// W10.4 — Alert dedup / notification-marker helpers
// ---------------------------------------------------------------------------

export interface ActiveAlertForBook {
  readonly alertId: string;
  readonly canonicalBookId: string;
  readonly userId: string;
  readonly targetPriceAmount: number;
  readonly lastNotifiedAt: Date | null;
  readonly lastNotifiedPriceAmount: number | null;
  /** Book availability observed at the previous evaluation (back-in-stock baseline). */
  readonly lastObservedAvailability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN' | null;
}

/**
 * Return ACTIVE alerts whose wishlist item's canonicalBookId is in the given set.
 * Returns [] immediately for empty input (avoids `IN ()` query).
 */
export async function findActiveAlertsForBooks(
  prisma: PrismaClient,
  canonicalBookIds: string[],
): Promise<ActiveAlertForBook[]> {
  if (canonicalBookIds.length === 0) return [];

  const rows = await prisma.alert.findMany({
    where: {
      status: 'ACTIVE',
      wishlistItem: { canonicalBookId: { in: canonicalBookIds } },
    },
    select: {
      id: true,
      targetPriceAmount: true,
      lastNotifiedAt: true,
      lastNotifiedPriceAmount: true,
      lastNotifiedAvailability: true,
      wishlistItem: { select: { canonicalBookId: true, userId: true } },
    },
  });

  return rows.map((row) => ({
    alertId: row.id,
    canonicalBookId: row.wishlistItem.canonicalBookId,
    userId: row.wishlistItem.userId,
    targetPriceAmount: row.targetPriceAmount,
    lastNotifiedAt: row.lastNotifiedAt,
    lastNotifiedPriceAmount: row.lastNotifiedPriceAmount,
    lastObservedAvailability: row.lastNotifiedAvailability,
  }));
}

/**
 * Return a map of canonicalBookId → lowest IN_STOCK priceAmount across that
 * book's provider listings. Books with no in-stock listing are absent from the map.
 * Returns an empty Map immediately for empty input.
 */
export async function findLowestInStockPriceByBook(
  prisma: PrismaClient,
  canonicalBookIds: string[],
): Promise<Map<string, number>> {
  if (canonicalBookIds.length === 0) return new Map();

  const rows = await prisma.providerListing.groupBy({
    by: ['canonicalBookId'],
    where: {
      canonicalBookId: { in: canonicalBookIds },
      availability: 'IN_STOCK',
    },
    _min: { priceAmount: true },
  });

  const result = new Map<string, number>();
  for (const row of rows) {
    const min = row._min.priceAmount;
    if (min != null) {
      result.set(row.canonicalBookId, min);
    }
  }
  return result;
}

/**
 * Persist the dedup marker (lastNotifiedAt / lastNotifiedPriceAmount) for an alert.
 * Pass null values to clear the marker (re-arm the alert).
 */
export async function updateAlertNotificationMarker(
  prisma: PrismaClient,
  alertId: string,
  marker: { lastNotifiedAt: Date | null; lastNotifiedPriceAmount: number | null },
): Promise<void> {
  await prisma.alert.update({
    where: { id: alertId },
    data: marker,
  });
}

/**
 * Persist the back-in-stock observation marker (W4b). `lastNotifiedAvailability`
 * tracks the book availability observed at the previous evaluation; `lastStockNotifiedAt`
 * (optional) records when a back-in-stock notification was actually sent.
 */
export async function updateAlertStockMarker(
  prisma: PrismaClient,
  alertId: string,
  marker: {
    lastNotifiedAvailability?: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
    lastStockNotifiedAt?: Date | null;
  },
): Promise<void> {
  await prisma.alert.update({
    where: { id: alertId },
    data: marker,
  });
}
