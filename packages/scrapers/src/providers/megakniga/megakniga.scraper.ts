import type {
  ScraperProvider,
  ScraperResult,
  ScraperOptions,
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
import { paginateCatalog } from '../../lib/paginate-catalog.js';
import { NOOP_LOGGER } from '../../lib/noop-logger.js';

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
 * catalog scrape returns every listing with `isbn: null`. The provider declares
 * `enrichmentMode: 'background'` (megakniga-resumable-enrichment PRD): the
 * pipeline strips `enrichDescriptions` for it, and product-page details are
 * filled by the API's batch-committing `scrape:enrich` job over persisted
 * listings — an in-memory pass over the ~27k catalog loses hours of work on
 * any interruption. The inline pass below stays functional for direct/test
 * callers, but is not reachable through the production pipeline.
 */
export class MegaknigaScraper implements ScraperProvider {
  readonly name = 'megakniga' as const;
  readonly enrichmentMode = 'background' as const;

  constructor(private readonly fetcher: HtmlFetcher = new FetchHtmlFetcher()) {}

  async scrape(options?: ScraperOptions): Promise<ScraperResult> {
    const scrapedAt = new Date().toISOString();
    const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
    const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
    const logger = options?.logger ?? NOOP_LOGGER;

    const retryingFetcher = withRetry(this.fetcher, maxRetries);

    const errors: string[] = [];

    logger.info(`megakniga: catalog pass starting (maxPages=${maxPages}, delayMs=${delayMs})`);

    // Stop when the page contributed zero NEW urls. A genuinely empty page
    // (hasNextPage false) always has zero new urls too, so this single check
    // covers both the "empty page" and "paginator repeats the last page"
    // stop conditions (recon §7).
    const { listings: allListings, pagesFetched } = await paginateCatalog({
      maxPages,
      delayMs,
      errors,
      buildUrl: buildListingUrl,
      fetch: (url) => retryingFetcher.fetch(url, timeoutMs),
      parse: parseMegaknigaListing,
      stopWhenNoNewListings: true,
      onPageStart: (page, url) => {
        logger.info(`megakniga: fetching catalog page ${page}/${maxPages} — ${url}`);
      },
    });

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
