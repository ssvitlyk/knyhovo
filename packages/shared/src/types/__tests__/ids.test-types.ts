/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Compile-time checks for branded ID types.
 * This file must typecheck cleanly — any @ts-expect-error that does NOT produce
 * an error would itself cause a type error, keeping the checks honest.
 */
import type {
  BookId,
  CanonicalBookId,
  ProviderListingId,
  PriceHistoryPointId,
  UserId,
  WishlistItemId,
  UUID,
} from '../ids.js';

// Each branded type is assignable from a matching cast
const _bookId = 'abc' as BookId;
const _canonicalId = 'def' as CanonicalBookId;
const _listingId = 'ghi' as ProviderListingId;
const _historyId = 'jkl' as PriceHistoryPointId;
const _userId = 'mno' as UserId;
const _wishlistId = 'pqr' as WishlistItemId;
const _uuid = 'stu' as UUID;

// Branded types are not mutually assignable — assigning one to another must fail
// @ts-expect-error CanonicalBookId is not assignable to BookId
const _wrongId1: BookId = _canonicalId;
// @ts-expect-error UserId is not assignable to WishlistItemId
const _wrongId2: WishlistItemId = _userId;
// @ts-expect-error ProviderListingId is not assignable to PriceHistoryPointId
const _wrongId3: PriceHistoryPointId = _listingId;

// Plain string is not directly assignable to a branded type without a cast
// @ts-expect-error plain string is not assignable to CanonicalBookId
const _wrongId4: CanonicalBookId = 'plain-string';

// Declare module to prevent TS "unused" errors on _wrongIdN in strict projects
export {};
