import type { CanonicalBookId, ProviderListingId } from './ids.js';
import type { ISBN } from './book.js';
import type { Money } from './money.js';

/**
 * A book entry as returned by a single provider (e.g. Yakaboo, BookClub).
 * One CanonicalBook may have multiple ProviderListings — one per provider that
 * carries the book.
 */
export interface ProviderListing {
  readonly id: ProviderListingId;
  /** The canonical record this listing has been matched to. */
  readonly canonicalBookId: CanonicalBookId;
  /** Provider slug, e.g. 'yakaboo' or 'book-club'. */
  readonly provider: string;
  /** Title as it appears on the provider's site (may differ from canonical title). */
  readonly title: string;
  /** Author as it appears on the provider's site. */
  readonly author: string;
  /** null when the provider page does not include an ISBN. */
  readonly isbn: ISBN;
  readonly price: Money;
  /** Direct URL to the book's page on the provider's site. */
  readonly url: string;
  /** ISO 8601 timestamp of the last successful scrape that found this listing. */
  readonly lastSeenAt: string;
}

/**
 * Contract that every scraper provider must implement.
 * Adding a new provider means creating a new module that satisfies this interface —
 * no changes to the core pipeline are required.
 */
export interface ScraperProvider {
  /** Unique provider slug used in ProviderListing.provider, e.g. 'yakaboo'. */
  readonly name: string;
  /** Fetch and parse current listings from the provider. Must not throw — collect errors into ScraperResult.errors instead. */
  scrape(): Promise<ScraperResult>;
}

/**
 * The result of one complete scrape run by a single provider.
 * Errors are collected rather than thrown so that a partial failure
 * does not discard successfully scraped listings.
 */
export interface ScraperResult {
  /** Provider slug, mirrors ScraperProvider.name. */
  readonly provider: string;
  readonly listings: ProviderListing[];
  /** ISO 8601 timestamp of when the scrape was initiated. */
  readonly scrapedAt: string;
  /** Human-readable error messages for any listings that failed to parse. */
  readonly errors: string[];
}
