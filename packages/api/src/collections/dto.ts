/**
 * Collections API v1.0 response contract.
 *
 * These DTOs are the *only* shape exposed to API consumers. No Prisma model
 * type is ever returned from the collections endpoints — the repository/
 * mapper/service layers translate persistence rows into these structures.
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

export interface CollectionBookDto {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly coverUrl: string | null;
  /** Cheapest in-stock provider price. null when there is no available offer. */
  readonly minPrice: MoneyDto | null;
  /** Highest historical price strictly greater than the current cheapest price. null when there is no real drop. */
  readonly oldPrice: MoneyDto | null;
  /** Percentage drop from oldPrice to minPrice, rounded. null when there is no real drop. */
  readonly discountPercent: number | null;
  /** Display name of the store backing the cheapest listing. null when there is no available offer. */
  readonly storeName: string | null;
  // TODO: no ratings data source yet (MVP) — always null.
  readonly rating: number | null;
  // TODO: no reviews data source yet (MVP) — always null.
  readonly reviewsCount: number | null;
  readonly wishlistCount: number;
  readonly isWishlisted: boolean;
  readonly inStock: boolean;
  readonly catalogAddedAt: string;
}

export interface GenreDto {
  readonly slug: string;
  readonly name: string;
  readonly icon: string | null;
  readonly bookCount: number;
}

export interface MoodDto {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly bookCount: number;
}

export interface CollectionSummaryDto {
  readonly slug: string;
  readonly type: string;
  readonly title: string;
  readonly eyebrow: string | null;
  readonly description: string | null;
  readonly statusLabel: string | null;
  readonly icon: string | null;
  readonly bookCount: number;
  readonly previewBooks: readonly CollectionBookDto[];
}

export interface CollectionDetailDto {
  readonly slug: string;
  readonly type: string;
  readonly title: string;
  readonly eyebrow: string | null;
  readonly description: string | null;
  readonly statusLabel: string | null;
  readonly icon: string | null;
  readonly bookCount: number;
}

interface SectionBase {
  readonly slug: string;
  readonly title: string;
  readonly eyebrow: string | null;
  readonly description: string | null;
  readonly statusLabel: string | null;
  readonly href: string;
}

/**
 * Home/Hub page section — a discriminated union on `type` so consumers can
 * narrow `items` without a runtime type-check.
 */
export type Section =
  | (SectionBase & {
      readonly type:
        | 'wishlist-popular'
        | 'new-arrivals'
        | 'biggest-discounts'
        | 'popular'
        | 'underrated';
      readonly items: readonly CollectionBookDto[];
    })
  | (SectionBase & {
      readonly type: 'genres';
      readonly items: readonly GenreDto[];
    })
  | (SectionBase & {
      readonly type: 'moods';
      readonly items: readonly MoodDto[];
    })
  | (SectionBase & {
      readonly type: 'editorial';
      readonly items: readonly CollectionSummaryDto[];
    });

export interface HomeResponseDto {
  readonly featured: CollectionSummaryDto;
  readonly sections: readonly Section[];
}

export interface BooksPageDto {
  readonly collection: CollectionDetailDto;
  readonly books: readonly CollectionBookDto[];
  readonly page: number;
  readonly perPage: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface SimilarDto {
  readonly collections: readonly CollectionSummaryDto[];
}

/** Public catalog path for a collection/genre/mood slug. Never `/dobirky`. */
export function collectionHref(slug: string): string {
  return `/catalog/${slug}`;
}
