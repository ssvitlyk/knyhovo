import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WishlistToggle } from '../WishlistToggle';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/lib/api/wishlist', () => ({
  addToWishlist: vi.fn(),
  removeFromWishlist: vi.fn(),
  WishlistError: class WishlistError extends Error {
    status: number | null;
    constructor(msg: string, status: number | null) {
      super(msg);
      this.name = 'WishlistError';
      this.status = status;
    }
  },
}));

import { addToWishlist, removeFromWishlist } from '@/lib/api/wishlist';

beforeEach(() => {
  vi.mocked(addToWishlist).mockResolvedValue(undefined);
  vi.mocked(removeFromWishlist).mockResolvedValue(undefined);
});

describe('WishlistToggle', () => {
  it('unsaved state → shows «До вішлиста»', () => {
    render(<WishlistToggle bookId="book-1" initialInWishlist={false} />);
    expect(screen.getByRole('button', { name: /До вішлиста/ })).toBeTruthy();
  });

  it('saved state → shows «У вішлисті»', () => {
    render(<WishlistToggle bookId="book-1" initialInWishlist={true} />);
    expect(screen.getByRole('button', { name: /У вішлисті/ })).toBeTruthy();
  });

  it('unsaved → click calls addToWishlist and flips to saved', async () => {
    render(<WishlistToggle bookId="book-1" initialInWishlist={false} />);
    fireEvent.click(screen.getByRole('button', { name: /До вішлиста/ }));
    await waitFor(() => expect(addToWishlist).toHaveBeenCalledWith('book-1'));
    expect(screen.getByRole('button', { name: /У вішлисті/ })).toBeTruthy();
  });

  it('saved → click calls removeFromWishlist and flips to unsaved', async () => {
    render(<WishlistToggle bookId="book-1" initialInWishlist={true} />);
    fireEvent.click(screen.getByRole('button', { name: /У вішлисті/ }));
    await waitFor(() => expect(removeFromWishlist).toHaveBeenCalledWith('book-1'));
    expect(screen.getByRole('button', { name: /До вішлиста/ })).toBeTruthy();
  });

  it('401 error → shows inline «Увійдіть» note and reverts state', async () => {
    const { WishlistError } = await import('@/lib/api/wishlist');
    vi.mocked(addToWishlist).mockRejectedValue(new WishlistError('Unauthorized', 401));

    render(<WishlistToggle bookId="book-1" initialInWishlist={false} />);
    fireEvent.click(screen.getByRole('button', { name: /До вішлиста/ }));

    await waitFor(() =>
      expect(screen.getByText(/Увійдіть, щоб зберігати/)).toBeTruthy(),
    );
    // State reverts back to unsaved
    expect(screen.getByRole('button', { name: /До вішлиста/ })).toBeTruthy();
  });

  it('non-401 error → reverts state but shows no note', async () => {
    const { WishlistError } = await import('@/lib/api/wishlist');
    vi.mocked(addToWishlist).mockRejectedValue(new WishlistError('Server error', 500));

    render(<WishlistToggle bookId="book-1" initialInWishlist={false} />);
    fireEvent.click(screen.getByRole('button', { name: /До вішлиста/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /До вішлиста/ })).toBeTruthy(),
    );
    expect(screen.queryByText(/Увійдіть, щоб зберігати/)).toBeNull();
  });

  it('is disabled while the request is pending', async () => {
    let resolve: () => void = () => {};
    vi.mocked(addToWishlist).mockReturnValue(
      new Promise<void>((r) => { resolve = r; }),
    );

    render(<WishlistToggle bookId="book-1" initialInWishlist={false} />);
    const btn = screen.getByRole('button', { name: /До вішлиста/ });
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    resolve();
    await waitFor(() => expect(btn).not.toBeDisabled());
  });
});
