import type { Provider } from '@prisma/client';
import type { Availability, ProviderName } from '@knyhovo/shared';

/**
 * The single home of the persisted-enum <-> public-slug maps for providers and
 * availability. Importable from anywhere (HTTP mappers, pipeline, refresh).
 */

/** Persisted `Provider` enum value. */
export type DbProvider = Provider;

/** Persisted availability enum value. */
export type DbAvailability = 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';

/** Public provider slug -> persisted enum. */
export const PROVIDER_DB_ENUM: Record<ProviderName, DbProvider> = {
  yakaboo: 'YAKABOO',
  'book-club': 'BOOK_CLUB',
  vivat: 'VIVAT',
  'book-ye': 'BOOK_YE',
  bookchef: 'BOOKCHEF',
  laboratory: 'LABORATORY',
  knigoland: 'KNIGOLAND',
  megakniga: 'MEGAKNIGA',
};

/** Reverse map from the persisted provider enum to its public slug. */
export const PROVIDER_SLUG: Record<DbProvider, ProviderName> = {
  YAKABOO: 'yakaboo',
  BOOK_CLUB: 'book-club',
  VIVAT: 'vivat',
  BOOK_YE: 'book-ye',
  BOOKCHEF: 'bookchef',
  LABORATORY: 'laboratory',
  KNIGOLAND: 'knigoland',
  MEGAKNIGA: 'megakniga',
};

/** Reverse map from the persisted availability enum to its public slug. */
export const AVAILABILITY_SLUG: Record<DbAvailability, Availability> = {
  IN_STOCK: 'in-stock',
  OUT_OF_STOCK: 'out-of-stock',
  UNKNOWN: 'unknown',
};

/** A listing counts as priced only when it carries a usable numeric amount. */
export function hasPrice(listing: { readonly priceAmount: number }): boolean {
  return listing.priceAmount != null && Number.isFinite(listing.priceAmount);
}
