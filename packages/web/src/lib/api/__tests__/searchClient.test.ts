import { afterEach, describe, expect, it, vi } from 'vitest';
import { clientSearch } from '../searchClient';
import { SearchError } from '../search';
import type { SearchResponseDto } from '../types';

const RESPONSE: SearchResponseDto = {
  items: [
    {
      id: 'a',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      lowestPrice: { amount: 29900, currency: 'UAH' },
      offersCount: 1,
      providers: [{ provider: 'yakaboo', price: { amount: 29900, currency: 'UAH' } }],
    },
  ],
  page: 1,
  pageSize: 6,
  totalItems: 1,
  totalPages: 1,
};

function mockFetch(impl: typeof fetch): void {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clientSearch', () => {
  it('requests /api/search with encoded q and pageSize, returns parsed body', async () => {
    let calledUrl = '';
    mockFetch((async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return new Response(JSON.stringify(RESPONSE), { status: 200 });
    }) as typeof fetch);

    const result = await clientSearch({ q: 'Кобзар', pageSize: 6 });

    expect(result).toEqual(RESPONSE);
    expect(calledUrl).toContain('/api/search?');
    expect(calledUrl).toContain('q=%D0%9A%D0%BE%D0%B1%D0%B7%D0%B0%D1%80');
    expect(calledUrl).toContain('pageSize=6');
  });

  it('defaults pageSize to 6', async () => {
    let calledUrl = '';
    mockFetch((async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return new Response(JSON.stringify(RESPONSE), { status: 200 });
    }) as typeof fetch);

    await clientSearch({ q: 'test' });

    expect(calledUrl).toContain('pageSize=6');
  });

  it('throws SearchError with the HTTP status on a non-2xx response', async () => {
    mockFetch((async () => new Response('{"error":"NOT_FOUND"}', { status: 404 })) as typeof fetch);

    const error = await clientSearch({ q: 'test' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SearchError);
    expect((error as SearchError).status).toBe(404);
  });

  it('throws SearchError with null status on a transport error', async () => {
    mockFetch((async () => {
      throw new Error('network down');
    }) as typeof fetch);

    const error = await clientSearch({ q: 'test' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SearchError);
    expect((error as SearchError).status).toBeNull();
  });

  it('rethrows AbortError unchanged without wrapping in SearchError', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });
    mockFetch((async () => {
      throw abortError;
    }) as typeof fetch);

    const error = await clientSearch({ q: 'test' }).catch((e: unknown) => e);
    expect((error as Error).name).toBe('AbortError');
    expect(error).not.toBeInstanceOf(SearchError);
  });
});
