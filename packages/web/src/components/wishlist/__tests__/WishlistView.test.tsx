import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WishlistView } from '../WishlistView';
import type { WishlistItemDto } from '@/lib/api/types';

// RemoveButton / WishlistCard use client hooks
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
  alert: null,
};

const TRIGGERED_ITEM: WishlistItemDto = {
  book: {
    id: 'book-2',
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    isbn: null,
    coverUrl: null,
    lowestPrice: { amount: 19000, currency: 'UAH' },
    offersCount: 1,
    providers: [
      {
        provider: 'yakaboo',
        price: { amount: 19000, currency: 'UAH' },
        availability: 'in-stock',
        url: 'https://yakaboo.ua/kobzar',
        lastSeenAt: '2026-06-13T08:00:00.000Z',
      },
    ],
  },
  createdAt: '2026-06-10T00:00:00.000Z',
  alert: {
    status: 'triggered',
    intent: 'below-current',
    targetPrice: { amount: 22000, currency: 'UAH' },
    pausedAt: null,
  },
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

  /* ── New triggered-section tests ─────────────────────────────────────────── */

  it('triggered item is promoted into «Книги зі знижками» section', () => {
    render(<WishlistView items={[ITEM, TRIGGERED_ITEM]} />);

    const discountsSection = screen.getByRole('region', { name: 'Книги зі знижками' });
    expect(discountsSection).toBeTruthy();

    // Кобзар (triggered) should appear inside the discounts section
    // Both desktop row and mobile card render the title, so getAllByText
    const kobzarTitles = screen.getAllByText('Кобзар');
    expect(kobzarTitles.length).toBeGreaterThan(0);
  });

  it('triggered item count in «Книги зі знижками» header reflects 1', () => {
    render(<WishlistView items={[ITEM, TRIGGERED_ITEM]} />);

    // The count is shown as a span.hy-group-count next to the section heading.
    // WishlistView shows triggered.length in section 1 and rest.length in section 2.
    // With 1 triggered + 1 non-triggered: section 1 count = 1, section 2 count = 1.
    const counts = document.querySelectorAll('.hy-group-count');
    // First count = triggered (1), second = rest (1)
    expect(counts[0]?.textContent).toBe('1');
    expect(counts[1]?.textContent).toBe('1');
  });

  it('non-triggered item stays in «Інші бажанки» section', () => {
    render(<WishlistView items={[ITEM, TRIGGERED_ITEM]} />);

    const othersSection = screen.getByRole('region', { name: 'Інші бажанки' });
    expect(othersSection).toBeTruthy();

    // Тіні забутих предків (non-triggered) should appear
    const tiniTitles = screen.getAllByText('Тіні забутих предків');
    expect(tiniTitles.length).toBeGreaterThan(0);
  });

  it('with only non-triggered item → «Книги зі знижками» count is 0', () => {
    render(<WishlistView items={[ITEM]} />);

    const counts = document.querySelectorAll('.hy-group-count');
    expect(counts[0]?.textContent).toBe('0');
    expect(counts[1]?.textContent).toBe('1');
  });

  it('eyebrow count uses plural "КНИГА" for 1 item', () => {
    render(<WishlistView items={[ITEM]} />);
    expect(screen.getByText(/БАЖАНКИ · 1 КНИГА/)).toBeTruthy();
  });

  it('eyebrow count uses plural "КНИГИ" for 2 items', () => {
    render(<WishlistView items={[ITEM, TRIGGERED_ITEM]} />);
    expect(screen.getByText(/БАЖАНКИ · 2 КНИГИ/)).toBeTruthy();
  });
});
