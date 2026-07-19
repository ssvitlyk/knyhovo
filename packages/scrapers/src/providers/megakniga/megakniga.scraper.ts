import type {
  ScraperProvider,
  ScraperResult,
  ScraperOptions,
  RawProviderListing,
} from '@knyhovo/shared';
import { FetchHtmlFetcher, type HtmlFetcher } from '../../http/html-fetcher.js';
import { fetchWithRetry } from '../../http/retry.js';
import {
  buildListingUrl,
  DEFAULT_MAX_PAGES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_DELAY_MS,
  DEFAULT_ENRICHMENT_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
} from './constants.js';
import { parseMegaknigaListing, extractMegaknigaProductDetails } from './megakniga.parser.js';
import { enrichProductDetails } from '../../lib/enrich-product-details.js';

/**
 * Wrap an `HtmlFetcher` so every `fetch()` call goes through `fetchWithRetry`
 * (exponential backoff on transient failures — 429/timeout/connection reset).
 * Non-retryable errors (e.g. 404/410) surface on the first attempt unchanged.
 * Used for both the catalog pagination loop and the enrichment pass, so retry
 * behavior is identical everywhere this scraper makes a request.
 */
function withRetry(fetcher: HtmlFetcher, maxRetries: number): HtmlFetcher {
  return {
    async fetch(url: string, timeoutMs: number): Promise<string> {
      const { html } = await fetchWithRetry(fetcher, url, timeoutMs, {
        maxRetries,
        baseDelayMs: DEFAULT_RETRY_BASE_DELAY_MS,
        maxDelayMs: DEFAULT_RETRY_MAX_DELAY_MS,
      });
      return html;
    },
  };
}

/**
 * Megakniga catalog scraper (Tier A, PRD approved 2026-07-19). The catalog is
 * server-rendered Yii2 (PHP) with no Cloudflare challenge (recon §2/§4), so the
 * default FetchHtmlFetcher works — same class of provider as Vivat.
 *
 * Discovery paginates `/catalog/knigi/pageN?per-page=64`. Unlike Vivat, an
 * empty-page `hasNextPage` check alone is not a safe stop condition: beyond the
 * last page Megakniga's paginator keeps returning the LAST page verbatim
 * (recon §7), so the loop stops when a page yields zero NEW urls (yakaboo-style
 * URL dedupe) — which also covers a genuinely empty page as a special case.
 *
 * ISBN is not present on catalog cards (only on product pages), so a normal
 * catalog scrape returns every listing with `isbn: null`; the opt-in
 * `enrichDescriptions` pass (same flag as every other provider) fetches each
 * product page to fill in ISBN/publisher/format/description/rawCategories.
 */
export class MegaknigaScraper implements ScraperProvider {
  readonly name = 'megakniga' as const;

  constructor(private readonly fetcher: HtmlFetcher = new FetchHtmlFetcher()) {}

  async scrape(options?: ScraperOptions): Promise<ScraperResult> {
    const scrapedAt = new Date().toISOString();
    const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const logger = options?.logger ?? { info: () => {} };

    const retryingFetcher = withRetry(this.fetcher, maxRetries);

    const allListings: RawProviderListing[] = [];
    const errors: string[] = [];
    const seenUrls = new Set<string>();

    logger.info(`megakniga: catalog pass starting (maxPages=${maxPages}, delayMs=${delayMs})`);

    let pagesFetched = 0;
    for (let page = 1; page <= maxPages; page++) {
      const url = buildListingUrl(page);
      logger.info(`megakniga: fetching catalog page ${page}/${maxPages} — ${url}`);

      let html: string;
      try {
        html = await retryingFetcher.fetch(url, timeoutMs);
      } catch (err) {
        errors.push(
          `Page ${page}: network error — ${err instanceof Error ? err.message : String(err)}`,
        );
        break;
      }
      pagesFetched = page;

      const { listings, errors: parseErrors, hasNextPage } = parseMegaknigaListing(html);
      errors.push(...parseErrors);

      let newCount = 0;
      for (const listing of listings) {
        if (!seenUrls.has(listing.url)) {
          seenUrls.add(listing.url);
          allListings.push(listing);
          newCount++;
        }
      }

      // Stop when the page contributed zero NEW urls. A genuinely empty page
      // (hasNextPage false) always has newCount 0 too, so this single check
      // covers both the "empty page" and "paginator repeats the last page"
      // stop conditions (recon §7).
      if (!hasNextPage || newCount === 0) break;

      if (page < maxPages && delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }

    logger.info(
      `megakniga: catalog pass done — ${allListings.length} listings from ${pagesFetched} pages ` +
        `(${errors.length} errors)`,
    );

    // Opt-in per-book product-page enrichment (ISBN/publisher/format/description/
    // rawCategories — PRD §2.3/§4). Off by default — a normal catalog scrape
    // performs no product-page requests.
    if (options?.enrichDescriptions) {
      await enrichProductDetails(allListings, retryingFetcher, extractMegaknigaProductDetails, {
        timeoutMs,
        delayMs: options.descriptionDelayMs ?? DEFAULT_ENRICHMENT_DELAY_MS,
        errors,
        logger,
        // A listing is only "done" once it has both a description AND publisher
        // (mirrors Vivat) — a re-run backfills metadata on listings enriched
        // before a metadata field was added.
        skipListing: (l) => l.description != null && l.description !== '' && l.publisher != null,
        ...(options.skipDescriptionUrls ? { skipUrls: options.skipDescriptionUrls } : {}),
      });
    }

    return { provider: 'megakniga', listings: allListings, scrapedAt, errors };
  }
}
