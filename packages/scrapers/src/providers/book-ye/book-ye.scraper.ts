import type { ScraperProvider, ScraperResult, ScraperOptions } from '@knyhovo/shared';
import { type HtmlFetcher } from '../../http/html-fetcher.js';
import { PlaywrightHtmlFetcher } from '../../http/playwright-html-fetcher.js';
import { browserManager } from '../../http/browser-manager.js';
import { BOOK_YE_CATALOG_URL, PRODUCT_CARD_SELECTOR, CLOUDFLARE_CHALLENGE_SELECTOR } from './constants.js';
import { parseBookYePage, extractBookYeProductDescription } from './book-ye.parser.js';
import { enrichProductDetails, type ExtractedProductDetails } from '../../lib/enrich-product-details.js';
import { classifyBlockedPage } from '../../http/blocked-page.js';
import { paginateCatalog } from '../../lib/paginate-catalog.js';
import { DEFAULT_MAX_PAGES } from '../../lib/defaults.js';
import { NOOP_LOGGER } from '../../lib/noop-logger.js';

// Playwright + a content-aware wait (the Cloudflare challenge takes a few seconds
// to solve) needs a larger budget than the static-fetch providers.
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_DELAY_MS = 1_000;

/**
 * Книгарня «Є» catalog scraper. The site returns a Cloudflare JS challenge to a
 * plain fetch, so it requires a browser context: the default fetcher is a
 * PlaywrightHtmlFetcher told to wait for a product card to render (so the
 * challenge solves and redirects before the HTML is read). The fetcher is
 * injectable so tests substitute fixtures without touching the network.
 */
export class BookYeScraper implements ScraperProvider {
  readonly name = 'book-ye' as const;

  constructor(
    private readonly fetcher: HtmlFetcher = new PlaywrightHtmlFetcher(browserManager, {
      waitForSelector: PRODUCT_CARD_SELECTOR,
      challengeSelector: CLOUDFLARE_CHALLENGE_SELECTOR,
    }),
    private readonly catalogUrl: string = BOOK_YE_CATALOG_URL,
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
      buildUrl: (page) => `${this.catalogUrl}?p=${page}`,
      fetch: (url) => this.fetcher.fetch(url, timeoutMs),
      parse: parseBookYePage,
    });

    // When nothing was scraped, classify the first page so an empty result is
    // explained (anti-bot block vs. a legitimately empty catalog) instead of
    // silently returning 0 listings. A fetch that threw leaves firstPageHtml null
    // and is already reported as a network/403 error above.
    if (allListings.length === 0 && firstPageHtml !== null) {
      const reason = classifyBlockedPage(firstPageHtml);
      if (reason === 'cloudflare-challenge') {
        errors.push('BookYe blocked by Cloudflare Turnstile/challenge');
      } else if (reason === 'forbidden') {
        errors.push('BookYe blocked by HTTP 403, likely anti-bot protection');
      }
    }

    // Opt-in per-book product-page description enrichment (W9a F2). Off by
    // default. Книгарня «Є» needs Playwright per page (Cloudflare), so callers
    // should pass a larger descriptionDelayMs than the catalog delay.
    // Книгарня «Є» has no verified structured metadata source yet (book-metadata
    // PRD §3) — metadata stays null, description-only behavior is unchanged.
    if (options?.enrichDescriptions) {
      await enrichProductDetails(
        allListings,
        this.fetcher,
        (html): ExtractedProductDetails => ({
          description: extractBookYeProductDescription(html),
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

    return { provider: 'book-ye', listings: allListings, scrapedAt, errors };
  }
}
