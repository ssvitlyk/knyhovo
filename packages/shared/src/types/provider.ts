import type { CanonicalBookId, ProviderListingId } from './ids.js';
import type { ISBN } from './book.js';
import type { Money } from './money.js';

/**
 * Known provider slugs. Extend this union when a new scraper is added.
 * The slug is used as a stable identifier across ProviderListing, ScraperProvider, and ScraperResult.
 */
export type ProviderName = 'yakaboo' | 'book-club';

/**
 * Stock availability as reported by a provider at scrape time.
 * Canonical matching and DB persistence happen after this — availability
 * is a raw observation, not a guarantee.
 */
export type Availability = 'in-stock' | 'out-of-stock' | 'unknown';

/**
 * Tuning knobs passed to ScraperProvider.scrape().
 * All fields are optional — providers use sensible defaults when omitted.
 */
export interface ScraperOptions {
  /** Maximum number of catalog pages to fetch. Provider default applies when omitted. */
  maxPages?: number;
  /** Per-request timeout in milliseconds. Provider default applies when omitted. */
  timeoutMs?: number;
  /** Delay between consecutive page requests in milliseconds. Provider default applies when omitted. */
  delayMs?: number;
}

/**
 * Raw listing data as returned by the scraper layer, before canonical matching or DB persistence.
 * This is the output of a scraper run — it has no DB ids and no canonicalBookId.
 *
 * Contrast with ProviderListing, which is the persisted DB entity created after canonical matching.
 */
export interface RawProviderListing {
  readonly provider: ProviderName;
  /** Title as it appears on the provider's site. */
  readonly title: string;
  /** Author(s) as they appear on the provider's site. null when the provider does not expose an author. */
  readonly author: string | null;
  /** null when the provider page does not include an ISBN (e.g. catalog listing pages). */
  readonly isbn: ISBN;
  /** null when price is absent or could not be parsed. Amount is in the smallest currency unit (kopecks). */
  readonly price: Money | null;
  /** Direct URL to the book's page on the provider's site. */
  readonly url: string;
  readonly availability: Availability;
}

/**
 * A book entry as returned by a single provider (e.g. Yakaboo, BookClub).
 * One CanonicalBook may have multiple ProviderListings — one per provider that
 * carries the book.
 *
 * This is the persisted DB entity created after canonical matching.
 * Contrast with RawProviderListing, which is the pre-DB scraper output.
 */
export interface ProviderListing {
  readonly id: ProviderListingId;
  /** The canonical record this listing has been matched to. */
  readonly canonicalBookId: CanonicalBookId;
  readonly provider: ProviderName;
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
  /** Stock availability persisted from the last scrape that saw this listing. */
  readonly availability: Availability;
}

/**
 * Contract that every scraper provider must implement.
 * Adding a new provider means creating a new module that satisfies this interface —
 * no changes to the core pipeline are required.
 */
export interface ScraperProvider {
  readonly name: ProviderName;
  /** Fetch and parse current listings from the provider. Must not throw — collect errors into ScraperResult.errors instead. */
  scrape(options?: ScraperOptions): Promise<ScraperResult>;
}

/**
 * The result of one complete scrape run by a single provider.
 * Errors are collected rather than thrown so that a partial failure
 * does not discard successfully scraped listings.
 */
export interface ScraperResult {
  readonly provider: ProviderName;
  /** Raw listings from the scraper layer. No DB ids, no canonicalBookId. */
  readonly listings: RawProviderListing[];
  /** ISO 8601 timestamp of when the scrape was initiated. */
  readonly scrapedAt: string;
  /** Human-readable error messages for any listings that failed to parse or pages that failed to fetch. */
  readonly errors: string[];
}
