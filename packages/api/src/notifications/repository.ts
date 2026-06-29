import type { PrismaClient } from '@prisma/client';

/**
 * Data access for user notification preferences (W4b PR5).
 */

export interface NotificationPreferences {
  readonly priceDropEnabled: boolean;
  readonly backInStockEnabled: boolean;
  /** True when the user has globally opted out (unsubscribedAt is set). */
  readonly unsubscribed: boolean;
}

export async function getNotificationPreferences(
  prisma: PrismaClient,
  userId: string,
): Promise<NotificationPreferences | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { priceDropEnabled: true, backInStockEnabled: true, unsubscribedAt: true },
  });
  if (!row) return null;
  return {
    priceDropEnabled: row.priceDropEnabled,
    backInStockEnabled: row.backInStockEnabled,
    unsubscribed: row.unsubscribedAt != null,
  };
}

/**
 * Update a user's notification preferences. `resubscribe: true` clears the global
 * opt-out. Returns the resulting preferences.
 */
export async function updateNotificationPreferences(
  prisma: PrismaClient,
  userId: string,
  data: {
    priceDropEnabled?: boolean;
    backInStockEnabled?: boolean;
    resubscribe?: boolean;
  },
): Promise<NotificationPreferences | null> {
  const patch: {
    priceDropEnabled?: boolean;
    backInStockEnabled?: boolean;
    unsubscribedAt?: Date | null;
  } = {};
  if (data.priceDropEnabled != null) patch.priceDropEnabled = data.priceDropEnabled;
  if (data.backInStockEnabled != null) patch.backInStockEnabled = data.backInStockEnabled;
  if (data.resubscribe === true) patch.unsubscribedAt = null;

  const row = await prisma.user.update({
    where: { id: userId },
    data: patch,
    select: { priceDropEnabled: true, backInStockEnabled: true, unsubscribedAt: true },
  });
  return {
    priceDropEnabled: row.priceDropEnabled,
    backInStockEnabled: row.backInStockEnabled,
    unsubscribed: row.unsubscribedAt != null,
  };
}

/**
 * Apply a one-click unsubscribe by token. Idempotent: returns true when a user
 * matched the token (even if already unsubscribed), false otherwise. Never
 * reveals whether the token exists beyond this boolean.
 */
export async function unsubscribeByToken(
  prisma: PrismaClient,
  token: string,
  now: Date,
): Promise<boolean> {
  const res = await prisma.user.updateMany({
    where: { unsubscribeToken: token },
    data: { unsubscribedAt: now },
  });
  return res.count > 0;
}
