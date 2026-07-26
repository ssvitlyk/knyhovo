import type { PrismaClient } from '@prisma/client';
import type { AlertPolicy, RearmPolicy } from './policy.js';

/** Prisma enum identifier → policy value. */
export const REARM_SLUG: Record<'FOLLOW_DOWN' | 'STATIC', RearmPolicy> = {
  FOLLOW_DOWN: 'follow-down',
  STATIC: 'static',
};

/** Policy value → Prisma enum identifier (for writes). */
export const REARM_ENUM: Record<RearmPolicy, 'FOLLOW_DOWN' | 'STATIC'> = {
  'follow-down': 'FOLLOW_DOWN',
  static: 'STATIC',
};

/**
 * Internal row shape for an Alert as returned by the wishlist repository.
 *
 * Deliberately mirrors only the fields the mapper needs. Structurally compatible
 * with the Prisma payload so query results are assignable without manual copying.
 */
export interface WishlistAlertRow {
  readonly status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'UNAVAILABLE';
  readonly mode: 'ANY_DROP' | 'GOOD_PRICE' | 'MY_PRICE';
  readonly targetPriceAmount: number;
  readonly targetPriceCurrency: 'UAH';
  readonly baselineAmount: number | null;
  readonly thresholdProof: string | null;
  readonly pausedAt: Date | null;
  /** Notification marker — the fact behind the `reached` state. */
  readonly lastNotifiedAt: Date | null;
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

/** The persisted shape of a policy write (create or replace). */
export interface AlertPolicyWrite {
  readonly mode: 'ANY_DROP' | 'GOOD_PRICE' | 'MY_PRICE';
  readonly targetPriceAmount: number;
  readonly targetPriceCurrency: 'UAH';
  readonly baselineAmount: number | null;
  readonly rearmPolicy: 'FOLLOW_DOWN' | 'STATIC';
  readonly thresholdBasis: string | null;
  readonly thresholdProof: string | null;
}

/**
 * Legacy `intent` value written alongside `mode` for one release.
 *
 * The column is deprecated but still NOT NULL, so a rollback to the pre-v2 code
 * path finds a usable value instead of a broken row.
 */
const LEGACY_INTENT: Record<
  AlertPolicyWrite['mode'],
  'ANY_DROP' | 'FAVOURABLE_PRICE' | 'CUSTOM_PRICE'
> = {
  ANY_DROP: 'ANY_DROP',
  GOOD_PRICE: 'FAVOURABLE_PRICE',
  MY_PRICE: 'CUSTOM_PRICE',
};

/**
 * Create or fully replace the alert — and therefore its policy — for a wishlist
 * item. Always writes lifecycle ACTIVE: configuring an alert un-pauses it.
 */
export async function upsertAlert(
  prisma: PrismaClient,
  wishlistItemId: string,
  policy: AlertPolicyWrite,
): Promise<void> {
  // Replacing the alert replaces its threshold, so the notification marker no
  // longer describes anything: clearing it here is what makes the `reached`
  // state mean "we emailed about the CURRENT threshold" without any price maths.
  const data = {
    status: 'ACTIVE',
    pausedAt: null,
    mode: policy.mode,
    intent: LEGACY_INTENT[policy.mode],
    targetPriceAmount: policy.targetPriceAmount,
    targetPriceCurrency: policy.targetPriceCurrency,
    baselineAmount: policy.baselineAmount,
    rearmPolicy: policy.rearmPolicy,
    thresholdBasis: policy.thresholdBasis,
    thresholdProof: policy.thresholdProof,
    lastNotifiedAt: null,
    lastNotifiedPriceAmount: null,
  } as const;

  await prisma.alert.upsert({
    where: { wishlistItemId },
    create: { wishlistItemId, ...data },
    update: { ...data },
  });
}

/**
 * Update the lifecycle (and pausedAt) of an existing alert.
 * Uses updateMany so it is a no-op (rather than a throw) when no alert exists.
 */
export async function setAlertStatus(
  prisma: PrismaClient,
  wishlistItemId: string,
  data: {
    status: 'ACTIVE' | 'PAUSED';
    pausedAt: Date | null;
  },
): Promise<void> {
  await prisma.alert.updateMany({
    where: { wishlistItemId },
    data,
  });
}

/**
 * Lower a follow-down policy's threshold and baseline onto the price we just
 * emailed about (§9.2). Called by the dispatcher after a successful send only.
 */
export async function applyRearmToAlert(
  prisma: PrismaClient,
  alertId: string,
  next: { threshold: number; baseline: number },
): Promise<void> {
  await prisma.alert.update({
    where: { id: alertId },
    data: { targetPriceAmount: next.threshold, baselineAmount: next.baseline },
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
  /**
   * The policy the engine evaluates. Deliberately does NOT include `mode`: the
   * engine must not be able to tell the modes apart (§9.1).
   */
  readonly policy: Pick<AlertPolicy, 'threshold' | 'baseline' | 'rearmPolicy'>;
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
      baselineAmount: true,
      rearmPolicy: true,
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
    policy: {
      threshold: row.targetPriceAmount,
      baseline: row.baselineAmount,
      rearmPolicy: REARM_SLUG[row.rearmPolicy],
    },
    lastNotifiedAt: row.lastNotifiedAt,
    lastNotifiedPriceAmount: row.lastNotifiedPriceAmount,
    lastObservedAvailability: row.lastNotifiedAvailability,
  }));
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
