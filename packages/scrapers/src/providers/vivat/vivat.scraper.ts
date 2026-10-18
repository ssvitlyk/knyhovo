import type { ScraperProvider, ScraperResult, ScraperOptions } from '@knyhovo/shared';
import { FetchHtmlFetcher, type HtmlFetcher } from '../../http/html-fetcher.js';
import { VIVAT_CATALOG_URL } from './constants.js';
import { parseVivatPage, extractVivatProductDetails } from './vivat.parser.js';
import { enrichProductDetails } from '../../lib/enrich-product-details.js';
import { paginateCatalog } from '../../lib/paginate-catalog.js';
import { NOOP_LOGGER } from '../../lib/noop-logger.js';
import { DEFAULT_MAX_PAGES, DEFAULT_TIMEOUT_MS, DEFAULT_DELAY_MS } from '../../lib/defaults.js';

/**
 * Vivat catalog scraper. The catalog is server-rendered Next.js, so the default
 * FetchHtmlFetcher works (no Cloudflare challenge like Yakaboo). The fetcher is
 * injectable so tests substitute fixtures and prod can swap implementations.
 */
export class VivatScraper implements ScraperProvider {
  readonly name = 'vivat' as const;

  constructor(
    private readonly fetcher: HtmlFetcher = new FetchHtmlFetcher(),
    private readonly catalogUrl: string = VIVAT_CATALOG_URL,
  ) {}

  async scrape(options?: ScraperOptions): Promise<ScraperResult> {
    const scrapedAt = new Date().toISOString();
    const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
    const logger = options?.logger ?? NOOP_LOGGER;

    const errors: string[] = [];

    logger.info(`vivat: catalog pass starting (maxPages=${maxPages}, delayMs=${delayMs})`);

    const { listings: allListings, pagesFetched } = await paginateCatalog({
      maxPages,
      delayMs,
      errors,
      buildUrl: (page) => `${this.catalogUrl}?page=${page}`,
      fetch: (url) => this.fetcher.fetch(url, timeoutMs),
      parse: parseVivatPage,
      onPageStart: (page, url) => {
        logger.info(`vivat: fetching catalog page ${page}/${maxPages} — ${url}`);
      },
    });

    logger.info(
      `vivat: catalog pass done — ${allListings.length} listings from ${pagesFetched} pages ` +
        `(${errors.length} errors)`,
    );

    // Opt-in per-book product-page enrichment (W9a F2 description pass,
    // generalized by the book-metadata PRD to also extract edition metadata
    // from the same fetch). Off by default — a normal catalog scrape performs
    // no product-page requests.
    // NOTE: sequential by design (one product page per listing + throttle), so a
    // full-catalog pass takes tens of minutes; progress is logged inside.
    if (options?.enrichDescriptions) {
      await enrichProductDetails(allListings, this.fetcher, extractVivatProductDetails, {
        timeoutMs,
        delayMs: options.descriptionDelayMs ?? delayMs,
        errors,
        logger,
        // Vivat extracts metadata too — a listing is only "done" once it has
        // both a description AND publisher, so a re-run backfills metadata on
        // listings enriched before this PRD shipped (description-only).
        skipListing: (l) => l.description != null && l.description !== '' && l.publisher != null,
        ...(options.skipDescriptionUrls ? { skipUrls: options.skipDescriptionUrls } : {}),
      });
    }

    return { provider: 'vivat', listings: allListings, scrapedAt, errors };
  }
}
