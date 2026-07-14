import type {
  ScraperProvider,
  ScraperResult,
  ScraperOptions,
  ScraperLogger,
  RawProviderListing,
} from '@knyhovo/shared';
import { FetchHtmlFetcher, type HtmlFetcher } from '../../http/html-fetcher.js';
import { classifyBlockedPage, isForbiddenError } from '../../http/blocked-page.js';
import { parseSitemapEntries } from '../../sitemap/parse-sitemap.js';
import { planIncrementalFetch } from '../../sitemap/plan-incremental-fetch.js';
import { BOOKCHEF_PRODUCTS_SITEMAP_URL, DEFAULT_MAX_PRODUCTS } from './constants.js';
import { parseBookChefListing } from './bookchef.parser.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_DELAY_MS = 500;
const NOOP_LOGGER: ScraperLogger = { info: () => {} };

// A full BookChef run walks up to ~15k pages sequentially over multiple hours
// with no other output between the sitemap-plan log and the final result —
// indistinguishable from a hang in production. Emit a progress line every
// FETCH_PROGRESS_EVERY pages instead. At ~1s/page this is roughly one line
// every 1.5–2 minutes.
const FETCH_PROGRESS_EVERY = 100;

/**
 * BookChef scraper (Tier A). Discovery is sitemap-driven: the catalog is
 * client-rendered (Livewire/Vue) and exposes no products in SSR HTML, so the
 * scraper reads the product sitemap and fetches each product page — which IS
 * server-rendered with a rich JSON-LD `@type:Product` block. No Cloudflare
 * challenge, so the default FetchHtmlFetcher works.
 *
 * The fetcher is injectable so tests substitute fixtures and prod can swap
 * implementations. `options.maxPages` overrides the provider-local product cap
 * without touching the shared ScraperOptions contract.
 *
 * Sitemap-incremental (bookchef-incremental-scraping PRD): when
 * `options.knownSourceLastmod` is supplied, only sitemap entries that are new
 * or whose `<lastmod>` advanced past the known watermark are fetched — see
 * `planIncrementalFetch`. Omitted → every discovered URL is fetched, i.e. the
 * pre-existing full-scrape behavior is unchanged. Either way `ScraperResult`
 * carries the *full* sitemap presence list (`sitemap.entries`) for the
 * pipeline's presence bookkeeping and shadow validation, and each listing
 * carries `sourceLastmod` from its own sitemap entry.
 */
export class BookChefScraper implements ScraperProvider {
  readonly name = 'bookchef' as const;

  constructor(
    private readonly fetcher: HtmlFetcher = new FetchHtmlFetcher(),
    private readonly sitemapUrl: string = BOOKCHEF_PRODUCTS_SITEMAP_URL,
    private readonly maxProducts: number = DEFAULT_MAX_PRODUCTS,
  ) {}

  async scrape(options?: ScraperOptions): Promise<ScraperResult> {
    const scrapedAt = new Date().toISOString();
    const maxProducts = options?.maxPages ?? this.maxProducts;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
    const logger = options?.logger ?? NOOP_LOGGER;

    const allListings: RawProviderListing[] = [];
    const errors: string[] = [];

    // 1. Discovery — fetch the product sitemap. A failure here yields an empty
    //    run (never throws): there are no product URLs to walk.
    let sitemapXml: string;
    try {
      sitemapXml = await this.fetcher.fetch(this.sitemapUrl, timeoutMs);
    } catch (err) {
      if (isForbiddenError(err)) {
        errors.push('BookChef blocked by HTTP 403, likely anti-bot protection');
      } else {
        errors.push(
          `Sitemap: network error — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return { provider: 'bookchef', listings: allListings, scrapedAt, errors };
    }

    const { entries, error: sitemapError } = parseSitemapEntries(sitemapXml);
    if (sitemapError) errors.push(sitemapError);

    // A sitemap that parsed to zero URLs may be an anti-bot interstitial served
    // with HTTP 200 — classify it so an empty run is explained, not silent.
    if (entries.length === 0) {
      const reason = classifyBlockedPage(sitemapXml);
      if (reason === 'cloudflare-challenge') {
        errors.push('BookChef blocked by Cloudflare challenge, likely anti-bot protection');
      } else if (reason === 'forbidden') {
        errors.push('BookChef blocked by HTTP 403, likely anti-bot protection');
      }
      return { provider: 'bookchef', listings: allListings, scrapedAt, errors };
    }

    // 2. Sitemap-incremental diff — full mode (knownSourceLastmod omitted)
    //    fetches everything, same as before. `plan.toFetch` still carries every
    //    entry's lastmod so listings below get sourceLastmod attached in both modes.
    const plan = planIncrementalFetch(entries, options?.knownSourceLastmod);
    const targets = plan.toFetch.slice(0, maxProducts);
    logger.info(
      `bookchef: sitemap entries=${entries.length} toFetch=${plan.toFetch.length} ` +
        `unchangedSkipped=${plan.unchangedCount} fetching=${targets.length}`,
    );

    // 3. Per-product fetch, capped at maxProducts. Products are independent: a
    //    broken/deleted URL (network error or HTTP 404/410) is recorded and the
    //    loop continues — unlike catalog pagination, which breaks on the gap.
    const seenUrls = new Set<string>();
    const fetchStartedMs = Date.now();
    const debugFetchStages = options?.debugFetchStages ?? false;

    for (let i = 0; i < targets.length; i++) {
      const entry = targets[i];
      const productUrl = entry.url;

      if (debugFetchStages) {
        logger.info(`bookchef: [stage] fetch started ${i + 1}/${targets.length} ${productUrl}`);
      }

      let html: string | undefined;
      const fetchStartMs = Date.now();
      try {
        html = await this.fetcher.fetch(productUrl, timeoutMs);
        if (debugFetchStages) {
          logger.info(`bookchef: [stage] fetch completed ${i + 1} (${Date.now() - fetchStartMs}ms)`);
        }
      } catch (err) {
        if (debugFetchStages) {
          logger.info(`bookchef: [stage] fetch failed ${i + 1} (${Date.now() - fetchStartMs}ms)`);
        }
        errors.push(
          `Product ${productUrl}: fetch error — ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      if (html !== undefined) {
        const { listing, errors: parseErrors } = parseBookChefListing(html);
        errors.push(...parseErrors);
        if (listing !== null && !seenUrls.has(listing.url)) {
          seenUrls.add(listing.url);
          // Keyed by the sitemap entry actually fetched (not listing.url) so the
          // watermark is correct even in the unlikely case they diverge — day-0
          // verification found `offers.url === <loc>` on 16/16 samples (PRD §8).
          allListings.push({ ...listing, sourceLastmod: entry.lastmod });
        }
      }

      if (debugFetchStages) {
        logger.info(`bookchef: [stage] parse completed ${i + 1}`);
      }

      if ((i + 1) % FETCH_PROGRESS_EVERY === 0) {
        const elapsedMs = Date.now() - fetchStartedMs;
        const elapsedSec = Math.round(elapsedMs / 1000);
        const avgMs = Math.round(elapsedMs / (i + 1));
        const etaSec = Math.round(
          (elapsedMs / (i + 1)) * (targets.length - (i + 1)) / 1000,
        );
        logger.info(
          `BookChef progress: current=${i + 1} total=${targets.length} ok=${allListings.length} ` +
            `errors=${errors.length} elapsed=${elapsedSec}s avgPerPage=${avgMs}ms ETA=${etaSec}s`,
        );
      }

      if (i < targets.length - 1 && delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        if (debugFetchStages) {
          logger.info(`bookchef: [stage] sleep completed ${i + 1}`);
        }
      }
    }

    {
      const elapsedSec = Math.round((Date.now() - fetchStartedMs) / 1000);
      logger.info(
        `bookchef: fetch complete — ${allListings.length} listings, ${errors.length} errors in ${elapsedSec}s`,
      );
    }

    return {
      provider: 'bookchef',
      listings: allListings,
      scrapedAt,
      errors,
      sitemap: { entries },
    };
  }
}
