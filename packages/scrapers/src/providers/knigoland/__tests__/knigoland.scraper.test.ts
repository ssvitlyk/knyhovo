import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { KnigolandScraper } from '../knigoland.scraper.js';
import { KNIGOLAND_SITEMAP_INDEX_URL } from '../constants.js';
import type { HtmlFetcher } from '../../../http/html-fetcher.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

const INSTOCK = loadFixture('product-instock.html');
const INSTOCK2 = loadFixture('product-instock-2.html');
const OOS = loadFixture('product-outofstock.html');
const NONBOOK = loadFixture('product-nonbook.html');

const INSTOCK_URL = 'https://knigoland.com.ua/his-last-bow-item';
const INSTOCK2_URL = 'https://knigoland.com.ua/gra-v-biser-item';
const OOS_URL = 'https://knigoland.com.ua/galapagos-item';
const NONBOOK_URL = 'https://knigoland.com.ua/kartonnyy-konstruktor-cartonic-3d-puzzle-boxer-item';

const CP = 'https://knigoland.com.ua/sitemaps/sections/catalog-products-';

/** Build a sitemap-index XML pointing at the given product sub-sitemap URLs. */
function makeIndex(subSitemapUrls: string[]): string {
  const entries = subSitemapUrls.map((u) => `<sitemap><loc>${u}</loc></sitemap>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex>${entries}</sitemapindex>`;
}

/** Build a product sub-sitemap XML listing the given product-page URLs. */
function makeSitemap(urls: string[]): string {
  const entries = urls.map((u) => `<url><loc>${u}</loc></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset>${entries}</urlset>`;
}

/**
 * Build an HtmlFetcher whose responses are keyed by URL. URLs not in the map fall
 * back to `defaultResponse` (an empty page by default). A function value is invoked
 * (used to simulate a network error by throwing).
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

function networkError(): never {
  throw new Error('network down');
}

// ──────────────────────────────────────────────────────────────
// Successful index-driven scrape
// ──────────────────────────────────────────────────────────────

describe('KnigolandScraper.scrape — index traversal + per-product fetch', () => {
  it('walks the index → sub-sitemaps → product pages and combines book listings', async () => {
    const fetcher = makeFetcher({
      [KNIGOLAND_SITEMAP_INDEX_URL]: makeIndex([`${CP}1.xml`, `${CP}2.xml`]),
      [`${CP}1.xml`]: makeSitemap([INSTOCK_URL, NONBOOK_URL]),
      [`${CP}2.xml`]: makeSitemap([INSTOCK2_URL, OOS_URL]),
      [INSTOCK_URL]: INSTOCK,
      [INSTOCK2_URL]: INSTOCK2,
      [OOS_URL]: OOS,
      [NONBOOK_URL]: NONBOOK,
    });
    const scraper = new KnigolandScraper(fetcher, KNIGOLAND_SITEMAP_INDEX_URL, 50);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.provider).toBe('knigoland');
    expect(result.scrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // The non-book (puzzle) is dropped; the three books are kept.
    expect(result.listings.map((l) => l.url).sort()).toEqual(
      [INSTOCK_URL, INSTOCK2_URL, OOS_URL].sort(),
    );
  });

  it('keeps the non-book silent skip noise-free — no scrape errors at all', async () => {
    const fetcher = makeFetcher({
      [KNIGOLAND_SITEMAP_INDEX_URL]: makeIndex([`${CP}1.xml`]),
      [`${CP}1.xml`]: makeSitemap([INSTOCK_URL, NONBOOK_URL]),
      [INSTOCK_URL]: INSTOCK,
      [NONBOOK_URL]: NONBOOK,
    });
    const scraper = new KnigolandScraper(fetcher, KNIGOLAND_SITEMAP_INDEX_URL, 50);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.errors).toEqual([]);
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]?.url).toBe(INSTOCK_URL);
  });

  it('fetches each non-book page exactly once and never retries after a skip', async () => {
    const fetcher = makeFetcher({
      [KNIGOLAND_SITEMAP_INDEX_URL]: makeIndex([`${CP}1.xml`, `${CP}2.xml`]),
      // The same non-book URL appears in two sub-sitemaps; dedup must collapse it.
      [`${CP}1.xml`]: makeSitemap([NONBOOK_URL, INSTOCK_URL]),
      [`${CP}2.xml`]: makeSitemap([NONBOOK_URL]),
      [INSTOCK_URL]: INSTOCK,
      [NONBOOK_URL]: NONBOOK,
    });
    const scraper = new KnigolandScraper(fetcher, KNIGOLAND_SITEMAP_INDEX_URL, 50);
    const result = await scraper.scrape({ delayMs: 0 });

    const fetchMock = vi.mocked(fetcher.fetch);
    const nonbookFetches = fetchMock.mock.calls.filter(([u]) => u === NONBOOK_URL).length;
    expect(nonbookFetches).toBe(1);
    expect(result.errors.some((e) => e.includes(NONBOOK_URL))).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────
// Discovery details — real index, dedup, cap
// ──────────────────────────────────────────────────────────────

describe('KnigolandScraper.scrape — discovery', () => {
  it('fetches only the catalog-products sub-sitemaps from the real index', async () => {
    const fetcher = makeFetcher({
      [KNIGOLAND_SITEMAP_INDEX_URL]: loadFixture('sitemap-index.xml'),
    });
    const scraper = new KnigolandScraper(fetcher, KNIGOLAND_SITEMAP_INDEX_URL, 50);
    await scraper.scrape({ delayMs: 0 });

    const fetched = vi.mocked(fetcher.fetch).mock.calls.map(([u]) => u);
    for (let n = 1; n <= 5; n++) {
      expect(fetched).toContain(`${CP}${n}.xml`);
    }
    expect(fetched.some((u) => u.includes('/images/'))).toBe(false);
    expect(fetched.some((u) => u.includes('authors-items'))).toBe(false);
  });

  it('deduplicates product URLs that appear across multiple sub-sitemaps', async () => {
    const fetcher = makeFetcher({
      [KNIGOLAND_SITEMAP_INDEX_URL]: makeIndex([`${CP}1.xml`, `${CP}2.xml`]),
      [`${CP}1.xml`]: makeSitemap([INSTOCK_URL]),
      [`${CP}2.xml`]: makeSitemap([INSTOCK_URL]),
      [INSTOCK_URL]: INSTOCK,
    });
    const scraper = new KnigolandScraper(fetcher, KNIGOLAND_SITEMAP_INDEX_URL, 50);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(1);
    const instockFetches = vi
      .mocked(fetcher.fetch)
      .mock.calls.filter(([u]) => u === INSTOCK_URL).length;
    expect(instockFetches).toBe(1);
  });

  it('caps product fetches at maxProducts, with options.maxPages as override', async () => {
    const responses = {
      [KNIGOLAND_SITEMAP_INDEX_URL]: makeIndex([`${CP}1.xml`]),
      [`${CP}1.xml`]: makeSitemap([INSTOCK_URL, INSTOCK2_URL, OOS_URL]),
      [INSTOCK_URL]: INSTOCK,
      [INSTOCK2_URL]: INSTOCK2,
      [OOS_URL]: OOS,
    };
    const capped = await new KnigolandScraper(makeFetcher(responses), KNIGOLAND_SITEMAP_INDEX_URL, 2).scrape(
      { delayMs: 0 },
    );
    expect(capped.listings).toHaveLength(2);

    const overridden = await new KnigolandScraper(
      makeFetcher(responses),
      KNIGOLAND_SITEMAP_INDEX_URL,
      1,
    ).scrape({ maxPages: 3, delayMs: 0 });
    expect(overridden.listings).toHaveLength(3);
  });
});

// ──────────────────────────────────────────────────────────────
// Error handling — never throws
// ──────────────────────────────────────────────────────────────

describe('KnigolandScraper.scrape — error handling', () => {
  it('records a product fetch error and continues with the rest', async () => {
    const fetcher = makeFetcher({
      [KNIGOLAND_SITEMAP_INDEX_URL]: makeIndex([`${CP}1.xml`]),
      [`${CP}1.xml`]: makeSitemap([INSTOCK_URL, OOS_URL]),
      [INSTOCK_URL]: networkError,
      [OOS_URL]: OOS,
    });
    const scraper = new KnigolandScraper(fetcher, KNIGOLAND_SITEMAP_INDEX_URL, 50);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings.map((l) => l.url)).toEqual([OOS_URL]);
    expect(result.errors.some((e) => e.includes(INSTOCK_URL) && e.includes('fetch error'))).toBe(
      true,
    );
  });

  it('records a sub-sitemap fetch error and continues with the other sub-sitemaps', async () => {
    const fetcher = makeFetcher({
      [KNIGOLAND_SITEMAP_INDEX_URL]: makeIndex([`${CP}1.xml`, `${CP}2.xml`]),
      [`${CP}1.xml`]: networkError,
      [`${CP}2.xml`]: makeSitemap([INSTOCK_URL]),
      [INSTOCK_URL]: INSTOCK,
    });
    const scraper = new KnigolandScraper(fetcher, KNIGOLAND_SITEMAP_INDEX_URL, 50);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings.map((l) => l.url)).toEqual([INSTOCK_URL]);
    expect(result.errors.some((e) => e.includes(`${CP}1.xml`) && e.includes('fetch error'))).toBe(
      true,
    );
  });

  it('returns an empty run with an error when the index fetch fails', async () => {
    const fetcher = makeFetcher({ [KNIGOLAND_SITEMAP_INDEX_URL]: networkError });
    const scraper = new KnigolandScraper(fetcher, KNIGOLAND_SITEMAP_INDEX_URL, 50);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns a well-formed ScraperResult', async () => {
    const fetcher = makeFetcher({
      [KNIGOLAND_SITEMAP_INDEX_URL]: makeIndex([`${CP}1.xml`]),
      [`${CP}1.xml`]: makeSitemap([INSTOCK_URL]),
      [INSTOCK_URL]: INSTOCK,
    });
    const scraper = new KnigolandScraper(fetcher, KNIGOLAND_SITEMAP_INDEX_URL, 50);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.provider).toBe('knigoland');
    expect(Array.isArray(result.listings)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.scrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
