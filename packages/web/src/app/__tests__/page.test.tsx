import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import HomePage from '../page';
import { getHomeShelves } from '@/components/home/data';
import type { HomeShelfView } from '@/components/home/data';
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

/** Build the shelf-view array the page consumes, in display order (keys cast to simulate backend payloads, incl. an unknown key). */
function shelves(map: Readonly<Record<string, readonly HomeBook[]>>): HomeShelfView[] {
  return Object.entries(map).map(([key, books]) => ({ key: key as HomeShelfView['key'], books }));
}

describe('HomePage', () => {
  it('renders the frozen sections in backend display order with books from the API mapper', async () => {
    mockedGetHomeShelves.mockResolvedValue(
      shelves({
        popular: [book({ id: 'p1', title: 'Sapiens', store: 'BookClub' })],
        novynky: [book({ id: 'n1', title: 'Інтернат' })],
        knyhovyk: [book({ id: 'r1', title: 'Кобзар' })],
      }),
    );

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

  it('hides a shelf section entirely when the backend omits it', async () => {
    mockedGetHomeShelves.mockResolvedValue(shelves({ novynky: [book({ id: 'n1' })] }));

    const { container } = render(await HomePage());
    const headings = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent ?? '');
    expect(headings).not.toContain('Популярне зараз');
    expect(headings).toContain('Новинки');
    expect(headings).not.toContain('Книговик радить');
  });

  it('ignores an unknown shelf key without crashing', async () => {
    mockedGetHomeShelves.mockResolvedValue(shelves({ popular: [book({ id: 'p1' })], 'future-shelf': [book({ id: 'x1' })] }));

    const { container } = render(await HomePage());
    const headings = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent ?? '');
    expect(headings).toContain('Популярне зараз');
    // Unknown key renders nothing extra.
    expect(headings).toHaveLength(1);
  });

  it('degrades to hero-only (no shelves) when the endpoint fails', async () => {
    mockedGetHomeShelves.mockResolvedValue([]);

    const { container } = render(await HomePage());
    expect(container.querySelectorAll('h2')).toHaveLength(0);
    // Hero still present.
    expect(container.querySelector('h1')?.textContent).toContain('Де книга дешевша?');
  });

  it('never renders the removed mock data (Rozetka/Yakaboo fixtures)', async () => {
    mockedGetHomeShelves.mockResolvedValue(
      shelves({ popular: [book()], novynky: [book()], knyhovyk: [book()] }),
    );

    const { container } = render(await HomePage());
    expect(container.textContent).not.toContain('Rozetka');
  });

  it('advertises the WebSite + SearchAction JSON-LD (search entry point)', async () => {
    mockedGetHomeShelves.mockResolvedValue([]);

    const { container } = render(await HomePage());
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
    const data = JSON.parse(script?.textContent ?? '{}');
    expect(data['@type']).toBe('WebSite');
    expect(data.potentialAction['@type']).toBe('SearchAction');
    expect(data.potentialAction.target.urlTemplate).toContain('/search?q={search_term_string}');
  });
});
