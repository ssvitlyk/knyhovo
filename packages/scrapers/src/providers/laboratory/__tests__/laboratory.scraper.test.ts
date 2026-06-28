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
    const scraper = new LaboratoryScraper(fetcher, LABORATORY_PRODUCTS_SITEMAP_URL, 12);
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
    const scraper = new LaboratoryScraper(fetcher, LABORATORY_PRODUCTS_SITEMAP_URL, 12);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.url).toBe(INSTOCK_URL);
  });

  it('respects the maxProducts cap via options.maxPages', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP,
      [INSTOCK_URL]: INSTOCK,
    });
    const scraper = new LaboratoryScraper(fetcher, LABORATORY_PRODUCTS_SITEMAP_URL, 50);
    await scraper.scrape({ maxPages: 3, delayMs: 0 });

    // 1 sitemap fetch + 3 product fetches (cap), not all 12.
    expect(fetcher.fetch).toHaveBeenCalledTimes(4);
  });

  it('uses the provider-local default cap when maxPages is omitted', async () => {
    const fetcher = makeFetcher({ [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP });
    const scraper = new LaboratoryScraper(fetcher, LABORATORY_PRODUCTS_SITEMAP_URL, 5);
    await scraper.scrape({ delayMs: 0 });

    // sitemap has 12 URLs but the cap is 5 → 1 + 5 fetches.
    expect(fetcher.fetch).toHaveBeenCalledTimes(6);
  });
});

// ──────────────────────────────────────────────────────────────
// Error resilience — never throws
// ──────────────────────────────────────────────────────────────

describe('LaboratoryScraper.scrape — error handling', () => {
  it('records a per-product fetch error and continues the loop', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP,
      [PAPERBACK_URL]: () => {
        throw new Error('socket hang up');
      },
      [INSTOCK_URL]: INSTOCK,
    });
    const scraper = new LaboratoryScraper(fetcher, LABORATORY_PRODUCTS_SITEMAP_URL, 12);
    const result = await scraper.scrape({ delayMs: 0 });

    // The throwing product is skipped; the loop continues to the other product.
    expect(result.listings.map((l) => l.url)).toEqual([INSTOCK_URL]);
    expect(
      result.errors.some((e) => e.includes(PAPERBACK_URL) && e.includes('socket hang up')),
    ).toBe(true);
  });

  it('returns an empty run with an error when the sitemap fetch fails', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: () => {
        throw new Error('ETIMEDOUT');
      },
    });
    const scraper = new LaboratoryScraper(fetcher, LABORATORY_PRODUCTS_SITEMAP_URL);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(0);
    expect(result.errors.some((e) => e.includes('ETIMEDOUT'))).toBe(true);
    // No product fetches attempted.
    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns an empty run with an error when the sitemap has no <loc> entries', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: '<urlset></urlset>',
    });
    const scraper = new LaboratoryScraper(fetcher, LABORATORY_PRODUCTS_SITEMAP_URL);
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
    const scraper = new LaboratoryScraper(fetcher, LABORATORY_PRODUCTS_SITEMAP_URL);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(0);
    expect(result.errors.some((e) => e.includes('Cloudflare'))).toBe(true);
  });

  it('reports HTTP 403 when the sitemap body is a forbidden page', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: '<html><body>403 Forbidden — access denied</body></html>',
    });
    const scraper = new LaboratoryScraper(fetcher, LABORATORY_PRODUCTS_SITEMAP_URL);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.errors.some((e) => e.includes('HTTP 403'))).toBe(true);
  });

  it('reports HTTP 403 when the sitemap fetch throws a forbidden error', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: () => {
        throw new Error('Request failed with status code 403');
      },
    });
    const scraper = new LaboratoryScraper(fetcher, LABORATORY_PRODUCTS_SITEMAP_URL);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.errors.some((e) => e.includes('HTTP 403'))).toBe(true);
  });

  it('waits delayMs between product fetches (fake timers, deterministic)', async () => {
    vi.useFakeTimers();
    try {
      const fetcher = makeFetcher({ [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP }, INSTOCK);
      const scraper = new LaboratoryScraper(fetcher, LABORATORY_PRODUCTS_SITEMAP_URL, 2);
      const promise = scraper.scrape({ delayMs: 100 });
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.listings).toHaveLength(1); // both pages dedupe to one URL
      expect(fetcher.fetch).toHaveBeenCalledTimes(3); // sitemap + 2 products
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not throw and returns a well-formed ScraperResult shape', async () => {
    const fetcher = makeFetcher({
      [LABORATORY_PRODUCTS_SITEMAP_URL]: SITEMAP,
      [INSTOCK_URL]: INSTOCK,
    });
    const scraper = new LaboratoryScraper(fetcher, LABORATORY_PRODUCTS_SITEMAP_URL, 12);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result).toMatchObject({
      provider: 'laboratory',
      listings: expect.any(Array),
      errors: expect.any(Array),
      scrapedAt: expect.any(String),
    });
  });
});
