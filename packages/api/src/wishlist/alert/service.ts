import type { PrismaClient } from '@prisma/client';
import type { AlertStatus, AlertIntent } from './dto.js';
import type { MoneyDto } from '../dto.js';
import { WishlistItemNotFoundError } from '../../errors.js';
import {
  findWishlistItemId,
  upsertAlert,
  setAlertStatus,
  deleteAlert,
} from './repository.js';

// ---------------------------------------------------------------------------
// Enum reverse-maps (Prisma identifier → public slug)
// ---------------------------------------------------------------------------

/** Maps Prisma AlertStatus enum identifiers to their public API slugs. */
export const ALERT_STATUS_SLUG: Record<
  'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'UNAVAILABLE',
  AlertStatus
> = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  TRIGGERED: 'triggered',
  UNAVAILABLE: 'unavailable',
};

/** Maps Prisma AlertIntent enum identifiers to their public API slugs. */
export const ALERT_INTENT_SLUG: Record<
  'ANY_DROP' | 'BELOW_CURRENT' | 'FAVOURABLE_PRICE' | 'CUSTOM_PRICE',
  AlertIntent
> = {
  ANY_DROP: 'any-drop',
  BELOW_CURRENT: 'below-current',
  FAVOURABLE_PRICE: 'favourable-price',
  CUSTOM_PRICE: 'custom-price',
};

/** Maps public API intent slugs to their Prisma enum identifiers (for writes). */
export const INTENT_ENUM: Record<
  AlertIntent,
  'ANY_DROP' | 'BELOW_CURRENT' | 'FAVOURABLE_PRICE' | 'CUSTOM_PRICE'
> = {
  'any-drop': 'ANY_DROP',
  'below-current': 'BELOW_CURRENT',
  'favourable-price': 'FAVOURABLE_PRICE',
  'custom-price': 'CUSTOM_PRICE',
};

// ---------------------------------------------------------------------------
// Status derivation (pure — no Prisma, fully unit-testable)
// ---------------------------------------------------------------------------

/**
 * Derive the effective (public) alert status from persisted state + live pricing.
 *
 * Precedence (EXACT):
 * 1. persisted.status === 'PAUSED'                                     → 'paused'
 * 2. offersCount === 0                                                  → 'unavailable'
 * 3. lowestPrice != null && lowestPrice.amount <= targetPriceAmount     → 'triggered'
 * 4. else                                                               → 'active'
 */
export function deriveAlertStatus(
  persisted: {
    status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'UNAVAILABLE';
    targetPriceAmount: number;
  },
  lowestPrice: MoneyDto | null,
  offersCount: number,
): AlertStatus {
  if (persisted.status === 'PAUSED') return 'paused';
  if (offersCount === 0) return 'unavailable';
  if (lowestPrice != null && lowestPrice.amount <= persisted.targetPriceAmount) return 'triggered';
  return 'active';
}

// ---------------------------------------------------------------------------
// Orchestration functions
// ---------------------------------------------------------------------------

/**
 * Resolve the wishlist item id for a user + canonical book combination.
 * Throws {@link WishlistItemNotFoundError} when the book is not in the wishlist.
 */
async function resolveWishlistItemId(
  prisma: PrismaClient,
  userId: string,
  bookId: string,
): Promise<string> {
  const wishlistItemId = await findWishlistItemId(prisma, userId, bookId);
  if (!wishlistItemId) throw new WishlistItemNotFoundError();
  return wishlistItemId;
}

/**
 * Create or replace the alert for the wishlist item identified by userId + bookId.
 * The alert is always set to ACTIVE with pausedAt = null on upsert.
 *
 * Throws {@link WishlistItemNotFoundError} when the book is not in the user's wishlist.
 */
export async function setAlert(
  prisma: PrismaClient,
  userId: string,
  bookId: string,
  input: { intent: AlertIntent; targetPrice: { amount: number; currency: 'UAH' } },
): Promise<void> {
  const wishlistItemId = await resolveWishlistItemId(prisma, userId, bookId);
  await upsertAlert(prisma, wishlistItemId, {
    status: 'ACTIVE',
    intent: INTENT_ENUM[input.intent],
    targetPriceAmount: input.targetPrice.amount,
    targetPriceCurrency: input.targetPrice.currency,
    pausedAt: null,
  });
}

/**
 * Pause or unpause the alert for the wishlist item identified by userId + bookId.
 *
 * When paused:   status → PAUSED, pausedAt → now()
 * When unpaused: status → ACTIVE, pausedAt → null
 *
 * Uses updateMany so it is a no-op when no alert exists (rather than throwing).
 * Throws {@link WishlistItemNotFoundError} when the book is not in the user's wishlist.
 *
 * @param now Injectable clock — pass `() => new Date()` in production.
 */
export async function setAlertPaused(
  prisma: PrismaClient,
  userId: string,
  bookId: string,
  paused: boolean,
  now: () => Date,
): Promise<void> {
  const wishlistItemId = await resolveWishlistItemId(prisma, userId, bookId);
  await setAlertStatus(prisma, wishlistItemId, {
    status: paused ? 'PAUSED' : 'ACTIVE',
    pausedAt: paused ? now() : null,
  });
}

/**
 * Remove the alert for the wishlist item identified by userId + bookId.
 *
 * Throws {@link WishlistItemNotFoundError} when the book is not in the user's wishlist.
 * Deleting a non-existent alert on an existing wishlist item is a no-op success.
 */
export async function removeAlert(
  prisma: PrismaClient,
  userId: string,
  bookId: string,
): Promise<void> {
  const wishlistItemId = await resolveWishlistItemId(prisma, userId, bookId);
  await deleteAlert(prisma, wishlistItemId);
}
