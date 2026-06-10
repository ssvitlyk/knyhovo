import type { ProviderName } from '@knyhovo/shared';

/**
 * Search Results v1.0 response contract.
 *
 * These DTOs are the *only* shape exposed to API consumers. No Prisma model
 * type is ever returned from the search endpoint — the repository/mapper layers
 * translate persistence rows into these structures.
 *
 * Monetary amounts are expressed in the smallest currency unit (kopiyky),
 * matching the shared `Money` semantics. Formatting to a display value is the
 * UI's responsibility.
 */

export interface MoneyDto {
  /** Amount in the smallest currency unit (kopiyky). */
  readonly amount: number;
  readonly currency: string;
}

export interface ProviderOfferDto {
  /** Provider slug, e.g. `'yakaboo'` or `'book-club'`. */
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
