import type { ProviderName } from '@knyhovo/shared';

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
