import { describe, it, expect, vi } from 'vitest';
import { BookClubScraper } from '../book-club.scraper.js';
import type { GraphqlClient, GraphqlResponse } from '../graphql-client.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCatalogResponse(
  slugs: string[],
  hasMorePages: boolean,
  page = 1,
): GraphqlResponse {
  return {
    data: {
      catalogProducts: {
        meta: {
          total: 100,
          per_page: 100,
          current_page: page,
          last_page: 10,
          has_more_pages: hasMorePages,
        },
        data: slugs.map((slug) => ({ slug, name: `Book ${slug}`, type: 'paper', available: true, cost: 300 })),
      },
    },
  };
}

function makeProductEntry(slug: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: `Book ${slug}`,
    isbn: '9786171520073',
    type: 'paper',
    cost: 300,
    available: true,
    in_stock: 10,
    authors: [{ name: 'Author', surname: 'Test' }],
    image: { small: [{ format: 'jpg', url: `/covers/${slug}.jpg` }] },
    ...overrides,
  };
}

function makeBatchResponse(slugs: string[]): GraphqlResponse {
  const data: Record<string, unknown> = {};
  slugs.forEach((slug, i) => {
    data[`p${i}`] = makeProductEntry(slug);
  });
  return { data };
}

/**
 * A client whose `request` returns either a catalog or batch response
 * depending on query content.
 */
function makeQueryBranchingClient(
  catalogResponses: GraphqlResponse[],
  batchResponses: GraphqlResponse[],
): GraphqlClient {
  let catalogIdx = 0;
  let batchIdx = 0;
  return {
    request: vi.fn(async (query: string) => {
      if (query.includes('catalogProducts')) {
        const resp = catalogResponses[catalogIdx++];
        if (resp === undefined) throw new Error('No more catalog responses');
        return resp;
      } else {
        const resp = batchResponses[batchIdx++];
        if (resp === undefined) throw new Error('No more batch responses');
        return resp;
      }
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BookClubScraper.scrape — basic shape', () => {
  it('returns a well-formed ScraperResult', async () => {
    const client = makeQueryBranchingClient(
      [makeCatalogResponse(['book-1'], false)],
      [makeBatchResponse(['book-1'])],
    );
    const scraper = new BookClubScraper(client, 10, 30);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.provider).toBe('book-club');
    expect(result.scrapedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(Array.isArray(result.listings)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

describe('BookClubScraper.scrape — discovery stops on has_more_pages false', () => {
  it('only requests one catalog page when has_more_pages is false', async () => {
    const client = makeQueryBranchingClient(
      [makeCatalogResponse(['book-1', 'book-2'], false)],
      [makeBatchResponse(['book-1', 'book-2'])],
    );
    const scraper = new BookClubScraper(client, 60, 30);
    const result = await scraper.scrape({ delayMs: 0 });

    const catalogCalls = vi
      .mocked(client.request)
      .mock.calls.filter(([q]) => q.includes('catalogProducts')).length;
    expect(catalogCalls).toBe(1);
    expect(result.listings).toHaveLength(2);
  });

  it('requests multiple catalog pages until has_more_pages is false', async () => {
    const client = makeQueryBranchingClient(
      [
        makeCatalogResponse(['book-1', 'book-2'], true, 1),
        makeCatalogResponse(['book-3'], false, 2),
      ],
      [makeBatchResponse(['book-1', 'book-2', 'book-3'])],
    );
    const scraper = new BookClubScraper(client, 60, 30);
    await scraper.scrape({ delayMs: 0 });

    const catalogCalls = vi
      .mocked(client.request)
      .mock.calls.filter(([q]) => q.includes('catalogProducts')).length;
    expect(catalogCalls).toBe(2);
  });
});

describe('BookClubScraper.scrape — multi-batch when slugs > batchSize', () => {
  it('splits slugs into multiple batch requests', async () => {
    const slugs = ['s1', 's2', 's3', 's4', 's5'];
    const client = makeQueryBranchingClient(
      [makeCatalogResponse(slugs, false)],
      [
        makeBatchResponse(['s1', 's2']),
        makeBatchResponse(['s3', 's4']),
        makeBatchResponse(['s5']),
      ],
    );
    // batchSize=2 → 3 batches
    const scraper = new BookClubScraper(client, 60, 2);
    const result = await scraper.scrape({ delayMs: 0 });

    const batchCalls = vi
      .mocked(client.request)
      .mock.calls.filter(([q]) => q.includes('productPage')).length;
    expect(batchCalls).toBe(3);
    expect(result.listings).toHaveLength(5);
  });
});

describe('BookClubScraper.scrape — ebook filtered, null alias skipped', () => {
  it('does not include ebook listings', async () => {
    const client = makeQueryBranchingClient(
      [makeCatalogResponse(['ebook-1'], false)],
      [
        {
          data: {
            p0: makeProductEntry('ebook-1', { type: 'ebook' }),
          },
        },
      ],
    );
    const scraper = new BookClubScraper(client, 60, 30);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(0);
    expect(result.errors).toEqual([]);
  });

  it('silently skips null alias with no error', async () => {
    const client = makeQueryBranchingClient(
      [makeCatalogResponse(['missing-slug'], false)],
      [{ data: { p0: null } }],
    );
    const scraper = new BookClubScraper(client, 60, 30);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(0);
    expect(result.errors).toEqual([]);
  });
});

describe('BookClubScraper.scrape — maxProducts cap + options.maxPages override', () => {
  it('caps listings at maxProducts', async () => {
    const slugs = ['s1', 's2', 's3', 's4', 's5'];
    const client = makeQueryBranchingClient(
      [makeCatalogResponse(slugs, false)],
      [makeBatchResponse(['s1', 's2'])],
    );
    const scraper = new BookClubScraper(client, 2 /* maxProducts */, 30);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(2);
  });

  it('options.maxPages overrides the constructor maxProducts', async () => {
    const slugs = ['s1', 's2', 's3', 's4', 's5'];
    const client = makeQueryBranchingClient(
      [makeCatalogResponse(slugs, false)],
      [makeBatchResponse(['s1', 's2', 's3'])],
    );
    const scraper = new BookClubScraper(client, 1 /* maxProducts */, 30);
    const result = await scraper.scrape({ maxPages: 3, delayMs: 0 });

    expect(result.listings).toHaveLength(3);
  });
});

describe('BookClubScraper.scrape — error handling', () => {
  it('network error on catalog page → breaks + records error, returns empty', async () => {
    const client: GraphqlClient = {
      request: vi.fn().mockRejectedValue(new Error('network down')),
    };
    const scraper = new BookClubScraper(client, 60, 30);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toEqual([]);
    expect(result.errors.some((e) => e.includes('Catalog page') && e.includes('network down'))).toBe(true);
  });

  it('network error on a batch → records error and continues with other batches', async () => {
    const slugs = ['s1', 's2', 's3', 's4'];
    let batchIdx = 0;
    const client: GraphqlClient = {
      request: vi.fn(async (query: string) => {
        if (query.includes('catalogProducts')) {
          return makeCatalogResponse(slugs, false);
        }
        batchIdx++;
        if (batchIdx === 1) {
          throw new Error('batch network error');
        }
        return makeBatchResponse(['s3', 's4']);
      }),
    };
    // batchSize=2 → 2 batches
    const scraper = new BookClubScraper(client, 60, 2);
    const result = await scraper.scrape({ delayMs: 0 });

    // First batch failed, second batch succeeded
    expect(result.listings).toHaveLength(2);
    expect(result.errors.some((e) => e.includes('fetch error'))).toBe(true);
  });

  it('never throws even when everything fails', async () => {
    const client: GraphqlClient = {
      request: vi.fn().mockRejectedValue(new Error('total failure')),
    };
    const scraper = new BookClubScraper(client, 60, 30);

    await expect(scraper.scrape({ delayMs: 0 })).resolves.toBeDefined();
  });
});

describe('BookClubScraper.scrape — deduplication', () => {
  it('deduplicates slugs across catalog pages', async () => {
    const client = makeQueryBranchingClient(
      [
        makeCatalogResponse(['book-1', 'book-2'], true, 1),
        makeCatalogResponse(['book-1', 'book-3'], false, 2), // book-1 duplicated
      ],
      [makeBatchResponse(['book-1', 'book-2', 'book-3'])],
    );
    const scraper = new BookClubScraper(client, 60, 30);
    const result = await scraper.scrape({ delayMs: 0 });

    expect(result.listings).toHaveLength(3);
  });
});
