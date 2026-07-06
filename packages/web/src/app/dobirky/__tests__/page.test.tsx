import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import DobirkyPage from '../page';
import { getCollectionBooks, getCollectionsHub } from '@/lib/api/collections';
import type { CollectionBookDto, CollectionDto, CollectionsHubDto } from '@/lib/api/types';

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ toString: (): string => '' })) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api/collections', () => ({
  getCollectionsHub: vi.fn(),
  getCollectionBooks: vi.fn(),
}));

// Heavy client sub-components are stubbed to lightweight stand-ins — the hub
// page's OWN empty-state branching is what this test exercises; the
// sub-components (nav dropdowns, wishlist hearts, mood grid, ...) have their
// own dedicated tests.
vi.mock('@/components/collections/CollectionsNav', () => ({ CollectionsNav: () => <nav data-testid="nav" /> }));
vi.mock('@/components/collections/FeaturedCard', () => ({
  FeaturedCard: ({ collection }: { collection: CollectionDto }) => (
    <div data-testid="featured">{collection.name}</div>
  ),
}));
vi.mock('@/components/collections/BookSection', () => ({
  BookSection: ({ title, items }: { title: string; items: readonly unknown[] }) => (
    <section data-testid={`section-${title}`}>{items.length}</section>
  ),
  SecDivider: () => <hr />,
}));
vi.mock('@/components/collections/MoodSection', () => ({
  MoodSection: ({ moods }: { moods: readonly unknown[] }) => <div data-testid="moods">{moods.length}</div>,
}));
vi.mock('@/components/collections/FreshSection', () => ({
  FreshSection: ({ weekly }: { weekly: readonly unknown[] }) =>
    weekly.length === 0 ? null : <div data-testid="fresh">{weekly.length}</div>,
}));
vi.mock('@/components/collections/GemsBand', () => ({
  GemsBand: ({ fanCovers }: { fanCovers: readonly unknown[] }) => (
    <div data-testid="gems">{fanCovers.length}</div>
  ),
}));

const mockedGetCollectionsHub = vi.mocked(getCollectionsHub);
const mockedGetCollectionBooks = vi.mocked(getCollectionBooks);

function collection(overrides: Partial<CollectionDto> = {}): CollectionDto {
  return {
    id: 'c1',
    slug: 'knyhovyk-radyt',
    type: 'editorial',
    name: 'Книговик радить',
    description: 'desc',
    bookCount: 0,
    updatedAt: '2026-07-04T00:00:00.000Z',
    isActive: true,
    ...overrides,
  };
}

function emptyHub(overrides: Partial<CollectionsHubDto> = {}): CollectionsHubDto {
  return {
    featured: null,
    dynamic: [],
    editorial: [],
    weekly: [],
    moods: [],
    genres: [],
    ...overrides,
  };
}

describe('DobirkyPage', () => {
  it('with featured: null and every section empty, renders the friendly empty state, not the fetch-error retry', async () => {
    mockedGetCollectionsHub.mockResolvedValue(emptyHub());
    mockedGetCollectionBooks.mockResolvedValue({ books: [], total: 0, page: 1, per_page: 24, total_pages: 0 });

    const { container } = render(await DobirkyPage());

    expect(container.textContent).toContain('У добірках поки немає книг.');
    expect(container.textContent).not.toContain('Не вдалося завантажити книги добірки.');
    expect(container.querySelector('[data-testid="featured"]')).toBeNull();
  });

  it('a hub fetch rejection still renders the retry error block', async () => {
    mockedGetCollectionsHub.mockRejectedValue(new Error('down'));

    const { container } = render(await DobirkyPage());

    expect(container.textContent).toContain('Не вдалося завантажити книги добірки.');
    expect(container.textContent).not.toContain('У добірках поки немає книг.');
  });

  it('skips the hero when featured is null but other sections have books', async () => {
    mockedGetCollectionsHub.mockResolvedValue(emptyHub());
    const priced: CollectionBookDto = {
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
      offersCount: 1,
    };
    mockedGetCollectionBooks.mockImplementation(async ({ slug }) =>
      slug === 'populyarne-zaraz'
        ? { books: [priced], total: 1, page: 1, per_page: 24, total_pages: 1 }
        : { books: [], total: 0, page: 1, per_page: 24, total_pages: 0 },
    );

    const { container } = render(await DobirkyPage());

    expect(container.querySelector('[data-testid="featured"]')).toBeNull();
    expect(container.querySelector('[data-testid="section-Популярне зараз"]')?.textContent).toBe('1');
    expect(container.textContent).not.toContain('У добірках поки немає книг.');
  });

  it('skips the hero when the featured collection has zero books, even if not null', async () => {
    mockedGetCollectionsHub.mockResolvedValue(
      emptyHub({ featured: { collection: collection({ bookCount: 0 }), previewBooks: [] } }),
    );
    mockedGetCollectionBooks.mockResolvedValue({ books: [], total: 0, page: 1, per_page: 24, total_pages: 0 });

    const { container } = render(await DobirkyPage());
    expect(container.querySelector('[data-testid="featured"]')).toBeNull();
  });

  it('renders the hero when featured is present with books', async () => {
    mockedGetCollectionsHub.mockResolvedValue(
      emptyHub({ featured: { collection: collection({ bookCount: 12 }), previewBooks: [] } }),
    );
    mockedGetCollectionBooks.mockResolvedValue({ books: [], total: 0, page: 1, per_page: 24, total_pages: 0 });

    const { container } = render(await DobirkyPage());
    expect(container.querySelector('[data-testid="featured"]')?.textContent).toBe('Книговик радить');
  });

  it('filters zero-book weekly/mood collections out before they reach their sections', async () => {
    mockedGetCollectionsHub.mockResolvedValue(
      emptyHub({
        weekly: [collection({ slug: 'buker-2026', bookCount: 0 }), collection({ slug: 'non-fikshn', bookCount: 5 })],
        moods: [collection({ slug: 'sumno', bookCount: 0 }), collection({ slug: 'vesna', bookCount: 3 })],
      }),
    );
    mockedGetCollectionBooks.mockResolvedValue({ books: [], total: 0, page: 1, per_page: 24, total_pages: 0 });

    const { container } = render(await DobirkyPage());

    expect(container.querySelector('[data-testid="fresh"]')?.textContent).toBe('1');
    expect(container.querySelector('[data-testid="moods"]')?.textContent).toBe('1');
  });
});
