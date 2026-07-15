import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { BookChefScraper } from '../bookchef.scraper.js';
import { BOOKCHEF_PRODUCTS_SITEMAP_URL } from '../constants.js';
import type { HtmlFetcher } from '../../../http/html-fetcher.js';

const NOOP_SLEEP = { sleep: async (): Promise<void> => {} };

function abortError(message = 'This operation was aborted'): Error {
  const e = new Error(message);
  e.name = 'AbortError';
  return e;
}

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

const INSTOCK = loadFixture('product-instock.html');
const PREORDER = loadFixture('product-preorder.html');
const OUTOFSTOCK = loadFixture('product-outofstock.html');

const INSTOCK_URL = 'https://bookchef.ua/na-vershynu-svitu';
const PREORDER_URL = 'https://bookchef.ua/donka-zemli';
const OUTOFSTOCK_URL = 'https://bookchef.ua/aliaska';

// Realistic BookChef sitemap shape: xmlns + <lastmod> with a +03:00 offset,
// matching the live-recon sample quoted in the PRD (2026-07-13).
function buildSitemap(entries: ReadonlyArray<{ url: string; lastmod: string | null }>): string {
  const urlBlocks = entries
    .map(
      ({ url, lastmod }) =>
        `  <url>\n    <loc>${url}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlBlocks}\n</urlset>`;
}

function makeFetcher(responses: Record<string, string | (() => never)>, defaultResponse = ''): HtmlFetcher {
  return {
    fetch: vi.fn(async (url: string) => {
      const r = url in responses ? responses[url] : defaultResponse;
      if (typeof r === 'function') return r();
      return r;
    }),
  };
}

describe('BookChefScraper.scrape — full mode (no knownSourceLastmod)', () => {
  it('fetches every sitemap entry, same as before the incremental change', async () => {
    const sitemap = buildSitemap([
      { url: INSTOCK_URL, lastmod: '2026-07-08T16:00:45+03:00' },
      { url: PREORDER_URL, lastmod: '2026-07-01T10:00:00+03:00' },
      { url: OUTOFSTOCK_URL, lastmod: null },
    ]);
    const fetcher = makeFetcher({
      [BOOKCHEF_PRODUCTS_SITEMAP_URL]: sitemap,
      [INSTOCK_URL]: INSTOCK,
      [PREORDER_URL]: PREORDER,
      [OUTOFSTOCK_URL]: OUTOFSTOCK,
    });
    const scraper = new BookChefScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    const urls = result.listings.map((l) => l.url).sort();
    expect(urls).toEqual([INSTOCK_URL, OUTOFSTOCK_URL, PREORDER_URL].sort());
    // sitemap call + 3 product calls, no skips.
    expect(fetcher.fetch).toHaveBeenCalledTimes(4);
  });

  it('carries the full sitemap presence list on ScraperResult', async () => {
    const sitemap = buildSitemap([
      { url: INSTOCK_URL, lastmod: '2026-07-08T16:00:45+03:00' },
      { url: PREORDER_URL, lastmod: null },
    ]);
    const fetcher = makeFetcher({
      [BOOKCHEF_PRODUCTS_SITEMAP_URL]: sitemap,
      [INSTOCK_URL]: INSTOCK,
      [PREORDER_URL]: PREORDER,
    });
    const scraper = new BookChefScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.sitemap).toEqual({
      entries: [
        { url: INSTOCK_URL, lastmod: '2026-07-08T13:00:45.000Z' },
        { url: PREORDER_URL, lastmod: null },
      ],
    });
  });

  it('attaches sourceLastmod (normalized) to each listing', async () => {
    const sitemap = buildSitemap([{ url: INSTOCK_URL, lastmod: '2026-07-08T16:00:45+03:00' }]);
    const fetcher = makeFetcher({
      [BOOKCHEF_PRODUCTS_SITEMAP_URL]: sitemap,
      [INSTOCK_URL]: INSTOCK,
    });
    const scraper = new BookChefScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings[0]?.sourceLastmod).toBe('2026-07-08T13:00:45.000Z');
  });

  it('attaches a null sourceLastmod when the sitemap entry had no lastmod', async () => {
    const sitemap = buildSitemap([{ url: INSTOCK_URL, lastmod: null }]);
    const fetcher = makeFetcher({
      [BOOKCHEF_PRODUCTS_SITEMAP_URL]: sitemap,
      [INSTOCK_URL]: INSTOCK,
    });
    const scraper = new BookChefScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings[0]?.sourceLastmod).toBeNull();
  });
});

describe('BookChefScraper.scrape — incremental mode (knownSourceLastmod provided)', () => {
  it('fetches only new and changed URLs, skipping unchanged ones', async () => {
    const sitemap = buildSitemap([
      { url: INSTOCK_URL, lastmod: '2026-07-08T16:00:45+03:00' }, // changed (newer than known)
      { url: PREORDER_URL, lastmod: '2026-07-01T10:00:00+03:00' }, // unchanged (equal to known)
      { url: OUTOFSTOCK_URL, lastmod: '2026-07-05T00:00:00+03:00' }, // new (absent from known)
    ]);
    const fetcher = makeFetcher({
      [BOOKCHEF_PRODUCTS_SITEMAP_URL]: sitemap,
      [INSTOCK_URL]: INSTOCK,
      [PREORDER_URL]: PREORDER,
      [OUTOFSTOCK_URL]: OUTOFSTOCK,
    });
    const known = new Map<string, string>([
      [INSTOCK_URL, '2026-07-01T00:00:00.000Z'], // older than the new sitemap lastmod
      [PREORDER_URL, '2026-07-01T07:00:00.000Z'], // equals 2026-07-01T10:00:00+03:00 in UTC
    ]);
    const scraper = new BookChefScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0, knownSourceLastmod: known });

    const fetchedUrls = result.listings.map((l) => l.url).sort();
    expect(fetchedUrls).toEqual([INSTOCK_URL, OUTOFSTOCK_URL].sort());
    // sitemap call + 2 product calls (PREORDER_URL skipped as unchanged).
    expect(fetcher.fetch).toHaveBeenCalledTimes(3);
    expect(fetcher.fetch).not.toHaveBeenCalledWith(PREORDER_URL, expect.anything());
  });

  it('always fetches an entry whose sitemap lastmod is null, even with a known watermark', async () => {
    const sitemap = buildSitemap([{ url: INSTOCK_URL, lastmod: null }]);
    const fetcher = makeFetcher({
      [BOOKCHEF_PRODUCTS_SITEMAP_URL]: sitemap,
      [INSTOCK_URL]: INSTOCK,
    });
    const known = new Map<string, string>([[INSTOCK_URL, '2026-07-01T00:00:00.000Z']]);
    const scraper = new BookChefScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0, knownSourceLastmod: known });

    expect(result.listings.map((l) => l.url)).toEqual([INSTOCK_URL]);
    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
  });

  it('carries the full sitemap presence list even when most entries are skipped', async () => {
    const sitemap = buildSitemap([
      { url: INSTOCK_URL, lastmod: '2026-07-08T16:00:45+03:00' },
      { url: PREORDER_URL, lastmod: '2026-07-01T10:00:00+03:00' },
    ]);
    const fetcher = makeFetcher({
      [BOOKCHEF_PRODUCTS_SITEMAP_URL]: sitemap,
      [INSTOCK_URL]: INSTOCK,
    });
    const known = new Map<string, string>([
      [INSTOCK_URL, '2026-07-01T00:00:00.000Z'],
      [PREORDER_URL, '2026-07-01T07:00:00.000Z'],
    ]);
    const scraper = new BookChefScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0, knownSourceLastmod: known });

    expect(result.sitemap?.entries).toHaveLength(2);
    // Only 1 product fetch (INSTOCK) despite 2 sitemap entries.
    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
  });

  it('logs a summary of entries/toFetch/unchanged when a logger is supplied', async () => {
    const sitemap = buildSitemap([
      { url: INSTOCK_URL, lastmod: '2026-07-08T16:00:45+03:00' },
      { url: PREORDER_URL, lastmod: '2026-07-01T10:00:00+03:00' },
    ]);
    const fetcher = makeFetcher({
      [BOOKCHEF_PRODUCTS_SITEMAP_URL]: sitemap,
      [INSTOCK_URL]: INSTOCK,
    });
    const known = new Map<string, string>([
      [INSTOCK_URL, '2026-07-01T00:00:00.000Z'],
      [PREORDER_URL, '2026-07-01T07:00:00.000Z'],
    ]);
    const info = vi.fn();
    const scraper = new BookChefScraper(fetcher);
    await scraper.scrape({ delayMs: 0, knownSourceLastmod: known, logger: { info } });

    expect(info).toHaveBeenCalledWith(expect.stringContaining('unchangedSkipped=1'));
  });
});

// Fetch-progress logging (bookchef-fetch-progress-logging): a full run walks
// up to ~15k pages over multiple hours with zero output between the
// sitemap-plan log and the final result. These tests generate large synthetic
// sitemaps (well past FETCH_PROGRESS_EVERY = 100) to verify progress lines
// fire on both healthy and all-erroring runs, and that a final summary always
// logs. `delayMs: 0` keeps the tests fast.
describe('BookChefScraper.scrape — fetch progress logging', () => {
  function buildManySitemap(n: number): { xml: string; urls: string[] } {
    const urls = Array.from({ length: n }, (_, i) => `https://bookchef.ua/product-${i}`);
    const xml = buildSitemap(urls.map((url) => ({ url, lastmod: null })));
    return { xml, urls };
  }

  it('logs progress every 100 pages plus a final summary on a healthy run', async () => {
    const { xml, urls } = buildManySitemap(200);
    const responses: Record<string, string> = { [BOOKCHEF_PRODUCTS_SITEMAP_URL]: xml };
    // Each product must carry a distinct URL in its JSON-LD `offers.url` (what
    // `listing.url` is read from) — otherwise the scraper's own same-URL
    // dedup (see bookchef.scraper.ts) would collapse all 200 into one listing.
    for (const url of urls) responses[url] = INSTOCK.replaceAll(INSTOCK_URL, url);
    const fetcher = makeFetcher(responses);
    const info = vi.fn();
    const scraper = new BookChefScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0, logger: { info } });

    const lines = info.mock.calls.map((call) => call[0] as string);
    expect(
      lines.some((l) => l.includes('BookChef progress: current=100 total=200 ok=100 errors=0')),
    ).toBe(true);
    expect(
      lines.some((l) => l.includes('BookChef progress: current=200 total=200 ok=200 errors=0')),
    ).toBe(true);
    expect(
      lines.some((l) => l.includes('bookchef: fetch complete — 200 listings, 0 errors in')),
    ).toBe(true);
    expect(result.listings).toHaveLength(200);
    expect(result.errors).toHaveLength(0);
  }, 20_000);

  it('counts error iterations toward progress and the final summary', async () => {
    const { xml, urls } = buildManySitemap(100);
    const responses: Record<string, string | (() => never)> = {
      [BOOKCHEF_PRODUCTS_SITEMAP_URL]: xml,
    };
    for (const url of urls) {
      responses[url] = () => {
        throw new Error('boom');
      };
    }
    const fetcher = makeFetcher(responses);
    const info = vi.fn();
    const scraper = new BookChefScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0, logger: { info } });

    const lines = info.mock.calls.map((call) => call[0] as string);
    expect(
      lines.some((l) => l.includes('BookChef progress: current=100 total=100 ok=0 errors=100')),
    ).toBe(true);
    expect(
      lines.some((l) => l.includes('bookchef: fetch complete — 0 listings, 100 errors in')),
    ).toBe(true);
    expect(result.listings).toHaveLength(0);
    expect(result.errors).toHaveLength(100);
  });
});

// Per-stage debug logging (debugFetchStages): identifies exactly which await
// a hung production process is sitting on. Zero behavior change when off.
describe('BookChefScraper.scrape — debugFetchStages', () => {
  function buildManySitemap(n: number): { xml: string; urls: string[] } {
    const urls = Array.from({ length: n }, (_, i) => `https://bookchef.ua/product-${i}`);
    const xml = buildSitemap(urls.map((url) => ({ url, lastmod: null })));
    return { xml, urls };
  }

  it('emits fetch/parse/sleep stage lines in order per page when enabled', async () => {
    const { xml, urls } = buildManySitemap(3);
    const responses: Record<string, string> = { [BOOKCHEF_PRODUCTS_SITEMAP_URL]: xml };
    for (const url of urls) responses[url] = INSTOCK.replaceAll(INSTOCK_URL, url);
    const fetcher = makeFetcher(responses);
    const info = vi.fn();
    const scraper = new BookChefScraper(fetcher);
    await scraper.scrape({ delayMs: 1, logger: { info }, debugFetchStages: true });

    const lines = info.mock.calls.map((call) => call[0] as string).filter((l) => l.includes('[stage]'));
    expect(lines).toEqual([
      expect.stringContaining('bookchef: [stage] fetch started 1/3'),
      expect.stringMatching(/bookchef: \[stage\] fetch completed 1 \(\d+ms\)/),
      'bookchef: [stage] parse completed 1',
      'bookchef: [stage] sleep completed 1',
      expect.stringContaining('bookchef: [stage] fetch started 2/3'),
      expect.stringMatching(/bookchef: \[stage\] fetch completed 2 \(\d+ms\)/),
      'bookchef: [stage] parse completed 2',
      'bookchef: [stage] sleep completed 2',
      expect.stringContaining('bookchef: [stage] fetch started 3/3'),
      expect.stringMatching(/bookchef: \[stage\] fetch completed 3 \(\d+ms\)/),
      'bookchef: [stage] parse completed 3',
    ]);
  });

  it('emits no [stage] lines when the flag is absent', async () => {
    const { xml, urls } = buildManySitemap(2);
    const responses: Record<string, string> = { [BOOKCHEF_PRODUCTS_SITEMAP_URL]: xml };
    for (const url of urls) responses[url] = INSTOCK.replaceAll(INSTOCK_URL, url);
    const fetcher = makeFetcher(responses);
    const info = vi.fn();
    const scraper = new BookChefScraper(fetcher);
    await scraper.scrape({ delayMs: 0, logger: { info } });

    const lines = info.mock.calls.map((call) => call[0] as string);
    expect(lines.some((l) => l.includes('[stage]'))).toBe(false);
  });
});

// Sitemap retry policy (bookchef silent-stall fix): the sitemap fetch is
// separated from the product-page fetch (its own longer timeout) and retried
// with backoff on transient failures via the shared `fetchWithRetry` helper.
describe('BookChefScraper.scrape — sitemap retry policy', () => {
  it('fetches the sitemap once with its own 60s timeout, separate from the 10s product timeout', async () => {
    const sitemap = buildSitemap([{ url: INSTOCK_URL, lastmod: null }]);
    const fetcher = makeFetcher({
      [BOOKCHEF_PRODUCTS_SITEMAP_URL]: sitemap,
      [INSTOCK_URL]: INSTOCK,
    });
    const scraper = new BookChefScraper(fetcher, undefined, undefined, NOOP_SLEEP);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(1);
    const calls = (fetcher.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.filter(([url]) => url === BOOKCHEF_PRODUCTS_SITEMAP_URL)).toHaveLength(1);
    expect(fetcher.fetch).toHaveBeenCalledWith(BOOKCHEF_PRODUCTS_SITEMAP_URL, 60_000);
    expect(fetcher.fetch).toHaveBeenCalledWith(INSTOCK_URL, 10_000);
  });

  it('retries the sitemap fetch and succeeds on the 3rd attempt', async () => {
    const sitemap = buildSitemap([{ url: INSTOCK_URL, lastmod: null }]);
    let sitemapCalls = 0;
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async (url: string) => {
        if (url === BOOKCHEF_PRODUCTS_SITEMAP_URL) {
          sitemapCalls++;
          if (sitemapCalls < 3) throw abortError();
          return sitemap;
        }
        return INSTOCK;
      }),
    };
    const info = vi.fn();
    const scraper = new BookChefScraper(fetcher, undefined, undefined, NOOP_SLEEP);
    const result = await scraper.scrape({ delayMs: 0, logger: { info } });

    expect(result.listings).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(sitemapCalls).toBe(3);

    const lines = info.mock.calls.map((call) => call[0] as string);
    expect(lines.some((l) => l.includes('sitemap attempt 1/3'))).toBe(true);
    expect(lines.some((l) => l.includes('sitemap attempt 2/3'))).toBe(true);
    expect(lines.some((l) => l.includes('attempt 3/3') || l.includes('on attempt 3'))).toBe(true);
  });

  it('gives up after 3 attempts, all aborting, and returns an empty result with no sitemap field', async () => {
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async () => {
        throw abortError();
      }),
    };
    const scraper = new BookChefScraper(fetcher, undefined, undefined, NOOP_SLEEP);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toEqual([]);
    expect(result.sitemap).toBeUndefined();
    expect(result.errors[0]).toMatch(/Sitemap: network error after 3 attempt/);
    const sitemapCalls = (fetcher.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([url]) => url === BOOKCHEF_PRODUCTS_SITEMAP_URL,
    );
    expect(sitemapCalls).toHaveLength(3);
  });

  it('does not retry a non-retryable HTTP 403 on the sitemap fetch', async () => {
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async () => {
        throw new Error('HTTP 403 Forbidden');
      }),
    };
    const scraper = new BookChefScraper(fetcher, undefined, undefined, NOOP_SLEEP);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    expect(result.errors).toContain('BookChef blocked by HTTP 403, likely anti-bot protection');
  });
});

// Circuit breaker (bookchef silent-stall fix): abort a run after too many
// consecutive network/timeout product-fetch failures rather than silently
// grinding through hours of dead air.
describe('BookChefScraper.scrape — circuit breaker', () => {
  function buildManySitemap(n: number): { xml: string; urls: string[] } {
    const urls = Array.from({ length: n }, (_, i) => `https://bookchef.ua/product-${i}`);
    const xml = buildSitemap(urls.map((url) => ({ url, lastmod: null })));
    return { xml, urls };
  }

  it('trips after N consecutive network failures, discarding fetched listings', async () => {
    const { xml } = buildManySitemap(30);
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async (url: string) => {
        if (url === BOOKCHEF_PRODUCTS_SITEMAP_URL) return xml;
        throw abortError();
      }),
    };
    const scraper = new BookChefScraper(fetcher, undefined, undefined, NOOP_SLEEP);
    const result = await scraper.scrape({ delayMs: 0, maxConsecutiveFetchFailures: 5 });

    expect(result.listings).toEqual([]);
    expect(result.sitemap).toBeUndefined();
    expect(result.errors[0]).toMatch(/^Circuit breaker: aborted after 5 consecutive network failures/);
    const calls = (fetcher.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const productCalls = calls.filter(([url]) => url !== BOOKCHEF_PRODUCTS_SITEMAP_URL);
    expect(productCalls).toHaveLength(5);
    expect(calls).toHaveLength(6); // 1 sitemap + 5 product attempts
  });

  it('resets the counter on a successful fetch, so intermittent failures never trip it', async () => {
    const { xml, urls } = buildManySitemap(10);
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async (url: string) => {
        if (url === BOOKCHEF_PRODUCTS_SITEMAP_URL) return xml;
        const idx = urls.indexOf(url);
        if ((idx + 1) % 3 === 0) return INSTOCK.replaceAll(INSTOCK_URL, url);
        throw abortError();
      }),
    };
    const scraper = new BookChefScraper(fetcher, undefined, undefined, NOOP_SLEEP);
    const result = await scraper.scrape({ delayMs: 0, maxConsecutiveFetchFailures: 4 });

    expect(result.sitemap).toBeDefined();
    const successes = urls.filter((_, i) => (i + 1) % 3 === 0).length;
    expect(result.listings).toHaveLength(successes);
    expect(result.errors).toHaveLength(urls.length - successes);
  });

  it('resets the counter on a non-network error (e.g. HTTP 404), not just successes', async () => {
    const { xml, urls } = buildManySitemap(10);
    // Sequence per URL index: abort, abort, 404, abort, abort, then successes.
    const behaviors: Array<'abort' | '404' | 'ok'> = [
      'abort', 'abort', '404', 'abort', 'abort', 'ok', 'ok', 'ok', 'ok', 'ok',
    ];
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async (url: string) => {
        if (url === BOOKCHEF_PRODUCTS_SITEMAP_URL) return xml;
        const idx = urls.indexOf(url);
        const behavior = behaviors[idx];
        if (behavior === 'abort') throw abortError();
        if (behavior === '404') throw new Error('HTTP 404 Not Found');
        return INSTOCK.replaceAll(INSTOCK_URL, url);
      }),
    };
    const scraper = new BookChefScraper(fetcher, undefined, undefined, NOOP_SLEEP);
    const result = await scraper.scrape({ delayMs: 0, maxConsecutiveFetchFailures: 3 });

    // Never 3 consecutive network failures in a row (404 resets at index 2), so no trip.
    expect(result.sitemap).toBeDefined();
    expect(result.listings).toHaveLength(5);
    expect(result.errors).toHaveLength(5);
  });

  it('trips when the same non-network-reset sequence has 3 real consecutive aborts', async () => {
    const { xml, urls } = buildManySitemap(10);
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async (url: string) => {
        if (url === BOOKCHEF_PRODUCTS_SITEMAP_URL) return xml;
        throw abortError();
      }),
    };
    const scraper = new BookChefScraper(fetcher, undefined, undefined, NOOP_SLEEP);
    const result = await scraper.scrape({ delayMs: 0, maxConsecutiveFetchFailures: 3 });

    expect(result.sitemap).toBeUndefined();
    expect(result.errors[0]).toMatch(/^Circuit breaker: aborted after 3 consecutive network failures/);
    void urls;
  });

  it('includes consecutiveErrors in the progress line', async () => {
    const { xml, urls } = buildManySitemap(200);
    const responses: Record<string, string> = { [BOOKCHEF_PRODUCTS_SITEMAP_URL]: xml };
    for (const url of urls) responses[url] = INSTOCK.replaceAll(INSTOCK_URL, url);
    const fetcher = makeFetcher(responses);
    const info = vi.fn();
    const scraper = new BookChefScraper(fetcher, undefined, undefined, NOOP_SLEEP);
    await scraper.scrape({ delayMs: 0, logger: { info } });

    const lines = info.mock.calls.map((call) => call[0] as string);
    expect(lines.some((l) => l.includes('consecutiveErrors=0'))).toBe(true);
  });
});
