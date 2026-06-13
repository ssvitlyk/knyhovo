import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WishlistRow } from '../WishlistRow';
import type { WishlistItemDto } from '@/lib/api/types';

// RemoveButton uses useRouter — mock next/navigation
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const BASE_ITEM: WishlistItemDto = {
  book: {
    id: 'book-1',
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    isbn: null,
    coverUrl: null,
    lowestPrice: { amount: 24500, currency: 'UAH' },
    offersCount: 2,
    providers: [
      {
        provider: 'yakaboo',
        price: { amount: 24500, currency: 'UAH' },
        availability: 'in-stock',
        url: 'https://yakaboo.ua/book',
        lastSeenAt: '2026-06-13T08:00:00.000Z',
      },
    ],
  },
  createdAt: '2026-06-10T10:00:00.000Z',
};

describe('WishlistRow', () => {
  it('renders the book title as a link to /books/:id', () => {
    render(<WishlistRow item={BASE_ITEM} />);
    const link = screen.getByRole('link', { name: 'Кобзар' });
    expect(link).toHaveAttribute('href', '/books/book-1');
  });

  it('renders the author', () => {
    render(<WishlistRow item={BASE_ITEM} />);
    expect(screen.getByText('Тарас Шевченко')).toBeTruthy();
  });

  it('renders price and store when lowestPrice is present', () => {
    render(<WishlistRow item={BASE_ITEM} />);
    expect(screen.getByText('245 ₴')).toBeTruthy();
    expect(screen.getByText('Yakaboo')).toBeTruthy();
  });

  it('renders «До книгарні» link when book has offers', () => {
    render(<WishlistRow item={BASE_ITEM} />);
    const link = screen.getByRole('link', { name: 'До книгарні' });
    expect(link).toHaveAttribute('href', 'https://yakaboo.ua/book');
  });

  it('renders «Деталі книги» link', () => {
    render(<WishlistRow item={BASE_ITEM} />);
    const link = screen.getByRole('link', { name: 'Деталі книги' });
    expect(link).toHaveAttribute('href', '/books/book-1');
  });

  it('offersCount===0 → shows «Очікуємо наявності» badge', () => {
    const outOfStockItem: WishlistItemDto = {
      ...BASE_ITEM,
      book: {
        ...BASE_ITEM.book,
        offersCount: 0,
        providers: [],
        lowestPrice: null,
      },
    };
    render(<WishlistRow item={outOfStockItem} />);
    expect(screen.getByText('Очікуємо наявності')).toBeTruthy();
  });

  it('offersCount===0 → shows «Знайти схожі» link, no «До книгарні»', () => {
    const outOfStockItem: WishlistItemDto = {
      ...BASE_ITEM,
      book: {
        ...BASE_ITEM.book,
        offersCount: 0,
        providers: [],
        lowestPrice: null,
      },
    };
    render(<WishlistRow item={outOfStockItem} />);
    const znajtiLink = screen.getByRole('link', { name: 'Знайти схожі' });
    expect(znajtiLink).toHaveAttribute('href', '/search');
    expect(screen.queryByRole('link', { name: 'До книгарні' })).toBeNull();
  });

  it('shows «Збираємо ціни…» when lowestPrice is null', () => {
    const noPrice: WishlistItemDto = {
      ...BASE_ITEM,
      book: { ...BASE_ITEM.book, lowestPrice: null, offersCount: 2 },
    };
    render(<WishlistRow item={noPrice} />);
    expect(screen.getByText('Збираємо ціни…')).toBeTruthy();
  });
});
