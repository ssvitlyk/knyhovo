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

/** Emit a progress line once every this many processed targets (plus one at completion). */
const PROGRESS_INTERVAL = 100;

/**
 * Normalize a product URL for skip-set comparison. The skip set carries stored
 * `ProviderListing.url` values (a prior scrape's JSON-LD `offers.url`), while the
 * fetch loop iterates sitemap `<loc>` URLs — the same canonical product URL but
 * possibly differing by trailing slash or surrounding whitespace. Trimming and
 * dropping trailing slashes on both sides makes the comparison stable without
 * altering the URL actually fetched (targets keep their original form).
 */
function normalizeProductUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Knigoland scraper (Tier A). Discovery traverses the sitemap index
 * (`/sitemaps/sitemap.xml`): the index lists sub-sitemaps, of which only the
 * `sections/catalog-products-1..5.xml` ones (~50k product URLs total) are kept.
 * Each product page is server-rendered (Next.js, no Cloudflare/WAF) with a
 * `@type:Product` JSON-LD block (price/availability) plus a visible spec table
 * the parser reads for isbn/author. Non-books (gifts/stationery/toys) carry no
 * Bookland-prefixed ISBN and the parser skips them silently — no error, and
 * because product URLs are deduplicated across all sub-sitemaps BEFORE the fetch
 * loop, each URL (book or not) is fetched at most once and never re-fetched
 * after a skip.
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

    // 3. Description-enrichment skip set. When an enrichment pass supplies URLs
    //    whose listings already carry a stored description, drop them so their
    //    product pages are not re-fetched (Knigoland reads the description inline
    //    from the same page it fetches for price/availability, so an already-
    //    described URL is an unnecessary fetch during an enrichment pass). Gated
    //    on `enrichDescriptions` — a normal full-catalog run must still re-fetch
    //    every page so prices/availability refresh — matching the shared contract
    //    ("skipDescriptionUrls is ignored when enrichDescriptions is off").
    const skipSet =
      options?.enrichDescriptions === true ? options.skipDescriptionUrls : undefined;
    let candidateUrls = productUrls;
    let skippedCount = 0;
    if (skipSet !== undefined && skipSet.size > 0) {
      const normalizedSkip = new Set<string>();
      for (const u of skipSet) normalizedSkip.add(normalizeProductUrl(u));
      candidateUrls = productUrls.filter((u) => !normalizedSkip.has(normalizeProductUrl(u)));
      skippedCount = productUrls.length - candidateUrls.length;
    }

    // 4. Per-product fetch, capped at maxProducts AFTER the skip so the cap bounds
    //    the pages actually fetched. URLs are already deduplicated, so each product
    //    page — book or non-book — is fetched at most once. A non-book page is
    //    skipped by the parser with an empty `errors` array, so the skip adds no
    //    noise to `scrapeErrors` and is never retried. A broken/deleted URL
    //    (network error or HTTP 404/410) is recorded and the loop continues.
    const targets = candidateUrls.slice(0, maxProducts);
    const seenListingUrls = new Set<string>();

    options?.logger?.info(
      `knigoland: ${productUrls.length} product URLs discovered, ` +
        `${skippedCount} skipped (already described), ${targets.length} to fetch ` +
        `(maxPages=${maxProducts}, enrichment=${options?.enrichDescriptions === true})`,
    );

    const loopStartedAt = Date.now();
    const errorsBeforeLoop = errors.length;
    let processed = 0;

    const logProgress = (label: 'progress' | 'complete'): void => {
      const logger = options?.logger;
      if (logger === undefined) return;
      const elapsedMs = Date.now() - loopStartedAt;
      const avgMs = processed > 0 ? Math.round(elapsedMs / processed) : 0;
      const remaining = targets.length - processed;
      const loopErrors = errors.length - errorsBeforeLoop;
      const base =
        `knigoland: ${label} ${processed}/${targets.length} — ` +
        `${allListings.length} listings, ${loopErrors} errors, ` +
        `${Math.round(elapsedMs / 1000)}s elapsed, ${avgMs}ms/item`;
      logger.info(
        label === 'complete' ? base : `${base}, ~${Math.round((avgMs * remaining) / 1000)}s remaining`,
      );
    };

    const maybeLogProgress = (): void => {
      if (processed % PROGRESS_INTERVAL === 0 && processed !== targets.length) {
        logProgress('progress');
      }
    };

    for (let i = 0; i < targets.length; i++) {
      const productUrl = targets[i];
      processed++;

      let html: string;
      try {
        html = await this.fetcher.fetch(productUrl, timeoutMs);
      } catch (err) {
        errors.push(
          `Product ${productUrl}: fetch error — ${err instanceof Error ? err.message : String(err)}`,
        );
        maybeLogProgress();
        continue;
      }

      const { listing, errors: parseErrors } = parseKnigolandListing(html);
      errors.push(...parseErrors);
      if (listing !== null && !seenListingUrls.has(listing.url)) {
        seenListingUrls.add(listing.url);
        allListings.push(listing);
      }

      maybeLogProgress();

      if (i < targets.length - 1 && delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }

    if (targets.length > 0) {
      logProgress('complete');
    }

    return { provider: 'knigoland', listings: allListings, scrapedAt, errors };
  }
}
