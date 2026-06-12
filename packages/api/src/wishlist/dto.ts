import type { ProviderName, Availability } from '@knyhovo/shared';

/**
 * Wishlist API v1.0 response contract.
 *
 * These DTOs are the *only* shape exposed to API consumers. No Prisma model
 * type is ever returned from the wishlist endpoint — the repository/mapper layers
 * translate persistence rows into these structures.
 *
 * Monetary amounts are expressed in the smallest currency unit (kopiyky),
 * matching the shared `Money` semantics. Formatting to a display value is the
 * UI's responsibility.
 *
 * Re-exports ProviderName and Availability from shared to avoid re-defining
 * slug types — all wishlist code imports from here.
 */
export type { ProviderName, Availability };

export interface MoneyDto {
  /** Amount in the smallest currency unit (kopiyky). */
  readonly amount: number;
  readonly currency: string;
}

export interface WishlistProviderDto {
  /** Provider slug, e.g. `'yakaboo'` or `'book-club'`. */
  readonly provider: ProviderName;
  readonly price: MoneyDto;
  readonly availability: Availability;
  /** Direct URL to the book's page on the provider's site. */
  readonly url: string;
  /** ISO 8601 timestamp of the last scrape that saw this listing. */
  readonly lastSeenAt: string;
}

export interface WishlistBookDto {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly isbn: string | null;
  /** Always null — column does not exist in DB. Reserved for future use. */
  readonly coverUrl: string | null;
  /** Minimum available provider price. null when there are no available offers. */
  readonly lowestPrice: MoneyDto | null;
  /** Number of available provider offers included in `providers`. */
  readonly offersCount: number;
  /** Available provider offers, sorted by ascending price. */
  readonly providers: readonly WishlistProviderDto[];
}

export interface WishlistItemDto {
  readonly book: WishlistBookDto;
  /** ISO 8601 timestamp of when this item was added to the wishlist. */
  readonly createdAt: string;
}

export interface WishlistResponseDto {
  readonly items: readonly WishlistItemDto[];
}

export interface WishlistStatusDto {
  readonly inWishlist: boolean;
}

export interface OkResponseDto {
  readonly ok: true;
}
