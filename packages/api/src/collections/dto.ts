/**
 * Collections API v3 (catalog-v3) response contract.
 *
 * These DTOs are the *only* shape exposed to API consumers. No Prisma model
 * type is ever returned from the collections endpoints — the repository/
 * mapper/service layers translate persistence rows into these structures.
 *
 * Monetary amounts are expressed as whole кopiyky (smallest currency unit).
 * Formatting to a display value is the UI's responsibility.
 */

export type CollectionTypeDto = 'dynamic' | 'editorial' | 'taxonomic';

export type SortOption = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'oldest' | 'discount_desc';

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

export interface BookCardDataDto {
  /** = canonical_books.id */
  readonly id: string;
  readonly title: string;
  readonly author: string;
  /** Defensively `''` when no listing carries a usable cover. */
  readonly coverUrl: string;
  /** Cheapest offer, in кopiyky. */
  readonly price: number;
  /** Only present when there is a real historical price drop. */
  readonly oldPrice?: number;
  /** Display name of the provider backing the cheapest listing. */
  readonly storeName: string;
  readonly discountPct?: number;
  readonly inStock: boolean;
  /** = `/books/{id}` */
  readonly url: string;
  /** ISO-8601 timestamp; = canonical_books.created_at */
  readonly catalogAddedAt: string;
  readonly wishlistCount: number;
}

export interface HubResponseDto {
  readonly featured: {
    readonly collection: CollectionDto;
    readonly previewBooks: readonly BookCardDataDto[];
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
  readonly books: readonly BookCardDataDto[];
  readonly total: number;
  readonly page: number;
  readonly per_page: number;
  readonly total_pages: number;
}

export interface CollectionsListResponseDto {
  readonly collections: readonly CollectionDto[];
}
