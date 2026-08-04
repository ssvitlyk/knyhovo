import type { PrismaClient } from '@prisma/client';
import type { AlertDto, AlertLifecycle, AlertMode, AlertState } from './dto.js';
import { WishlistItemNotFoundError, AlertPolicyError } from '../../errors.js';
import {
  findWishlistItemId,
  upsertAlert,
  setAlertStatus,
  deleteAlert,
  REARM_ENUM,
} from './repository.js';
import { resolveAlertPolicy, type ResolveFailure } from './resolver.js';
import { resolveGoodPrice, type GoodPriceResult } from './good-price.js';
import { findCanonicalPriceByBook } from '../../pricing/canonical-price.js';

// ---------------------------------------------------------------------------
// Enum reverse-maps (Prisma identifier → public slug)
// ---------------------------------------------------------------------------

/** Prisma AlertMode identifier → public slug. */
export const ALERT_MODE_SLUG: Record<'ANY_DROP' | 'GOOD_PRICE' | 'MY_PRICE', AlertMode> = {
  ANY_DROP: 'any-drop',
  GOOD_PRICE: 'good-price',
  MY_PRICE: 'my-price',
};

/** Public slug → Prisma AlertMode identifier (for writes). */
export const MODE_ENUM: Record<AlertMode, 'ANY_DROP' | 'GOOD_PRICE' | 'MY_PRICE'> = {
  'any-drop': 'ANY_DROP',
  'good-price': 'GOOD_PRICE',
  'my-price': 'MY_PRICE',
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

/** Human messages for each resolver failure, shown by the client as-is. */
const POLICY_ERROR_MESSAGE: Record<ResolveFailure, string> = {
  NO_CANONICAL_PRICE: 'Книги зараз немає в наявності — поріг визначити неможливо.',
  INSUFFICIENT_HISTORY: 'Ще збираємо історію цін для цієї книги.',
  THRESHOLD_REQUIRED: 'Вкажіть свою ціну.',
  THRESHOLD_NOT_ALLOWED: 'Поріг для цього режиму визначає Knyhovo.',
  THRESHOLD_NOT_BELOW_CURRENT: 'Ціна має бути нижчою за поточну.',
};

/**
 * Create or replace the alert for a wishlist item.
 *
 * The server owns the threshold end to end (notifications-model-v2 §9.1, plan
 * step 5): it reads the book's canonical price and the good-price source itself,
 * runs the resolver, and persists the finished policy. A client can only choose a
 * mode — and, for `my-price`, name its own number. Nothing it sends is trusted as
 * a threshold for the other modes.
 *
 * Throws {@link WishlistItemNotFoundError} when the book is not in the wishlist and
 * {@link PolicyResolutionError} when the chosen mode has no honest threshold.
 */
export async function setAlert(
  prisma: PrismaClient,
  userId: string,
  bookId: string,
  input: { mode: AlertMode; threshold?: { amount: number; currency: 'UAH' } | null },
  deps?: {
    canonicalPriceFor?: (
      prisma: PrismaClient,
      bookId: string,
    ) => Promise<{ amount: number | null; currency: 'UAH' }>;
    goodPriceFor?: (prisma: PrismaClient, bookId: string) => Promise<GoodPriceResult>;
  },
): Promise<AlertDto> {
  const wishlistItemId = await resolveWishlistItemId(prisma, userId, bookId);

  const readCanonical = deps?.canonicalPriceFor ?? canonicalPriceForBook;
  const readGoodPrice = deps?.goodPriceFor ?? goodPriceForBook;

  const [canonical, goodPrice] = await Promise.all([
    readCanonical(prisma, bookId),
    readGoodPrice(prisma, bookId),
  ]);

  const resolved = resolveAlertPolicy(input.mode, {
    canonicalPrice: canonical.amount,
    currency: canonical.currency,
    goodPrice,
    requestedThreshold: input.threshold?.amount ?? null,
  });

  if (!resolved.ok) {
    throw new AlertPolicyError(resolved.reason, POLICY_ERROR_MESSAGE[resolved.reason]);
  }

  await upsertAlert(prisma, wishlistItemId, {
    mode: MODE_ENUM[input.mode],
    targetPriceAmount: resolved.policy.threshold,
    targetPriceCurrency: canonical.currency,
    baselineAmount: resolved.policy.baseline,
    rearmPolicy: REARM_ENUM[resolved.policy.rearmPolicy],
    thresholdBasis: resolved.policy.thresholdBasis,
    thresholdProof: resolved.policy.thresholdProof,
  });

  // A freshly written alert is ACTIVE with a cleared marker, so its state is fully
  // determined here — no extra read, and no chance of the client inferring it.
  return {
    state: deriveAlertState({ lifecycle: 'active', lastNotifiedAt: null }, canonical.amount),
    mode: input.mode,
    threshold: { amount: resolved.policy.threshold, currency: canonical.currency },
    baseline:
      resolved.policy.baseline === null
        ? null
        : { amount: resolved.policy.baseline, currency: canonical.currency },
    thresholdProof: resolved.policy.thresholdProof,
    pausedAt: null,
    notifiedAt: null,
  };
}

/** Read a book's canonical price (the single definition, src/pricing). */
async function canonicalPriceForBook(
  prisma: PrismaClient,
  bookId: string,
): Promise<{ amount: number | null; currency: 'UAH' }> {
  const byBook = await findCanonicalPriceByBook(prisma, [bookId]);
  return { amount: byBook.get(bookId) ?? null, currency: 'UAH' };
}

/**
 * Read the good-price suggestion for a book.
 *
 * Gathers the recorded price points the formula will need and delegates to the
 * good-price source, which answers `PENDING_CALIBRATION` until the data study
 * fixes the formula (PRD §5.3).
 */
async function goodPriceForBook(
  prisma: PrismaClient,
  bookId: string,
): Promise<GoodPriceResult> {
  const [canonical, points] = await Promise.all([
    canonicalPriceForBook(prisma, bookId),
    prisma.priceHistoryPoint.findMany({
      where: { providerListing: { canonicalBookId: bookId } },
      select: { priceAmount: true },
    }),
  ]);

  return resolveGoodPrice({
    amounts: points.map((p: { priceAmount: number }) => p.priceAmount),
    canonicalPrice: canonical.amount,
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
