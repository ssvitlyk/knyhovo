import type { PrismaClient, Provider } from '@prisma/client';

/**
 * Data access for the `notification_deliveries` outbox (W4b).
 *
 * This module is pure DB access — it contains no dedup-key construction, backoff
 * computation, or rate-limit decisions (those live in the alert decision engine
 * and the email dispatcher). Mirrors the style of `wishlist/alert/repository.ts`.
 */

export type DeliveryType = 'PRICE_DROP' | 'BACK_IN_STOCK';

/** Input for enqueueing a delivery. `dedupKey` is the idempotency key. */
export interface EnqueueDeliveryInput {
  readonly dedupKey: string;
  readonly alertId: string;
  readonly userId: string;
  readonly canonicalBookId: string;
  readonly type: DeliveryType;
  /** Lowest in-stock price (копійки) at trigger time; null for back-in-stock. */
  readonly triggerPriceAmount: number | null;
}

/** A delivery row selected for dispatch. */
export interface DueDelivery {
  readonly id: string;
  readonly alertId: string;
  readonly userId: string;
  readonly canonicalBookId: string;
  readonly type: DeliveryType;
  readonly triggerPriceAmount: number | null;
  readonly attempts: number;
  readonly dedupKey: string;
}

/**
 * Idempotently enqueue a delivery keyed by `dedupKey`. If a delivery with the
 * same key already exists, this is a no-op and `created` is false.
 *
 * Implemented as findUnique-then-upsert so the caller can tell whether a new row
 * was inserted (used by the engine to avoid double-counting enqueued events).
 */
export async function enqueueDelivery(
  prisma: PrismaClient,
  input: EnqueueDeliveryInput,
): Promise<{ created: boolean; id: string }> {
  const existing = await prisma.notificationDelivery.findUnique({
    where: { dedupKey: input.dedupKey },
    select: { id: true },
  });
  if (existing) return { created: false, id: existing.id };

  const row = await prisma.notificationDelivery.upsert({
    where: { dedupKey: input.dedupKey },
    create: {
      dedupKey: input.dedupKey,
      alertId: input.alertId,
      userId: input.userId,
      canonicalBookId: input.canonicalBookId,
      type: input.type,
      triggerPriceAmount: input.triggerPriceAmount,
      status: 'PENDING',
    },
    update: {},
    select: { id: true },
  });
  return { created: true, id: row.id };
}

/**
 * Return deliveries eligible for dispatch, oldest first:
 *   status in (PENDING, FAILED) AND attempts < maxAttempts
 *   AND (nextAttemptAt is null OR nextAttemptAt <= now).
 */
export async function findDueDeliveries(
  prisma: PrismaClient,
  now: Date,
  maxAttempts: number,
  limit: number,
): Promise<DueDelivery[]> {
  const rows = await prisma.notificationDelivery.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      attempts: { lt: maxAttempts },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      alertId: true,
      userId: true,
      canonicalBookId: true,
      type: true,
      triggerPriceAmount: true,
      attempts: true,
      dedupKey: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    alertId: row.alertId,
    userId: row.userId,
    canonicalBookId: row.canonicalBookId,
    type: row.type as DeliveryType,
    triggerPriceAmount: row.triggerPriceAmount,
    attempts: row.attempts,
    dedupKey: row.dedupKey,
  }));
}

/** Mark a delivery as successfully sent; clears retry markers. */
export async function markDeliverySent(
  prisma: PrismaClient,
  id: string,
  data: { providerMessageId: string | null; sentAt: Date },
): Promise<void> {
  await prisma.notificationDelivery.update({
    where: { id },
    data: {
      status: 'SENT',
      providerMessageId: data.providerMessageId,
      sentAt: data.sentAt,
      lastError: null,
      nextAttemptAt: null,
    },
  });
}

/**
 * Mark a delivery as failed after a (transient) error. `attempts` is the new
 * attempt count and `nextAttemptAt` the earliest time it may be retried.
 */
export async function markDeliveryFailed(
  prisma: PrismaClient,
  id: string,
  data: { lastError: string; attempts: number; nextAttemptAt: Date | null },
): Promise<void> {
  await prisma.notificationDelivery.update({
    where: { id },
    data: {
      status: 'FAILED',
      lastError: data.lastError,
      attempts: data.attempts,
      nextAttemptAt: data.nextAttemptAt,
    },
  });
}

/** Mark a delivery as permanently skipped (non-retryable error). */
export async function markDeliverySkipped(
  prisma: PrismaClient,
  id: string,
  data: { lastError: string },
): Promise<void> {
  await prisma.notificationDelivery.update({
    where: { id },
    data: { status: 'SKIPPED', lastError: data.lastError },
  });
}

/**
 * Count a user's successfully-sent deliveries created at or after `since`.
 * Used for per-user daily rate limiting.
 */
export async function countUserDeliveriesSince(
  prisma: PrismaClient,
  userId: string,
  since: Date,
): Promise<number> {
  return prisma.notificationDelivery.count({
    where: { userId, status: 'SENT', createdAt: { gte: since } },
  });
}

/**
 * Defer a delivery without consuming a retry attempt (used when a per-user rate
 * limit is hit). Keeps the row PENDING and pushes `nextAttemptAt` forward.
 */
export async function deferDelivery(
  prisma: PrismaClient,
  id: string,
  nextAttemptAt: Date,
): Promise<void> {
  await prisma.notificationDelivery.update({
    where: { id },
    data: { status: 'PENDING', nextAttemptAt },
  });
}

/** Everything the dispatcher needs to render and send one delivery. */
export interface DeliveryContext {
  readonly id: string;
  readonly type: DeliveryType;
  readonly alertId: string;
  readonly canonicalBookId: string;
  readonly attempts: number;
  readonly triggerPriceAmount: number | null;
  readonly targetPriceAmount: number;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly priceDropEnabled: boolean;
    readonly backInStockEnabled: boolean;
    readonly unsubscribedAt: Date | null;
    readonly unsubscribeToken: string | null;
  };
  readonly book: { readonly title: string; readonly author: string };
  /** Cheapest in-stock listing for the book, or null if none remain in stock. */
  readonly bestListing: {
    readonly provider: Provider;
    readonly url: string;
    readonly priceAmount: number;
  } | null;
}

/**
 * Load the full context for a delivery: user prefs, book, alert threshold, and the
 * cheapest in-stock listing. Returns null when the delivery no longer exists.
 */
export async function loadDeliveryContext(
  prisma: PrismaClient,
  deliveryId: string,
): Promise<DeliveryContext | null> {
  const d = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    select: {
      id: true,
      type: true,
      alertId: true,
      canonicalBookId: true,
      attempts: true,
      triggerPriceAmount: true,
      alert: { select: { targetPriceAmount: true } },
      user: {
        select: {
          id: true,
          email: true,
          priceDropEnabled: true,
          backInStockEnabled: true,
          unsubscribedAt: true,
          unsubscribeToken: true,
        },
      },
    },
  });
  if (!d) return null;

  const book = await prisma.canonicalBook.findUnique({
    where: { id: d.canonicalBookId },
    select: { title: true, author: true },
  });

  const bestListing = await prisma.providerListing.findFirst({
    where: { canonicalBookId: d.canonicalBookId, availability: 'IN_STOCK' },
    orderBy: { priceAmount: 'asc' },
    select: { provider: true, url: true, priceAmount: true },
  });

  return {
    id: d.id,
    type: d.type as DeliveryType,
    alertId: d.alertId,
    canonicalBookId: d.canonicalBookId,
    attempts: d.attempts,
    triggerPriceAmount: d.triggerPriceAmount,
    targetPriceAmount: d.alert.targetPriceAmount,
    user: d.user,
    book: book ?? { title: '', author: '' },
    bestListing,
  };
}

/** Set the user's unsubscribe token only when it is not yet assigned (lazy init). */
export async function setUserUnsubscribeToken(
  prisma: PrismaClient,
  userId: string,
  token: string,
): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, unsubscribeToken: null },
    data: { unsubscribeToken: token },
  });
}
