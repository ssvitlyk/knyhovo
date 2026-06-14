import { describe, it, expect } from 'vitest';
import { toEmptyPriceHistory, toPriceHistory } from '../mapper.js';

const BOOK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

// Fixed dates for deterministic tests.
const D1 = new Date('2026-01-01T00:00:00.000Z');
const D2 = new Date('2026-01-10T00:00:00.000Z');
const D3 = new Date('2026-01-20T00:00:00.000Z');
const D4 = new Date('2026-01-30T00:00:00.000Z');
const D5 = new Date('2026-02-10T00:00:00.000Z');
const D6 = new Date('2026-02-20T00:00:00.000Z');

function point(
  priceAmount: number,
  recordedAt: Date,
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN' = 'IN_STOCK',
) {
  return { priceAmount, priceCurrency: 'UAH' as const, availability, recordedAt };
}

describe('toEmptyPriceHistory', () => {
  it('returns null aggregates and empty points array', () => {
    const dto = toEmptyPriceHistory(BOOK_ID, '90d', 'UAH');
    expect(dto).toEqual({
      bookId: BOOK_ID,
      period: '90d',
      currency: 'UAH',
      current: null,
      lowest: null,
      highest: null,
      typicalRange: null,
      change: null,
      points: [],
    });
  });
});

describe('toPriceHistory', () => {
  it('maps availability enum to public slug', () => {
    const dto = toPriceHistory(BOOK_ID, '90d', 'UAH', [
      point(30000, D1, 'IN_STOCK'),
      point(25000, D2, 'OUT_OF_STOCK'),
      point(28000, D3, 'UNKNOWN'),
    ]);
    expect(dto.points[0].availability).toBe('in-stock');
    expect(dto.points[1].availability).toBe('out-of-stock');
    expect(dto.points[2].availability).toBe('unknown');
  });

  it('returns points ascending by recordedAt (preserves caller order)', () => {
    const dto = toPriceHistory(BOOK_ID, '30d', 'UAH', [
      point(30000, D1),
      point(25000, D2),
      point(28000, D3),
    ]);
    expect(dto.points.map((p) => p.recordedAt)).toEqual([
      D1.toISOString(),
      D2.toISOString(),
      D3.toISOString(),
    ]);
  });

  it('sets current to the last point (including availability)', () => {
    const dto = toPriceHistory(BOOK_ID, '90d', 'UAH', [
      point(30000, D1),
      point(25000, D2, 'OUT_OF_STOCK'),
    ]);
    expect(dto.current).toEqual({
      amount: 25000,
      currency: 'UAH',
      availability: 'out-of-stock',
      recordedAt: D2.toISOString(),
    });
  });

  it('computes lowest as the point with the minimum amount (no availability field)', () => {
    const dto = toPriceHistory(BOOK_ID, '90d', 'UAH', [
      point(30000, D1),
      point(22000, D2),
      point(28000, D3),
    ]);
    expect(dto.lowest).toEqual({
      amount: 22000,
      currency: 'UAH',
      recordedAt: D2.toISOString(),
    });
    // Confirm no availability field on extreme DTO.
    expect('availability' in (dto.lowest ?? {})).toBe(false);
  });

  it('computes highest as the point with the maximum amount', () => {
    const dto = toPriceHistory(BOOK_ID, '90d', 'UAH', [
      point(30000, D1),
      point(22000, D2),
      point(35000, D3),
    ]);
    expect(dto.highest).toEqual({
      amount: 35000,
      currency: 'UAH',
      recordedAt: D3.toISOString(),
    });
  });

  it('typicalRange with <5 points = lowest.amount / highest.amount', () => {
    const dto = toPriceHistory(BOOK_ID, '90d', 'UAH', [
      point(30000, D1),
      point(22000, D2),
      point(35000, D3),
    ]);
    expect(dto.typicalRange).toEqual({ min: 22000, max: 35000, currency: 'UAH' });
  });

  it('typicalRange with >=5 points trims one min + one max', () => {
    // Amounts: 10000, 20000, 25000, 30000, 40000 → trim → 20000, 25000, 30000 → range 20000–30000
    const dto = toPriceHistory(BOOK_ID, 'all', 'UAH', [
      point(25000, D1),
      point(10000, D2),
      point(30000, D3),
      point(40000, D4),
      point(20000, D5),
    ]);
    expect(dto.typicalRange).toEqual({ min: 20000, max: 30000, currency: 'UAH' });
  });

  it('typicalRange with >=5 identical amounts → min === max', () => {
    const pts = [D1, D2, D3, D4, D5].map((d) => point(25000, d));
    const dto = toPriceHistory(BOOK_ID, 'all', 'UAH', pts);
    expect(dto.typicalRange).toEqual({ min: 25000, max: 25000, currency: 'UAH' });
  });

  it('computes change.amount and change.percent correctly (price drop)', () => {
    const dto = toPriceHistory(BOOK_ID, '90d', 'UAH', [
      point(40000, D1),
      point(30000, D2),
    ]);
    expect(dto.change).toEqual({ amount: -10000, percent: -25 });
  });

  it('computes change.amount and change.percent correctly (price rise)', () => {
    const dto = toPriceHistory(BOOK_ID, '90d', 'UAH', [
      point(20000, D1),
      point(25000, D2),
    ]);
    expect(dto.change).toEqual({ amount: 5000, percent: 25 });
  });

  it('change.percent = 0 when first.amount <= 0', () => {
    const dto = toPriceHistory(BOOK_ID, '90d', 'UAH', [
      point(0, D1),
      point(10000, D2),
    ]);
    expect(dto.change?.percent).toBe(0);
  });

  it('out-of-stock points keep stored amount (not zeroed)', () => {
    const dto = toPriceHistory(BOOK_ID, '90d', 'UAH', [
      point(30000, D1, 'OUT_OF_STOCK'),
    ]);
    expect(dto.points[0].amount).toBe(30000);
    expect(dto.points[0].availability).toBe('out-of-stock');
    expect(dto.current?.amount).toBe(30000);
  });

  it('single point → current, lowest, highest all equal; typicalRange min===max; change amount=0', () => {
    const dto = toPriceHistory(BOOK_ID, '90d', 'UAH', [point(28000, D1)]);
    expect(dto.current?.amount).toBe(28000);
    expect(dto.lowest?.amount).toBe(28000);
    expect(dto.highest?.amount).toBe(28000);
    expect(dto.typicalRange).toEqual({ min: 28000, max: 28000, currency: 'UAH' });
    expect(dto.change).toEqual({ amount: 0, percent: 0 });
  });

  it('recordedAt is ISO string', () => {
    const dto = toPriceHistory(BOOK_ID, '90d', 'UAH', [point(28000, D1)]);
    expect(dto.points[0].recordedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('returns correct bookId and period in DTO', () => {
    const dto = toPriceHistory(BOOK_ID, '1y', 'UAH', [point(28000, D1), point(30000, D6)]);
    expect(dto.bookId).toBe(BOOK_ID);
    expect(dto.period).toBe('1y');
    expect(dto.currency).toBe('UAH');
  });
});
