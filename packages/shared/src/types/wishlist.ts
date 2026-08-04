import type { WishlistItemId, UserId, CanonicalBookId, AlertId } from './ids.js';
import type { Money } from './money.js';

/**
 * A single entry in a user's wishlist. One user may have at most one WishlistItem
 * per CanonicalBook in MVP.
 *
 * targetPrice is nullable: a book may be wishlisted without setting a price target,
 * in which case no email alert will be triggered for it.
 */
export interface WishlistItem {
  readonly id: WishlistItemId;
  readonly userId: UserId;
  readonly canonicalBookId: CanonicalBookId;
  /**
   * @deprecated Use the dedicated Alert entity instead (W4). The Alert now owns
   * the price threshold. This field is kept for backward compatibility only.
   * Alert is triggered when any provider's price drops at or below this value. null means no alert.
   */
  readonly targetPrice: Money | null;
  /** ISO 8601 timestamp of when the item was added to the wishlist. */
  readonly createdAt: string;
}

/**
 * Why a wishlist book qualifies for the «Зараз вигідно купити» section.
 * Frozen 3-value contract (Buying Reason Engine spec §3): every signal must be
 * proven by Knyhovo's own price tracking — never a store-side "was" price.
 * BEST_OFFER/BIG_DISCOUNT/BACK_IN_STOCK/GOOD_DEAL were deliberately removed;
 * do not reintroduce without an explicit product decision.
 */
export type BuyingReason = 'TARGET_REACHED' | 'LOWEST_90_DAYS' | 'PRICE_DROPPED';

/**
 * @deprecated Superseded by {@link AlertLifecycle} (what is stored) and
 * {@link AlertState} (what the user is told). Kept until the read models stop
 * emitting it.
 */
export type AlertStatus = 'active' | 'paused' | 'triggered' | 'unavailable';

/**
 * The only alert state that is PERSISTED (notifications-model-v2 §9.1).
 * Everything else about an alert is either a fact (a notification marker) or a
 * property of the live listing data.
 */
export type AlertLifecycle = 'active' | 'paused';

/**
 * The effective alert state shown to the user (notifications-model-v2 §9.3).
 *
 * - `paused`      — the user muted it (persisted).
 * - `unavailable` — the book has no strictly-IN_STOCK offer, so no promise can be kept.
 * - `reached`     — we have already emailed about the current threshold. This is a
 *                   FACT read from the notification marker, never a price
 *                   comparison, so the UI cannot claim an email that was never sent.
 * - `armed`       — watching.
 */
export type AlertState = 'armed' | 'reached' | 'unavailable' | 'paused';

/**
 * @deprecated Superseded by {@link AlertMode}. `below-current` was the same user
 * intent as `any-drop` expressed with a frozen baseline and is gone; the column
 * survives one release for rollback safety.
 */
export type AlertIntent = 'any-drop' | 'below-current' | 'favourable-price' | 'custom-price';

/**
 * How the user asked the threshold to be chosen (notifications-model-v2 §3).
 *
 * A mode is a resolver selector and a display label — nothing downstream of the
 * resolver may branch on it.
 */
export type AlertMode = 'any-drop' | 'good-price' | 'my-price';

/** A price alert associated with a WishlistItem. */
export interface Alert {
  readonly id: AlertId;
  readonly wishlistItemId: WishlistItemId;
  readonly status: AlertStatus;
  readonly intent: AlertIntent;
  readonly targetPrice: Money;
  readonly pausedAt: string | null;  // ISO 8601
  readonly createdAt: string;
  readonly updatedAt: string;
}
