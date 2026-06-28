import type {
  ScraperProvider,
  ScraperResult,
  ScraperOptions,
  RawProviderListing,
} from '@knyhovo/shared';
import { FetchHtmlFetcher, type HtmlFetcher } from '../../http/html-fetcher.js';
import { classifyBlockedPage, isForbiddenError } from '../../http/blocked-page.js';
import { LABORATORY_PRODUCTS_SITEMAP_URL, DEFAULT_MAX_PRODUCTS } from './constants.js';
import { parseLaboratorySitemap, parseLaboratoryListing } from './laboratory.parser.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_DELAY_MS = 500;

/**
 * Laboratory scraper (Tier A). Discovery is sitemap-driven: the product sitemap
 * (`/sitemap.xml/type-products`) is a flat `<urlset>` of ~6k product URLs, and
 * each product page is server-rendered with two JSON-LD blocks (`@type:Product`
 * for price/availability + `@type:Book` for isbn/author) that the parser merges.
 * Cloudflare is CDN-only (no challenge), so the default FetchHtmlFetcher works.
 *
 * The fetcher is injectable so tests substitute fixtures and prod can swap
 * implementations. `options.maxPages` overrides the provider-local product cap
 * without touching the shared ScraperOptions contract — the full sitemap is
 * always parsed; the cap only bounds how many product pages are fetched per run.
 */
export class LaboratoryScraper implements ScraperProvider {
  readonly name = 'laboratory' as const;

  constructor(
    private readonly fetcher: HtmlFetcher = new FetchHtmlFetcher(),
    private readonly sitemapUrl: string = LABORATORY_PRODUCTS_SITEMAP_URL,
    private readonly maxProducts: number = DEFAULT_MAX_PRODUCTS,
  ) {}

  async scrape(options?: ScraperOptions): Promise<ScraperResult> {
    const scrapedAt = new Date().toISOString();
    const maxProducts = options?.maxPages ?? this.maxProducts;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;

    const allListings: RawProviderListing[] = [];
    const errors: string[] = [];

    // 1. Discovery — fetch the product sitemap. A failure here yields an empty
    //    run (never throws): there are no product URLs to walk.
    let sitemapXml: string;
    try {
      sitemapXml = await this.fetcher.fetch(this.sitemapUrl, timeoutMs);
    } catch (err) {
      if (isForbiddenError(err)) {
        errors.push('Laboratory blocked by HTTP 403, likely anti-bot protection');
      } else {
        errors.push(
          `Sitemap: network error — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return { provider: 'laboratory', listings: allListings, scrapedAt, errors };
    }

    const { urls, errors: sitemapErrors } = parseLaboratorySitemap(sitemapXml);
    errors.push(...sitemapErrors);

    // A sitemap that parsed to zero URLs may be an anti-bot interstitial served
    // with HTTP 200 — classify it so an empty run is explained, not silent.
    if (urls.length === 0) {
      const reason = classifyBlockedPage(sitemapXml);
      if (reason === 'cloudflare-challenge') {
        errors.push('Laboratory blocked by Cloudflare challenge, likely anti-bot protection');
      } else if (reason === 'forbidden') {
        errors.push('Laboratory blocked by HTTP 403, likely anti-bot protection');
      }
      return { provider: 'laboratory', listings: allListings, scrapedAt, errors };
    }

    // 2. Per-product fetch, capped at maxProducts. Products are independent: a
    //    broken/deleted URL (network error or HTTP 404/410) is recorded and the
    //    loop continues — unlike catalog pagination, which breaks on the gap.
    const targets = urls.slice(0, maxProducts);
    const seenUrls = new Set<string>();

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

      const { listing, errors: parseErrors } = parseLaboratoryListing(html);
      errors.push(...parseErrors);
      if (listing !== null && !seenUrls.has(listing.url)) {
        seenUrls.add(listing.url);
        allListings.push(listing);
      }

      if (i < targets.length - 1 && delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return { provider: 'laboratory', listings: allListings, scrapedAt, errors };
  }
}
