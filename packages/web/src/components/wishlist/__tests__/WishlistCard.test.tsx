import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WishlistCard } from '../WishlistCard';
import type { WishlistItemDto } from '@/lib/api/types';

// WishlistCard is a 'use client' component that uses useState — no special wrapper needed in jsdom.
// RemoveButton uses useRouter — mock next/navigation
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
// WishlistAlertControl uses priceAlerts
vi.mock('@/lib/api/priceAlerts', () => ({
  setAlert: vi.fn(),
  pauseAlert: vi.fn(),
  removeAlert: vi.fn(),
  AlertError: class AlertError extends Error {
    status: number | null;
    constructor(msg: string, status: number | null) {
      super(msg);
      this.name = 'AlertError';
      this.status = status;
    }
  },
}));

const BASE_ITEM: WishlistItemDto = {
  book: {
    id: 'book-1',
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    isbn: null,
    coverUrl: null,
    lowestPrice: { amount: 24500, currency: 'UAH' },
    offersCount: 1,
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
  alert: null,
};

describe('WishlistCard', () => {
  it('renders the book title in the collapsed header', () => {
    render(<WishlistCard item={BASE_ITEM} />);
    expect(screen.getByText('Кобзар')).toBeTruthy();
  });

  /* ── Cover rendering tests ───────────────────────────────────────────────── */

  it('non-null coverUrl → renders img.v1-mob-cover with correct src', () => {
    const itemWithCover: WishlistItemDto = {
      ...BASE_ITEM,
      book: {
        ...BASE_ITEM.book,
        coverUrl: 'https://cdn.yakaboo.ua/cover.jpg',
      },
    };
    const { container } = render(<WishlistCard item={itemWithCover} />);
    const img = container.querySelector('img.v1-mob-cover');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://cdn.yakaboo.ua/cover.jpg');
  });

  it('null coverUrl → no img, placeholder span.v1-mob-cover present', () => {
    // BASE_ITEM already has coverUrl: null
    const { container } = render(<WishlistCard item={BASE_ITEM} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('span.v1-mob-cover')).toBeTruthy();
  });
});
