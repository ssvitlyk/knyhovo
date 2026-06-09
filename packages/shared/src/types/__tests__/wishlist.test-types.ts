/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Compile-time checks for WishlistItem — nullable targetPrice.
 */
import type { WishlistItem } from '../wishlist.js';
import type { WishlistItemId, UserId, CanonicalBookId } from '../ids.js';

// WishlistItem without a price target is valid
const _itemNoTarget: WishlistItem = {
  id: 'wi-1' as WishlistItemId,
  userId: 'u-1' as UserId,
  canonicalBookId: 'cb-1' as CanonicalBookId,
  targetPrice: null,
  createdAt: '2026-06-08T00:00:00.000Z',
};

// WishlistItem with a price target is also valid
const _itemWithTarget: WishlistItem = {
  id: 'wi-2' as WishlistItemId,
  userId: 'u-1' as UserId,
  canonicalBookId: 'cb-2' as CanonicalBookId,
  targetPrice: { amount: 20000, currency: 'UAH' },
  createdAt: '2026-06-08T00:00:00.000Z',
};

// targetPrice cannot be undefined — only Money or null
// @ts-expect-error undefined is not assignable to Money | null
const _badTargetPrice: WishlistItem['targetPrice'] = undefined;

export {};
