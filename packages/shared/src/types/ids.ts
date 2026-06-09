/**
 * Opaque brand utility. Wraps a primitive type T with a unique phantom tag TBrand
 * so TypeScript treats each branded alias as a distinct type — prevents accidentally
 * passing a UserId where a CanonicalBookId is expected, even though both are strings.
 */
type Brand<T, TBrand extends string> = T & { readonly _brand: TBrand };

/**
 * A raw UUID string. Use the more specific branded aliases below wherever possible;
 * UUID is exported for edge cases where the concrete domain is not yet known.
 */
export type UUID = Brand<string, 'UUID'>;

/** Identifier for a raw Book record (not yet canonicalised). */
export type BookId = Brand<string, 'BookId'>;

/** Identifier for a CanonicalBook — the deduplicated, provider-agnostic record. */
export type CanonicalBookId = Brand<string, 'CanonicalBookId'>;

/** Identifier for a ProviderListing — one book entry as seen by a single provider. */
export type ProviderListingId = Brand<string, 'ProviderListingId'>;

/** Identifier for an immutable price snapshot in the price history log. */
export type PriceHistoryPointId = Brand<string, 'PriceHistoryPointId'>;

/** Identifier for a registered User. */
export type UserId = Brand<string, 'UserId'>;

/** Identifier for a WishlistItem. */
export type WishlistItemId = Brand<string, 'WishlistItemId'>;
