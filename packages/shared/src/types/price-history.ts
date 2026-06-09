import type { PriceHistoryPointId, ProviderListingId } from './ids.js';
import type { Money } from './money.js';

/**
 * An immutable price snapshot for a ProviderListing at a specific point in time.
 *
 * Price history is append-only: rows are never updated or deleted.
 * All fields are readonly to make this intent explicit at the type level.
 */
export interface PriceHistoryPoint {
  readonly id: PriceHistoryPointId;
  /** The provider listing whose price was recorded. */
  readonly providerListingId: ProviderListingId;
  /** The price observed at recordedAt. */
  readonly price: Money;
  /** ISO 8601 timestamp of when this price was recorded during a scrape. */
  readonly recordedAt: string;
}
