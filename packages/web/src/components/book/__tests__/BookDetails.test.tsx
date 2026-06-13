import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookDetails } from '../BookDetails';
import type { BookDetailsDto } from '@/lib/api/types';

const BOOK_NO_DESC: BookDetailsDto = {
  id: 'abc',
  title: 'Кобзар',
  author: 'Тарас Шевченко',
  isbn: '978-966-01-0001-1',
  description: null,
  coverUrl: null,
  lowestPrice: { amount: 29900, currency: 'UAH' },
  offersCount: 1,
  providers: [
    {
      provider: 'book-club',
      price: { amount: 29900, currency: 'UAH' },
      availability: 'in-stock',
      url: 'https://book-club.ua/book/1',
      lastSeenAt: '2024-01-15T10:00:00.000Z',
    },
  ],
};

const BOOK_WITH_DESC: BookDetailsDto = {
  ...BOOK_NO_DESC,
  description: 'Збірка поетичних творів Тараса Шевченка.',
};

describe('BookDetails', () => {
  it('renders the book title as a heading and the author', () => {
    render(<BookDetails book={BOOK_NO_DESC} initialInWishlist={false} />);

    expect(screen.getByRole('heading', { name: 'Кобзар' })).toBeInTheDocument();
    expect(screen.getByText('Тарас Шевченко')).toBeInTheDocument();
  });

  it('renders the bd-hint copy when description is null', () => {
    render(<BookDetails book={BOOK_NO_DESC} initialInWishlist={false} />);

    expect(screen.getByText(/Опис ще не додано/)).toBeInTheDocument();
  });

  it('renders the description text and no hint when description is present', () => {
    render(<BookDetails book={BOOK_WITH_DESC} initialInWishlist={false} />);

    expect(screen.getByText('Збірка поетичних творів Тараса Шевченка.')).toBeInTheDocument();
    expect(screen.queryByText(/Опис ще не додано/)).not.toBeInTheDocument();
  });
});
