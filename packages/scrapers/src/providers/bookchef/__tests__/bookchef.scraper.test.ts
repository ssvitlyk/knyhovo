import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { BookChefScraper } from '../bookchef.scraper.js';
import { BOOKCHEF_PRODUCTS_SITEMAP_URL } from '../constants.js';
import type { HtmlFetcher } from '../../../http/html-fetcher.js';

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
