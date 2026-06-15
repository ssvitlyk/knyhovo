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
