import type {
  ScraperProvider,
  ScraperResult,
  ScraperOptions,
  RawProviderListing,
} from '@knyhovo/shared';
import { FetchHtmlFetcher, type HtmlFetcher } from '../../http/html-fetcher.js';
import { classifyBlockedPage, isForbiddenError } from '../../http/blocked-page.js';
import { KNIGOLAND_SITEMAP_INDEX_URL, DEFAULT_MAX_PRODUCTS } from './constants.js';
import {
  parseKnigolandSitemapIndex,
  parseKnigolandSitemap,
  parseKnigolandListing,
} from './knigoland.parser.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_DELAY_MS = 500;

/**
 * Knigoland scraper (Tier A). Discovery traverses the sitemap index
 * (`/sitemaps/sitemap.xml`): the index lists sub-sitemaps, of which only the
 * `sections/catalog-products-1..5.xml` ones (~50k product URLs total) are kept.
 * Each product page is server-rendered (nginx + Next.js, no Cloudflare/WAF) with
 * a `@type:Product` block (price/availability) plus a `@type:Book` block
 * (isbn/author) that the parser merges. Non-books (gifts/stationery/toys) carry no
 * `@type:Book` and the parser skips them silently — no error, and because product
 * URLs are deduplicated across all sub-sitemaps BEFORE the fetch loop, each URL
 * (book or not) is fetched at most once and never re-fetched after a skip.
 *
 * The fetcher is injectable so tests substitute fixtures and prod can swap
 * implementations. `options.maxPages` overrides the provider-local product cap
 * without touching the shared ScraperOptions contract — every sub-sitemap is
 * always parsed; the cap only bounds how many product pages are fetched per run.
 */
export class KnigolandScraper implements ScraperProvider {
  readonly name = 'knigoland' as const;

  constructor(
    private readonly fetcher: HtmlFetcher = new FetchHtmlFetcher(),
    private readonly sitemapIndexUrl: string = KNIGOLAND_SITEMAP_INDEX_URL,
    private readonly maxProducts: number = DEFAULT_MAX_PRODUCTS,
  ) {}

  async scrape(options?: ScraperOptions): Promise<ScraperResult> {
    const scrapedAt = new Date().toISOString();
    const maxProducts = options?.maxPages ?? this.maxProducts;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;

    const allListings: RawProviderListing[] = [];
    const errors: string[] = [];

    // 1. Discovery — fetch the sitemap index. A failure here yields an empty run
    //    (never throws): there are no product sub-sitemaps to walk.
    let indexXml: string;
    try {
      indexXml = await this.fetcher.fetch(this.sitemapIndexUrl, timeoutMs);
    } catch (err) {
      if (isForbiddenError(err)) {
        errors.push('Knigoland blocked by HTTP 403, likely anti-bot protection');
      } else {
        errors.push(
          `Sitemap index: network error — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return { provider: 'knigoland', listings: allListings, scrapedAt, errors };
    }

    const { sitemapUrls, errors: indexErrors } = parseKnigolandSitemapIndex(indexXml);
    errors.push(...indexErrors);

    // An index that parsed to zero product sub-sitemaps may be an anti-bot
    // interstitial served with HTTP 200 — classify it so an empty run is explained.
    if (sitemapUrls.length === 0) {
      const reason = classifyBlockedPage(indexXml);
      if (reason === 'cloudflare-challenge') {
        errors.push('Knigoland blocked by Cloudflare challenge, likely anti-bot protection');
      } else if (reason === 'forbidden') {
        errors.push('Knigoland blocked by HTTP 403, likely anti-bot protection');
      }
      return { provider: 'knigoland', listings: allListings, scrapedAt, errors };
    }

    // 2. Fetch each product sub-sitemap and collect product URLs, deduplicated
    //    ACROSS all sub-sitemaps so a URL listed twice is fetched only once. A
    //    broken sub-sitemap is recorded and the loop continues.
    const productUrls: string[] = [];
    const seenProductUrls = new Set<string>();

    for (let s = 0; s < sitemapUrls.length; s++) {
      const subSitemapUrl = sitemapUrls[s];

      let subSitemapXml: string;
      try {
        subSitemapXml = await this.fetcher.fetch(subSitemapUrl, timeoutMs);
      } catch (err) {
        errors.push(
          `Sub-sitemap ${subSitemapUrl}: fetch error — ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }

      const { urls, errors: sitemapErrors } = parseKnigolandSitemap(subSitemapXml);
      errors.push(...sitemapErrors);
      for (const url of urls) {
        if (!seenProductUrls.has(url)) {
          seenProductUrls.add(url);
          productUrls.push(url);
        }
      }

      if (s < sitemapUrls.length - 1 && delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // 3. Per-product fetch, capped at maxProducts. URLs are already deduplicated, so
    //    each product page — book or non-book — is fetched at most once. A non-book
    //    page is skipped by the parser with an empty `errors` array, so the skip adds
    //    no noise to `scrapeErrors` and is never retried. A broken/deleted URL
    //    (network error or HTTP 404/410) is recorded and the loop continues.
    const targets = productUrls.slice(0, maxProducts);
    const seenListingUrls = new Set<string>();

    for (let i = 0; i < targets.length; i++) {
      const productUrl = targets[i];

      let html: string;
      try {
        html = await this.fetcher.fetch(productUrl, timeoutMs);
      } catch (err) {
        errors.push(
          `Product ${productUrl}: fetch error — ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }

      const { listing, errors: parseErrors } = parseKnigolandListing(html);
      errors.push(...parseErrors);
      if (listing !== null && !seenListingUrls.has(listing.url)) {
        seenListingUrls.add(listing.url);
        allListings.push(listing);
      }

      if (i < targets.length - 1 && delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return { provider: 'knigoland', listings: allListings, scrapedAt, errors };
  }
}
