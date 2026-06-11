import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OffersPanel } from '../OffersPanel';
import type { BookProviderDto } from '@/lib/api/types';

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
    render(
      <OffersPanel
        providers={[BOOKCLUB_OFFER, YAKABOO_OFFER]}
        lowestPrice={BOOKCLUB_OFFER.price}
        offersCount={2}
      />,
    );

    // Eyebrow
    expect(screen.getByText('ЦІНИ У 2 КНИГАРНЯХ')).toBeInTheDocument();

    // Best price formatted
    expect(screen.getByText('299 ₴')).toBeInTheDocument();

    // Primary CTA with correct href
    const primaryLink = screen.getByRole('link', { name: 'Перейти до книгарні' });
    expect(primaryLink).toBeInTheDocument();
    expect(primaryLink.getAttribute('href')).toBe('https://book-club.ua/book/1');

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
      />,
    );

    expect(screen.getByText('Наявність уточнюється')).toBeInTheDocument();
  });

  it('with no offers shows the unavailable state and no CTAs', () => {
    render(<OffersPanel providers={[]} lowestPrice={null} offersCount={0} />);

    expect(screen.getByText('Зараз немає в наявності')).toBeInTheDocument();

    // No primary CTA
    expect(screen.queryByRole('link', { name: 'Перейти до книгарні' })).not.toBeInTheDocument();

    // No secondary CTA
    expect(screen.queryByRole('link', { name: 'Перейти' })).not.toBeInTheDocument();

    // No eyebrow with "ЦІНИ У"
    expect(screen.queryByText(/ЦІНИ У/)).not.toBeInTheDocument();
  });
});
