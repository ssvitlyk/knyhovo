import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { YakabooScraper } from '../yakaboo.scraper.js';
import type { HtmlFetcher } from '../../../http/html-fetcher.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8');
}

/** Build an HtmlFetcher mock that returns predefined pages by call order. */
function makeFetcher(pages: string[]): HtmlFetcher {
  let callCount = 0;
  return {
    fetch: vi.fn(async () => {
      const html = pages[callCount] ?? '';
      callCount++;
      return html;
    }),
  };
}

// ──────────────────────────────────────────────────────────────
// Successful multi-page scrape
// ──────────────────────────────────────────────────────────────

describe('YakabooScraper.scrape — successful pages', () => {
  it('returns combined listings from multiple pages', async () => {
    const catalogPage = loadFixture('catalog-page.html');
    const emptyPage = loadFixture('catalog-empty.html');
    const fetcher = makeFetcher([catalogPage, emptyPage]);

    const scraper = new YakabooScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.provider).toBe('yakaboo');
    expect(result.listings).toHaveLength(4);
    expect(result.errors).toHaveLength(0);
    expect(result.scrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('stops at empty page without fetching more', async () => {
    const catalogPage = loadFixture('catalog-page.html');
    const emptyPage = loadFixture('catalog-empty.html');
    const fetcher = makeFetcher([catalogPage, emptyPage]);

    const scraper = new YakabooScraper(fetcher);
    await scraper.scrape({ delayMs: 0 });

    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates listings with identical URLs', async () => {
    const catalogPage = loadFixture('catalog-page.html');
    const fetcher = makeFetcher([catalogPage, catalogPage, loadFixture('catalog-empty.html')]);

    const scraper = new YakabooScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(4);
  });

  it('respects maxPages option', async () => {
    const catalogPage = loadFixture('catalog-page.html');
    const fetcher = makeFetcher([catalogPage, catalogPage, catalogPage]);

    const scraper = new YakabooScraper(fetcher);
    const result = await scraper.scrape({ maxPages: 2, delayMs: 0 });

    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
    expect(result.listings).toHaveLength(4);
  });

  it('all listings have isbn = null', async () => {
    const fetcher = makeFetcher([loadFixture('catalog-page.html'), loadFixture('catalog-empty.html')]);
    const scraper = new YakabooScraper(fetcher);
    const { listings } = await scraper.scrape({ delayMs: 0 });
    for (const l of listings) expect(l.isbn).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// Network error handling
// ──────────────────────────────────────────────────────────────

describe('YakabooScraper.scrape — network errors', () => {
  it('catches network error on first page and returns empty listings', async () => {
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    };

    const scraper = new YakabooScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('ECONNREFUSED');
  });

  it('stops pagination after network error (does not fetch more pages)', async () => {
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async () => {
        throw new Error('Timeout');
      }),
    };

    const scraper = new YakabooScraper(fetcher);
    await scraper.scrape({ delayMs: 0 });

    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not throw — returns ScraperResult even on complete failure', async () => {
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async () => {
        throw new Error('Network unavailable');
      }),
    };

    const scraper = new YakabooScraper(fetcher);
    await expect(scraper.scrape({ delayMs: 0 })).resolves.toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────
// ScraperResult shape
// ──────────────────────────────────────────────────────────────

describe('YakabooScraper.scrape — ScraperResult shape', () => {
  it('result conforms to ScraperResult interface', async () => {
    const fetcher = makeFetcher([loadFixture('catalog-empty.html')]);
    const scraper = new YakabooScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result).toMatchObject({
      provider: 'yakaboo',
      listings: expect.any(Array),
      scrapedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      errors: expect.any(Array),
    });
  });
});
