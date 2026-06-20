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
  /** Display cover URL selected across providers, or null when none is available. */
  readonly coverUrl: string | null;
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
 * Frontend mirror of the W4a price-alert contract
 * (`GET /api/wishlist` alert field, `PUT/PATCH/DELETE /api/wishlist/:bookId/alert`).
 * The DTOs are not exported from `@knyhovo/shared`; the shape is mirrored here.
 */

/** Server-derived effective status of a price alert, returned at read time. */
export type AlertStatus = 'active' | 'paused' | 'triggered' | 'unavailable';

/** The intent the user selected when configuring the alert. */
export type AlertIntent = 'any-drop' | 'below-current' | 'favourable-price' | 'custom-price';

/** Price alert configuration nested in each {@link WishlistItemDto}. */
export interface AlertDto {
  /** Server-derived effective status at read time. */
  readonly status: AlertStatus;
  readonly intent: AlertIntent;
  readonly targetPrice: MoneyDto;
  /** ISO 8601 timestamp when the alert was paused, or null when not paused. */
  readonly pausedAt: string | null;
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
  /** Selected display cover URL (W9a provider-priority selection across all listings); null when no provider has a usable cover. */
  readonly coverUrl: string | null;
  readonly lowestPrice: MoneyDto | null;
  readonly offersCount: number;
  /** Provider offers sorted ascending by price; OUT_OF_STOCK excluded. */
  readonly providers: readonly WishlistProviderDto[];
}

export interface WishlistItemDto {
  readonly book: WishlistBookDto;
  readonly createdAt: string;
  /** Price alert config for this item; null when no alert is set (W4a). */
  readonly alert: AlertDto | null;
}

export interface WishlistResponseDto {
  readonly items: readonly WishlistItemDto[];
}

/**
 * Frontend mirror of the W5 price-history API contract
 * (packages/api/src/books/price-history/dto.ts). The DTOs are not exported
 * from `@knyhovo/shared`, and the architecture forbids web → api imports, so
 * the shape is mirrored here. `Availability` is the single source-of-truth
 * type imported from the shared package.
 */

export type PriceHistoryPeriod = '30d' | '90d' | '1y' | 'all';

export interface PriceHistoryPointDto {
  readonly amount: number;
  readonly currency: string;
  readonly availability: Availability;
  readonly recordedAt: string;
}

export interface PriceHistoryExtremeDto {
  readonly amount: number;
  readonly currency: string;
  readonly recordedAt: string;
}

export interface TypicalRangeDto {
  readonly min: number;
  readonly max: number;
  readonly currency: string;
}

export interface PriceHistoryChangeDto {
  /** Signed kopiyky: positive = price went up, negative = price went down. */
  readonly amount: number;
  /** Rounded percentage. 0 when first.amount <= 0. */
  readonly percent: number;
}

export interface BookPriceHistoryDto {
  readonly bookId: string;
  readonly period: PriceHistoryPeriod;
  readonly currency: string;
  readonly current: PriceHistoryPointDto | null;
  readonly lowest: PriceHistoryExtremeDto | null;
  readonly highest: PriceHistoryExtremeDto | null;
  readonly typicalRange: TypicalRangeDto | null;
  readonly change: PriceHistoryChangeDto | null;
  readonly points: readonly PriceHistoryPointDto[];
}
