import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { WishlistOpportunityItem } from '@/lib/wishlist/opportunities';
import { BuyingOpportunities } from '../BuyingOpportunities';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

class StubResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function mockMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

function makeItem(overrides: Partial<WishlistOpportunityItem> & { bookId: string }): WishlistOpportunityItem {
  return {
    title: `Title ${overrides.bookId}`,
    author: `Author ${overrides.bookId}`,
    coverUrl: null,
    reason: 'PRICE_DROPPED',
    savingsAmount: 1000,
    price: 20000,
    prevPrice: 25000,
    currency: 'UAH',
    store: 'yakaboo',
    ctaUrl: 'https://yakaboo.ua/book',
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', StubResizeObserver);
});

describe('BuyingOpportunities', () => {
  it('renders the empty-state copy and no carousel chrome when there are 0 items', () => {
    mockMatchMedia(true);
    render(<BuyingOpportunities items={[]} />);
    expect(screen.getByText('Сьогодні вигідних пропозицій ще немає.')).toBeInTheDocument();
    expect(
      screen.getByText("Книговик стежить за цінами і повідомить, щойно з'явиться щось цікаве."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Попередні книги')).not.toBeInTheDocument();
  });

  it('chunks desktop items 4-per-page and shows the "1 / N" counter', () => {
    mockMatchMedia(true);
    const items = Array.from({ length: 5 }, (_, i) => makeItem({ bookId: `b${i}` }));
    render(<BuyingOpportunities items={items} />);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    // First page shows 4 cards; the 5th sits on the aria-hidden second page
    // (role queries correctly exclude aria-hidden subtrees).
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
  });

  it('renders one badge per reason', () => {
    mockMatchMedia(true);
    const items = [
      makeItem({ bookId: 'a', reason: 'TARGET_REACHED' }),
      makeItem({ bookId: 'b', reason: 'LOWEST_90_DAYS' }),
    ];
    render(<BuyingOpportunities items={items} />);
    expect(screen.getByText('Досягнуто вашої цілі')).toBeInTheDocument();
    expect(screen.getByText('Найнижча за 90 днів')).toBeInTheDocument();
  });

  it('shows the struck old price only when prevPrice > price', () => {
    mockMatchMedia(true);
    const items = [
      makeItem({ bookId: 'discounted', price: 20000, prevPrice: 25000 }),
      makeItem({ bookId: 'flat', price: 20000, prevPrice: 20000 }),
    ];
    const { container } = render(<BuyingOpportunities items={items} />);
    const oldPrices = container.querySelectorAll('.wl21-sale__old');
    expect(oldPrices).toHaveLength(1);
    expect(oldPrices[0]).toHaveTextContent('250 ₴');
  });

  it('renders no dots for a solo mobile item', () => {
    mockMatchMedia(false);
    const items = [makeItem({ bookId: 'solo' })];
    const { container } = render(<BuyingOpportunities items={items} />);
    expect(container.querySelector('.wl22-dots')).not.toBeInTheDocument();
    expect(container.querySelector('.wl22-solo')).toBeInTheDocument();
  });
});
