import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultsGrid } from '../ResultsGrid';
import type { SearchItemDto } from '@/lib/api/types';

const ITEMS: SearchItemDto[] = [
  {
    id: 'a',
    title: 'Дорожча книга',
    author: 'Автор А',
    lowestPrice: { amount: 42000, currency: 'UAH' },
    offersCount: 1,
    providers: [{ provider: 'yakaboo', price: { amount: 42000, currency: 'UAH' } }],
  },
  {
    id: 'b',
    title: 'Найдешевша книга',
    author: 'Автор Б',
    lowestPrice: { amount: 29900, currency: 'UAH' },
    offersCount: 2,
    providers: [
      { provider: 'book-club', price: { amount: 29900, currency: 'UAH' } },
      { provider: 'yakaboo', price: { amount: 34900, currency: 'UAH' } },
    ],
  },
];

describe('ResultsGrid', () => {
  it('formats the lowest price and shows the lowest-price provider as the store', () => {
    render(<ResultsGrid items={ITEMS} />);
    expect(screen.getByText('299 ₴')).toBeInTheDocument();
    expect(screen.getByText('420 ₴')).toBeInTheDocument();
    expect(screen.getByText('· BookClub')).toBeInTheDocument();
  });

  it('marks only the cheapest item on the page with the best-price badge', () => {
    render(<ResultsGrid items={ITEMS} />);
    expect(screen.getAllByText('Найкраща ціна')).toHaveLength(1);
  });
});
