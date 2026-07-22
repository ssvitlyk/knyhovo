import { describe, expect, it, vi } from 'vitest';
import type { HomeShelfKey } from '@knyhovo/shared';
import { getHome } from '@/lib/api/home';
import type { CollectionBookDto, HomeResponseDto, HomeShelfDto } from '@/lib/api/types';
import { getHomeShelves } from '../data';

// Keep the real HomeError (data.ts branches on `instanceof HomeError`); mock only getHome.
vi.mock('@/lib/api/home', async (orig) => {
  const actual = await orig<typeof import('@/lib/api/home')>();
  return { ...actual, getHome: vi.fn() };
});

const mockedGetHome = vi.mocked(getHome);

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

/** Build a `HomeResponseDto` from a key→books map, preserving insertion order as display order. */
function mockHome(shelves: Readonly<Record<string, readonly CollectionBookDto[]>>): void {
  const payload: HomeResponseDto = {
    shelves: Object.entries(shelves).map(([key, books]): HomeShelfDto => ({ key: key as HomeShelfKey, books })),
  };
  mockedGetHome.mockResolvedValue(payload);
}

function shelfBooks(views: Awaited<ReturnType<typeof getHomeShelves>>, key: string) {
  return views.find((s) => s.key === key)?.books ?? [];
}

describe('getHomeShelves', () => {
  it('maps discount percent to a solid badge on non-novynky shelves', async () => {
    mockHome({ popular: [book({ id: 'p1', discountPercent: 16 })] });
    const views = await getHomeShelves();
    expect(shelfBooks(views, 'popular')[0]?.badge).toBe('solid:-16%');
  });

  it('gives every novynky book the accent «Новинка» badge, ignoring discount', async () => {
    mockHome({ novynky: [book({ id: 'n1', discountPercent: 10 })] });
    const views = await getHomeShelves();
    expect(shelfBooks(views, 'novynky')[0]?.badge).toBe('accent:Новинка');
  });

  it('no badge when discountPercent is null or below 1 on non-novynky shelves', async () => {
    mockHome({ popular: [book({ id: 'p1', discountPercent: null }), book({ id: 'p2', discountPercent: 0 })] });
    const views = await getHomeShelves();
    expect(shelfBooks(views, 'popular').every((b) => b.badge === null)).toBe(true);
  });

  it('skips unpriced books (minPrice === null)', async () => {
    mockHome({ popular: [book({ id: 'p1', minPrice: null }), book({ id: 'p2' })] });
    const views = await getHomeShelves();
    const popular = shelfBooks(views, 'popular');
    expect(popular).toHaveLength(1);
    expect(popular[0]?.id).toBe('p2');
  });

  it('renders exactly the books the backend returns (no web-side cap — composition is the backend\'s job)', async () => {
    mockHome({ popular: Array.from({ length: 16 }, (_, i) => book({ id: `p${i}` })) });
    const views = await getHomeShelves();
    // Web must not silently change composition; the backend already caps at take=12.
    expect(shelfBooks(views, 'popular')).toHaveLength(16);
  });

  it('preserves the backend display order of shelves', async () => {
    mockHome({
      popular: [book({ id: 'p1' })],
      novynky: [book({ id: 'n1' })],
      knyhovyk: [book({ id: 'k1' })],
    });
    const views = await getHomeShelves();
    expect(views.map((s) => s.key)).toEqual(['popular', 'novynky', 'knyhovyk']);
  });

  it('drops a shelf that maps to zero priced books', async () => {
    mockHome({ popular: [book({ id: 'p1' })], novynky: [book({ id: 'n1', minPrice: null })] });
    const views = await getHomeShelves();
    expect(views.map((s) => s.key)).toEqual(['popular']);
  });

  it('a full endpoint failure degrades to no shelves (hero-only), not a crash', async () => {
    mockedGetHome.mockRejectedValue(new Error('network down'));
    const views = await getHomeShelves();
    expect(views).toEqual([]);
  });

  it('maps id/href/price/oldPrice/store/cover/offersCount through', async () => {
    mockHome({
      knyhovyk: [
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
    const views = await getHomeShelves();
    expect(shelfBooks(views, 'knyhovyk')[0]).toMatchObject({
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
