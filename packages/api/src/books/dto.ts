import type { ProviderName, Availability } from '@knyhovo/shared';

/**
 * Book Details v1.0 response contract.
 *
 * These DTOs are the *only* shape exposed to API consumers. No Prisma model
 * type is ever returned from the books endpoint — the repository/mapper layers
 * translate persistence rows into these structures.
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

export interface BookProviderDto {
  /** Provider slug, e.g. `'yakaboo'` or `'book-club'`. */
  readonly provider: ProviderName;
  readonly price: MoneyDto;
  readonly availability: Availability;
  /** Direct URL to the book's page on the provider's site. */
  readonly url: string;
  /** ISO 8601 timestamp of the last scrape that saw this listing. */
  readonly lastSeenAt: string;
}

export interface BookDetailsDto {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly isbn: string | null;
  /**
   * Sanitized plain-text description selected across the book's provider
   * listings (W9a F2). null when no provider has an enriched description.
   */
  readonly description: string | null;
  /** Always null — column does not exist in DB. Reserved for future use. */
  readonly coverUrl: string | null;
  /** Minimum available provider price. null when there are no available offers. */
  readonly lowestPrice: MoneyDto | null;
  /** Number of available provider offers included in `providers`. */
  readonly offersCount: number;
  /** Available provider offers, sorted by ascending price. */
  readonly providers: readonly BookProviderDto[];
}
