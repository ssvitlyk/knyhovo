import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WishlistToggle } from '../WishlistToggle';
import type { AlertDto, AlertModePreviewDto } from '@/lib/api/types';

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
    code: string | null;
    constructor(msg: string, status: number | null, code: string | null = null) {
      super(msg);
      this.name = 'AlertError';
      this.status = status;
      this.code = code;
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

/** All 3 modes available — the common case in these tests. */
const PREVIEW: readonly AlertModePreviewDto[] = [
  { mode: 'any-drop', available: true, threshold: { amount: 24000, currency: 'UAH' }, proof: null, reason: null },
  { mode: 'good-price', available: true, threshold: { amount: 20000, currency: 'UAH' }, proof: 'дешевше, ніж зазвичай', reason: null },
  { mode: 'my-price', available: true, threshold: null, proof: null, reason: null },
];

const RESOLVED_ANY_DROP: AlertDto = {
  state: 'armed',
  mode: 'any-drop',
  threshold: { amount: 24000, currency: 'UAH' },
  baseline: { amount: 24000, currency: 'UAH' },
  thresholdProof: null,
  pausedAt: null,
  notifiedAt: null,
};

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
  vi.mocked(setAlert).mockResolvedValue(RESOLVED_ANY_DROP);
  vi.mocked(pauseAlert).mockResolvedValue(undefined);
  vi.mocked(getPriceHistory).mockResolvedValue({
    bookId: 'book-1',
    period: '90d',
    currency: 'UAH',
    current: null,
    lowest: null,
    highest: null,
    typicalRange: null,
    change: null,
    points: [],
    alertPolicyPreview: PREVIEW,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

/* ── Row 1 — wishlist toggle ─────────────────────────────────────────────── */
describe('WishlistToggle', () => {
  it('unsaved state → shows «Додати до бажанок»', () => {
    render(<WishlistToggle bookId="book-1" initialInWishlist={false} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    const btn = screen.getByRole('button', { name: /Додати до бажанок/ });
    expect(btn).toBeTruthy();
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('saved state → shows «У бажанках»', () => {
    render(<WishlistToggle bookId="book-1" initialInWishlist={true} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    const btn = screen.getByRole('button', { name: /У бажанках/ });
    expect(btn).toBeTruthy();
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('unsaved → click calls addToWishlist and flips to saved', async () => {
    render(<WishlistToggle bookId="book-1" initialInWishlist={false} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    fireEvent.click(screen.getByRole('button', { name: /Додати до бажанок/ }));
    await act(async () => { vi.runAllTimers(); });
    await waitFor(() => expect(addToWishlist).toHaveBeenCalledWith('book-1'));
    expect(screen.getByRole('button', { name: /У бажанках/ })).toBeTruthy();
  });

  it('saved → click calls removeFromWishlist and flips to unsaved', async () => {
    render(<WishlistToggle bookId="book-1" initialInWishlist={true} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    fireEvent.click(screen.getByRole('button', { name: /У бажанках/ }));
    await act(async () => { vi.runAllTimers(); });
    await waitFor(() => expect(removeFromWishlist).toHaveBeenCalledWith('book-1'));
    expect(screen.getByRole('button', { name: /Додати до бажанок/ })).toBeTruthy();
  });

  it('401 error → shows inline «Увійдіть» note and reverts state', async () => {
    const { WishlistError } = await import('@/lib/api/wishlist');
    vi.mocked(addToWishlist).mockRejectedValue(new WishlistError('Unauthorized', 401));

    render(<WishlistToggle bookId="book-1" initialInWishlist={false} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    fireEvent.click(screen.getByRole('button', { name: /Додати до бажанок/ }));

    await act(async () => { vi.runAllTimers(); });
    await waitFor(() =>
      expect(screen.getByText('Увійдіть, щоб додавати до бажанок')).toBeTruthy(),
    );
    // State reverts back to unsaved
    expect(screen.getByRole('button', { name: /Додати до бажанок/ })).toBeTruthy();
  });

  it('non-401 error → reverts state and shows a retryable «Ще раз» row error', async () => {
    const { WishlistError } = await import('@/lib/api/wishlist');
    vi.mocked(addToWishlist).mockRejectedValue(new WishlistError('Server error', 500));

    render(<WishlistToggle bookId="book-1" initialInWishlist={false} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    fireEvent.click(screen.getByRole('button', { name: /Додати до бажанок/ }));

    await act(async () => { vi.runAllTimers(); });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Додати до бажанок/ })).toBeTruthy(),
    );
    expect(screen.queryByText('Увійдіть, щоб додавати до бажанок')).toBeNull();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('Не вдалося додати до бажанок.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ще раз' }));
    await act(async () => { vi.runAllTimers(); });
    await waitFor(() => expect(addToWishlist).toHaveBeenCalledTimes(2));
  });

  it('add / remove show the wishlist toasts', async () => {
    const { unmount } = render(
      <WishlistToggle bookId="book-1" initialInWishlist={false} initialAlert={null} currentPrice={null} bookTitle="Тест" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Додати до бажанок/ }));
    await act(async () => { vi.runAllTimers(); });
    await waitFor(() => expect(screen.getByText('Додано до бажанок')).toBeTruthy());
    unmount();

    render(<WishlistToggle bookId="book-1" initialInWishlist={true} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    fireEvent.click(screen.getByRole('button', { name: /У бажанках/ }));
    await act(async () => { vi.runAllTimers(); });
    await waitFor(() => expect(screen.getByText('Прибрано з бажанок')).toBeTruthy());
  });

  it('is aria-busy while the request is pending, without ever disabling the button', async () => {
    let resolve: () => void = () => {};
    vi.mocked(addToWishlist).mockReturnValue(
      new Promise<void>((r) => { resolve = r; }),
    );

    render(<WishlistToggle bookId="book-1" initialInWishlist={false} initialAlert={null} currentPrice={null} bookTitle="Тест" />);
    const btn = screen.getByRole('button', { name: /Додати до бажанок/ });
    fireEvent.click(btn);
    // Optimistic update flips the label immediately; it must not flicker again
    // once the request settles — same label busy and resolved.
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent('У бажанках');

    resolve();
    await act(async () => { vi.runAllTimers(); });
    await waitFor(() => expect(btn).not.toHaveAttribute('aria-busy'));
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent('У бажанках');
  });

  /* ── Row 2 — alert states ────────────────────────────────────────────────── */

  it('unsaved → alert row sleeps with «Сповістити про зниження ціни» + sub', () => {
    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={false}
        initialAlert={null}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );
    const row = screen.getByRole('button', { name: /Сповістити про зниження ціни/ });
    expect(row).toBeTruthy();
    expect(screen.getByText('Спершу додайте до бажанок')).toBeTruthy();
  });

  it('unsaved → clicking the sleeping alert row adds to wishlist then opens AlertConfig', async () => {
    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={false}
        initialAlert={null}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Сповістити про зниження ціни/ }));
    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => expect(addToWishlist).toHaveBeenCalledWith('book-1'));
    await waitFor(() => {
      expect(screen.getByText('Коли повідомити про ціну?')).toBeTruthy();
    });
  });

  it('saved + no alert → shows «Сповістити про зниження ціни» row', () => {
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

  it('submitting config (default mode any-drop) calls setAlert and shows the toast', async () => {
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
    // Let the lazily-fetched price-history preview resolve.
    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => {
      expect(screen.getByText('Коли повідомити про ціну?')).toBeTruthy();
    });

    const submitBtn = screen.getByRole('button', { name: 'Зберегти' });
    fireEvent.click(submitBtn);

    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => {
      expect(setAlert).toHaveBeenCalledWith('book-1', 'any-drop', undefined);
    });

    // Toast appears
    await act(async () => { vi.advanceTimersByTime(0); });
    await waitFor(() => {
      expect(screen.getByText('Сповіщення увімкнено')).toBeTruthy();
    });
  });

  it('armed alert (good-price) → shows «Сповіщення про зниження увімкнено» + target sub; click opens AlertConfig', async () => {
    const armedAlert: AlertDto = {
      state: 'armed',
      mode: 'good-price',
      threshold: { amount: 24000, currency: 'UAH' },
      baseline: null,
      thresholdProof: 'дешевше, ніж зазвичай',
      pausedAt: null,
      notifiedAt: null,
    };
    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={true}
        initialAlert={armedAlert}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );
    expect(screen.getByText('Сповіщення про зниження увімкнено')).toBeTruthy();
    expect(screen.getByText('Ціль — нижче 240 ₴')).toBeTruthy();
    // No more «Змінити» link — the whole row opens the editor.
    expect(screen.queryByText('Змінити')).toBeNull();

    fireEvent.click(screen.getByText('Сповіщення про зниження увімкнено'));
    await act(async () => { vi.advanceTimersByTime(0); });
    // Editing an existing (non-paused) alert shows the «Сповіщення про ціну» title,
    // not the first-time «Коли повідомити про ціну?» question.
    await waitFor(() => {
      expect(screen.getByText('Сповіщення про ціну')).toBeTruthy();
    });
  });

  it('armed alert with any-drop mode → shows «Будь-яке зниження ціни» sub', () => {
    const armedAlert: AlertDto = {
      state: 'armed',
      mode: 'any-drop',
      threshold: { amount: 24000, currency: 'UAH' },
      baseline: { amount: 24000, currency: 'UAH' },
      thresholdProof: null,
      pausedAt: null,
      notifiedAt: null,
    };
    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={true}
        initialAlert={armedAlert}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );
    expect(screen.getByText('Будь-яке зниження ціни')).toBeTruthy();
  });

  it('reached alert → shows «Ціль досягнута»', () => {
    const reachedAlert: AlertDto = {
      state: 'reached',
      mode: 'good-price',
      threshold: { amount: 24000, currency: 'UAH' },
      baseline: null,
      thresholdProof: 'дешевше, ніж зазвичай',
      pausedAt: null,
      notifiedAt: '2026-07-20T08:00:00.000Z',
    };
    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={true}
        initialAlert={reachedAlert}
        currentPrice={{ amount: 20000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );
    expect(screen.getByText('Ціль досягнута')).toBeTruthy();
  });

  it('paused alert → shows «Поновити сповіщення» + sub that calls pauseAlert(bookId, false)', async () => {
    const pausedAlert: AlertDto = {
      state: 'paused',
      mode: 'good-price',
      threshold: { amount: 24000, currency: 'UAH' },
      baseline: null,
      thresholdProof: 'дешевше, ніж зазвичай',
      pausedAt: '2026-06-01T08:00:00.000Z',
      notifiedAt: null,
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

    expect(screen.getByText('Сповіщення призупинено')).toBeTruthy();
    const resumeBtn = screen.getByRole('button', { name: /Поновити сповіщення/ });
    expect(resumeBtn).toBeTruthy();
    fireEvent.click(resumeBtn);

    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => {
      expect(pauseAlert).toHaveBeenCalledWith('book-1', false);
    });
  });

  it('failed resume from the row → local «Не вдалося поновити сповіщення.» segment', async () => {
    vi.mocked(pauseAlert).mockRejectedValue(new AlertError('Сервіс недоступний.', 500));
    const pausedAlert: AlertDto = {
      state: 'paused',
      mode: 'good-price',
      threshold: { amount: 24000, currency: 'UAH' },
      baseline: null,
      thresholdProof: null,
      pausedAt: '2026-06-01T08:00:00.000Z',
      notifiedAt: null,
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

    fireEvent.click(screen.getByRole('button', { name: /Поновити сповіщення/ }));
    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('Не вдалося поновити сповіщення.')).toBeTruthy();
    });
    // The rows stay live — the failure is local to the group.
    expect(screen.getByRole('button', { name: /У бажанках/ })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Ще раз' }));
    await act(async () => { vi.runAllTimers(); });
    await waitFor(() => expect(pauseAlert).toHaveBeenCalledTimes(2));
  });

  it('unavailable alert → shows plain info text, not a button', () => {
    const unavailableAlert: AlertDto = {
      state: 'unavailable',
      mode: 'good-price',
      threshold: { amount: 24000, currency: 'UAH' },
      baseline: null,
      thresholdProof: null,
      pausedAt: null,
      notifiedAt: null,
    };
    render(
      <WishlistToggle
        bookId="book-1"
        initialInWishlist={true}
        initialAlert={unavailableAlert}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );
    const info = screen.getByText(/Сповістимо, коли книга знову/);
    expect(info).toBeTruthy();
    expect(info.closest('button')).toBeNull();
  });

  it('setAlert rejection (AlertError) → error note shown in the form, with the server message verbatim', async () => {
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
    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => {
      expect(screen.getByText('Коли повідомити про ціну?')).toBeTruthy();
    });

    const submitBtn = screen.getByRole('button', { name: 'Зберегти' });
    fireEvent.click(submitBtn);

    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('Не вдалося ввімкнути сповіщення.')).toBeTruthy();
    });
  });

  it('getPriceHistory resolves alertPolicyPreview → the mode cards render from it (good-price enabled)', async () => {
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

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(radios[1]).not.toHaveAttribute('aria-disabled');
  });
});
