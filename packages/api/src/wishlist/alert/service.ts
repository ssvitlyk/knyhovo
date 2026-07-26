import type { PrismaClient } from '@prisma/client';
import type { AlertIntent, AlertLifecycle, AlertState } from './dto.js';
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
// State derivation (pure — no Prisma, fully unit-testable)
// ---------------------------------------------------------------------------

/**
 * Map the persisted status column onto the only lifecycle we store.
 *
 * `TRIGGERED`/`UNAVAILABLE` were never written by any code path; they are read
 * defensively as `active` until the enum is narrowed by migration.
 */
export function toLifecycle(
  status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'UNAVAILABLE',
): AlertLifecycle {
  return status === 'PAUSED' ? 'paused' : 'active';
}

/**
 * Derive the effective alert state the user is shown (notifications-model-v2 §9.3).
 *
 * Precedence (EXACT):
 * 1. lifecycle === 'paused'          → 'paused'
 * 2. canonicalPriceAmount === null   → 'unavailable'  (no strictly in-stock offer)
 * 3. lastNotifiedAt != null          → 'reached'      (we emailed about this threshold)
 * 4. else                            → 'armed'
 *
 * There is deliberately NO price comparison here. `reached` is a fact carried by
 * the notification marker, which only the dispatcher writes and only after a
 * successful send — so the state can never promise an email that did not happen.
 * The marker is cleared when the threshold changes (upsert) and when the engine
 * re-arms the alert, which is what makes step 3 mean "for the current threshold".
 */
export function deriveAlertState(
  persisted: { lifecycle: AlertLifecycle; lastNotifiedAt: Date | null },
  canonicalPriceAmount: number | null,
): AlertState {
  if (persisted.lifecycle === 'paused') return 'paused';
  if (canonicalPriceAmount === null) return 'unavailable';
  if (persisted.lastNotifiedAt != null) return 'reached';
  return 'armed';
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
