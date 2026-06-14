/**
 * Price-history module contracts.
 *
 * These types operate at the persistence boundary and therefore use the
 * Prisma-side enum slugs (`'IN_STOCK'`, `'UAH'`, ...), matching how the rest of
 * the persistence layer refers to these enums. No `@prisma/client` model type
 * leaks through.
 *
 * Monetary amounts are in the smallest currency unit (копійки), per the shared
 * `Money` semantics.
 */
export type SnapshotCurrency = 'UAH';
export type SnapshotAvailability = 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';

/** Price + availability of a listing at a single point in time. */
export interface ListingPriceState {
  /** Price in the smallest currency unit (копійки). */
  readonly priceAmount: number;
  readonly priceCurrency: SnapshotCurrency;
  readonly availability: SnapshotAvailability;
}

/** Everything needed to append one immutable price-history snapshot. */
export interface PriceSnapshotInput extends ListingPriceState {
  readonly providerListingId: string;
  readonly recordedAt: Date;
}

/** A single recorded price-history point returned by read queries. */
export interface PricePoint extends ListingPriceState {
  readonly recordedAt: Date;
}

/** Optional time window for history timeline queries. */
export interface HistoryRange {
  readonly since?: Date;
  readonly until?: Date;
}
