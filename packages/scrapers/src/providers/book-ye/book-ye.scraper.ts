import type { ScraperProvider, ScraperResult, ScraperOptions } from '@knyhovo/shared';
import type { RawProviderListing } from '@knyhovo/shared';
import { type HtmlFetcher } from '../../http/html-fetcher.js';
import { PlaywrightHtmlFetcher } from '../../http/playwright-html-fetcher.js';
import { browserManager } from '../../http/browser-manager.js';
import { BOOK_YE_CATALOG_URL, PRODUCT_CARD_SELECTOR } from './constants.js';
import { parseBookYePage } from './book-ye.parser.js';

const DEFAULT_MAX_PAGES = 50;
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
    }),
    private readonly catalogUrl: string = BOOK_YE_CATALOG_URL,
  ) {}

  async scrape(options?: ScraperOptions): Promise<ScraperResult> {
    const scrapedAt = new Date().toISOString();
    const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;

    const allListings: RawProviderListing[] = [];
    const errors: string[] = [];
    const seenUrls = new Set<string>();

    for (let page = 1; page <= maxPages; page++) {
      const url = `${this.catalogUrl}?p=${page}`;

      let html: string;
      try {
        html = await this.fetcher.fetch(url, timeoutMs);
      } catch (err) {
        errors.push(
          `Page ${page}: network error — ${err instanceof Error ? err.message : String(err)}`,
        );
        break;
      }

      const { listings, errors: parseErrors, hasNextPage } = parseBookYePage(html);

      for (const listing of listings) {
        if (!seenUrls.has(listing.url)) {
          seenUrls.add(listing.url);
          allListings.push(listing);
        }
      }
      errors.push(...parseErrors);

      if (!hasNextPage) break;

      if (page < maxPages && delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return { provider: 'book-ye', listings: allListings, scrapedAt, errors };
  }
}
