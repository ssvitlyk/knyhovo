import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchBooks, SearchError } from '../search';
import type { SearchResponseDto } from '../types';

const RESPONSE: SearchResponseDto = {
  items: [
    {
      id: 'a',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      lowestPrice: { amount: 29900, currency: 'UAH' },
      offersCount: 2,
      providers: [
        { provider: 'book-club', price: { amount: 29900, currency: 'UAH' } },
        { provider: 'yakaboo', price: { amount: 34900, currency: 'UAH' } },
      ],
      coverUrl: null,
    },
  ],
  page: 1,
  pageSize: 20,
  totalItems: 1,
  totalPages: 1,
};

function mockFetch(impl: typeof fetch): void {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchBooks', () => {
  it('requests the search endpoint with q/page/pageSize and returns the parsed body', async () => {
    let calledUrl = '';
    mockFetch((async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return new Response(JSON.stringify(RESPONSE), { status: 200 });
    }) as typeof fetch);

    const result = await searchBooks({ q: 'Кобзар', page: 2, pageSize: 10 });

    expect(result).toEqual(RESPONSE);
    expect(calledUrl).toContain('/api/search?');
    expect(calledUrl).toContain('q=%D0%9A%D0%BE%D0%B1%D0%B7%D0%B0%D1%80');
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('pageSize=10');
  });

  it('defaults page to 1 and pageSize to 20', async () => {
    let calledUrl = '';
    mockFetch((async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return new Response(JSON.stringify(RESPONSE), { status: 200 });
    }) as typeof fetch);

    await searchBooks({ q: 'test' });

    expect(calledUrl).toContain('page=1');
    expect(calledUrl).toContain('pageSize=20');
  });

  it('throws SearchError with the HTTP status on a non-2xx response', async () => {
    mockFetch((async () => new Response('{}', { status: 400 })) as typeof fetch);

    await expect(searchBooks({ q: '' })).rejects.toMatchObject({
      name: 'SearchError',
      status: 400,
    });
  });

  it('throws SearchError with null status on a transport/timeout failure', async () => {
    mockFetch((async () => {
      throw new Error('network down');
    }) as typeof fetch);

    const error = await searchBooks({ q: 'x' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SearchError);
    expect((error as SearchError).status).toBeNull();
  });
});
