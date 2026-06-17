import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WishlistToggle } from '../WishlistToggle';
import type { AlertDto } from '@/lib/api/types';

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
vi.mock('@/lib/api/priceHistory', () => ({
  getPriceHistory: vi.fn(),
  PriceHistoryError: class PriceHistoryError extends Error {
    status: number | null;
    constructor(msg: string, status: number | null) {
      super(msg);
      this.name = 'PriceHistoryError';
      this.status = status;
    }
  },
}));

import { addToWishlist, removeFromWishlist } from '@/lib/api/wishlist';
import { setAlert, pauseAlert, AlertError } from '@/lib/api/priceAlerts';
import { getPriceHistory } from '@/lib/api/priceHistory';

function makeMatchMedia(matches: boolean): typeof window.matchMedia {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  // `shouldAdvanceTime: true` keeps the fake clock progressing with real time so
  // RTL's `waitFor` (which polls on timers) can never deadlock against the faked
  // clock. The explicit vi.runAllTimers()/advanceTimersByTime() calls below still
  // work; this only removes the fake-timers + waitFor hang risk.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.matchMedia = makeMatchMedia(false);
  vi.mocked(addToWishlist).mockResolvedValue(undefined);
  vi.mocked(removeFromWishlist).mockResolvedValue(undefined);
  vi.mocked(setAlert).mockResolvedValue(undefined);
  vi.mocked(pauseAlert).mockResolvedValue(undefined);
  vi.mocked(getPriceHistory).mockResolvedValue({
    bookId: 'book-1',
    period: '90d',
    currency: 'UAH',
    current: null,
    lowest: null,
    highest: null,
    typicalRange: { min: 20000, max: 28000, currency: 'UAH' },
    change: null,
    points: [],
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

/* ── Existing tests (preserved) ─────────────────────────────────────────────── */
describe('WishlistToggle', () => {
  it('unsaved state → shows «До вішлиста»', () => {
    render(<WishlistToggle bookId="book-1" initialInWishlist={false} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    expect(screen.getByRole('button', { name: /До вішлиста/ })).toBeTruthy();
  });

  it('saved state → shows «У вішлисті»', () => {
    render(<WishlistToggle bookId="book-1" initialInWishlist={true} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    expect(screen.getByRole('button', { name: /У вішлисті/ })).toBeTruthy();
  });

  it('unsaved → click calls addToWishlist and flips to saved', async () => {
    render(<WishlistToggle bookId="book-1" initialInWishlist={false} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    fireEvent.click(screen.getByRole('button', { name: /До вішлиста/ }));
    await act(async () => { vi.runAllTimers(); });
    await waitFor(() => expect(addToWishlist).toHaveBeenCalledWith('book-1'));
    expect(screen.getByRole('button', { name: /У вішлисті/ })).toBeTruthy();
  });

  it('saved → click calls removeFromWishlist and flips to unsaved', async () => {
    render(<WishlistToggle bookId="book-1" initialInWishlist={true} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    fireEvent.click(screen.getByRole('button', { name: /У вішлисті/ }));
    await act(async () => { vi.runAllTimers(); });
    await waitFor(() => expect(removeFromWishlist).toHaveBeenCalledWith('book-1'));
    expect(screen.getByRole('button', { name: /До вішлиста/ })).toBeTruthy();
  });

  it('401 error → shows inline «Увійдіть» note and reverts state', async () => {
    const { WishlistError } = await import('@/lib/api/wishlist');
    vi.mocked(addToWishlist).mockRejectedValue(new WishlistError('Unauthorized', 401));

    render(<WishlistToggle bookId="book-1" initialInWishlist={false} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    fireEvent.click(screen.getByRole('button', { name: /До вішлиста/ }));

    await act(async () => { vi.runAllTimers(); });
    await waitFor(() =>
      expect(screen.getByText(/Увійдіть, щоб зберігати/)).toBeTruthy(),
    );
    // State reverts back to unsaved
    expect(screen.getByRole('button', { name: /До вішлиста/ })).toBeTruthy();
  });

  it('non-401 error → reverts state but shows no note', async () => {
    const { WishlistError } = await import('@/lib/api/wishlist');
    vi.mocked(addToWishlist).mockRejectedValue(new WishlistError('Server error', 500));

    render(<WishlistToggle bookId="book-1" initialInWishlist={false} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    fireEvent.click(screen.getByRole('button', { name: /До вішлиста/ }));

    await act(async () => { vi.runAllTimers(); });
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

    render(<WishlistToggle bookId="book-1" initialInWishlist={false} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    const btn = screen.getByRole('button', { name: /До вішлиста/ });
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
    resolve();
    await act(async () => { vi.runAllTimers(); });
    await waitFor(() => expect(btn).not.toBeDisabled());
  });

  /* ── New alert-related tests ─────────────────────────────────────────────── */

  it('saved + no alert → shows «Сповістити про зниження ціни» link', () => {
    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={true}
        initialAlert={null}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );
    expect(screen.getByText('Сповістити про зниження ціни')).toBeTruthy();
  });

  it('clicking «Сповістити про зниження ціни» opens AlertConfig', async () => {
    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={true}
        initialAlert={null}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );

    fireEvent.click(screen.getByText('Сповістити про зниження ціни'));

    // AlertSurface opens after mount effect
    await act(async () => {
      vi.advanceTimersByTime(0);
    });

    await waitFor(() => {
      expect(screen.getByText('Коли повідомити про ціну?')).toBeTruthy();
    });
  });

  it('submitting config calls setAlert and shows the toast', async () => {
    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={true}
        initialAlert={null}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );

    fireEvent.click(screen.getByText('Сповістити про зниження ціни'));

    await act(async () => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText('Коли повідомити про ціну?')).toBeTruthy();
    });

    // Click submit (below-current is default, currentPrice=24000 so enabled)
    const submitBtn = screen.getByRole('button', { name: 'Увімкнути сповіщення' });
    fireEvent.click(submitBtn);

    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => {
      expect(setAlert).toHaveBeenCalledWith(
        'book-1',
        'below-current',
        { amount: 24000, currency: 'UAH' },
      );
    });

    // Toast appears
    await act(async () => { vi.advanceTimersByTime(0); });
    await waitFor(() => {
      expect(screen.getByText('Сповіщення увімкнено')).toBeTruthy();
    });
  });

  it('watch alert → shows AlertChip «Стежимо за ціною» + «Змінити» button', () => {
    const watchAlert: AlertDto = {
      status: 'active',
      intent: 'below-current',
      targetPrice: { amount: 24000, currency: 'UAH' },
      pausedAt: null,
    };
    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={true}
        initialAlert={watchAlert}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );
    expect(screen.getByText('Стежимо за ціною')).toBeTruthy();
    expect(screen.getByText('Змінити')).toBeTruthy();
  });

  it('paused alert → shows «Поновити сповіщення» link that calls pauseAlert(bookId, false)', async () => {
    const pausedAlert: AlertDto = {
      status: 'paused',
      intent: 'below-current',
      targetPrice: { amount: 24000, currency: 'UAH' },
      pausedAt: '2026-06-01T08:00:00.000Z',
    };
    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={true}
        initialAlert={pausedAlert}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );

    const resumeBtn = screen.getByText('Поновити сповіщення');
    expect(resumeBtn).toBeTruthy();
    fireEvent.click(resumeBtn);

    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => {
      expect(pauseAlert).toHaveBeenCalledWith('book-1', false);
    });
  });

  it('setAlert rejection (AlertError) → error note shown in the form', async () => {
    vi.mocked(setAlert).mockRejectedValue(
      new AlertError('Не вдалося ввімкнути сповіщення.', 500),
    );

    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={true}
        initialAlert={null}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );

    fireEvent.click(screen.getByText('Сповістити про зниження ціни'));
    await act(async () => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText('Коли повідомити про ціну?')).toBeTruthy();
    });

    const submitBtn = screen.getByRole('button', { name: 'Увімкнути сповіщення' });
    fireEvent.click(submitBtn);

    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('Не вдалося ввімкнути сповіщення.')).toBeTruthy();
    });
  });

  it('getPriceHistory resolves typicalRange → favourable-price intent is enabled', async () => {
    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={true}
        initialAlert={null}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );

    fireEvent.click(screen.getByText('Сповістити про зниження ціни'));
    await act(async () => { vi.advanceTimersByTime(0); });

    // Wait for priceHistory fetch to resolve
    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => {
      expect(screen.getByText('Коли повідомити про ціну?')).toBeTruthy();
    });

    // After typicalRangeMin is set, favourable-price should be enabled
    const radios = screen.getAllByRole('radio');
    expect(radios[2]).not.toBeDisabled();
  });
});
