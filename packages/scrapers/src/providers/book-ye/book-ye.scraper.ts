import type { ScraperProvider, ScraperResult, ScraperOptions } from '@knyhovo/shared';
import type { RawProviderListing } from '@knyhovo/shared';
import { type HtmlFetcher } from '../../http/html-fetcher.js';
import { PlaywrightHtmlFetcher } from '../../http/playwright-html-fetcher.js';
import { browserManager } from '../../http/browser-manager.js';
import { BOOK_YE_CATALOG_URL, PRODUCT_CARD_SELECTOR, CLOUDFLARE_CHALLENGE_SELECTOR } from './constants.js';
import { parseBookYePage, extractBookYeProductDescription } from './book-ye.parser.js';
import { enrichDescriptions } from '../../lib/enrich-descriptions.js';
import { classifyBlockedPage } from '../../http/blocked-page.js';

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
      challengeSelector: CLOUDFLARE_CHALLENGE_SELECTOR,
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
    let firstPageHtml: string | null = null;

    for (let page = 1; page <= maxPages; page++) {
      const url = `${this.catalogUrl}?p=${page}`;

      let html: string;
      try {
        html = await this.fetcher.fetch(url, timeoutMs);
        if (firstPageHtml === null) firstPageHtml = html;
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
    if (options?.enrichDescriptions) {
      await enrichDescriptions(allListings, this.fetcher, extractBookYeProductDescription, {
        timeoutMs,
        delayMs: options.descriptionDelayMs ?? delayMs,
        errors,
      });
    }

    return { provider: 'book-ye', listings: allListings, scrapedAt, errors };
  }
}
