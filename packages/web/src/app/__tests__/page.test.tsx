import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import HomePage from '../page';
import { getHomeShelves } from '@/components/home/data';
import type { HomeBook } from '@/components/home/content';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/home/data', () => ({ getHomeShelves: vi.fn() }));

const mockedGetHomeShelves = vi.mocked(getHomeShelves);

function book(overrides: Partial<HomeBook> = {}): HomeBook {
  return {
    id: 'b1',
    href: '/books/b1',
    title: 'Атомні звички',
    author: 'Джеймс Клір',
    price: '245 ₴',
    oldPrice: null,
    store: 'Лабораторія',
    cover: null,
    badge: null,
    offersCount: 1,
    ...overrides,
  };
}

describe('HomePage', () => {
  it('renders the four frozen sections in order and books from the API mapper', async () => {
    mockedGetHomeShelves.mockResolvedValue({
      popular: [book({ id: 'p1', title: 'Sapiens', store: 'BookClub' })],
      newReleases: [book({ id: 'n1', title: 'Інтернат' })],
      recommends: [book({ id: 'r1', title: 'Кобзар' })],
    });

    const { container } = render(await HomePage());
    const headings = Array.from(container.querySelectorAll('h1, h2')).map((h) => h.textContent ?? '');
    expect(headings[0]).toContain('Де книга дешевша?');
    expect(headings[1]).toBe('Популярне зараз');
    expect(headings[2]).toBe('Новинки');
    expect(headings[3]).toBe('Книговик радить');

    expect(container.textContent).toContain('Sapiens');
    expect(container.textContent).toContain('Інтернат');
    expect(container.textContent).toContain('Кобзар');
    expect(container.textContent).toContain('BookClub');
  });

  it('hides a shelf section entirely when its shelf is empty', async () => {
    mockedGetHomeShelves.mockResolvedValue({
      popular: [],
      newReleases: [book({ id: 'n1' })],
      recommends: [],
    });

    const { container } = render(await HomePage());
    const headings = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent ?? '');
    expect(headings).not.toContain('Популярне зараз');
    expect(headings).toContain('Новинки');
    expect(headings).not.toContain('Книговик радить');
  });

  it('never renders the removed mock data (Rozetka/Yakaboo fixtures)', async () => {
    mockedGetHomeShelves.mockResolvedValue({
      popular: [book()],
      newReleases: [book()],
      recommends: [book()],
    });

    const { container } = render(await HomePage());
    expect(container.textContent).not.toContain('Rozetka');
    expect(container.textContent).not.toContain('Yakaboo');
  });

  it('advertises the WebSite + SearchAction JSON-LD (search entry point)', async () => {
    mockedGetHomeShelves.mockResolvedValue({ popular: [], newReleases: [], recommends: [] });

    const { container } = render(await HomePage());
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    const data = JSON.parse(script?.textContent ?? '{}');
    expect(data['@type']).toBe('WebSite');
    expect(data.potentialAction['@type']).toBe('SearchAction');
    expect(data.potentialAction.target.urlTemplate).toContain('/search?q={search_term_string}');
  });
});
