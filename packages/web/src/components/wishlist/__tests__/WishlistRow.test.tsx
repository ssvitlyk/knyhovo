import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WishlistRow } from '../WishlistRow';
import type { WishlistItemDto } from '@/lib/api/types';

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
  alert: null,
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

  /* ── New alert-related tests ─────────────────────────────────────────────── */

  it('watch alert → renders AlertChip «Стежимо за ціною»', () => {
    const watchItem: WishlistItemDto = {
      ...BASE_ITEM,
      alert: {
        status: 'active',
        intent: 'below-current',
        targetPrice: { amount: 24500, currency: 'UAH' },
        pausedAt: null,
      },
    };
    render(<WishlistRow item={watchItem} />);
    expect(screen.getByText('Стежимо за ціною')).toBeTruthy();
  });

  it('watch alert → renders AlertTarget with target price copy', () => {
    const watchItem: WishlistItemDto = {
      ...BASE_ITEM,
      alert: {
        status: 'active',
        intent: 'below-current',
        targetPrice: { amount: 24500, currency: 'UAH' },
        pausedAt: null,
      },
    };
    render(<WishlistRow item={watchItem} />);
    expect(screen.getByText(/Книговик напише, коли ціна стане/)).toBeTruthy();
  });

  it('watch alert → renders alert bell control (WishlistAlertControl)', () => {
    const watchItem: WishlistItemDto = {
      ...BASE_ITEM,
      alert: {
        status: 'active',
        intent: 'below-current',
        targetPrice: { amount: 24500, currency: 'UAH' },
        pausedAt: null,
      },
    };
    render(<WishlistRow item={watchItem} />);
    // WishlistAlertControl renders AlertBell with the 'watch' state
    expect(
      screen.getByRole('button', { name: 'Змінити сповіщення про ціну' }),
    ).toBeTruthy();
  });

  it('out-of-stock + no alert → shows «Очікуємо наявності» badge', () => {
    const outOfStockItem: WishlistItemDto = {
      ...BASE_ITEM,
      book: {
        ...BASE_ITEM.book,
        offersCount: 0,
        providers: [],
        lowestPrice: null,
      },
      alert: null,
    };
    render(<WishlistRow item={outOfStockItem} />);
    expect(screen.getByText('Очікуємо наявності')).toBeTruthy();
  });

  it('triggered alert → row has v1-row--hot class', () => {
    const triggeredItem: WishlistItemDto = {
      ...BASE_ITEM,
      alert: {
        status: 'triggered',
        intent: 'below-current',
        targetPrice: { amount: 24500, currency: 'UAH' },
        pausedAt: null,
      },
    };
    const { container } = render(<WishlistRow item={triggeredItem} />);
    expect(container.querySelector('.v1-row--hot')).toBeTruthy();
  });

  it('triggered alert → shows «Ціль досягнута» chip', () => {
    const triggeredItem: WishlistItemDto = {
      ...BASE_ITEM,
      alert: {
        status: 'triggered',
        intent: 'below-current',
        targetPrice: { amount: 24500, currency: 'UAH' },
        pausedAt: null,
      },
    };
    render(<WishlistRow item={triggeredItem} />);
    expect(screen.getByText('Ціль досягнута')).toBeTruthy();
  });

  /* ── Cover rendering tests ───────────────────────────────────────────────── */

  it('non-null coverUrl → renders img.v1-cover with correct src', () => {
    const itemWithCover: WishlistItemDto = {
      ...BASE_ITEM,
      book: {
        ...BASE_ITEM.book,
        coverUrl: 'https://cdn.yakaboo.ua/cover.jpg',
      },
    };
    const { container } = render(<WishlistRow item={itemWithCover} />);
    const img = container.querySelector('img.v1-cover');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://cdn.yakaboo.ua/cover.jpg');
  });

  it('null coverUrl → no img, placeholder span.v1-cover present', () => {
    // BASE_ITEM already has coverUrl: null
    const { container } = render(<WishlistRow item={BASE_ITEM} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('span.v1-cover')).toBeTruthy();
  });
});
