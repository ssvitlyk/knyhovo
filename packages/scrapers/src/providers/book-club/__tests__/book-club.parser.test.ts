import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  bookClubPriceToKopecks,
  parseCatalogProducts,
  parseProductPageBatch,
} from '../book-club.parser.js';
import type { GraphqlResponse } from '../graphql-client.js';

const FIXTURES_DIR = resolve(import.meta.dirname, '../__fixtures__');

function loadFixture(name: string): GraphqlResponse {
  return JSON.parse(readFileSync(resolve(FIXTURES_DIR, name), 'utf-8')) as GraphqlResponse;
}

// ─── bookClubPriceToKopecks ───────────────────────────────────────────────────

describe('bookClubPriceToKopecks', () => {
  it('converts a positive integer to kopecks', () => {
    expect(bookClubPriceToKopecks(540)).toBe(54000);
  });

  it('converts a numeric string', () => {
    expect(bookClubPriceToKopecks('324')).toBe(32400);
  });

  it('rounds fractional values', () => {
    expect(bookClubPriceToKopecks(10.555)).toBe(1056);
  });

  it('returns null for zero', () => {
    expect(bookClubPriceToKopecks(0)).toBeNull();
  });

  it('returns null for negative', () => {
    expect(bookClubPriceToKopecks(-5)).toBeNull();
  });

  it('returns null for null', () => {
    expect(bookClubPriceToKopecks(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(bookClubPriceToKopecks(undefined)).toBeNull();
  });

  it('returns null for NaN string', () => {
    expect(bookClubPriceToKopecks('abc')).toBeNull();
  });

  it('returns null for Infinity', () => {
    expect(bookClubPriceToKopecks(Infinity)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(bookClubPriceToKopecks('')).toBeNull();
  });
});

// ─── parseCatalogProducts ─────────────────────────────────────────────────────

describe('parseCatalogProducts — catalog-page.json', () => {
  const fixture = loadFixture('catalog-page.json');

  it('extracts 5 slugs from the fixture', () => {
    const result = parseCatalogProducts(fixture);
    expect(result.slugs).toHaveLength(5);
    expect(result.slugs).toContain('bukvar');
    expect(result.slugs).toContain('u-tsey-chas-nastupnoho-lita');
    expect(result.slugs).toContain('shchaslyvytsia');
  });

  it('reports hasMorePages: true', () => {
    expect(parseCatalogProducts(fixture).hasMorePages).toBe(true);
  });

  it('returns no errors', () => {
    expect(parseCatalogProducts(fixture).errors).toEqual([]);
  });
});

describe('parseCatalogProducts — catalog-last-page.json', () => {
  const fixture = loadFixture('catalog-last-page.json');

  it('reports hasMorePages: false', () => {
    expect(parseCatalogProducts(fixture).hasMorePages).toBe(false);
  });

  it('extracts the single slug on the last page', () => {
    const result = parseCatalogProducts(fixture);
    expect(result.slugs).toHaveLength(1);
    expect(result.slugs[0]).toBe('kobzar-vpershe-zi-shchodennikom-avtora');
  });
});

describe('parseCatalogProducts — deduplication', () => {
  it('deduplicates slugs within a single page', () => {
    const response: GraphqlResponse = {
      data: {
        catalogProducts: {
          meta: { has_more_pages: false },
          data: [{ slug: 'abc' }, { slug: 'abc' }, { slug: 'def' }],
        },
      },
    };
    const result = parseCatalogProducts(response);
    expect(result.slugs).toEqual(['abc', 'def']);
  });
});

describe('parseCatalogProducts — error cases', () => {
  it('returns empty result when catalogProducts is missing', () => {
    const result = parseCatalogProducts({ data: {} });
    expect(result.slugs).toEqual([]);
    expect(result.hasMorePages).toBe(false);
  });

  it('surfaces top-level GraphQL errors', () => {
    const response: GraphqlResponse = {
      data: null,
      errors: [{ message: 'Something went wrong' }],
    };
    const result = parseCatalogProducts(response);
    expect(result.errors).toContain('Something went wrong');
  });

  it('defaults hasMorePages to false when meta is absent', () => {
    const response: GraphqlResponse = {
      data: { catalogProducts: { data: [] } },
    };
    expect(parseCatalogProducts(response).hasMorePages).toBe(false);
  });
});

// ─── parseProductPageBatch ────────────────────────────────────────────────────

describe('parseProductPageBatch — product-batch.json', () => {
  const fixture = loadFixture('product-batch.json');
  const slugs = ['drakula', 'bukvar', 'shchaslyvytsia', 'zaproshennia', 'nonexistent'];

  it('returns 3 paper listings (p3 ebook and p4 null silently skipped)', () => {
    const result = parseProductPageBatch(fixture, slugs);
    expect(result.listings).toHaveLength(3);
  });

  it('maps drakula correctly', () => {
    const result = parseProductPageBatch(fixture, slugs);
    const drakula = result.listings.find((l) => l.url.includes('drakula'));
    expect(drakula).toBeDefined();
    expect(drakula!.title).toBe('Дракула');
    expect(drakula!.provider).toBe('book-club');
    expect(drakula!.url).toBe('https://ksd.ua/product/drakula');
    expect(drakula!.availability).toBe('in-stock');
    expect(drakula!.price).toEqual({ amount: 54000, currency: 'UAH' });
  });

  it('normalises the hyphenated ISBN for drakula', () => {
    const result = parseProductPageBatch(fixture, slugs);
    const drakula = result.listings.find((l) => l.url.includes('drakula'));
    // "978-617-15-2007-3" → normalized ISBN-13
    expect(drakula!.isbn).toBe('9786171520073');
  });

  it('resolves author "Брем Стокер" for drakula', () => {
    const result = parseProductPageBatch(fixture, slugs);
    const drakula = result.listings.find((l) => l.url.includes('drakula'));
    expect(drakula!.author).toBe('Брем Стокер');
  });

  it('resolves coverUrl with non-webp format preferred', () => {
    const result = parseProductPageBatch(fixture, slugs);
    const drakula = result.listings.find((l) => l.url.includes('drakula'));
    // First entry in drakula is png, not webp → should be chosen
    expect(drakula!.coverUrl).toMatch(/^https:\/\/ksd\.ua/);
    expect(drakula!.coverUrl).not.toMatch(/webp/);
  });

  it('normalises the bare ISBN-13 for shchaslyvytsia', () => {
    const result = parseProductPageBatch(fixture, slugs);
    const shch = result.listings.find((l) => l.url.includes('shchaslyvytsia'));
    // "9786171713253" is already 13 digits
    expect(shch!.isbn).toBe('9786171713253');
  });

  it('skips the ebook (p3) silently — no error', () => {
    const result = parseProductPageBatch(fixture, slugs);
    const hasEbook = result.listings.some((l) => l.url.includes('zaproshennia'));
    expect(hasEbook).toBe(false);
    const hasEbookError = result.errors.some((e) => e.includes('zaproshennia'));
    expect(hasEbookError).toBe(false);
  });

  it('skips null p4 (nonexistent slug) silently — no error', () => {
    const result = parseProductPageBatch(fixture, slugs);
    const hasError = result.errors.some((e) => e.includes('nonexistent'));
    expect(hasError).toBe(false);
  });

  it('returns no errors for a clean batch', () => {
    const result = parseProductPageBatch(fixture, slugs);
    expect(result.errors).toEqual([]);
  });
});

describe('parseProductPageBatch — product-batch-partial-error.json', () => {
  const fixture = loadFixture('product-batch-partial-error.json');
  const slugs = ['drakula', 'bukvar'];

  it('includes p0 drakula listing', () => {
    const result = parseProductPageBatch(fixture, slugs);
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]!.url).toContain('drakula');
  });

  it('records an error for p1 bukvar (null + error in response)', () => {
    const result = parseProductPageBatch(fixture, slugs);
    expect(result.errors.some((e) => e.includes('bukvar') && e.includes('Internal server error'))).toBe(true);
  });
});

describe('parseProductPageBatch — perturbed cases', () => {
  function makeProductBatch(overrides: Record<string, unknown>): GraphqlResponse {
    return {
      data: {
        p0: {
          name: 'Тест книга',
          isbn: '9786171520073',
          type: 'paper',
          cost: 200,
          available: true,
          in_stock: 5,
          authors: [{ name: 'Автор', surname: 'Тестовий' }],
          image: {
            small: [
              { format: 'jpg', url: '/covers/test.jpg' },
              { format: 'webp', url: '/covers/test.webp' },
            ],
          },
          ...overrides,
        },
      },
    };
  }

  it('missing name → error + no listing', () => {
    const resp = makeProductBatch({ name: null });
    const result = parseProductPageBatch(resp, ['test-slug']);
    expect(result.listings).toHaveLength(0);
    expect(result.errors.some((e) => e.includes('missing name'))).toBe(true);
  });

  it('cost null → price null + out-of-stock', () => {
    const resp = makeProductBatch({ cost: null });
    const result = parseProductPageBatch(resp, ['test-slug']);
    expect(result.listings[0]!.price).toBeNull();
    expect(result.listings[0]!.availability).toBe('out-of-stock');
  });

  it('available: false → out-of-stock', () => {
    const resp = makeProductBatch({ available: false });
    const result = parseProductPageBatch(resp, ['test-slug']);
    expect(result.listings[0]!.availability).toBe('out-of-stock');
  });

  it('available: non-bool → unknown availability', () => {
    const resp = makeProductBatch({ available: 'yes' });
    const result = parseProductPageBatch(resp, ['test-slug']);
    expect(result.listings[0]!.availability).toBe('unknown');
  });

  it('invalid isbn → null isbn', () => {
    const resp = makeProductBatch({ isbn: '000000000000' });
    const result = parseProductPageBatch(resp, ['test-slug']);
    expect(result.listings[0]!.isbn).toBeNull();
  });

  it('missing isbn → null isbn', () => {
    const resp = makeProductBatch({ isbn: null });
    const result = parseProductPageBatch(resp, ['test-slug']);
    expect(result.listings[0]!.isbn).toBeNull();
  });
});
