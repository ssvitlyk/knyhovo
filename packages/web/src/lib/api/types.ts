import type { ProviderName, Availability } from '@knyhovo/shared';

/**
 * Frontend mirror of the S8a `GET /api/search` response contract
 * (packages/api/src/search/dto.ts). The DTOs are not exported from
 * `@knyhovo/shared`, and the architecture forbids web → api imports, so the
 * shape is mirrored here. `ProviderName` is the single source-of-truth type
 * imported from the shared package.
 */

export interface MoneyDto {
  /** Amount in the smallest currency unit (kopiyky). */
  readonly amount: number;
  readonly currency: string;
}

export interface ProviderOfferDto {
  readonly provider: ProviderName;
  readonly price: MoneyDto;
}

export interface SearchItemDto {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  /** Minimum available provider price for this book. */
  readonly lowestPrice: MoneyDto;
  /** Number of provider offers included in `providers`. */
  readonly offersCount: number;
  /** Provider offers, sorted by ascending price. */
  readonly providers: readonly ProviderOfferDto[];
}

export interface SearchResponseDto {
  readonly items: readonly SearchItemDto[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

/**
 * Frontend mirror of the S7a `GET /api/books/:id` contract
 * (packages/api/src/books/dto.ts). The DTOs are not exported from
 * `@knyhovo/shared`, and the architecture forbids web → api imports, so the
 * shape is mirrored here. `ProviderName` and `Availability` are the single
 * source-of-truth types imported from the shared package.
 */

export interface BookProviderDto {
  readonly provider: ProviderName;
  readonly price: MoneyDto;
  readonly availability: Availability;
  readonly url: string;
  readonly lastSeenAt: string;
}

export interface BookDetailsDto {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly isbn: string | null;
  readonly description: string | null;
  readonly coverUrl: string | null;
  readonly lowestPrice: MoneyDto | null;
  readonly offersCount: number;
  readonly providers: readonly BookProviderDto[];
}

/**
 * Frontend mirror of the S8 auth user shape
 * (packages/api/src/auth/dto.ts — AuthUserDto).
 */
export interface AuthUserDto {
  readonly id: string;
  readonly email: string;
  readonly createdAt: string;
}

/**
 * Frontend mirror of the S9 wishlist contract
 * (packages/api/src/wishlist/dto.ts). The DTOs are not exported from
 * `@knyhovo/shared`, and the architecture forbids web → api imports, so the
 * shape is mirrored here. `ProviderName` and `Availability` are the single
 * source-of-truth types imported from the shared package.
 */

export interface WishlistProviderDto {
  readonly provider: ProviderName;
  readonly price: MoneyDto;
  readonly availability: Availability;
  readonly url: string;
  readonly lastSeenAt: string;
}

export interface WishlistBookDto {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly isbn: string | null;
  /** Always null from the S9 API — cover scraping not yet implemented. */
  readonly coverUrl: string | null;
  readonly lowestPrice: MoneyDto | null;
  readonly offersCount: number;
  /** Provider offers sorted ascending by price; OUT_OF_STOCK excluded. */
  readonly providers: readonly WishlistProviderDto[];
}

export interface WishlistItemDto {
  readonly book: WishlistBookDto;
  readonly createdAt: string;
}

export interface WishlistResponseDto {
  readonly items: readonly WishlistItemDto[];
}
