import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Hoisted mocks so the module factories can reference them.
const { mockAdd, mockRemove, mockOpenLogin } = vi.hoisted(() => ({
  mockAdd: vi.fn(),
  mockRemove: vi.fn(),
  mockOpenLogin: vi.fn(),
}));

vi.mock('@/lib/api/wishlist', () => {
  // Real class so the component's `instanceof WishlistError` check works.
  class WishlistError extends Error {
    readonly status: number | null;
    constructor(message: string, status: number | null) {
      super(message);
      this.name = 'WishlistError';
      this.status = status;
    }
  }
  return { addToWishlist: mockAdd, removeFromWishlist: mockRemove, WishlistError };
});

vi.mock('@/components/auth/LoginModalProvider', () => ({
  useLoginModal: () => ({ openLogin: mockOpenLogin }),
}));

import { CollectionBookCard } from '../CollectionBookCard';
import { WishlistError } from '@/lib/api/wishlist';
import type { CollectionBookDto } from '@/lib/api/types';

function makeBook(over: Partial<CollectionBookDto> = {}): CollectionBookDto {
  return {
    id: 'b1',
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    coverUrl: '/covers/kobzar.png',
    minPrice: { amount: 24900, currency: 'UAH' },
    oldPrice: null,
    discountPercent: null,
    storeName: 'Yakaboo',
    rating: null,
    reviewsCount: null,
    wishlistCount: 0,
    isWishlisted: false,
    inStock: true,
    catalogAddedAt: new Date().toISOString(),
    ...over,
  };
}

describe('CollectionBookCard', () => {
  beforeEach(() => {
    mockAdd.mockReset();
    mockRemove.mockReset();
    mockOpenLogin.mockReset();
  });

  it('renders title, author and price', () => {
    render(<CollectionBookCard book={makeBook()} />);
    expect(screen.getByText('Кобзар')).toBeInTheDocument();
    expect(screen.getByText('Тарас Шевченко')).toBeInTheDocument();
    expect(screen.getByText(/249/)).toBeInTheDocument();
  });

  it('links the whole card to the book details page', () => {
    render(<CollectionBookCard book={makeBook({ id: 'abc' })} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/books/abc');
  });

  it('optimistically saves to wishlist on heart click (real wishlist API, no mock store)', async () => {
    mockAdd.mockResolvedValueOnce(undefined);
    render(<CollectionBookCard book={makeBook()} />);

    const heart = screen.getByRole('button', { name: 'Додати в бажанки' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(heart);

    await waitFor(() => expect(mockAdd).toHaveBeenCalledWith('b1'));
    expect(await screen.findByRole('button', { name: 'У бажанках' })).toHaveAttribute('aria-pressed', 'true');
    expect(mockOpenLogin).not.toHaveBeenCalled();
  });

  it('removes from wishlist when already saved', async () => {
    mockRemove.mockResolvedValueOnce(undefined);
    render(<CollectionBookCard book={makeBook({ isWishlisted: true })} />);

    const heart = screen.getByRole('button', { name: 'У бажанках' });
    fireEvent.click(heart);

    await waitFor(() => expect(mockRemove).toHaveBeenCalledWith('b1'));
    expect(await screen.findByRole('button', { name: 'Додати в бажанки' })).toBeInTheDocument();
  });

  it('on 401 it reverts the optimistic state and opens the login modal with returnTo', async () => {
    mockAdd.mockRejectedValueOnce(new WishlistError('unauthorized', 401));
    render(<CollectionBookCard book={makeBook()} returnTo="/catalog" />);

    fireEvent.click(screen.getByRole('button', { name: 'Додати в бажанки' }));

    await waitFor(() => expect(mockOpenLogin).toHaveBeenCalledWith('/catalog'));
    // reverted back to the unsaved state
    expect(screen.getByRole('button', { name: 'Додати в бажанки' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('on a non-401 error it reverts without opening the login modal', async () => {
    mockAdd.mockRejectedValueOnce(new WishlistError('server error', 500));
    render(<CollectionBookCard book={makeBook()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Додати в бажанки' }));

    await waitFor(() => expect(mockAdd).toHaveBeenCalled());
    expect(mockOpenLogin).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Додати в бажанки' })).toHaveAttribute('aria-pressed', 'false');
  });
});
