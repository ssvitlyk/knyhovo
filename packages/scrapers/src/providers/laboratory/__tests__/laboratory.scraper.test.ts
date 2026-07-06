import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { LaboratoryScraper } from '../laboratory.scraper.js';
import { LABORATORY_PRODUCTS_SITEMAP_URL } from '../constants.js';
import type { HtmlFetcher } from '../../../http/html-fetcher.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

const SITEMAP = loadFixture('sitemap-products.xml');
const INSTOCK = loadFixture('product-instock.html');
const PAPERBACK = loadFixture('product-paperback.html');

// Both URLs are present in the real 12-entry sitemap fragment (product-outofstock
// is a parser-only fixture and is intentionally NOT in this sitemap).
const INSTOCK_URL = 'https://laboratory.ua/products/pro-vijnu';
const PAPERBACK_URL = 'https://laboratory.ua/products/krasyvi-divchata-tezh-pomyrayut';

// Instant sleep so delay/backoff waits never slow tests down.
const noSleep = async (): Promise<void> => {};

/**
 * Build an HtmlFetcher whose responses are keyed by URL. URLs not in the map fall
 * back to `defaultResponse` (an empty page by default), which the parser records
 * as an error and the scraper skips — exactly the live shape for the other 10
 * product URLs in the real sitemap fragment.
 */
function makeFetcher(
  responses: Record<string, string | (() => never)>,
  defaultResponse = '',
): HtmlFetcher {
  return {
    fetch: vi.fn(async (url: string) => {
      const r = url in responses ? responses[url] : defaultResponse;
      if (typeof r === 'function') return r();
      return r;
    }),
  };
}

function httpError(status: number, statusText = ''): () => never {
  return () => {
    throw new Error(`HTTP ${status} ${statusText}`.trim());
  };
}

// ──────────────────────────────────────────────────────────────
// Successful sitemap-driven scrape
// ──────────────────────────────────────────────────────────────

describe('LaboratoryScraper.scrape — sitemap discovery + per-product fetch', () => {
  it('fetches the sitemap then each product page and combines listings', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP,
      [INSTOCK_URL]: INSTOCK,
      [PAPERBACK_URL]: PAPERBACK,
    });
    // Only two of the 12 sitemap URLs have a body; the rest are empty → skipped.
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 12 });
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.provider).toBe('laboratory');
    expect(result.scrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const urls = result.listings.map((l) => l.url).sort();
    expect(urls).toEqual([INSTOCK_URL, PAPERBACK_URL].sort());
    // sitemap call + 12 product calls
    expect(fetcher.fetch).toHaveBeenCalledTimes(13);
  });

  it('deduplicates listings that resolve to the same product URL', async () => {
    // Every product URL returns the same in-stock page → all parse to one URL.
    const fetcher = makeFetcher({ [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP }, INSTOCK);
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 12 });
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.url).toBe(INSTOCK_URL);
  });

  it('respects the maxProducts cap via options.maxPages', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP,
      [INSTOCK_URL]: INSTOCK,
    });
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 50 });
    await scraper.scrape({ maxPages: 3, delayMs: 0 });

    // 1 sitemap fetch + 3 product fetches (cap), not all 12.
    expect(fetcher.fetch).toHaveBeenCalledTimes(4);
  });

  it('uses the provider-local default cap when maxPages is omitted', async () => {
    const fetcher = makeFetcher({ [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP });
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 5 });
    await scraper.scrape({ delayMs: 0 });

    // sitemap has 12 URLs but the cap is 5 → 1 + 5 fetches.
    expect(fetcher.fetch).toHaveBeenCalledTimes(6);
  });
});

// ──────────────────────────────────────────────────────────────
// Bounded concurrency — the fix for the post-PR-#72 hang. Product pages are
// fetched through a fixed-size worker pool instead of strictly sequentially.
// ──────────────────────────────────────────────────────────────

/** Fetcher that records the peak number of concurrent product fetches. */
function concurrencyTrackingFetcher(): { fetcher: HtmlFetcher; maxInFlight: () => number } {
  let inFlight = 0;
  let peak = 0;
  const fetcher: HtmlFetcher = {
    fetch: vi.fn(async (url: string) => {
      if (url === LABORATORY_PRODUCTS_SITEMAP_URL) return SITEMAP;
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return INSTOCK;
    }),
  };
  return { fetcher, maxInFlight: () => peak };
}

describe('LaboratoryScraper.scrape — bounded concurrency', () => {
  it('fetches product pages in parallel, capped at the concurrency limit', async () => {
    const { fetcher, maxInFlight } = concurrencyTrackingFetcher();
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 12, concurrency: 4 });
    await scraper.scrape({ delayMs: 0 });

    expect(maxInFlight()).toBeGreaterThan(1);
    expect(maxInFlight()).toBeLessThanOrEqual(4);
  });

  it('options.concurrency overrides the constructor default', async () => {
    const { fetcher, maxInFlight } = concurrencyTrackingFetcher();
    // Constructor says 8, but the per-call option caps it at 2.
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 12, concurrency: 8 });
    await scraper.scrape({ delayMs: 0, concurrency: 2 });

    expect(maxInFlight()).toBeGreaterThan(1);
    expect(maxInFlight()).toBeLessThanOrEqual(2);
  });

  it('fetches every target exactly once under concurrency (no double-fetch, no skips)', async () => {
    const counts = new Map<string, number>();
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async (url: string) => {
        counts.set(url, (counts.get(url) ?? 0) + 1);
        return url === LABORATORY_PRODUCTS_SITEMAP_URL ? SITEMAP : INSTOCK;
      }),
    };
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 12, concurrency: 4 });
    await scraper.scrape({ delayMs: 0 });

    const productFetches = [...counts.entries()].filter(
      ([url]) => url !== LABORATORY_PRODUCTS_SITEMAP_URL,
    );
    expect(productFetches).toHaveLength(12);
    expect(productFetches.every(([, n]) => n === 1)).toBe(true);
  });

  it('one hung/slow request does not block the pool — the others still complete', async () => {
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async (url: string) => {
        if (url === LABORATORY_PRODUCTS_SITEMAP_URL) return SITEMAP;
        if (url === PAPERBACK_URL) {
          // Simulate a per-request timeout for one URL (non-retryable here).
          const err = new Error('This operation was aborted');
          err.name = 'AbortError';
          throw err;
        }
        return INSTOCK;
      }),
    };
    const scraper = new LaboratoryScraper(fetcher, {
      maxProducts: 12,
      concurrency: 2,
      maxRetries: 0,
      sleep: noSleep,
    });
    const result = await scraper.scrape({ delayMs: 0 });

    // The other successful product still produces a listing; the aborted one errors.
    expect(result.listings.map((l) => l.url)).toContain(INSTOCK_URL);
    expect(result.errors.some((e) => e.includes(PAPERBACK_URL))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// Throttle — a per-worker delay between requests (configurable, defaulted).
// ──────────────────────────────────────────────────────────────

describe('LaboratoryScraper.scrape — request throttle', () => {
  it('sleeps for options.delayMs between requests within a worker', async () => {
    const fetcher = makeFetcher({ [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP }, INSTOCK);
    const sleep = vi.fn(noSleep);
    // concurrency 1 → a single worker walks all targets, sleeping after each.
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 3, concurrency: 1, sleep });
    await scraper.scrape({ delayMs: 250 });

    expect(sleep).toHaveBeenCalledWith(250);
  });

  it('uses the default delay when options.delayMs is omitted', async () => {
    const fetcher = makeFetcher({ [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP }, INSTOCK);
    const sleep = vi.fn(noSleep);
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 2, concurrency: 1, sleep });
    await scraper.scrape();

    // DEFAULT_DELAY_MS = 500.
    expect(sleep).toHaveBeenCalledWith(500);
  });
});

// ──────────────────────────────────────────────────────────────
// Retry with exponential backoff — transient failures only.
// ──────────────────────────────────────────────────────────────

describe('LaboratoryScraper.scrape — retry', () => {
  it('retries a transient 429 for a product page, then succeeds', async () => {
    let productCalls = 0;
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async (url: string) => {
        if (url === LABORATORY_PRODUCTS_SITEMAP_URL) return SITEMAP;
        if (url === INSTOCK_URL) {
          productCalls++;
          if (productCalls === 1) throw new Error('HTTP 429 Too Many Requests');
          return INSTOCK;
        }
        return ''; // other URLs → skipped
      }),
    };
    const scraper = new LaboratoryScraper(fetcher, {
      maxProducts: 12,
      concurrency: 1,
      maxRetries: 3,
      sleep: noSleep,
    });
    const result = await scraper.scrape({ delayMs: 0 });

    // The 429 was retried and the second attempt produced the listing.
    expect(result.listings.map((l) => l.url)).toContain(INSTOCK_URL);
    expect(productCalls).toBe(2);
  });

  it('does NOT retry a 404 — records the error after a single attempt', async () => {
    let calls = 0;
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async (url: string) => {
        if (url === LABORATORY_PRODUCTS_SITEMAP_URL) return SITEMAP;
        if (url === INSTOCK_URL) {
          calls++;
          throw new Error('HTTP 404 Not Found');
        }
        return '';
      }),
    };
    const scraper = new LaboratoryScraper(fetcher, {
      maxProducts: 12,
      concurrency: 1,
      maxRetries: 3,
      sleep: noSleep,
    });
    const result = await scraper.scrape({ delayMs: 0 });

    expect(calls).toBe(1); // no retry
    expect(result.errors.some((e) => e.includes(INSTOCK_URL) && e.includes('404'))).toBe(true);
  });

  it('gives up after options.maxRetries on a persistent transient error', async () => {
    let calls = 0;
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async (url: string) => {
        if (url === LABORATORY_PRODUCTS_SITEMAP_URL) return SITEMAP;
        if (url === INSTOCK_URL) {
          calls++;
          throw new Error('HTTP 429 Too Many Requests');
        }
        return '';
      }),
    };
    const scraper = new LaboratoryScraper(fetcher, {
      maxProducts: 12,
      concurrency: 1,
      sleep: noSleep,
    });
    const result = await scraper.scrape({ delayMs: 0, maxRetries: 2 });

    // 1 initial + 2 retries for the one INSTOCK_URL.
    expect(calls).toBe(3);
    expect(result.errors.some((e) => e.includes(INSTOCK_URL) && e.includes('429'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// Progress + run metrics logging.
// ──────────────────────────────────────────────────────────────

describe('LaboratoryScraper.scrape — logging', () => {
  it('logs a progress line every progressInterval product pages', async () => {
    const fetcher = makeFetcher({ [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP }, INSTOCK);
    const logger = { info: vi.fn() };
    const scraper = new LaboratoryScraper(fetcher, {
      maxProducts: 12,
      concurrency: 1,
      progressInterval: 4,
    });
    await scraper.scrape({ delayMs: 0, logger });

    const lines = logger.info.mock.calls.map((c) => c[0] as string);
    // 12 targets, interval 4 → progress at 4, 8, 12.
    expect(lines.filter((l) => /processed \d+\/12 product pages/.test(l))).toHaveLength(3);
  });

  it('logs a final run-metrics summary (completed / failed / retried / latency / elapsed)', async () => {
    const fetcher = makeFetcher(
      { [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP, [INSTOCK_URL]: INSTOCK },
      PAPERBACK,
    );
    const logger = { info: vi.fn() };
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 12, concurrency: 4 });
    await scraper.scrape({ delayMs: 0, logger });

    const summary = logger.info.mock.calls
      .map((c) => c[0] as string)
      .find((l) => l.includes('run complete'));
    expect(summary).toBeDefined();
    expect(summary).toMatch(/completed=\d+/);
    expect(summary).toMatch(/failed=\d+/);
    expect(summary).toMatch(/retried=\d+/);
    expect(summary).toMatch(/avgLatencyMs=\d+/);
    expect(summary).toMatch(/elapsedMs=\d+/);
  });
});

// ──────────────────────────────────────────────────────────────
// Safety-net runtime — an emergency ceiling, NOT the normal completion path.
// A healthy run finishes well under it; if exceeded, return a partial + error.
// ──────────────────────────────────────────────────────────────

describe('LaboratoryScraper.scrape — safety-net runtime', () => {
  it('stops before any product fetch and returns an error when the budget is already blown', async () => {
    const fetcher = makeFetcher({ [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP }, INSTOCK);
    // Fake clock: startedAt=0, then every check jumps past the 1000ms budget.
    let calls = 0;
    const now = vi.fn(() => (calls++ === 0 ? 0 : 5000));
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 12, concurrency: 1, now });
    const result = await scraper.scrape({ delayMs: 0, maxRuntimeMs: 1000 });

    // Sitemap fetch only — the budget check aborts before the first product fetch.
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    expect(result.listings).toHaveLength(0);
    expect(
      result.errors.some((e) => e.includes('Aborted after exceeding safety-net runtime')),
    ).toBe(true);
  });

  it('returns the products collected so far (partial) when the budget is exceeded mid-run', async () => {
    const fetcher = makeFetcher(
      { [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP, [INSTOCK_URL]: INSTOCK },
      PAPERBACK,
    );
    // startedAt=0; first two worker iterations under budget, then over.
    let calls = 0;
    const now = vi.fn(() => {
      const c = calls++;
      return c <= 2 ? 0 : 10_000;
    });
    const scraper = new LaboratoryScraper(fetcher, {
      maxProducts: 12,
      concurrency: 1,
      maxRuntimeMs: 5000,
      now,
    });
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings.length).toBeGreaterThan(0);
    expect(result.listings.length).toBeLessThan(12);
    expect(
      result.errors.some((e) => e.includes('Aborted after exceeding safety-net runtime')),
    ).toBe(true);
  });

  it('does not abort a healthy run that finishes within the budget', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP,
      [INSTOCK_URL]: INSTOCK,
    });
    // Clock never advances → budget never reached.
    const scraper = new LaboratoryScraper(fetcher, {
      maxProducts: 12,
      concurrency: 4,
      maxRuntimeMs: 30 * 60 * 1000,
      now: () => 0,
    });
    const result = await scraper.scrape({ delayMs: 0 });

    expect(
      result.errors.some((e) => e.includes('Aborted after exceeding safety-net runtime')),
    ).toBe(false);
    expect(result.listings.map((l) => l.url)).toEqual([INSTOCK_URL]);
  });
});

// ──────────────────────────────────────────────────────────────
// Error resilience — never throws
// ──────────────────────────────────────────────────────────────

describe('LaboratoryScraper.scrape — error handling', () => {
  it('records a per-product fetch error and continues', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP,
      [PAPERBACK_URL]: () => {
        throw new Error('socket hang up');
      },
      [INSTOCK_URL]: INSTOCK,
    });
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 12, sleep: noSleep });
    const result = await scraper.scrape({ delayMs: 0 });

    // The throwing product is skipped; the other product is still collected.
    expect(result.listings.map((l) => l.url)).toEqual([INSTOCK_URL]);
    expect(
      result.errors.some((e) => e.includes(PAPERBACK_URL) && e.includes('socket hang up')),
    ).toBe(true);
  });

  it('returns an empty run with an error when the sitemap fetch fails', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: httpError(404, 'Not Found'),
    });
    const scraper = new LaboratoryScraper(fetcher, { sleep: noSleep });
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(0);
    expect(result.errors.some((e) => e.includes('404'))).toBe(true);
    // No product fetches attempted.
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns an empty run with an error when the sitemap has no <loc> entries', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: '<urlset></urlset>',
    });
    const scraper = new LaboratoryScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports a Cloudflare challenge when the sitemap is an interstitial', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]:
        '<html><body>Just a moment... checking your browser before accessing</body></html>',
    });
    const scraper = new LaboratoryScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(0);
    expect(result.errors.some((e) => e.includes('Cloudflare'))).toBe(true);
  });

  it('reports HTTP 403 when the sitemap body is a forbidden page', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: '<html><body>403 Forbidden — access denied</body></html>',
    });
    const scraper = new LaboratoryScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.errors.some((e) => e.includes('HTTP 403'))).toBe(true);
  });

  it('reports HTTP 403 when the sitemap fetch throws a forbidden error', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: () => {
        throw new Error('Request failed with status code 403');
      },
    });
    const scraper = new LaboratoryScraper(fetcher, { sleep: noSleep });
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.errors.some((e) => e.includes('HTTP 403'))).toBe(true);
  });

  it('does not throw and returns a well-formed ScraperResult shape', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP,
      [INSTOCK_URL]: INSTOCK,
    });
    const scraper = new LaboratoryScraper(fetcher, { maxProducts: 12 });
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result).toMatchObject({
      provider: 'laboratory',
      listings: expect.any(Array),
      errors: expect.any(Array),
      scrapedAt: expect.any(String),
    });
  });
});
