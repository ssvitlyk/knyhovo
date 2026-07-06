import type {
  ScraperProvider,
  ScraperResult,
  ScraperOptions,
  ScraperLogger,
  RawProviderListing,
} from '@knyhovo/shared';
import { FetchHtmlFetcher, type HtmlFetcher } from '../../http/html-fetcher.js';
import { classifyBlockedPage, isForbiddenError } from '../../http/blocked-page.js';
import { fetchWithRetry } from '../../http/retry.js';
import {
  LABORATORY_PRODUCTS_SITEMAP_URL,
  DEFAULT_MAX_PRODUCTS,
  DEFAULT_CONCURRENCY,
  DEFAULT_MAX_RUNTIME_MS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_DELAY_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  DEFAULT_PROGRESS_INTERVAL,
} from './constants.js';
import { parseLaboratorySitemap, parseLaboratoryListing } from './laboratory.parser.js';

const NOOP_LOGGER: ScraperLogger = { info: () => {} };

/** Construction-time knobs. All optional; each falls back to its provider default. */
export interface LaboratoryScraperConfig {
  readonly sitemapUrl?: string;
  readonly maxProducts?: number;
  readonly concurrency?: number;
  readonly maxRuntimeMs?: number;
  readonly maxRetries?: number;
  readonly retryBaseDelayMs?: number;
  readonly retryMaxDelayMs?: number;
  readonly progressInterval?: number;
  readonly logger?: ScraperLogger;
  /** Injectable monotonic clock (ms) for deterministic runtime/latency tests. */
  readonly now?: () => number;
  /** Injectable sleep for deterministic delay/backoff tests. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/** Per-run counters logged as the closing metrics line. */
interface RunMetrics {
  completed: number;
  failed: number;
  retried: number;
  latencySumMs: number;
  latencyCount: number;
}

/**
 * Laboratory scraper (Tier A). Discovery is sitemap-driven: the product sitemap
 * (`/sitemap.xml/type-products`) is a flat `<urlset>` of ~6k product URLs, and
 * each product page is server-rendered with two JSON-LD blocks (`@type:Product`
 * for price/availability + `@type:Book` for isbn/author) that the parser merges.
 * Cloudflare is CDN-only (no challenge), so the default FetchHtmlFetcher works.
 *
 * The sitemap stays the discovery source (stable, layout-agnostic). The ~6k URLs
 * are the real catalog size, so instead of capping how many we fetch, product
 * pages go through a bounded worker pool (`concurrency`) — turning a ~50min–hours
 * sequential walk into minutes. Each transient per-request failure (429 / timeout
 * / connection reset) is retried with exponential backoff; 404/410 and parse
 * failures are not. Concurrency is confined to HTTP fetching: the scraper does no
 * DB work — it returns raw listings and the caller persists them sequentially.
 *
 * `maxRuntimeMs` is an emergency wall-clock safety net, NOT the normal completion
 * path: if a run blows past it the pool stops dispatching and returns a partial
 * result plus an error, so a degraded origin can never leave the run hanging.
 *
 * All knobs are configurable per-construction (`LaboratoryScraperConfig`) and
 * per-call (`ScraperOptions` wins): `concurrency`, `maxRuntimeMs`, `maxRetries`,
 * `delayMs`, `timeoutMs`, `maxPages`, and a progress/metrics `logger`.
 */
export class LaboratoryScraper implements ScraperProvider {
  readonly name = 'laboratory' as const;

  private readonly fetcher: HtmlFetcher;
  private readonly sitemapUrl: string;
  private readonly maxProducts: number;
  private readonly concurrency: number;
  private readonly maxRuntimeMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly progressInterval: number;
  private readonly logger: ScraperLogger;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(fetcher: HtmlFetcher = new FetchHtmlFetcher(), config: LaboratoryScraperConfig = {}) {
    this.fetcher = fetcher;
    this.sitemapUrl = config.sitemapUrl ?? LABORATORY_PRODUCTS_SITEMAP_URL;
    this.maxProducts = config.maxProducts ?? DEFAULT_MAX_PRODUCTS;
    this.concurrency = config.concurrency ?? DEFAULT_CONCURRENCY;
    this.maxRuntimeMs = config.maxRuntimeMs ?? DEFAULT_MAX_RUNTIME_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.retryMaxDelayMs = config.retryMaxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS;
    this.progressInterval = config.progressInterval ?? DEFAULT_PROGRESS_INTERVAL;
    this.logger = config.logger ?? NOOP_LOGGER;
    this.now = config.now ?? ((): number => Date.now());
    this.sleep = config.sleep ?? ((ms): Promise<void> => new Promise((r) => setTimeout(r, ms)));
  }

  async scrape(options?: ScraperOptions): Promise<ScraperResult> {
    const scrapedAt = new Date().toISOString();
    const maxProducts = options?.maxPages ?? this.maxProducts;
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
    const concurrency = options?.concurrency ?? this.concurrency;
    const maxRuntimeMs = options?.maxRuntimeMs ?? this.maxRuntimeMs;
    const maxRetries = options?.maxRetries ?? this.maxRetries;
    const logger = options?.logger ?? this.logger;
    const startedAt = this.now();

    const errors: string[] = [];

    // 1. Discovery — fetch the product sitemap (with retry). A failure here yields
    //    an empty run (never throws): there are no product URLs to walk.
    let sitemapXml: string;
    try {
      const { html } = await fetchWithRetry(this.fetcher, this.sitemapUrl, timeoutMs, {
        maxRetries,
        baseDelayMs: this.retryBaseDelayMs,
        maxDelayMs: this.retryMaxDelayMs,
        sleep: this.sleep,
      });
      sitemapXml = html;
    } catch (err) {
      if (isForbiddenError(err)) {
        errors.push('Laboratory blocked by HTTP 403, likely anti-bot protection');
      } else {
        errors.push(
          `Sitemap: network error — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return { provider: 'laboratory', listings: [], scrapedAt, errors };
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
      return { provider: 'laboratory', listings: [], scrapedAt, errors };
    }

    // 2. Per-product fetch through a bounded worker pool, capped at maxProducts.
    const targets = urls.slice(0, maxProducts);
    logger.info(`laboratory: discovered ${urls.length} product URLs, fetching ${targets.length}`);

    const { listings, errors: fetchErrors } = await this.fetchProducts(targets, {
      timeoutMs,
      delayMs,
      concurrency,
      maxRuntimeMs,
      maxRetries,
      logger,
      startedAt,
    });
    errors.push(...fetchErrors);

    return { provider: 'laboratory', listings, scrapedAt, errors };
  }

  /**
   * Fetch each target product page through a fixed-size worker pool. Workers pull
   * from a shared cursor, so exactly `concurrency` requests are in flight at once
   * and each URL is handed to exactly one worker. Products are independent: a
   * broken/deleted URL (after retries are exhausted) is recorded and the worker
   * moves on — one failure never aborts the pool.
   *
   * Before taking each new URL a worker checks the wall-clock budget; once exceeded
   * every worker drains without dispatching more fetches and a single timeout error
   * is appended, so the result is a partial (never a hang). In-flight requests are
   * already bounded by the per-request `timeoutMs` inside each `fetchWithRetry`.
   */
  private async fetchProducts(
    targets: string[],
    ctx: {
      timeoutMs: number;
      delayMs: number;
      concurrency: number;
      maxRuntimeMs: number;
      maxRetries: number;
      logger: ScraperLogger;
      startedAt: number;
    },
  ): Promise<{ listings: RawProviderListing[]; errors: string[] }> {
    const { timeoutMs, delayMs, concurrency, maxRuntimeMs, maxRetries, logger, startedAt } = ctx;

    const listings: RawProviderListing[] = [];
    const errors: string[] = [];
    const seenUrls = new Set<string>();
    const metrics: RunMetrics = {
      completed: 0,
      failed: 0,
      retried: 0,
      latencySumMs: 0,
      latencyCount: 0,
    };

    let cursor = 0;
    let processed = 0;
    let timedOut = false;

    const worker = async (): Promise<void> => {
      for (;;) {
        if (this.now() - startedAt >= maxRuntimeMs) {
          timedOut = true;
          return;
        }

        // `cursor++` reads-then-increments synchronously (no await between), so
        // each index is handed to exactly one worker — no double-fetch.
        const index = cursor++;
        if (index >= targets.length) return;
        const productUrl = targets[index];

        const attemptStart = this.now();
        try {
          const { html } = await fetchWithRetry(this.fetcher, productUrl, timeoutMs, {
            maxRetries,
            baseDelayMs: this.retryBaseDelayMs,
            maxDelayMs: this.retryMaxDelayMs,
            sleep: this.sleep,
            onRetry: () => {
              metrics.retried++;
            },
          });
          const { listing, errors: parseErrors } = parseLaboratoryListing(html);
          errors.push(...parseErrors);
          if (listing !== null && !seenUrls.has(listing.url)) {
            seenUrls.add(listing.url);
            listings.push(listing);
          }
          metrics.completed++;
        } catch (err) {
          metrics.failed++;
          errors.push(
            `Product ${productUrl}: fetch error — ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        metrics.latencySumMs += this.now() - attemptStart;
        metrics.latencyCount++;
        processed++;

        if (processed % this.progressInterval === 0) {
          logger.info(`laboratory: processed ${processed}/${targets.length} product pages`);
        }

        if (delayMs > 0) {
          await this.sleep(delayMs);
        }
      }
    };

    const poolSize = Math.max(1, Math.min(concurrency, targets.length));
    await Promise.all(Array.from({ length: poolSize }, () => worker()));

    if (timedOut) {
      errors.push(
        `Aborted after exceeding safety-net runtime of ${maxRuntimeMs}ms — ` +
          `fetched ${processed} of ${targets.length} product pages`,
      );
    }

    const elapsedMs = this.now() - startedAt;
    const avgLatencyMs =
      metrics.latencyCount > 0 ? Math.round(metrics.latencySumMs / metrics.latencyCount) : 0;
    logger.info(
      `laboratory: run complete — completed=${metrics.completed} failed=${metrics.failed} ` +
        `retried=${metrics.retried} avgLatencyMs=${avgLatencyMs} elapsedMs=${elapsedMs}` +
        (timedOut ? ' (safety-net timeout)' : ''),
    );

    return { listings, errors };
  }
}
