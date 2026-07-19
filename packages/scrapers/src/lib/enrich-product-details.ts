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
): Promise<void> {
  const { timeoutMs, delayMs, errors } = opts;
  const logger = opts.logger ?? { info: () => {} };
  const skipListing = opts.skipListing ?? defaultSkipListing;
  const total = listings.length;
  const errorsBefore = errors.length;
  let enriched = 0;
  let skipped = 0;

  logger.info(`product enrichment: starting for ${total} listings (delayMs=${delayMs})`);

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i]!;

    // Already enriched — either the listing satisfies skipListing (e.g. carries
    // a description from the catalog pass or a previous run), or its URL is in
    // skipUrls (already enriched in a previous run). No fetch, no delay.
    if (skipListing(listing) || opts.skipUrls?.has(listing.url) === true) {
      skipped++;
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
    } catch (err) {
      errors.push(
        `Product ${listing.url}: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Stop this provider's pass on rate-limit/overload — keep what we have,
      // do not retry. The scrape result remains valid.
      if (isRateLimited(err)) {
        logger.info(
          `product enrichment: stopping early at ${i + 1}/${total} (rate-limited); ` +
            `${enriched} listings enriched`,
        );
        break;
      }
    }

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
      `(${skipped} skipped as already enriched), ${errors.length - errorsBefore} errors`,
  );
}
