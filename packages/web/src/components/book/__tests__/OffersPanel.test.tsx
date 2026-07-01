import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OffersPanel } from '../OffersPanel';
import type { BookProviderDto } from '@/lib/api/types';

// OffersPanel renders WishlistToggle, which uses next/navigation's useRouter
// (via useAlertController). Mock it so the App Router invariant is satisfied.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const YAKABOO_OFFER: BookProviderDto = {
  provider: 'yakaboo',
  price: { amount: 34900, currency: 'UAH' },
  availability: 'in-stock',
  url: 'https://yakaboo.ua/book/1',
  lastSeenAt: '2024-03-10T12:00:00.000Z',
};

const BOOKCLUB_OFFER: BookProviderDto = {
  provider: 'book-club',
  price: { amount: 29900, currency: 'UAH' },
  availability: 'in-stock',
  url: 'https://book-club.ua/book/1',
  lastSeenAt: '2024-03-10T12:00:00.000Z',
};

const UNKNOWN_OFFER: BookProviderDto = {
  provider: 'yakaboo',
  price: { amount: 34900, currency: 'UAH' },
  availability: 'unknown',
  url: 'https://yakaboo.ua/book/2',
  lastSeenAt: '2024-03-10T12:00:00.000Z',
};

describe('OffersPanel', () => {
  it('with 2 in-stock providers shows the best price block, eyebrow, and both CTAs', () => {
    const { container } = render(
      <OffersPanel
        providers={[BOOKCLUB_OFFER, YAKABOO_OFFER]}
        lowestPrice={BOOKCLUB_OFFER.price}
        offersCount={2}
        bookId="book-1"
        initialInWishlist={false}
        initialAlert={null}
        bookTitle="Тест"
      />,
    );

    // Eyebrow
    expect(screen.getByText('ЦІНИ У 2 КНИГАРНЯХ')).toBeInTheDocument();

    // Best price formatted
    expect(screen.getAllByText('299 ₴').length).toBeGreaterThanOrEqual(1);

    // Primary CTA (best-price block) + mobile sticky-bar CTA share the same label
    // and href (both point at the best offer). Expect two «Перейти до книгарні».
    const primaryLinks = screen.getAllByRole('link', { name: 'Перейти до книгарні' });
    expect(primaryLinks).toHaveLength(2);
    for (const link of primaryLinks) {
      expect(link.getAttribute('href')).toBe('https://book-club.ua/book/1');
    }

    // The best-price block carries the id the sticky bar observes.
    expect(container.querySelector('#bd-best-block')).not.toBeNull();

    // Mobile sticky purchase bar is rendered (CSS hides it above the breakpoint).
    expect(
      screen.getByRole('region', { name: 'Купити книгу — найкраща ціна' }),
    ).toBeInTheDocument();

    // Secondary row CTA with correct href
    const secondaryLink = screen.getByRole('link', { name: 'Перейти' });
    expect(secondaryLink).toBeInTheDocument();
    expect(secondaryLink.getAttribute('href')).toBe('https://yakaboo.ua/book/1');

    // Availability label
    expect(screen.getAllByText('В наявності').length).toBeGreaterThanOrEqual(1);
  });

  it('with an unknown availability provider shows the correct label', () => {
    render(
      <OffersPanel
        providers={[UNKNOWN_OFFER]}
        lowestPrice={UNKNOWN_OFFER.price}
        offersCount={1}
        bookId="book-1"
        initialInWishlist={false}
        initialAlert={null}
        bookTitle="Тест"
      />,
    );

    // W6a: availability now appears both in the store line and as a «why» reason
    // for an unknown best offer — assert presence tolerant of both occurrences.
    expect(screen.getAllByText('Наявність уточнюється').length).toBeGreaterThanOrEqual(1);
  });

  it('with no offers shows the unavailable state and no CTAs', () => {
    render(
      <OffersPanel
        providers={[]}
        lowestPrice={null}
        offersCount={0}
        bookId="book-1"
        initialInWishlist={false}
        initialAlert={null}
        bookTitle="Тест"
      />,
    );

    expect(screen.getByText('Зараз немає в наявності')).toBeInTheDocument();

    // No primary CTA
    expect(screen.queryByRole('link', { name: 'Перейти до книгарні' })).not.toBeInTheDocument();

    // No secondary CTA
    expect(screen.queryByRole('link', { name: 'Перейти' })).not.toBeInTheDocument();

    // No eyebrow with "ЦІНИ У"
    expect(screen.queryByText(/ЦІНИ У/)).not.toBeInTheDocument();

    // No sticky purchase bar in the unavailable state.
    expect(
      screen.queryByRole('region', { name: 'Купити книгу — найкраща ціна' }),
    ).not.toBeInTheDocument();
  });
});
