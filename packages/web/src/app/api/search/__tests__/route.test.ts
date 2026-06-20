import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { SearchResponseDto } from '@/lib/api/types';

vi.mock('@/lib/api/search', () => ({
  searchBooks: vi.fn(),
  SearchError: class SearchError extends Error {
    status: number | null;
    constructor(m: string, s: number | null) {
      super(m);
      this.name = 'SearchError';
      this.status = s;
    }
  },
}));

import { GET } from '../route';
import { searchBooks, SearchError } from '@/lib/api/search';

const mockSearchBooks = searchBooks as Mock;

const RESPONSE: SearchResponseDto = {
  items: [
    {
      id: 'a',
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      lowestPrice: { amount: 29900, currency: 'UAH' },
      offersCount: 1,
      providers: [{ provider: 'yakaboo', price: { amount: 29900, currency: 'UAH' } }],
      coverUrl: null,
    },
  ],
  page: 2,
  pageSize: 6,
  totalItems: 1,
  totalPages: 1,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/search route handler', () => {
  it('calls searchBooks with parsed args and returns 200 with the JSON body', async () => {
    mockSearchBooks.mockResolvedValue(RESPONSE);

    const req = new Request('http://localhost/api/search?q=Кобзар&page=2&pageSize=6');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(RESPONSE);
    expect(mockSearchBooks).toHaveBeenCalledWith({ q: 'Кобзар', page: 2, pageSize: 6 });
  });

  it('returns 400 with EMPTY_QUERY for blank q and does not call searchBooks', async () => {
    const req = new Request('http://localhost/api/search?q=   ');
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'EMPTY_QUERY' });
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('returns 400 with EMPTY_QUERY when q is missing and does not call searchBooks', async () => {
    const req = new Request('http://localhost/api/search');
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'EMPTY_QUERY' });
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID_PARAMS for an over-long query and does not call searchBooks', async () => {
    const longQuery = 'я'.repeat(121);
    const req = new Request(`http://localhost/api/search?q=${encodeURIComponent(longQuery)}`);
    const res = await GET(req);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_PARAMS' });
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID_PARAMS for a non-positive or non-integer page', async () => {
    for (const bad of ['0', '-1', 'abc', '1.5']) {
      const res = await GET(new Request(`http://localhost/api/search?q=Кобзар&page=${bad}`));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'INVALID_PARAMS' });
    }
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('returns 400 INVALID_PARAMS for an invalid pageSize', async () => {
    const res = await GET(new Request('http://localhost/api/search?q=Кобзар&pageSize=0'));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'INVALID_PARAMS' });
    expect(mockSearchBooks).not.toHaveBeenCalled();
  });

  it('clamps pageSize to the safe maximum (10) before proxying', async () => {
    mockSearchBooks.mockResolvedValue(RESPONSE);

    const res = await GET(new Request('http://localhost/api/search?q=Кобзар&pageSize=50'));

    expect(res.status).toBe(200);
    expect(mockSearchBooks).toHaveBeenCalledWith({ q: 'Кобзар', page: undefined, pageSize: 10 });
  });

  it('returns 503 with SEARCH_FAILED when searchBooks throws SearchError with status 503', async () => {
    mockSearchBooks.mockRejectedValue(new SearchError('upstream error', 503));

    const req = new Request('http://localhost/api/search?q=Кобзар');
    const res = await GET(req);

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'SEARCH_FAILED' });
  });

  it('returns 502 with SEARCH_FAILED when searchBooks throws SearchError with null status', async () => {
    mockSearchBooks.mockRejectedValue(new SearchError('transport failure', null));

    const req = new Request('http://localhost/api/search?q=Кобзар');
    const res = await GET(req);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'SEARCH_FAILED' });
  });
});
