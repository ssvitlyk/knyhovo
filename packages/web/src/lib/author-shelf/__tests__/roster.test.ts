import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SearchResponseDto, SearchItemDto } from '@/lib/api/types';

vi.mock('@/lib/api/search', () => ({
  searchBooks: vi.fn(),
}));

import { searchBooks } from '@/lib/api/search';
import { getAuthorShelfRoster, AUTHOR_SHELF_PAGE_SIZE } from '../roster';

const mockSearchBooks = vi.mocked(searchBooks);

function makeItem(overrides: Partial<SearchItemDto> & { id: string }): SearchItemDto {
  return {
    title: 'Book Title',
    author: 'Андрій Сапковський',
    lowestPrice: { amount: 24500, currency: 'UAH' },
    offersCount: 1,
    providers: [{ provider: 'yakaboo', price: { amount: 24500, currency: 'UAH' } }],
    coverUrl: null,
    ...overrides,
  };
}

function makeResponse(items: SearchItemDto[]): SearchResponseDto {
  return { items, page: 1, pageSize: AUTHOR_SHELF_PAGE_SIZE, totalItems: items.length, totalPages: 1 };
}

const AUTHOR = 'Андрій Сапковський';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getAuthorShelfRoster', () => {
  it('returns only exact-author books', async () => {
    mockSearchBooks.mockResolvedValueOnce(
      makeResponse([
        makeItem({ id: 'a', author: AUTHOR }),
        makeItem({ id: 'b', author: 'Інший Автор' }),
        makeItem({ id: 'c', author: AUTHOR }),
      ]),
    );
    const result = await getAuthorShelfRoster(AUTHOR);
    expect(result.map(b => b.id)).toEqual(['a', 'c']);
  });

  it('sorts results by price ascending', async () => {
    mockSearchBooks.mockResolvedValueOnce(
      makeResponse([
        makeItem({ id: 'expensive', author: AUTHOR, lowestPrice: { amount: 50000, currency: 'UAH' } }),
        makeItem({ id: 'cheap', author: AUTHOR, lowestPrice: { amount: 20000, currency: 'UAH' } }),
        makeItem({ id: 'mid', author: AUTHOR, lowestPrice: { amount: 35000, currency: 'UAH' } }),
      ]),
    );
    const result = await getAuthorShelfRoster(AUTHOR);
    expect(result.map(b => b.id)).toEqual(['cheap', 'mid', 'expensive']);
  });

  it('maps items to AuthorShelfBook shape', async () => {
    mockSearchBooks.mockResolvedValueOnce(
      makeResponse([
        makeItem({
          id: 'a',
          author: AUTHOR,
          title: 'Вежа ластівки',
          lowestPrice: { amount: 26000, currency: 'UAH' },
          providers: [{ provider: 'yakaboo', price: { amount: 26000, currency: 'UAH' } }],
          coverUrl: 'https://example.com/cover.jpg',
        }),
      ]),
    );
    const result = await getAuthorShelfRoster(AUTHOR);
    expect(result[0]).toEqual({
      id: 'a',
      title: 'Вежа ластівки',
      author: AUTHOR,
      price: '260 ₴',
      store: 'Yakaboo',
      coverUrl: 'https://example.com/cover.jpg',
    });
  });

  it('resolves to [] when searchBooks rejects', async () => {
    mockSearchBooks.mockRejectedValueOnce(new Error('Network error'));
    const result = await getAuthorShelfRoster(AUTHOR);
    expect(result).toEqual([]);
  });

  it('returns [] for empty author without calling searchBooks', async () => {
    const result = await getAuthorShelfRoster('');
    expect(mockSearchBooks).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('returns [] for whitespace-only author without calling searchBooks', async () => {
    const result = await getAuthorShelfRoster('   ');
    expect(mockSearchBooks).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('uses tie-break by id when prices are equal', async () => {
    mockSearchBooks.mockResolvedValueOnce(
      makeResponse([
        makeItem({ id: 'z', author: AUTHOR, lowestPrice: { amount: 24500, currency: 'UAH' } }),
        makeItem({ id: 'a', author: AUTHOR, lowestPrice: { amount: 24500, currency: 'UAH' } }),
      ]),
    );
    const result = await getAuthorShelfRoster(AUTHOR);
    expect(result.map(b => b.id)).toEqual(['a', 'z']);
  });
});
