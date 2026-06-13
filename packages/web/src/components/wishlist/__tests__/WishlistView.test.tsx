import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WishlistView } from '../WishlistView';
import type { WishlistItemDto } from '@/lib/api/types';

// RemoveButton / WishlistCard use client hooks
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const ITEM: WishlistItemDto = {
  book: {
    id: 'book-1',
    title: 'Тіні забутих предків',
    author: 'Михайло Коцюбинський',
    isbn: null,
    coverUrl: null,
    lowestPrice: { amount: 18000, currency: 'UAH' },
    offersCount: 1,
    providers: [
      {
        provider: 'yakaboo',
        price: { amount: 18000, currency: 'UAH' },
        availability: 'in-stock',
        url: 'https://yakaboo.ua',
        lastSeenAt: '2026-06-13T08:00:00.000Z',
      },
    ],
  },
  createdAt: '2026-06-10T00:00:00.000Z',
};

describe('WishlistView', () => {
  it('empty items → renders WishlistEmpty', () => {
    render(<WishlistView items={[]} />);
    expect(screen.getByText(/Не просто зберігайте книги/)).toBeTruthy();
  });

  it('empty items → renders the "Знайти книги" CTA', () => {
    render(<WishlistView items={[]} />);
    expect(screen.getByRole('link', { name: 'Знайти книги' })).toHaveAttribute('href', '/search');
  });

  it('with items → renders the «Інші бажанки» section heading', () => {
    render(<WishlistView items={[ITEM]} />);
    expect(screen.getByText('Інші бажанки')).toBeTruthy();
  });

  it('with items → renders the book title', () => {
    render(<WishlistView items={[ITEM]} />);
    // The title appears in both desktop row and mobile card
    const titles = screen.getAllByText('Тіні забутих предків');
    expect(titles.length).toBeGreaterThan(0);
  });

  it('with items → renders the «Книги зі знижками» section heading', () => {
    render(<WishlistView items={[ITEM]} />);
    expect(screen.getByText('Книги зі знижками')).toBeTruthy();
  });

  it('with items → quiet banner text is shown', () => {
    render(<WishlistView items={[ITEM]} />);
    expect(screen.getByText(/Knyhovo перевіряє ціни щодня о 08:00/)).toBeTruthy();
  });

  it('with items → renders hero headline', () => {
    render(<WishlistView items={[ITEM]} />);
    expect(screen.getByText('Книговик')).toBeTruthy();
  });
});
