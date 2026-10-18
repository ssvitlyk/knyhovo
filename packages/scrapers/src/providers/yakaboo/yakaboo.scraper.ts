import type { ScraperProvider, ScraperResult, ScraperOptions } from '@knyhovo/shared';
import { FetchHtmlFetcher, type HtmlFetcher } from '../../http/html-fetcher.js';
import { classifyBlockedPage, isForbiddenError } from '../../http/blocked-page.js';
import { YAKABOO_CATALOG_URL } from './constants.js';
import { parseYakabooPage, extractYakabooProductDescription } from './yakaboo.parser.js';
import { enrichProductDetails, type ExtractedProductDetails } from '../../lib/enrich-product-details.js';
import { errMsg } from '../../lib/errors.js';
import { paginateCatalog } from '../../lib/paginate-catalog.js';
import { NOOP_LOGGER } from '../../lib/noop-logger.js';
import { DEFAULT_MAX_PAGES, DEFAULT_TIMEOUT_MS, DEFAULT_DELAY_MS } from '../../lib/defaults.js';

export class YakabooScraper implements ScraperProvider {
  readonly name = 'yakaboo' as const;

  constructor(
    private readonly fetcher: HtmlFetcher = new FetchHtmlFetcher(),
    private readonly catalogUrl: string = YAKABOO_CATALOG_URL,
  ) {}

  async scrape(options?: ScraperOptions): Promise<ScraperResult> {
    const scrapedAt = new Date().toISOString();
    const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;

    const errors: string[] = [];

    const { listings: allListings, firstPageHtml } = await paginateCatalog({
      maxPages,
      delayMs,
      errors,
      buildUrl: (page) => `${this.catalogUrl}?page=${page}`,
      fetch: (url) => this.fetcher.fetch(url, timeoutMs),
      parse: parseYakabooPage,
      onFetchError: (err, page, errs) => {
        if (isForbiddenError(err)) {
          errs.push('Yakaboo blocked by HTTP 403, likely anti-bot protection');
        } else {
          errs.push(`Page ${page}: network error — ${errMsg(err)}`);
        }
      },
    });

    // When nothing was scraped, classify the first page so an empty result is
    // explained (anti-bot block vs. a legitimately empty catalog). A fetch that
    // threw a 403 is already reported above and leaves firstPageHtml null.
    if (allListings.length === 0 && firstPageHtml !== null) {
      const reason = classifyBlockedPage(firstPageHtml);
      if (reason === 'cloudflare-challenge') {
        errors.push('Yakaboo blocked by Cloudflare challenge, likely anti-bot protection');
      } else if (reason === 'forbidden') {
        errors.push('Yakaboo blocked by HTTP 403, likely anti-bot protection');
      }
    }

    // Opt-in per-book product-page description enrichment (W9a F2). Off by
    // default — a normal catalog scrape performs no product-page requests.
    // Yakaboo has no verified structured metadata source yet (book-metadata
    // PRD §3) — metadata stays null, description-only behavior is unchanged.
    if (options?.enrichDescriptions) {
      await enrichProductDetails(
        allListings,
        this.fetcher,
        (html): ExtractedProductDetails => ({
          description: extractYakabooProductDescription(html),
          metadata: null,
        }),
        {
          timeoutMs,
          delayMs: options.descriptionDelayMs ?? delayMs,
          errors,
          logger: options.logger ?? NOOP_LOGGER,
          ...(options.skipDescriptionUrls ? { skipUrls: options.skipDescriptionUrls } : {}),
        },
      );
    }

    return { provider: 'yakaboo', listings: allListings, scrapedAt, errors };
  }
}
