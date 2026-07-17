import type { BuyingReason, ProviderName } from '@knyhovo/shared';

/**
 * `GET /api/wishlist/buying-opportunities` response contract (frozen 3-value
 * `BuyingReason` engine — see `packages/shared/src/types/wishlist.ts`).
 *
 * Monetary amounts are expressed in the smallest currency unit (kopiyky),
 * matching the wishlist DTO convention. `store` is the provider slug (the
 * same convention as `WishlistProviderDto.provider`) — display-name mapping
 * is the UI's responsibility.
 */
export interface BuyingOpportunityItemDto {
  readonly bookId: string;
  readonly reason: BuyingReason;
  /** Amount saved vs. the relevant reference price, clamped to >= 0. Kopiyky. */
  readonly savingsAmount: number;
  /** Current qualifying price (cheapest IN_STOCK listing). Kopiyky. */
  readonly price: number;
  /**
   * Knyhovo's own previously tracked price for the selected listing (never a
   * store-supplied "was" price). null when fewer than 2 history points exist.
   */
  readonly prevPrice: number | null;
  readonly currency: string;
  /** Provider slug of the listing that produced `price`. */
  readonly store: ProviderName;
}

export interface BuyingOpportunitiesResponseDto {
  readonly items: readonly BuyingOpportunityItemDto[];
  /** Total number of items in the user's wishlist (qualifying or not). */
  readonly totalWishlistCount: number;
}
