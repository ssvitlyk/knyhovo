import { describe, expect, it, vi } from 'vitest';
import { getCollectionBooks } from '@/lib/api/collections';
import type { CollectionBookDto, CollectionBooksPageDto } from '@/lib/api/types';
import { getHomeShelves } from '../data';

vi.mock('@/lib/api/collections', () => ({ getCollectionBooks: vi.fn() }));

const mockedGetCollectionBooks = vi.mocked(getCollectionBooks);

function book(overrides: Partial<CollectionBookDto> = {}): CollectionBookDto {
  return {
    id: 'b1',
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    coverUrl: '/covers/kobzar.png',
    minPrice: { amount: 24000, currency: 'UAH' },
    oldPrice: null,
    discountPercent: null,
    storeName: 'Лабораторія',
    rating: null,
    reviewsCount: null,
    wishlistCount: 0,
    isWishlisted: false,
    inStock: true,
    url: '/books/b1',
    catalogAddedAt: '2026-01-01T00:00:00.000Z',
    offersCount: 3,
    ...overrides,
  };
}

function page(books: readonly CollectionBookDto[]): CollectionBooksPageDto {
  return { books, total: books.length, page: 1, per_page: 24, total_pages: 1 };
}

/** Route each mocked call by the requested slug, so per-shelf assertions are simple. */
function mockShelves(bySlug: Readonly<Record<string, readonly CollectionBookDto[] | Error>>): void {
  mockedGetCollectionBooks.mockImplementation(async ({ slug }) => {
    const result = bySlug[slug];
    if (result instanceof Error) throw result;
    return page(result ?? []);
  });
}

describe('getHomeShelves', () => {
  it('maps discount percent to a solid badge on the discount-driven shelves', async () => {
    mockShelves({
      'populyarne-zaraz': [book({ id: 'p1', discountPercent: 16 })],
      novynky: [],
      'knyhovyk-radyt': [],
    });
    const { popular } = await getHomeShelves();
    expect(popular[0]?.badge).toBe('solid:-16%');
  });

  it('gives every novynky book the accent «Новинка» badge, ignoring discount', async () => {
    mockShelves({
      'populyarne-zaraz': [],
      novynky: [book({ id: 'n1', discountPercent: 10 })],
      'knyhovyk-radyt': [],
    });
    const { newReleases } = await getHomeShelves();
    expect(newReleases[0]?.badge).toBe('accent:Новинка');
  });

  it('no badge when discountPercent is null or below 1 on non-novynky shelves', async () => {
    mockShelves({
      'populyarne-zaraz': [book({ id: 'p1', discountPercent: null }), book({ id: 'p2', discountPercent: 0 })],
      novynky: [],
      'knyhovyk-radyt': [],
    });
    const { popular } = await getHomeShelves();
    expect(popular.every((b) => b.badge === null)).toBe(true);
  });

  it('skips unpriced books (minPrice === null)', async () => {
    mockShelves({
      'populyarne-zaraz': [book({ id: 'p1', minPrice: null }), book({ id: 'p2' })],
      novynky: [],
      'knyhovyk-radyt': [],
    });
    const { popular } = await getHomeShelves();
    expect(popular).toHaveLength(1);
    expect(popular[0]?.id).toBe('p2');
  });

  it('caps a shelf at 12 books', async () => {
    mockShelves({
      'populyarne-zaraz': Array.from({ length: 16 }, (_, i) => book({ id: `p${i}` })),
      novynky: [],
      'knyhovyk-radyt': [],
    });
    const { popular } = await getHomeShelves();
    expect(popular).toHaveLength(12);
  });

  it('a shelf fetch failure degrades to an empty shelf, not a crash', async () => {
    mockShelves({
      'populyarne-zaraz': new Error('network down'),
      novynky: [book({ id: 'n1' })],
      'knyhovyk-radyt': [],
    });
    const shelves = await getHomeShelves();
    expect(shelves.popular).toEqual([]);
    expect(shelves.newReleases).toHaveLength(1);
  });

  it('maps id/href/price/oldPrice/store/cover/offersCount through', async () => {
    mockShelves({
      'populyarne-zaraz': [],
      novynky: [],
      'knyhovyk-radyt': [
        book({
          id: 'r1',
          url: '/books/r1',
          minPrice: { amount: 20000, currency: 'UAH' },
          oldPrice: { amount: 25000, currency: 'UAH' },
          storeName: 'BookClub',
          coverUrl: '/covers/r1.png',
          offersCount: 4,
        }),
      ],
    });
    const { recommends } = await getHomeShelves();
    expect(recommends[0]).toMatchObject({
      id: 'r1',
      href: '/books/r1',
      price: '200 ₴',
      oldPrice: '250 ₴',
      store: 'BookClub',
      cover: '/covers/r1.png',
      offersCount: 4,
    });
  });
});
