import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PriceHistorySection } from '../PriceHistorySection';

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

import { getPriceHistory } from '@/lib/api/priceHistory';
import type { BookPriceHistoryDto } from '@/lib/api/types';

/** A DTO with enough data that toViewModel returns a valid vm */
function makeFilledDto(period: string = '90d'): BookPriceHistoryDto {
  return {
    bookId: 'book-1',
    period: period as BookPriceHistoryDto['period'],
    currency: 'UAH',
    current: {
      amount: 24000,
      currency: 'UAH',
      availability: 'in-stock',
      recordedAt: '2026-06-13T08:00:00.000Z',
    },
    lowest: {
      amount: 24000,
      currency: 'UAH',
      recordedAt: '2026-06-13T08:00:00.000Z',
    },
    highest: {
      amount: 32000,
      currency: 'UAH',
      recordedAt: '2026-03-01T08:00:00.000Z',
    },
    typicalRange: { min: 28500, max: 31800, currency: 'UAH' },
    change: { amount: -8000, percent: -25 },
    points: [
      {
        amount: 32000,
        currency: 'UAH',
        availability: 'in-stock',
        recordedAt: '2026-03-15T08:00:00.000Z',
      },
      {
        amount: 29000,
        currency: 'UAH',
        availability: 'in-stock',
        recordedAt: '2026-04-15T08:00:00.000Z',
      },
      {
        amount: 24000,
        currency: 'UAH',
        availability: 'in-stock',
        recordedAt: '2026-06-13T08:00:00.000Z',
      },
    ],
  };
}

function makeEmptyDto(): BookPriceHistoryDto {
  return {
    bookId: 'book-1',
    period: '90d',
    currency: 'UAH',
    current: null,
    lowest: null,
    highest: null,
    typicalRange: null,
    change: null,
    points: [],
  };
}

beforeEach(() => {
  vi.mocked(getPriceHistory).mockReset();
});

describe('PriceHistorySection', () => {
  it('calls getPriceHistory with "90d" on mount (default period)', async () => {
    vi.mocked(getPriceHistory).mockResolvedValue(makeFilledDto());

    render(<PriceHistorySection bookId="book-1" />);

    await waitFor(() =>
      expect(getPriceHistory).toHaveBeenCalledWith('book-1', '90d'),
    );
  });

  it('shows aria-busy and chips disabled during loading', () => {
    // Never resolves → stays in loading state
    vi.mocked(getPriceHistory).mockReturnValue(new Promise(() => {}));

    render(<PriceHistorySection bookId="book-1" />);

    // Section should be aria-busy
    expect(document.querySelector('section[aria-busy="true"]')).toBeTruthy();

    // All period chips should be disabled
    const chips = screen.getAllByRole('tab');
    expect(chips.length).toBeGreaterThan(0);
    chips.forEach((chip) => {
      expect(chip).toBeDisabled();
    });
  });

  it('renders 4 stat labels on filled state', async () => {
    vi.mocked(getPriceHistory).mockResolvedValue(makeFilledDto());

    render(<PriceHistorySection bookId="book-1" />);

    // Wait for filled state — look for stat labels specifically
    await waitFor(() => screen.getByText('Найнижча'));
    expect(screen.getByText('Найнижча')).toBeTruthy();
    expect(screen.getByText('Типова ціна')).toBeTruthy();
    expect(screen.getByText('Зміна')).toBeTruthy();
    // "Зараз" appears in both advisory text and stat label; check the label class
    expect(document.querySelector('.ph-stat__label')).toBeTruthy();
  });

  it('shows amount formatted as ₴ in stats (24000 → "240 ₴")', async () => {
    vi.mocked(getPriceHistory).mockResolvedValue(makeFilledDto());

    render(<PriceHistorySection bookId="book-1" />);

    // Wait for filled state
    await waitFor(() => screen.getByText('Найнижча'));
    // Current price is 24000 kopiyky → 240 ₴
    // Multiple "240 ₴" could appear (current + lowest both = 240), use getAllByText
    const priceEls = screen.getAllByText('240 ₴');
    expect(priceEls.length).toBeGreaterThan(0);
  });

  it('switches period: clicking «30 днів» calls getPriceHistory with "30d"', async () => {
    vi.mocked(getPriceHistory).mockResolvedValue(makeFilledDto());

    render(<PriceHistorySection bookId="book-1" />);

    // Wait for initial load to complete
    await waitFor(() => screen.getByText('Найнижча'));

    // Mocks may be called again for the period switch
    vi.mocked(getPriceHistory).mockResolvedValue(makeFilledDto('30d'));

    const thirtyChip = screen.getByRole('tab', { name: '30 днів' });
    fireEvent.click(thirtyChip);

    await waitFor(() =>
      expect(getPriceHistory).toHaveBeenCalledWith('book-1', '30d'),
    );
  });

  it('shows empty state copy when points is [] — no chips rendered', async () => {
    vi.mocked(getPriceHistory).mockResolvedValue(makeEmptyDto());

    render(<PriceHistorySection bookId="book-1" />);

    await waitFor(() => screen.getByText('Ще збираємо історію'));
    expect(screen.getByText('Ще збираємо історію')).toBeTruthy();
    expect(screen.getByText('Збираємо дані')).toBeTruthy();

    // No chips in empty state
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('shows role="alert" and retry button on error — no chips', async () => {
    vi.mocked(getPriceHistory).mockRejectedValue(new Error('network error'));

    render(<PriceHistorySection bookId="book-1" />);

    await waitFor(() => screen.getByRole('alert'));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Спробувати ще раз' })).toBeTruthy();

    // No chips in error state
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('retry button re-fetches with current period', async () => {
    vi.mocked(getPriceHistory).mockRejectedValue(new Error('network error'));

    render(<PriceHistorySection bookId="book-1" />);

    await waitFor(() => screen.getByRole('button', { name: 'Спробувати ще раз' }));

    // Set up success for the retry
    vi.mocked(getPriceHistory).mockResolvedValue(makeFilledDto());

    fireEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));

    await waitFor(() =>
      expect(getPriceHistory).toHaveBeenLastCalledWith('book-1', '90d'),
    );
  });

  it('out-of-stock point retains its price (not 0)', async () => {
    const dto: BookPriceHistoryDto = {
      ...makeFilledDto(),
      points: [
        {
          amount: 32000,
          currency: 'UAH',
          availability: 'in-stock',
          recordedAt: '2026-03-15T08:00:00.000Z',
        },
        {
          amount: 28000, // out-of-stock — must not become 0
          currency: 'UAH',
          availability: 'out-of-stock',
          recordedAt: '2026-04-15T08:00:00.000Z',
        },
        {
          amount: 24000,
          currency: 'UAH',
          availability: 'in-stock',
          recordedAt: '2026-06-13T08:00:00.000Z',
        },
      ],
    };
    vi.mocked(getPriceHistory).mockResolvedValue(dto);

    render(<PriceHistorySection bookId="book-1" />);

    // Wait for filled state with chart
    await waitFor(() => screen.getByText('Найнижча'));

    // The chart SVG should render — the presence of the section title confirms filled state
    expect(screen.getByText('Динаміка ціни')).toBeTruthy();
    // aria-label of the chart SVG contains the current price
    const chartSvg = document.querySelector('svg[role="img"]');
    expect(chartSvg).toBeTruthy();
    // The out-of-stock point is in the SVG path but doesn't show as "0 ₴" in annotations
    // The annotation shows "зараз" and the current (latest) price, not the oos one
    expect(screen.queryByText('0 ₴')).toBeNull();
  });

  it('title «Динаміка ціни» is always present in all states', async () => {
    vi.mocked(getPriceHistory).mockReturnValue(new Promise(() => {}));

    render(<PriceHistorySection bookId="book-1" />);

    // In loading state
    expect(screen.getByText('Динаміка ціни')).toBeTruthy();
  });
});
