import type { Money, Availability, RawProviderListing } from '@knyhovo/shared';

/** Result of parsing one catalog listing page into raw provider listings. */
export interface CatalogPageResult {
  readonly listings: RawProviderListing[];
  readonly errors: string[];
  /** True when the page contained at least one card/product (paginator should fetch next page). */
  readonly hasNextPage: boolean;
}

/** Result of parsing a single product page into one raw provider listing. */
export interface ProductPageResult {
  /**
   * The parsed listing, or null when the page lacked a usable product block (or
   * was deliberately skipped, e.g. a non-book — then `errors` stays empty).
   */
  readonly listing: RawProviderListing | null;
  readonly errors: string[];
}

/** Price and availability read from a product page (refresh path). */
export interface ParsedProductState {
  readonly price: Money | null;
  readonly availability: Availability;
}

export type SingleProductParser = (html: string) => ParsedProductState;
