import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RemoveButton } from '../RemoveButton';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
vi.mock('@/lib/api/wishlist', () => ({
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

import { removeFromWishlist } from '@/lib/api/wishlist';

beforeEach(() => {
  refresh.mockClear();
  vi.mocked(removeFromWishlist).mockResolvedValue(undefined);
});

describe('RemoveButton', () => {
  it('renders with aria-label «Прибрати з бажанок»', () => {
    render(<RemoveButton bookId="book-1" />);
    expect(screen.getByRole('button', { name: 'Прибрати з бажанок' })).toBeTruthy();
  });

  it('click calls removeFromWishlist with the bookId', async () => {
    render(<RemoveButton bookId="book-42" />);
    fireEvent.click(screen.getByRole('button', { name: 'Прибрати з бажанок' }));
    await waitFor(() => expect(removeFromWishlist).toHaveBeenCalledWith('book-42'));
  });

  it('click calls router.refresh() after success', async () => {
    render(<RemoveButton bookId="book-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Прибрати з бажанок' }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('is disabled while pending', async () => {
    let resolve: () => void = () => {};
    vi.mocked(removeFromWishlist).mockReturnValue(
      new Promise<void>((r) => { resolve = r; }),
    );
    render(<RemoveButton bookId="book-1" />);
    const btn = screen.getByRole('button', { name: 'Прибрати з бажанок' });
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    resolve();
    await waitFor(() => expect(btn).not.toBeDisabled());
  });

  it('keeps the button enabled on WishlistError (no destructive UI)', async () => {
    const { WishlistError } = await import('@/lib/api/wishlist');
    vi.mocked(removeFromWishlist).mockRejectedValue(new WishlistError('fail', 500));

    render(<RemoveButton bookId="book-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Прибрати з бажанок' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Прибрати з бажанок' })).not.toBeDisabled());
  });
});
