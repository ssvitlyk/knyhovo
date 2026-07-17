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

/** The persisted status values for an Alert. TRIGGERED and UNAVAILABLE are derived at read time. */
export type AlertStatus = 'active' | 'paused' | 'triggered' | 'unavailable';

/** The intent a user has set for an Alert — drives how the derived status is computed. */
export type AlertIntent = 'any-drop' | 'below-current' | 'favourable-price' | 'custom-price';

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
