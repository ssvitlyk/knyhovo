import type { CanonicalBookId, ProviderListingId } from './ids.js';
import type { ISBN } from './book.js';
import type { Money } from './money.js';

/**
 * Known provider slugs. Extend this union when a new scraper is added.
 * The slug is used as a stable identifier across ProviderListing, ScraperProvider, and ScraperResult.
 */
export type ProviderName =
  | 'yakaboo'
  | 'book-club'
  | 'vivat'
  | 'book-ye'
  | 'bookchef'
  | 'laboratory'
  | 'knigoland'
  | 'megakniga';

/**
 * Stock availability as reported by a provider at scrape time.
 * Canonical matching and DB persistence happen after this — availability
 * is a raw observation, not a guarantee.
 */
export type Availability = 'in-stock' | 'out-of-stock' | 'unknown';

/**
 * Minimal logging sink a scraper can write progress/metrics to. Structurally
 * compatible with the API's richer `Logger` (which also has `error`), so callers
 * can pass their existing logger straight through. Providers default to a no-op
 * when none is supplied, so logging never becomes a hard dependency.
 */
export interface ScraperLogger {
  info(message: string): void;
}

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
  /**
   * How many product/page requests to run in parallel (providers that fetch many
   * independent pages, e.g. sitemap-driven ones). Provider default applies when omitted.
   */
  concurrency?: number;
  /**
   * Emergency wall-clock ceiling for a single scrape() call, in milliseconds. A
   * safety net, not the normal completion path: on exceed the provider returns a
   * partial result plus an error rather than hanging. Provider default applies when omitted.
   */
  maxRuntimeMs?: number;
  /**
   * How many times to retry a transient per-request failure (429 / timeout /
   * connection reset) with exponential backoff. Provider default applies when omitted.
   */
  maxRetries?: number;
  /** Optional sink for progress and run-metrics logging. No-op when omitted. */
  logger?: ScraperLogger;
  /**
   * Opt-in: run a per-book product-page fetch pass to enrich listings with descriptions (W9a F2).
   * Defaults to false — a normal catalog scrape performs no product-page requests.
   */
  enrichDescriptions?: boolean;
  /**
   * Delay between consecutive product-page requests during the description enrichment pass, in ms.
   * Falls back to delayMs when omitted. Product pages warrant a more aggressive throttle than catalog pages.
   */
  descriptionDelayMs?: number;
  /**
   * Product URLs whose listings already carry a stored description; the
   * description-enrichment pass skips fetching these product pages entirely.
   * Ignored when enrichDescriptions is off.
   */
  skipDescriptionUrls?: ReadonlySet<string>;
  /**
   * Per-URL watermark of the last successfully processed sitemap `lastmod`
   * (ISO 8601 string), keyed by product URL. When provided, a sitemap-incremental
   * scraper fetches only sitemap entries that are new or whose `lastmod` is newer
   * than the known value; everything else is skipped as unchanged. Omitted →
   * full scrape (existing behavior, every discovered URL is fetched).
   */
  knownSourceLastmod?: ReadonlyMap<string, string>;
  /**
   * Temporary per-page stage logging (fetch/parse/sleep) for hang diagnosis.
   * Scrapers may ignore it. Off by default.
   */
  debugFetchStages?: boolean;
  /**
   * Per-request timeout in milliseconds for the sitemap discovery fetch of
   * sitemap-driven providers. Provider default applies when omitted.
   */
  sitemapTimeoutMs?: number;
  /**
   * Circuit-breaker threshold: abort the run after this many consecutive
   * network/timeout product-fetch failures in a row. Provider default
   * applies when omitted.
   */
  maxConsecutiveFetchFailures?: number;
}

/**
 * A single `<url>` entry from a provider's sitemap: the product `<loc>` and its
 * optional `<lastmod>`, normalized to ISO 8601 UTC. `lastmod` is null when the
 * sitemap omitted it or it could not be parsed — callers must treat that as "no
 * signal" (fail open to fetching), never as "unchanged".
 */
export type SitemapEntry = {
  readonly url: string;
  readonly lastmod: string | null;
};

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
  /**
   * Cover image URL extracted from the provider's catalog card.
   * Optional and nullable: omitted/null when the card exposed no usable image.
   * Sourced from the listing card only — no product-page fetch (W9a F1).
   */
  readonly coverUrl?: string | null;
  /**
   * Sanitized plain-text description from the provider's product page (W9a F2).
   * Optional and nullable: omitted/null unless the opt-in enrichment pass ran and found one.
   */
  readonly description?: string | null;
  /**
   * Publisher as provider text, as-is (book-metadata PRD). Optional and nullable:
   * omitted/null unless the opt-in product-page enrichment pass ran and found one.
   */
  readonly publisher?: string | null;
  /**
   * Language as provider text, as-is (book-metadata PRD). Optional and nullable:
   * omitted/null unless the opt-in product-page enrichment pass ran and found one.
   */
  readonly language?: string | null;
  /**
   * Format/cover type as provider text, as-is (book-metadata PRD). Optional and
   * nullable: omitted/null unless the opt-in product-page enrichment pass ran and found one.
   */
  readonly format?: string | null;
  /**
   * Series as provider text, as-is (book-metadata PRD). Optional and nullable:
   * omitted/null unless the opt-in product-page enrichment pass ran and found one.
   */
  readonly series?: string | null;
  /**
   * Publication year (book-metadata PRD). Optional and nullable: omitted/null
   * unless the opt-in product-page enrichment pass ran and found one.
   */
  readonly publicationYear?: number | null;
  /**
   * Raw provider-native category/breadcrumb signals, root→leaf, uncanonicalized
   * (genres-taxonomy PRD G2). Optional/nullable: omitted/null when the provider
   * has no extraction wired up or the page carried no signal this scrape.
   */
  readonly rawCategories?: readonly string[] | null;
  /**
   * Sitemap `lastmod` (ISO 8601, normalized to UTC) of the sitemap entry this
   * listing was discovered from, for sitemap-incremental scrapers. Optional and
   * nullable: omitted/null for non-sitemap-driven providers or when the sitemap
   * entry carried no `lastmod`.
   */
  readonly sourceLastmod?: string | null;
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
  /**
   * Sanitized plain-text description scraped from the provider's product page (W9a F2).
   * null when no usable description has been enriched yet.
   */
  readonly description: string | null;
  /**
   * Publisher as provider text, as-is (book-metadata PRD). null when not yet enriched.
   */
  readonly publisher: string | null;
  /**
   * Language as provider text, as-is (book-metadata PRD). null when not yet enriched.
   */
  readonly language: string | null;
  /**
   * Format/cover type as provider text, as-is (book-metadata PRD). null when not yet enriched.
   */
  readonly format: string | null;
  /**
   * Series as provider text, as-is (book-metadata PRD). null when not yet enriched.
   */
  readonly series: string | null;
  /**
   * Publication year (book-metadata PRD). null when not yet enriched.
   */
  readonly publicationYear: number | null;
  /**
   * Raw provider-native category/breadcrumb signals, root→leaf
   * (genres-taxonomy PRD G2). [] when no signal has been collected yet.
   */
  readonly rawCategories: readonly string[];
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
  /**
   * The full presence list from a successfully parsed sitemap, for
   * sitemap-driven providers. Always the complete sitemap (never just the
   * fetched subset), regardless of full vs. incremental mode — the pipeline
   * uses it for presence bookkeeping and shadow validation. Omitted when the
   * provider is not sitemap-driven or the sitemap failed to parse.
   */
  readonly sitemap?: { readonly entries: ReadonlyArray<SitemapEntry> };
}
