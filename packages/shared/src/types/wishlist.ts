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
