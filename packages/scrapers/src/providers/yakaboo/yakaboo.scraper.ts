import type { ScraperProvider, ScraperResult, ScraperOptions } from '@knyhovo/shared';
import { FetchHtmlFetcher, type HtmlFetcher } from '../../http/html-fetcher.js';
import { classifyBlockedPage, isForbiddenError } from '../../http/blocked-page.js';
import { YAKABOO_CATALOG_URL } from './constants.js';
import { parseYakabooPage, extractYakabooProductDescription } from './yakaboo.parser.js';
import { enrichDescriptions } from '../../lib/enrich-descriptions.js';
import type { RawProviderListing } from '@knyhovo/shared';

const DEFAULT_MAX_PAGES = 50;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_DELAY_MS = 500;

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

    const allListings: RawProviderListing[] = [];
    const errors: string[] = [];
    const seenUrls = new Set<string>();
    let firstPageHtml: string | null = null;

    for (let page = 1; page <= maxPages; page++) {
      const url = `${this.catalogUrl}?page=${page}`;

      let html: string;
      try {
        html = await this.fetcher.fetch(url, timeoutMs);
        if (firstPageHtml === null) firstPageHtml = html;
      } catch (err) {
        if (isForbiddenError(err)) {
          errors.push('Yakaboo blocked by HTTP 403, likely anti-bot protection');
        } else {
          errors.push(
            `Page ${page}: network error — ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        break;
      }

      const { listings, errors: parseErrors, hasNextPage } = parseYakabooPage(html);

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
    if (options?.enrichDescriptions) {
      await enrichDescriptions(allListings, this.fetcher, extractYakabooProductDescription, {
        timeoutMs,
        delayMs: options.descriptionDelayMs ?? delayMs,
        errors,
      });
    }

    return { provider: 'yakaboo', listings: allListings, scrapedAt, errors };
  }
}
