import type { RawProviderListing, ScraperLogger } from '@knyhovo/shared';
import type { HtmlFetcher } from '../http/html-fetcher.js';
import { sanitizeDescription } from './sanitize-description.js';

/** Emit a progress line every this many listings during the enrichment pass. */
const PROGRESS_LOG_EVERY = 100;

export interface EnrichDescriptionsOptions {
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
 * Per-book product-page description enrichment pass (W9a F2).
 *
 * Sequentially fetches each listing's product page, extracts a raw description
 * with the provider-specific `extract` fn, sanitizes it to plain text, and
 * writes it back onto the listing. RawProviderListing is readonly, so the array
 * element is replaced rather than mutated; `listings` is updated in place.
 *
 * Resilience (W9a + security rules):
 *   - errors are collected into opts.errors, never thrown;
 *   - a failed/missing/empty description leaves the listing unchanged (null);
 *   - on an HTTP 429/503 the pass stops early for this provider, keeping every
 *     listing and description gathered so far — no retry loop.
 */
export async function enrichDescriptions(
  listings: RawProviderListing[],
  fetcher: HtmlFetcher,
  extract: (html: string) => string | null,
  opts: EnrichDescriptionsOptions,
): Promise<void> {
  const { timeoutMs, delayMs, errors } = opts;
  const logger = opts.logger ?? { info: () => {} };
  const total = listings.length;
  const errorsBefore = errors.length;
  let enriched = 0;
  let skipped = 0;

  logger.info(`description enrichment: starting for ${total} listings (delayMs=${delayMs})`);

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]!;

    // Already enriched — either the listing carries a description from the
    // catalog pass, or a previous run stored one (skipUrls). No fetch, no delay.
    if (
      (listing.description != null && listing.description !== '') ||
      opts.skipUrls?.has(listing.url) === true
    ) {
      skipped++;
      continue;
    }

    logger.info(`description enrichment [${i + 1}/${total}]: fetching ${listing.url}`);
    try {
      const html = await fetcher.fetch(listing.url, timeoutMs);
      const description = sanitizeDescription(extract(html));
      if (description !== null) {
        listings[i] = { ...listing, description };
        enriched++;
      }
    } catch (err) {
      errors.push(
        `Description ${listing.url}: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Stop this provider's pass on rate-limit/overload — keep what we have,
      // do not retry. The scrape result remains valid.
      if (isRateLimited(err)) {
        logger.info(
          `description enrichment: stopping early at ${i + 1}/${total} (rate-limited); ` +
            `${enriched} descriptions kept`,
        );
        break;
      }
    }

    if ((i + 1) % PROGRESS_LOG_EVERY === 0) {
      logger.info(
        `description enrichment: progress ${i + 1}/${total} ` +
          `(descriptions=${enriched}, skipped=${skipped}, errors=${errors.length - errorsBefore})`,
      );
    }

    if (delayMs > 0 && i < listings.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  logger.info(
    `description enrichment: done — ${enriched}/${total} descriptions ` +
      `(${skipped} skipped as already enriched), ${errors.length - errorsBefore} errors`,
  );
}
