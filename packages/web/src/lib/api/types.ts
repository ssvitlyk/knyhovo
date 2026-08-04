import type { ProviderName, Availability, BuyingReason, HomeShelfKey } from '@knyhovo/shared';

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
  /** Publisher selected across provider listings by provider priority (book-metadata PRD); null when no provider supplied one. */
  readonly publisher: string | null;
  /** Language as provider text (book-metadata PRD); null when no provider supplied one. */
  readonly language: string | null;
  /** Format/cover type as provider text (book-metadata PRD); null when no provider supplied one. */
  readonly format: string | null;
  /** Series as provider text (book-metadata PRD); null when no provider supplied one. */
  readonly series: string | null;
  /** Publication year (book-metadata PRD); null when no provider supplied one. */
  readonly publicationYear: number | null;
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
  readonly displayName: string | null;
}

/**
 * Frontend mirror of the notifications-model-v2 price-alert contract
 * (`GET /api/wishlist` alert field, `PUT/PATCH/DELETE /api/wishlist/:bookId/alert`,
 * packages/api/src/wishlist/alert/dto.ts — AlertDto).
 * The DTOs are not exported from `@knyhovo/shared`; the shape is mirrored here.
 *
 * The client never infers state or computes thresholds — everything below is
 * read verbatim from the server (notifications-model-v2 §9).
 */

/** Effective state shown to the user — derived from facts, never from a price comparison. */
export type AlertState = 'armed' | 'reached' | 'unavailable' | 'paused';

/** The mode the user picked — a label, never behaviour (§9.1). */
export type AlertMode = 'any-drop' | 'good-price' | 'my-price';

/** Price alert configuration nested in each {@link WishlistItemDto}. */
export interface AlertDto {
  /** Server-derived effective state at read time. */
  readonly state: AlertState;
  /** The mode the user picked when configuring the alert. */
  readonly mode: AlertMode;
  /** The policy threshold the server resolved and froze. */
  readonly threshold: MoneyDto;
  /** The price a further drop is measured against; null for static policies. */
  readonly baseline: MoneyDto | null;
  /** One-line human proof of where the threshold came from; render as-is. */
  readonly thresholdProof: string | null;
  /** ISO 8601 timestamp when the alert was paused, or null when not paused. */
  readonly pausedAt: string | null;
  /** ISO 8601 timestamp of the last email about the current threshold; null = never. */
  readonly notifiedAt: string | null;
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

/** A single genre assigned to a canonical book (`CanonicalBook.genreId → Collection`, one genre, not a list). */
export interface WishlistGenreDto {
  readonly slug: string;
  readonly name: string;
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
  /** Single assigned genre, or null when unassigned. */
  readonly genre: WishlistGenreDto | null;
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
 * Frontend mirror of the buying-opportunities contract
 * (`GET /api/wishlist/buying-opportunities`, wishlist v2.2 «Зараз вигідно
 * купити»). Not exported from `@knyhovo/shared` (only `BuyingReason` is); the
 * shape is mirrored here. All money fields are integer kopiyky; `store` is a
 * provider slug (`ProviderName`), display name resolved by the web layer.
 * The frontend never re-sorts `items` — order is authoritative from the API.
 */
export interface BuyingOpportunityDto {
  readonly bookId: string;
  readonly reason: BuyingReason;
  readonly savingsAmount: number;
  readonly price: number;
  readonly prevPrice: number | null;
  readonly currency: string;
  readonly store: ProviderName;
}

export interface BuyingOpportunitiesResponseDto {
  readonly items: readonly BuyingOpportunityDto[];
  readonly totalWishlistCount: number;
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
  /**
   * Per-mode alert preview (notifications-model-v2 §10), exactly 3 entries in
   * fixed order (any-drop, good-price, my-price), independent of `period`.
   * Lets the configurator render every mode without any client-side calculation.
   * A preview, not the contract — the authoritative policy is built by the
   * server on `PUT .../alert` and returned in that response.
   */
  readonly alertPolicyPreview: readonly AlertModePreviewDto[];
}

/** One selectable mode as the configurator should render it. */
export interface AlertModePreviewDto {
  readonly mode: AlertMode;
  /** False → the mode must be shown disabled, with `reason` and no threshold. */
  readonly available: boolean;
  /**
   * The threshold the server would freeze, or null (my-price / unavailable).
   * Always null for `my-price` even when `available: true` — the user hasn't
   * typed a number yet. This is not a bug.
   */
  readonly threshold: MoneyDto | null;
  /** One-line human proof of the threshold, or null. */
  readonly proof: string | null;
  /** Why the mode is unavailable; null when it is available. */
  readonly reason: string | null;
}

/**
 * Frontend mirror of the PR5b notification preferences contract
 * (`GET /api/notifications/preferences`, `PATCH /api/notifications/preferences`).
 */
export interface NotificationPreferencesDto {
  readonly priceDropEnabled: boolean;
  readonly backInStockEnabled: boolean;
  readonly unsubscribed: boolean;
}

/**
 * Frontend mirror of the Collections API contract (Collections PRD v1.0,
 * `GET /api/collections*`). The DTOs are not exported from `@knyhovo/shared`,
 * and the architecture forbids web → api imports, so the shape is mirrored
 * here verbatim from the agreed contract. Monetary amounts are integer kopiyky.
 */

export type CollectionType = 'dynamic' | 'editorial' | 'taxonomic';

export interface CollectionDto {
  readonly id: string;
  readonly slug: string;
  readonly type: CollectionType;
  readonly name: string;
  readonly description: string;
  readonly bookCount: number;
  /** ISO 8601 timestamp of the last content refresh. */
  readonly updatedAt: string;
  readonly isActive: boolean;
  /** Lucide-style icon name rendered via DynIcon (optional). */
  readonly icon?: string;
}

export interface CollectionBookDto {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly coverUrl: string;
  /** Current best price; null only when the book has zero priced listings. */
  readonly minPrice: MoneyDto | null;
  /** Previous price, only when there is a real historical drop. */
  readonly oldPrice: MoneyDto | null;
  readonly discountPercent: number | null;
  /** Display name of the cheapest listing's provider; null when unpriced. */
  readonly storeName: string | null;
  /** Always null for now — no reviews yet. */
  readonly rating: number | null;
  /** Always null for now — no reviews yet. */
  readonly reviewsCount: number | null;
  readonly wishlistCount: number;
  /** Per-user; always false for a guest request. */
  readonly isWishlisted: boolean;
  readonly inStock: boolean;
  /** Site-relative Book Details URL (e.g. `/books/:id`). */
  readonly url: string;
  /** ISO 8601 timestamp when the book entered the catalog; null when unknown. */
  readonly catalogAddedAt: string | null;
  /** Number of priced listings in the pool backing `minPrice` (in-stock priced listings when any exist, otherwise all priced listings); 0 when unpriced. */
  readonly offersCount: number;
}

export interface CollectionsHubFeaturedDto {
  readonly collection: CollectionDto;
  readonly previewBooks: readonly CollectionBookDto[];
}

export interface CollectionsHubDto {
  /** Null when the collections table has no `knyhovyk-radyt` row (unseeded). */
  readonly featured: CollectionsHubFeaturedDto | null;
  readonly dynamic: readonly CollectionDto[];
  /** knyhovyk-radyt + pryhovani-skarby. */
  readonly editorial: readonly CollectionDto[];
  /** Weekly editorial trio (buker-2026, ukr-fentezi, non-fikshn). */
  readonly weekly: readonly CollectionDto[];
  readonly moods: readonly CollectionDto[];
  /** Taxonomic collections with bookCount >= 30. */
  readonly genres: readonly CollectionDto[];
}

/** Sort options accepted by `GET /api/collections/:slug/books`. */
export type CollectionsApiSort =
  | 'relevance'
  | 'price_asc'
  | 'price_desc'
  | 'newest'
  | 'oldest'
  | 'discount_desc';

export interface CollectionBooksPageDto {
  readonly books: readonly CollectionBookDto[];
  readonly total: number;
  readonly page: number;
  readonly per_page: number;
  readonly total_pages: number;
}

/** One composed homepage shelf: a shared-vocabulary key + its books (backend supplies no presentation copy). */
export interface HomeShelfDto {
  readonly key: HomeShelfKey;
  readonly books: readonly CollectionBookDto[];
}

/** `GET /api/home` response — shelves in display order (empty shelves omitted). */
export interface HomeResponseDto {
  readonly shelves: readonly HomeShelfDto[];
}
