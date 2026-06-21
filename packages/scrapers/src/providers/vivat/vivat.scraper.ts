import type { ScraperProvider, ScraperResult, ScraperOptions } from '@knyhovo/shared';
import type { RawProviderListing } from '@knyhovo/shared';
import { FetchHtmlFetcher, type HtmlFetcher } from '../../http/html-fetcher.js';
import { VIVAT_CATALOG_URL } from './constants.js';
import { parseVivatPage, extractVivatProductDescription } from './vivat.parser.js';
import { enrichDescriptions } from '../../lib/enrich-descriptions.js';

const DEFAULT_MAX_PAGES = 50;
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_DELAY_MS = 500;

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

    const allListings: RawProviderListing[] = [];
    const errors: string[] = [];
    const seenUrls = new Set<string>();

    for (let page = 1; page <= maxPages; page++) {
      const url = `${this.catalogUrl}?page=${page}`;

      let html: string;
      try {
        html = await this.fetcher.fetch(url, timeoutMs);
      } catch (err) {
        errors.push(
          `Page ${page}: network error — ${err instanceof Error ? err.message : String(err)}`,
        );
        break;
      }

      const { listings, errors: parseErrors, hasNextPage } = parseVivatPage(html);

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

    // Opt-in per-book product-page description enrichment (W9a F2). Off by
    // default — a normal catalog scrape performs no product-page requests.
    if (options?.enrichDescriptions) {
      await enrichDescriptions(allListings, this.fetcher, extractVivatProductDescription, {
        timeoutMs,
        delayMs: options.descriptionDelayMs ?? delayMs,
        errors,
      });
    }

    return { provider: 'vivat', listings: allListings, scrapedAt, errors };
  }
}
