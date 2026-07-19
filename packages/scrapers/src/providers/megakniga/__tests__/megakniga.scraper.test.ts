import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { MegaknigaScraper } from '../megakniga.scraper.js';
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

describe('MegaknigaScraper.scrape — successful pages', () => {
  it('combines listings from multiple distinct catalog pages', async () => {
    const page1 = loadFixture('catalog-page.html');
    const page2 = loadFixture('catalog-page-2.html');
    const empty = loadFixture('catalog-empty.html');
    const fetcher = makeFetcher([page1, page2, empty]);

    const scraper = new MegaknigaScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.provider).toBe('megakniga');
    expect(result.listings).toHaveLength(10); // 6 + 4
    expect(result.errors).toHaveLength(0);
    expect(result.scrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('stops when a page yields zero NEW urls — the paginator repeating the last page', async () => {
    // Megakniga's paginator returns the LAST page verbatim beyond the real last
    // page (recon §7), unlike Vivat's genuinely-empty page. Feeding the same
    // fixture twice reproduces exactly that: page 2 contributes zero new urls.
    const page = loadFixture('catalog-page.html');
    const fetcher = makeFetcher([page, page, page]);

    const scraper = new MegaknigaScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
    expect(result.listings).toHaveLength(6);
  });

  it('stops at a genuinely empty page without fetching more', async () => {
    const fetcher = makeFetcher([loadFixture('catalog-page.html'), loadFixture('catalog-empty.html')]);

    const scraper = new MegaknigaScraper(fetcher);
    await scraper.scrape({ delayMs: 0 });

    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
  });

  it('respects maxPages option', async () => {
    const page1 = loadFixture('catalog-page.html');
    const page2 = loadFixture('catalog-page-2.html');
    const fetcher = makeFetcher([page1, page2, page2]);

    const scraper = new MegaknigaScraper(fetcher);
    const result = await scraper.scrape({ maxPages: 1, delayMs: 0 });

    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
    expect(result.listings).toHaveLength(6);
  });

  it('all listings have isbn = null before enrichment', async () => {
    const fetcher = makeFetcher([loadFixture('catalog-page.html'), loadFixture('catalog-empty.html')]);
    const scraper = new MegaknigaScraper(fetcher);
    const { listings } = await scraper.scrape({ delayMs: 0 });
    for (const l of listings) expect(l.isbn).toBeNull();
  });

  it('builds the expected paginated listing URL', async () => {
    const fetcher = makeFetcher([loadFixture('catalog-empty.html')]);
    const scraper = new MegaknigaScraper(fetcher);
    await scraper.scrape({ delayMs: 0 });
    expect(fetcher.fetch).toHaveBeenCalledWith(
      'https://www.megakniga.com.ua/catalog/knigi/page1?per-page=64',
      expect.any(Number),
    );
  });
});

// ──────────────────────────────────────────────────────────────
// Network error handling
// ──────────────────────────────────────────────────────────────

describe('MegaknigaScraper.scrape — network errors', () => {
  it('catches a non-retryable network error and returns empty listings', async () => {
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    };

    const scraper = new MegaknigaScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0, maxRetries: 0 });

    expect(result.listings).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('ECONNREFUSED');
  });

  it('stops pagination after a network error', async () => {
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async () => {
        throw new Error('boom');
      }),
    };

    const scraper = new MegaknigaScraper(fetcher);
    await scraper.scrape({ delayMs: 0, maxRetries: 0 });

    expect(fetcher.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not throw — resolves a ScraperResult even on complete failure', async () => {
    const fetcher: HtmlFetcher = {
      fetch: vi.fn(async () => {
        throw new Error('Network unavailable');
      }),
    };

    const scraper = new MegaknigaScraper(fetcher);
    await expect(scraper.scrape({ delayMs: 0, maxRetries: 0 })).resolves.toBeDefined();
  });
});

// ──────────────────────────────────────────────────────────────
// Enrichment (opt-in enrichDescriptions)
// ──────────────────────────────────────────────────────────────

describe('MegaknigaScraper.scrape — enrichment', () => {
  it('fills isbn/publisher/format/description/rawCategories from product pages when enrichDescriptions is on', async () => {
    // Single-card catalog page pointing at the Enejida product fixture's own URL,
    // so the enrichment fetch resolves to the matching product page.
    const catalogCard =
      '<div class="product-items-cont items-cont clear-after"><div class="product-list-item">' +
      '<a class="product-list-name" href="/catalog/knigi/proza/klasichna-ukr-l-ra/eneida.html">Енеїда Вергілій</a>' +
      '<div class="authors-block"><span class="bold-text author">Автор:</span><a href="/search">Вергілій</a></div>' +
      '<form data-price="208.40"></form>' +
      '<div class="product-available-container in_stock">Є в наявності</div>' +
      '</div></div>';

    const fetcher = makeFetcher([
      catalogCard,
      loadFixture('catalog-empty.html'),
      loadFixture('product-in-stock.html'),
    ]);

    const scraper = new MegaknigaScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0, enrichDescriptions: true, descriptionDelayMs: 0 });

    expect(result.listings).toHaveLength(1);
    const listing = result.listings[0]!;
    expect(listing.isbn).toBe('9786178493974');
    expect(listing.publisher).toBe('Фоліо');
    expect(listing.format).toBe("М'яка");
    expect(listing.description).toContain('Публій Вергілій Марон');
    expect(listing.rawCategories).toContain('Книги');
  });

  it('performs no product-page requests when enrichDescriptions is off (default)', async () => {
    const fetcher = makeFetcher([loadFixture('catalog-page.html'), loadFixture('catalog-empty.html')]);
    const scraper = new MegaknigaScraper(fetcher);
    await scraper.scrape({ delayMs: 0 });
    // 2 catalog page fetches only — no enrichment pass.
    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
  });

  it('threads the logger into the enrichment pass', async () => {
    const fetcher = makeFetcher([loadFixture('catalog-empty.html')]);
    const lines: string[] = [];

    const scraper = new MegaknigaScraper(fetcher);
    await scraper.scrape({
      delayMs: 0,
      enrichDescriptions: true,
      descriptionDelayMs: 0,
      logger: { info: (m) => lines.push(m) },
    });

    expect(lines).toContain('product enrichment: starting for 0 listings (delayMs=0)');
  });
});

// ──────────────────────────────────────────────────────────────
// ScraperResult shape
// ──────────────────────────────────────────────────────────────

describe('MegaknigaScraper.scrape — ScraperResult shape', () => {
  it('result conforms to ScraperResult interface', async () => {
    const fetcher = makeFetcher([loadFixture('catalog-empty.html')]);
    const scraper = new MegaknigaScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result).toMatchObject({
      provider: 'megakniga',
      listings: expect.any(Array),
      scrapedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      errors: expect.any(Array),
    });
  });

  it('is silent and unchanged without a logger (no-op default)', async () => {
    const fetcher = makeFetcher([loadFixture('catalog-empty.html')]);
    const scraper = new MegaknigaScraper(fetcher);
    const result = await scraper.scrape({ delayMs: 0 });
    expect(result.provider).toBe('megakniga');
  });
});

describe('MegaknigaScraper — enrichmentMode capability', () => {
  it("declares 'background' so the pipeline routes enrichment to the scrape:enrich job", () => {
    const scraper = new MegaknigaScraper(makeFetcher([]));
    expect(scraper.enrichmentMode).toBe('background');
  });
});
