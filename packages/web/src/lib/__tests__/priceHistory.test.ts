import { describe, expect, it } from 'vitest';
import {
  kopToUah,
  formatUah,
  formatRange,
  formatPercent,
  formatChangeAmount,
  toViewModel,
  buildAdvisory,
  PERIOD_MAP,
  DEFAULT_PERIOD_KEY,
} from '../priceHistory';
import type { BookPriceHistoryDto } from '../api/types';

describe('kopToUah', () => {
  it('converts whole hryvnia correctly', () => {
    expect(kopToUah(24000)).toBe(240);
    expect(kopToUah(30000)).toBe(300);
  });

  it('rounds kopiyky — 31850 → 319', () => {
    expect(kopToUah(31850)).toBe(319);
  });

  it('handles 0 and falsy values', () => {
    expect(kopToUah(0)).toBe(0);
  });
});

describe('formatUah', () => {
  it('formats 24000 kopiyky → "240 ₴"', () => {
    expect(formatUah(24000)).toBe('240 ₴');
  });

  it('formats 31850 kopiyky → "319 ₴" (rounded)', () => {
    expect(formatUah(31850)).toBe('319 ₴');
  });

  it('uses U+20B4 hryvnia sign with a space before', () => {
    const result = formatUah(10000);
    expect(result).toContain(' ₴');
    expect(result).toBe('100 ₴');
  });
});

describe('formatRange', () => {
  it('formats range with en-dash U+2013 and one ₴', () => {
    const result = formatRange(28500, 31800);
    expect(result).toBe('285–318 ₴');
  });

  it('matches frozen spec — "285–318 ₴"', () => {
    expect(formatRange(28500, 31800)).toBe('285–318 ₴');
  });
});

describe('formatPercent', () => {
  it('formats negative percent with U+2212 minus sign', () => {
    expect(formatPercent(-25)).toBe('−25%');
    expect(formatPercent(-25)).toBe('−25%');
  });

  it('formats positive percent with + sign', () => {
    expect(formatPercent(10)).toBe('+10%');
  });

  it('formats zero as "0%"', () => {
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('formatChangeAmount', () => {
  it('formats negative amount with U+2212 and ₴', () => {
    expect(formatChangeAmount(-8000)).toBe('−80 ₴');
  });

  it('formats positive amount with + and ₴', () => {
    expect(formatChangeAmount(3000)).toBe('+30 ₴');
  });

  it('formats zero as "0 ₴"', () => {
    expect(formatChangeAmount(0)).toBe('0 ₴');
  });
});

describe('PERIOD_MAP', () => {
  it('maps internal keys to API periods', () => {
    expect(PERIOD_MAP['30']).toBe('30d');
    expect(PERIOD_MAP['90']).toBe('90d');
    expect(PERIOD_MAP['365']).toBe('1y');
    expect(PERIOD_MAP['all']).toBe('all');
  });
});

describe('DEFAULT_PERIOD_KEY', () => {
  it('is 90 (90d)', () => {
    expect(DEFAULT_PERIOD_KEY).toBe('90');
  });
});

/* ── toViewModel ────────────────────────────────────────────────── */

const BASE_DTO: BookPriceHistoryDto = {
  bookId: 'test-book',
  period: '90d',
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

describe('toViewModel', () => {
  it('returns null when points is empty', () => {
    const dto: BookPriceHistoryDto = { ...BASE_DTO, points: [] };
    expect(toViewModel(dto)).toBeNull();
  });

  it('returns null when current is null', () => {
    const dto: BookPriceHistoryDto = { ...BASE_DTO, current: null };
    expect(toViewModel(dto)).toBeNull();
  });

  it('returns null when typicalRange is null', () => {
    const dto: BookPriceHistoryDto = { ...BASE_DTO, typicalRange: null };
    expect(toViewModel(dto)).toBeNull();
  });

  it('converts kopiyky to ₴ integers', () => {
    const vm = toViewModel(BASE_DTO);
    expect(vm).not.toBeNull();
    expect(vm!.current).toBe(240);      // 24000 → 240
    expect(vm!.usualLow).toBe(285);     // 28500 → 285
    expect(vm!.usualHigh).toBe(318);    // 31800 → 318
  });

  it('keeps out-of-stock point amount (never 0)', () => {
    const dto: BookPriceHistoryDto = {
      ...BASE_DTO,
      points: [
        {
          amount: 32000,
          currency: 'UAH',
          availability: 'in-stock',
          recordedAt: '2026-03-15T08:00:00.000Z',
        },
        {
          amount: 28000,
          currency: 'UAH',
          availability: 'out-of-stock', // out of stock — must keep amount
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
    const vm = toViewModel(dto);
    expect(vm).not.toBeNull();
    const oosPoint = vm!.points.find((p) => p.availability === 'out-of-stock');
    expect(oosPoint).toBeDefined();
    expect(oosPoint!.p).toBe(280); // 28000 → 280, not 0
    expect(oosPoint!.p).not.toBe(0);
  });

  it('does not include high in the view model', () => {
    const vm = toViewModel(BASE_DTO);
    expect(vm).not.toBeNull();
    // TypeScript will prevent `vm.high` but we check at runtime too
    expect('high' in (vm as object)).toBe(false);
  });

  it('maps change percent and kopiyky correctly', () => {
    const vm = toViewModel(BASE_DTO);
    expect(vm!.change).toBe(-25);
    expect(vm!.changeAmountKop).toBe(-8000);
  });

  it('sets period label from period key', () => {
    const vm = toViewModel(BASE_DTO);
    expect(vm!.label).toBe('90 днів');
    expect(vm!.period).toBe('90d');
  });
});

/* ── buildAdvisory ──────────────────────────────────────────────── */

describe('buildAdvisory', () => {
  const makeVm = (current: number, usualLow: number, usualHigh: number, low: number, change: number) => ({
    label: '90 днів',
    period: '90d' as const,
    points: [],
    usualLow,
    usualHigh,
    low,
    current,
    change,
    changeAmountKop: 0,
  });

  it('tone=good when current < usualLow', () => {
    const advisory = buildAdvisory(makeVm(240, 285, 318, 240, -25));
    expect(advisory.tone).toBe('good');
  });

  it('tone=calm when current is within typical range', () => {
    const advisory = buildAdvisory(makeVm(300, 285, 318, 280, -5));
    expect(advisory.tone).toBe('calm');
  });

  it('tone=high when current > usualHigh', () => {
    const advisory = buildAdvisory(makeVm(340, 285, 318, 240, 15));
    expect(advisory.tone).toBe('high');
  });

  it('includes "нижче за типовий діапазон" for good tone', () => {
    const advisory = buildAdvisory(makeVm(240, 285, 318, 240, -25));
    const text = advisory.parts
      .map((p) => (typeof p === 'string' ? p : p.b))
      .join('');
    expect(text).toContain('нижче за типовий діапазон');
  });

  it('includes "вище за типовий діапазон" for high tone', () => {
    const advisory = buildAdvisory(makeVm(340, 285, 318, 240, 15));
    const text = advisory.parts
      .map((p) => (typeof p === 'string' ? p : p.b))
      .join('');
    expect(text).toContain('вище за типовий діапазон');
  });

  it('includes near-low note when current <= low', () => {
    const advisory = buildAdvisory(makeVm(240, 285, 318, 240, -25));
    const text = advisory.parts
      .map((p) => (typeof p === 'string' ? p : p.b))
      .join('');
    expect(text).toContain('Поточна ціна близька до історичного мінімуму');
  });

  it('does not include near-low note when current > low', () => {
    const advisory = buildAdvisory(makeVm(260, 285, 318, 240, -15));
    const text = advisory.parts
      .map((p) => (typeof p === 'string' ? p : p.b))
      .join('');
    expect(text).not.toContain('Поточна ціна близька до історичного мінімуму');
  });
});
