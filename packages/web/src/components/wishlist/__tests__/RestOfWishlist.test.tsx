import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { WishlistItemDto } from '@/lib/api/types';
import { RestOfWishlist } from '../RestOfWishlist';

function makeItem(overrides: {
  id: string;
  title: string;
  author: string;
  genreSlug: string | null;
  genreName?: string;
  price: number | null;
  createdAt: string;
}): WishlistItemDto {
  return {
    book: {
      id: overrides.id,
      title: overrides.title,
      author: overrides.author,
      isbn: null,
      coverUrl: null,
      lowestPrice: overrides.price != null ? { amount: overrides.price, currency: 'UAH' } : null,
      offersCount: overrides.price != null ? 1 : 0,
      providers: [],
      genre:
        overrides.genreSlug != null
          ? { slug: overrides.genreSlug, name: overrides.genreName ?? overrides.genreSlug }
          : null,
    },
    createdAt: overrides.createdAt,
    alert: null,
  };
}

const ITEMS: WishlistItemDto[] = [
  makeItem({
    id: 'b1',
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    genreSlug: 'klasyka',
    genreName: 'Класика',
    price: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }),
  makeItem({
    id: 'b2',
    title: 'Лісова пісня',
    author: 'Леся Українка',
    genreSlug: 'klasyka',
    genreName: 'Класика',
    price: 16500,
    createdAt: '2026-02-01T00:00:00.000Z',
  }),
  makeItem({
    id: 'b3',
    title: 'Доця',
    author: 'Тамара Горіха Зерня',
    genreSlug: 'suchasna-proza',
    genreName: 'Сучасна проза',
    price: 21000,
    createdAt: '2026-03-01T00:00:00.000Z',
  }),
];

describe('RestOfWishlist', () => {
  it('derives genre options sorted by count desc then uk alphabet', () => {
    render(<RestOfWishlist items={ITEMS} />);
    fireEvent.click(screen.getByRole('button', { name: /Усі жанри/ }));
    const listbox = screen.getByRole('listbox', { name: 'Фільтр за жанром' });
    const options = within(listbox).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Усі жанри');
    expect(options[0]).toHaveTextContent('3');
    expect(options[1]).toHaveTextContent('Класика');
    expect(options[1]).toHaveTextContent('2');
    expect(options[2]).toHaveTextContent('Сучасна проза');
    expect(options[2]).toHaveTextContent('1');
  });

  it('filters by genre, sorts, and resets to page 1', () => {
    render(<RestOfWishlist items={ITEMS} />);
    fireEvent.click(screen.getByRole('button', { name: /Усі жанри/ }));
    fireEvent.click(screen.getByRole('option', { name: /Класика/ }));
    expect(screen.getByText('2 · Класика')).toBeInTheDocument();
    expect(screen.getByText('Кобзар')).toBeInTheDocument();
    expect(screen.getByText('Лісова пісня')).toBeInTheDocument();
    expect(screen.queryByText('Доця')).not.toBeInTheDocument();
  });

  it('renders an em dash and bkc--out for out-of-stock books', () => {
    const { container } = render(<RestOfWishlist items={ITEMS} />);
    const outCard = container.querySelector('a.bkc--out');
    expect(outCard).not.toBeNull();
    expect(within(outCard as HTMLElement).getByText('—')).toBeInTheDocument();
  });

  it('makes the whole card a single link', () => {
    render(<RestOfWishlist items={ITEMS} />);
    const link = screen.getByRole('link', { name: /Лісова пісня/ });
    expect(link).toHaveAttribute('href', '/books/b2');
  });

  it('hides pagination when there is a single page', () => {
    render(<RestOfWishlist items={ITEMS} />);
    expect(screen.queryByRole('navigation', { name: 'Сторінки бажанок' })).not.toBeInTheDocument();
  });
});
