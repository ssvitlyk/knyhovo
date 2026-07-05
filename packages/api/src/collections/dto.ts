/**
 * Collections API v3 (catalog-v3) response contract.
 *
 * These DTOs are the *only* shape exposed to API consumers. No Prisma model
 * type is ever returned from the collections endpoints — the repository/
 * mapper/service layers translate persistence rows into these structures.
 *
 * Monetary amounts are expressed via {@link MoneyDto} (whole кopiyky, i.e.
 * smallest currency unit). Formatting to a display value is the UI's
 * responsibility.
 */

export type CollectionTypeDto = 'dynamic' | 'editorial' | 'taxonomic';

export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'oldest' | 'discount_desc';

/** Slice-local money shape, mirrored from search/books/wishlist. */
export interface MoneyDto {
  readonly amount: number;
  readonly currency: 'UAH';
}

export interface CollectionDto {
  readonly id: string;
  readonly slug: string;
  readonly type: CollectionTypeDto;
  readonly name: string;
  readonly description: string;
  readonly bookCount: number;
  /** ISO-8601 timestamp. */
  readonly updatedAt: string;
  readonly isActive: boolean;
  readonly icon?: string;
}

export interface CollectionBookDto {
  /** = canonical_books.id */
  readonly id: string;
  readonly title: string;
  readonly author: string;
  /** Defensively `''` when no listing carries a usable cover. */
  readonly coverUrl: string;
  /** Cheapest priced listing. `null` only when the book has zero priced listings. */
  readonly minPrice: MoneyDto | null;
  /** Only set when there is a real historical price drop on the cheapest listing. */
  readonly oldPrice: MoneyDto | null;
  readonly discountPercent: number | null;
  /** Display name of the provider backing the cheapest listing; `null` when `minPrice` is `null`. */
  readonly storeName: string | null;
  /** Always `null` — TODO: populate once review data exists. */
  readonly rating: number | null;
  /** Always `null` — TODO: populate once review data exists. */
  readonly reviewsCount: number | null;
  readonly wishlistCount: number;
  /** `false` in the cache/for guests; decorated after cache read for a signed-in user. */
  readonly isWishlisted: boolean;
  readonly inStock: boolean;
  /** = `/books/{id}` */
  readonly url: string;
  /** ISO-8601 timestamp; = canonical_books.created_at. `null` only if the book has no createdAt. */
  readonly catalogAddedAt: string | null;
}

export interface HubResponseDto {
  readonly featured: {
    readonly collection: CollectionDto;
    readonly previewBooks: readonly CollectionBookDto[];
  };
  readonly dynamic: readonly CollectionDto[];
  readonly editorial: readonly CollectionDto[];
  readonly weekly: readonly CollectionDto[];
  readonly moods: readonly CollectionDto[];
  readonly genres: readonly CollectionDto[];
}

export interface CollectionDetailResponseDto {
  readonly collection: CollectionDto;
}

export interface CollectionBooksResponseDto {
  readonly books: readonly CollectionBookDto[];
  readonly total: number;
  readonly page: number;
  readonly per_page: number;
  readonly total_pages: number;
}

export interface CollectionsListResponseDto {
  readonly collections: readonly CollectionDto[];
}
