import { describe, it, expect, vi } from 'vitest';
import type { RawProviderListing } from '@knyhovo/shared';
import { paginateCatalog } from '../paginate-catalog.js';
import type { CatalogPageResult } from '../../providers/types.js';

function listing(url: string): RawProviderListing {
  return {
    provider: 'yakaboo',
    title: url,
    author: null,
    isbn: null,
    price: null,
    url,
    availability: 'unknown',
  };
}

function pages(map: Record<string, CatalogPageResult>): (html: string) => CatalogPageResult {
  return (html) => map[html] ?? { listings: [], errors: [], hasNextPage: false };
}

const base = {
  delayMs: 0,
  buildUrl: (p: number) => `page-${p}`,
};

describe('paginateCatalog', () => {
  it('walks pages until hasNextPage is false, de-duplicating by url', async () => {
    const errors: string[] = [];
    const result = await paginateCatalog({
      ...base,
      maxPages: 10,
      errors,
      fetch: async (url) => url,
      parse: pages({
        'page-1': { listings: [listing('a'), listing('b')], errors: ['e1'], hasNextPage: true },
        'page-2': { listings: [listing('b'), listing('c')], errors: [], hasNextPage: false },
      }),
    });
    expect(result.listings.map((l) => l.url)).toEqual(['a', 'b', 'c']);
    expect(result.pagesFetched).toBe(2);
    expect(result.firstPageHtml).toBe('page-1');
    expect(errors).toEqual(['e1']);
  });

  it('respects maxPages and sleeps between pages only', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async (url: string) => url);
    const p = paginateCatalog({
      ...base,
      delayMs: 100,
      maxPages: 2,
      errors: [],
      fetch,
      parse: () => ({ listings: [], errors: [], hasNextPage: true }),
    });
    await vi.advanceTimersByTimeAsync(100);
    const result = await p;
    vi.useRealTimers();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.pagesFetched).toBe(2);
  });

  it('reports a default network error and stops', async () => {
    const errors: string[] = [];
    const result = await paginateCatalog({
      ...base,
      maxPages: 5,
      errors,
      fetch: async () => {
        throw new Error('boom');
      },
      parse: pages({}),
    });
    expect(errors).toEqual(['Page 1: network error — boom']);
    expect(result).toEqual({ listings: [], firstPageHtml: null, pagesFetched: 0 });
  });

  it('delegates fetch errors to onFetchError', async () => {
    const errors: string[] = [];
    await paginateCatalog({
      ...base,
      maxPages: 5,
      errors,
      fetch: async () => {
        throw new Error('boom');
      },
      parse: pages({}),
      onFetchError: (_err, page, errs) => errs.push(`custom ${page}`),
    });
    expect(errors).toEqual(['custom 1']);
  });

  it('stops when a page adds no new listings if requested', async () => {
    const fetch = vi.fn(async (url: string) => url);
    const parse = () => ({ listings: [listing('a')], errors: [], hasNextPage: true });
    const lenient = await paginateCatalog({ ...base, maxPages: 3, errors: [], fetch, parse });
    expect(lenient.pagesFetched).toBe(3);
    fetch.mockClear();
    const strict = await paginateCatalog({
      ...base,
      maxPages: 3,
      errors: [],
      fetch,
      parse,
      stopWhenNoNewListings: true,
    });
    expect(strict.pagesFetched).toBe(2);
  });

  it('calls onPageStart before each fetch', async () => {
    const seen: string[] = [];
    await paginateCatalog({
      ...base,
      maxPages: 2,
      errors: [],
      fetch: async (url) => url,
      parse: () => ({ listings: [], errors: [], hasNextPage: true }),
      onPageStart: (page, url) => seen.push(`${page}:${url}`),
    });
    expect(seen).toEqual(['1:page-1', '2:page-2']);
  });
});
