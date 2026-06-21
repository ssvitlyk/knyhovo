import type { RawProviderListing } from '@knyhovo/shared';
import type { HtmlFetcher } from '../http/html-fetcher.js';
import { sanitizeDescription } from './sanitize-description.js';

export interface EnrichDescriptionsOptions {
  /** Per-request timeout in milliseconds (same value as the catalog pass). */
  readonly timeoutMs: number;
  /** Delay between consecutive product-page requests, in milliseconds. */
  readonly delayMs: number;
  /** Mutable error sink — fetch/extract failures are collected here, never thrown. */
  readonly errors: string[];
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

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]!;
    try {
      const html = await fetcher.fetch(listing.url, timeoutMs);
      const description = sanitizeDescription(extract(html));
      if (description !== null) {
        listings[i] = { ...listing, description };
      }
    } catch (err) {
      errors.push(
        `Description ${listing.url}: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Stop this provider's pass on rate-limit/overload — keep what we have,
      // do not retry. The scrape result remains valid.
      if (isRateLimited(err)) break;
    }

    if (delayMs > 0 && i < listings.length - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
