import type { RawProviderListing, ScraperLogger } from '@knyhovo/shared';
import type { HtmlFetcher } from '../http/html-fetcher.js';
import { sanitizeDescription } from './sanitize-description.js';

/** Emit a progress line every this many listings during the enrichment pass. */
const PROGRESS_LOG_EVERY = 100;

/**
 * Edition metadata a provider-specific extractor may pull off a product page
 * (book-metadata PRD). All fields are optional/nullable — a provider that has
 * no structured source for a field (or whose extractor hasn't been built yet)
 * simply omits it, and the listing stays null for that field.
 */
export interface ExtractedListingMetadata {
  /** null/omitted when the product page carries no usable ISBN. */
  readonly isbn?: string | null;
  /** Publisher as provider text, as-is. */
  readonly publisher?: string | null;
  /** Language as provider text, as-is. */
  readonly language?: string | null;
  /** Format/cover type as provider text, as-is. */
  readonly format?: string | null;
  /** Series as provider text, as-is. */
  readonly series?: string | null;
  readonly publicationYear?: number | null;
}

/** Everything a provider-specific extractor can pull from one product-page HTML. */
export interface ExtractedProductDetails {
  /** Raw (possibly HTML) description fragment; sanitized by the enrichment pass. */
  readonly description: string | null;
  /** Edition metadata, or null when the page carries no structured metadata source. */
  readonly metadata: ExtractedListingMetadata | null;
  /**
   * Raw provider-native category/breadcrumb signals, root→leaf (genres-taxonomy
   * PRD G2), for providers whose only category source is the product page (e.g.
   * Megakniga's breadcrumb, only available via this opt-in pass — unlike
   * sitemap-driven providers, which extract it "for free" in the catalog parser).
   * Optional/omitted for providers with no such source; never overwrites a
   * listing that already carries categories (see {@link mergeMetadata}).
   */
  readonly rawCategories?: readonly string[] | null;
}

/** Provider-specific product-page extractor: HTML in, extracted details out. Pure, never throws. */
export type ProductDetailsExtract = (html: string) => ExtractedProductDetails;

export interface EnrichProductDetailsOptions {
  /** Per-request timeout in milliseconds (same value as the catalog pass). */
  readonly timeoutMs: number;
  /** Delay between consecutive product-page requests, in milliseconds. */
  readonly delayMs: number;
  /** Mutable error sink — fetch/extract failures are collected here, never thrown. */
  readonly errors: string[];
  /** Progress sink; the pass is silent when omitted. */
  readonly logger?: ScraperLogger;
  /**
   * Product URLs that already have a stored description (e.g. from a previous
   * run) — these listings are skipped without a fetch or throttle delay.
   */
  readonly skipUrls?: ReadonlySet<string>;
  /**
   * Predicate deciding whether a listing is already fully enriched in-memory and
   * can be skipped without a fetch/delay. Defaults to "has a non-empty
   * description" (the original W9a F2 behavior); providers whose extractor also
   * finds metadata pass a stricter predicate so re-runs still backfill metadata
   * on listings that only have a description.
   */
  readonly skipListing?: (listing: RawProviderListing) => boolean;
  /**
   * Cooperative cancellation for graceful shutdown (megakniga-resumable-
   * enrichment PRD §4.7). Checked at the TOP of every iteration, so an
   * in-flight fetch is allowed to finish (bounded by `timeoutMs`) but no new
   * one is started once the signal fires. The pass then returns with
   * `stopReason: 'aborted'` and a `processedCount` of the listings it fully
   * handled — the caller's safe resume point.
   */
  readonly signal?: AbortSignal;
  /**
   * Circuit breaker (megakniga-resumable-enrichment PRD §4 / bookchef-style
   * resilience): stop the pass after this many CONSECUTIVE infrastructure
   * failures (timeout / connection refused / DNS / 5xx — see
   * {@link isInfrastructureFailure}), so a mass site outage does not walk the
   * entire catalog fetch-failing every page. Any successful fetch resets the
   * counter. Undefined disables the breaker (the original behavior). 429/503
   * stay a SEPARATE rate-limit stop, never counted here.
   */
  readonly maxConsecutiveFailures?: number;
}

/**
 * Why {@link enrichProductDetails} stopped walking its listings:
 *   - `complete`        — every listing was handled;
 *   - `rate-limited`    — a 429/503 halted the pass (resume later);
 *   - `aborted`         — the {@link EnrichProductDetailsOptions.signal} fired;
 *   - `circuit-breaker` — too many consecutive infrastructure failures.
 */
export type EnrichStopReason = 'complete' | 'rate-limited' | 'aborted' | 'circuit-breaker';

export interface EnrichProductDetailsResult {
  /**
   * Listings the pass fully handled (fetched — success or non-fatal error — or
   * skipped as already enriched), in order from the front of `listings`. It
   * EXCLUDES the item that tripped a rate-limit or the circuit breaker, and any
   * left unreached by an abort. The caller advances its cursor by exactly this
   * many rows on a clean/aborted stop.
   */
  readonly processedCount: number;
  readonly stopReason: EnrichStopReason;
}

/** Default skip predicate — preserves the original description-only behavior. */
function defaultSkipListing(listing: RawProviderListing): boolean {
  return listing.description != null && listing.description !== '';
}

/**
 * True when an error looks like an HTTP 429 (Too Many Requests) or 503
 * (Service Unavailable) response — the signal to stop the enrichment pass.
 */
export function isRateLimited(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\b(429|503)\b/.test(message);
}

/**
 * True when an error looks like a transport / server-side infrastructure
 * failure — a timeout, connection refused/reset, DNS failure, or a 5xx that is
 * NOT the 503 rate-limit signal. These are what a mass site outage produces;
 * the circuit breaker counts CONSECUTIVE occurrences of them
 * (megakniga-resumable-enrichment PRD §4). A 429/503 is deliberately excluded
 * (it is the separate {@link isRateLimited} stop), as are content/extract
 * errors that are specific to one page rather than the site being down.
 */
export function isInfrastructureFailure(err: unknown): boolean {
  if (isRateLimited(err)) return false;
  const message = err instanceof Error ? err.message : String(err);
  return /\b(500|502|504)\b|timeout|timed out|ETIMEDOUT|ECONNREFUSED|ECONNRESET|EPIPE|ENOTFOUND|EAI_AGAIN|getaddrinfo|socket hang up|network|fetch failed/i.test(
    message,
  );
}

function isUsableString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isUsableYear(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isUsableCategories(
  value: readonly string[] | null | undefined,
): value is readonly string[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Merge extracted metadata (and, when present, raw categories) onto a listing.
 * Each field is applied only when usable; `isbn` fills ONLY when the listing's
 * current isbn is null/empty, and `rawCategories` fills ONLY when the listing
 * doesn't already carry any — enrichment never overwrites catalog-provided
 * signals. Returns the merged listing plus whether at least one field actually
 * changed.
 */
function mergeMetadata(
  listing: RawProviderListing,
  extracted: ExtractedProductDetails,
): { listing: RawProviderListing; changed: boolean } {
  const metadata = extracted.metadata;

  let changed = false;
  const patch: {
    isbn?: string;
    publisher?: string;
    language?: string;
    format?: string;
    series?: string;
    publicationYear?: number;
    rawCategories?: readonly string[];
  } = {};

  if (metadata !== null) {
    if (isUsableString(metadata.publisher)) {
      patch.publisher = metadata.publisher;
      changed = true;
    }
    if (isUsableString(metadata.language)) {
      patch.language = metadata.language;
      changed = true;
    }
    if (isUsableString(metadata.format)) {
      patch.format = metadata.format;
      changed = true;
    }
    if (isUsableString(metadata.series)) {
      patch.series = metadata.series;
      changed = true;
    }
    if (isUsableYear(metadata.publicationYear)) {
      patch.publicationYear = metadata.publicationYear;
      changed = true;
    }
    if ((listing.isbn == null || listing.isbn === '') && isUsableString(metadata.isbn)) {
      patch.isbn = metadata.isbn;
      changed = true;
    }
  }

  if (
    (listing.rawCategories == null || listing.rawCategories.length === 0) &&
    isUsableCategories(extracted.rawCategories)
  ) {
    patch.rawCategories = extracted.rawCategories;
    changed = true;
  }

  if (!changed) return { listing, changed: false };
  return { listing: { ...listing, ...patch }, changed: true };
}

/**
 * Per-book product-page enrichment pass (W9a F2, generalized by the
 * book-metadata PRD to also extract edition metadata from the same fetch).
 *
 * Sequentially fetches each listing's product page, extracts a raw
 * description + optional metadata with the provider-specific `extract` fn,
 * sanitizes the description to plain text, merges usable metadata fields, and
 * writes the result back onto the listing. RawProviderListing is readonly, so
 * the array element is replaced rather than mutated; `listings` is updated in place.
 *
 * Resilience (W9a + security rules):
 *   - errors are collected into opts.errors, never thrown;
 *   - a failed/missing/empty description or metadata field leaves the
 *     corresponding listing field unchanged (null);
 *   - on an HTTP 429/503 the pass stops early for this provider, keeping every
 *     listing and value gathered so far — no retry loop.
 */
export async function enrichProductDetails(
  listings: RawProviderListing[],
  fetcher: HtmlFetcher,
  extract: ProductDetailsExtract,
  opts: EnrichProductDetailsOptions,
): Promise<EnrichProductDetailsResult> {
  const { timeoutMs, delayMs, errors } = opts;
  const logger = opts.logger ?? { info: () => {} };
  const skipListing = opts.skipListing ?? defaultSkipListing;
  const total = listings.length;
  const errorsBefore = errors.length;
  let enriched = 0;
  let skipped = 0;
  // Listings the pass has fully handled — the caller's safe resume prefix. It
  // is NOT incremented for the item that trips a rate-limit or the breaker, nor
  // for any left unreached by an abort (those must be re-walked).
  let processedCount = 0;
  let consecutiveInfraFailures = 0;
  let stopReason: EnrichStopReason = 'complete';

  logger.info(`product enrichment: starting for ${total} listings (delayMs=${delayMs})`);

  for (let i = 0; i < listings.length; i++) {
    // Graceful shutdown (PRD §4.7): the signal is honored at the TOP of the
    // loop, so the previous fetch (awaited already) has finished and nothing
    // new starts. Everything gathered so far stays; the caller resumes from
    // processedCount.
    if (opts.signal?.aborted === true) {
      stopReason = 'aborted';
      logger.info(
        `product enrichment: aborted at ${processedCount}/${total} (graceful shutdown); ` +
          `${enriched} listings enriched`,
      );
      break;
    }

    const listing = listings[i]!;

    // Already enriched — either the listing satisfies skipListing (e.g. carries
    // a description from the catalog pass or a previous run), or its URL is in
    // skipUrls (already enriched in a previous run). No fetch, no delay. It is
    // still counted as processed (safely past for the caller's cursor).
    if (skipListing(listing) || opts.skipUrls?.has(listing.url) === true) {
      skipped++;
      processedCount++;
      continue;
    }

    logger.info(`product enrichment [${i + 1}/${total}]: fetching ${listing.url}`);
    try {
      const html = await fetcher.fetch(listing.url, timeoutMs);
      const extracted = extract(html);
      const description = sanitizeDescription(extracted.description);

      // The extractor is responsible for sanitizing its own metadata values
      // (e.g. vivat.parser.ts runs sanitizeMetadataValue/parsePublicationYear at
      // its own scrape boundary) — this pass only checks field-level usability
      // before merging, per provider-agnostic contract of ExtractedListingMetadata.
      const { listing: merged, changed: metadataChanged } = mergeMetadata(listing, extracted);
      let next = merged;
      let descriptionChanged = false;
      if (description !== null) {
        next = { ...next, description };
        descriptionChanged = true;
      }

      if (descriptionChanged || metadataChanged) {
        listings[i] = next;
        enriched++;
      }
      // A successful fetch clears the infrastructure-failure streak.
      consecutiveInfraFailures = 0;
    } catch (err) {
      errors.push(
        `Product ${listing.url}: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Stop this provider's pass on rate-limit/overload — keep what we have,
      // do not retry. The scrape result remains valid. The offending item is
      // NOT counted as processed (its cursor must be re-walked).
      if (isRateLimited(err)) {
        stopReason = 'rate-limited';
        logger.info(
          `product enrichment: stopping early at ${i + 1}/${total} (rate-limited); ` +
            `${enriched} listings enriched`,
        );
        break;
      }
      // Circuit breaker (PRD §4): a run of infrastructure failures means the
      // site is down — stop rather than fetch-fail the whole catalog. The
      // tripping item is left un-processed so the resumed run re-walks the tail.
      if (isInfrastructureFailure(err) && opts.maxConsecutiveFailures !== undefined) {
        consecutiveInfraFailures++;
        if (consecutiveInfraFailures >= opts.maxConsecutiveFailures) {
          stopReason = 'circuit-breaker';
          logger.info(
            `product enrichment: circuit breaker tripped at ${i + 1}/${total} ` +
              `(${consecutiveInfraFailures} consecutive infrastructure failures); ` +
              `${enriched} listings enriched`,
          );
          break;
        }
      } else if (!isInfrastructureFailure(err)) {
        // A page-specific (non-infrastructure) error does not signal an outage;
        // it must not keep the breaker armed across otherwise-healthy fetches.
        consecutiveInfraFailures = 0;
      }
    }

    processedCount++;

    if ((i + 1) % PROGRESS_LOG_EVERY === 0) {
      logger.info(
        `product enrichment: progress ${i + 1}/${total} ` +
          `(enriched=${enriched}, skipped=${skipped}, errors=${errors.length - errorsBefore})`,
      );
    }

    if (delayMs > 0 && i < listings.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  logger.info(
    `product enrichment: done — ${enriched}/${total} listings enriched ` +
      `(${skipped} skipped as already enriched), ${errors.length - errorsBefore} errors` +
      `${stopReason === 'complete' ? '' : ` (stopped: ${stopReason})`}`,
  );
  return { processedCount, stopReason };
}
