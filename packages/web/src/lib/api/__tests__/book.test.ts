import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBookDetails, BookDetailsError } from '../book';
import type { BookDetailsDto } from '../types';

const BOOK_DTO: BookDetailsDto = {
  id: 'abc123',
  title: 'Кобзар',
  author: 'Тарас Шевченко',
  isbn: '978-966-01-0001-1',
  description: null,
  coverUrl: null,
  lowestPrice: { amount: 29900, currency: 'UAH' },
  offersCount: 2,
  providers: [
    {
      provider: 'book-club',
      price: { amount: 29900, currency: 'UAH' },
      availability: 'in-stock',
      url: 'https://book-club.ua/book/1',
      lastSeenAt: '2024-01-15T10:00:00.000Z',
    },
    {
      provider: 'yakaboo',
      price: { amount: 34900, currency: 'UAH' },
      availability: 'in-stock',
      url: 'https://yakaboo.ua/book/1',
      lastSeenAt: '2024-01-15T10:00:00.000Z',
    },
  ],
};

function mockFetch(impl: typeof fetch): void {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getBookDetails', () => {
  it('requests /api/books/:id with the given id and returns the parsed dto', async () => {
    let calledUrl = '';
    mockFetch((async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return new Response(JSON.stringify(BOOK_DTO), { status: 200 });
    }) as typeof fetch);

    const result = await getBookDetails('abc123');

    expect(result).toEqual(BOOK_DTO);
    expect(calledUrl).toContain('/api/books/');
    expect(calledUrl).toContain('abc123');
  });

  it('encodes the id in the URL', async () => {
    let calledUrl = '';
    mockFetch((async (input: RequestInfo | URL) => {
      calledUrl = String(input);
      return new Response(JSON.stringify(BOOK_DTO), { status: 200 });
    }) as typeof fetch);

    await getBookDetails('id with spaces/and?slash');

    expect(calledUrl).toContain('id%20with%20spaces%2Fand%3Fslash');
  });

  it('throws BookDetailsError with status 404 on a 404 response', async () => {
    mockFetch((async () => new Response('{}', { status: 404 })) as typeof fetch);

    await expect(getBookDetails('nonexistent')).rejects.toMatchObject({
      name: 'BookDetailsError',
      status: 404,
    });
  });

  it('throws BookDetailsError with status 500 on a 500 response', async () => {
    mockFetch((async () => new Response('{}', { status: 500 })) as typeof fetch);

    await expect(getBookDetails('some-id')).rejects.toMatchObject({
      name: 'BookDetailsError',
      status: 500,
    });
  });

  it('throws BookDetailsError with status null on a transport failure', async () => {
    mockFetch((async () => {
      throw new Error('network down');
    }) as typeof fetch);

    const error = await getBookDetails('x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BookDetailsError);
    expect((error as BookDetailsError).status).toBeNull();
  });
});
