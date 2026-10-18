import type { Availability, ProviderName } from '@knyhovo/shared';
import type { MoneyDto } from './money.js';
import { AVAILABILITY_SLUG, PROVIDER_SLUG, hasPrice } from './provider-maps.js';
import type { DbAvailability, DbProvider } from './provider-maps.js';

/** The listing fields needed to build a shown offer. */
export interface OfferListing {
  readonly provider: DbProvider;
  readonly priceAmount: number;
  readonly priceCurrency: 'UAH';
  readonly availability: DbAvailability;
  readonly url: string;
  readonly lastSeenAt: Date;
}

/** A provider offer as exposed by the books and wishlist endpoints. */
export interface OfferDto {
  readonly provider: ProviderName;
  readonly price: MoneyDto;
  readonly availability: Availability;
  readonly url: string;
  /** ISO 8601 timestamp of the last scrape that saw this listing. */
  readonly lastSeenAt: string;
}

/**
 * Listings we are willing to SHOW as offers: priced and not OUT_OF_STOCK
 * (UNKNOWN included). Input order is preserved.
 */
export function eligibleListings<L extends { readonly priceAmount: number; readonly availability: DbAvailability }>(
  listings: readonly L[],
): L[] {
  return listings.filter(hasPrice).filter((l) => l.availability !== 'OUT_OF_STOCK');
}

/** Shown offers (see {@link eligibleListings}) mapped to DTOs, sorted by ascending price. */
export function toOfferDtos(listings: readonly OfferListing[]): OfferDto[] {
  return eligibleListings(listings)
    .map((l) => ({
      provider: PROVIDER_SLUG[l.provider],
      price: { amount: l.priceAmount, currency: l.priceCurrency } satisfies MoneyDto,
      availability: AVAILABILITY_SLUG[l.availability],
      url: l.url,
      lastSeenAt: l.lastSeenAt.toISOString(),
    }))
    .sort((a, b) => a.price.amount - b.price.amount);
}
