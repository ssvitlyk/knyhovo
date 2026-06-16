import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WishlistAlertControl } from '../WishlistAlertControl';
import type { AlertDto } from '@/lib/api/types';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
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

import { setAlert, pauseAlert } from '@/lib/api/priceAlerts';

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
  // RTL's waitFor polling loop (which runs on the faked timers) actually fires;
  // a plain useFakeTimers() leaves that loop frozen and waitFor deadlocks.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  window.matchMedia = makeMatchMedia(false);
  vi.mocked(setAlert).mockResolvedValue(undefined);
  vi.mocked(pauseAlert).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('WishlistAlertControl', () => {
  it('saved (no alert) → bell aria-label is «Сповістити про ціну»', () => {
    render(
      <WishlistAlertControl
        bookId="book-1"
        alert={null}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );
    expect(screen.getByRole('button', { name: 'Сповістити про ціну' })).toBeTruthy();
  });

  it('watch alert → bell aria-label is «Змінити сповіщення про ціну»', () => {
    const watchAlert: AlertDto = {
      status: 'active',
      intent: 'below-current',
      targetPrice: { amount: 24000, currency: 'UAH' },
      pausedAt: null,
    };
    render(
      <WishlistAlertControl
        bookId="book-1"
        alert={watchAlert}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );
    expect(screen.getByRole('button', { name: 'Змінити сповіщення про ціну' })).toBeTruthy();
  });

  it('triggered alert → bell aria-label is «Ціль досягнута — змінити сповіщення»', () => {
    const triggeredAlert: AlertDto = {
      status: 'triggered',
      intent: 'below-current',
      targetPrice: { amount: 20000, currency: 'UAH' },
      pausedAt: null,
    };
    render(
      <WishlistAlertControl
        bookId="book-1"
        alert={triggeredAlert}
        currentPrice={{ amount: 19000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );
    expect(screen.getByRole('button', { name: 'Ціль досягнута — змінити сповіщення' })).toBeTruthy();
  });

  it('paused alert → bell aria-label is «Сповіщення призупинено»', () => {
    const pausedAlert: AlertDto = {
      status: 'paused',
      intent: 'below-current',
      targetPrice: { amount: 24000, currency: 'UAH' },
      pausedAt: '2026-06-01T08:00:00.000Z',
    };
    render(
      <WishlistAlertControl
        bookId="book-1"
        alert={pausedAlert}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );
    expect(screen.getByRole('button', { name: 'Сповіщення призупинено' })).toBeTruthy();
  });

  it('unavailable alert → bell is disabled', () => {
    const unavailableAlert: AlertDto = {
      status: 'unavailable',
      intent: 'any-drop',
      targetPrice: { amount: 24000, currency: 'UAH' },
      pausedAt: null,
    };
    render(
      <WishlistAlertControl
        bookId="book-1"
        alert={unavailableAlert}
        currentPrice={null}
        bookTitle="Кобзар"
      />,
    );
    expect(screen.getByRole('button', { name: 'Сповіщення недоступні' })).toBeDisabled();
  });

  it('saved → clicking bell opens AlertConfig form', async () => {
    render(
      <WishlistAlertControl
        bookId="book-1"
        alert={null}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сповістити про ціну' }));
    await act(async () => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      expect(screen.getByText('Коли повідомити про ціну?')).toBeTruthy();
    });
  });

  it('paused → clicking bell calls pauseAlert(bookId, false) to resume', async () => {
    const pausedAlert: AlertDto = {
      status: 'paused',
      intent: 'below-current',
      targetPrice: { amount: 24000, currency: 'UAH' },
      pausedAt: '2026-06-01T08:00:00.000Z',
    };
    render(
      <WishlistAlertControl
        bookId="book-1"
        alert={pausedAlert}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Сповіщення призупинено' }));

    await act(async () => { vi.runAllTimers(); });

    await waitFor(() => {
      expect(pauseAlert).toHaveBeenCalledWith('book-1', false);
    });
  });

  it('watch → clicking bell opens AlertConfig in edit mode', async () => {
    const watchAlert: AlertDto = {
      status: 'active',
      intent: 'below-current',
      targetPrice: { amount: 24000, currency: 'UAH' },
      pausedAt: null,
    };
    render(
      <WishlistAlertControl
        bookId="book-1"
        alert={watchAlert}
        currentPrice={{ amount: 24000, currency: 'UAH' }}
        bookTitle="Кобзар"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Змінити сповіщення про ціну' }));
    await act(async () => { vi.advanceTimersByTime(0); });

    await waitFor(() => {
      // Edit mode title
      expect(screen.getByText('Сповіщення про ціну')).toBeTruthy();
    });
  });
});
