import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookDetailsDto } from '@/lib/api/types';

// Mock the cached fetch so generateMetadata resolves deterministically without
// hitting the network. Importing the page module is otherwise side-effect free.
vi.mock('@/lib/api/book-cache', () => ({ getBookDetailsCached: vi.fn() }));

import { getBookDetailsCached } from '@/lib/api/book-cache';
import { generateMetadata } from '../page';

const mockedFetch = vi.mocked(getBookDetailsCached);

const BOOK: BookDetailsDto = {
  id: 'book-1',
  title: 'Тіні забутих предків',
  author: 'Михайло Коцюбинський',
  isbn: '9786171234567',
  description: 'Повість про життя гуцулів у Карпатах.',
  coverUrl: 'https://cdn.test/cover.jpg',
  lowestPrice: { amount: 29900, currency: 'UAH' },
  offersCount: 2,
  providers: [],
};

function params(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  mockedFetch.mockReset();
});

describe('generateMetadata', () => {
  it('builds unique title, description, canonical and OpenGraph per book', async () => {
    mockedFetch.mockResolvedValue(BOOK);
    const meta = await generateMetadata(params('book-1'));

    expect(meta.title).toBe('Тіні забутих предків — Михайло Коцюбинський · Knyhovo');
    expect(meta.description).toBe('Повість про життя гуцулів у Карпатах.');
    expect(meta.alternates?.canonical).toBe('/books/book-1');
    const og = meta.openGraph as { type?: string; url?: string; images?: unknown };
    expect(og.type).toBe('book');
    expect(og.url).toBe('/books/book-1');
    expect(og.images).toEqual(['https://cdn.test/cover.jpg']);
    expect((meta.twitter as { card?: string }).card).toBe('summary_large_image');
  });

  it('omits OG images when the book has no cover', async () => {
    mockedFetch.mockResolvedValue({ ...BOOK, coverUrl: null });
    const meta = await generateMetadata(params('book-1'));
    expect((meta.openGraph as { images?: unknown }).images).toBeUndefined();
  });

  it('returns safe minimal metadata when the fetch fails', async () => {
    mockedFetch.mockRejectedValue(new Error('boom'));
    const meta = await generateMetadata(params('missing'));
    expect(meta.title).toBe('Книга — Knyhovo');
  });
});
