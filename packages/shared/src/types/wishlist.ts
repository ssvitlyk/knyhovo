import type { WishlistItemId, UserId, CanonicalBookId } from './ids.js';
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
  /** Alert is triggered when any provider's price drops at or below this value. null means no alert. */
  readonly targetPrice: Money | null;
  /** ISO 8601 timestamp of when the item was added to the wishlist. */
  readonly createdAt: string;
}
