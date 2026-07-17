import { describe, expect, it } from 'vitest';
import {
  alertTargetAmount,
  deriveKnyhovykStatus,
  type DeriveKnyhovykStatusInput,
  type KnyhovykAlertSlice,
} from '../knyhovyk-status';

const base: DeriveKnyhovykStatusInput = {
  bookId: 'book-1',
  currentAmount: 20000,
  prevAmount: null,
  allTimeMinAmount: null,
  min90Amount: null,
  targetAmount: null,
  opportunities: [],
};

describe('deriveKnyhovykStatus', () => {
  it('returns none when currentAmount is null', () => {
    expect(deriveKnyhovykStatus({ ...base, currentAmount: null })).toEqual({ kind: 'none', label: null });
  });

  it('returns none when no signal matches', () => {
    expect(deriveKnyhovykStatus(base)).toEqual({ kind: 'none', label: null });
  });

  it('returns goal when price is at or below the target', () => {
    expect(deriveKnyhovykStatus({ ...base, targetAmount: 20000 })).toEqual({
      kind: 'goal',
      label: 'Ціль досягнута',
    });
    expect(deriveKnyhovykStatus({ ...base, targetAmount: 25000 })).toEqual({
      kind: 'goal',
      label: 'Ціль досягнута',
    });
  });

  it('returns best when price is at or below the all-time minimum', () => {
    expect(deriveKnyhovykStatus({ ...base, allTimeMinAmount: 20000 })).toEqual({
      kind: 'best',
      label: 'Найкраща ціна',
    });
  });

  it('returns low90 when price is at or below the 90-day minimum', () => {
    expect(deriveKnyhovykStatus({ ...base, min90Amount: 20000 })).toEqual({
      kind: 'low90',
      label: 'Мінімум за 90 днів',
    });
  });

  it('returns drop when price fell below the previous snapshot with no other signal', () => {
    expect(deriveKnyhovykStatus({ ...base, prevAmount: 21000 })).toEqual({
      kind: 'drop',
      label: 'Ціна впала',
    });
  });

  it('prioritizes goal over deal explicitly', () => {
    const result = deriveKnyhovykStatus({
      ...base,
      targetAmount: 20000,
      opportunities: [{ bookId: 'book-1', price: 20000, prevPrice: 40000, savingsAmount: 20000 }],
    });
    expect(result).toEqual({ kind: 'goal', label: 'Ціль досягнута' });
  });

  it('prioritizes best/low90 over deal', () => {
    const result = deriveKnyhovykStatus({
      ...base,
      allTimeMinAmount: 20000,
      opportunities: [{ bookId: 'book-1', price: 20000, prevPrice: 40000, savingsAmount: 20000 }],
    });
    expect(result).toEqual({ kind: 'best', label: 'Найкраща ціна' });
  });

  describe('deal rule', () => {
    it('returns deal when the pick has the single largest discount among opportunities', () => {
      const result = deriveKnyhovykStatus({
        ...base,
        opportunities: [
          { bookId: 'book-1', price: 20000, prevPrice: 40000, savingsAmount: 20000 }, // 50% off
          { bookId: 'book-2', price: 9000, prevPrice: 10000, savingsAmount: 1000 }, // 10% off
        ],
      });
      expect(result).toEqual({ kind: 'deal', label: 'Найбільша знижка' });
    });

    it('does not return deal when another book has a larger discount', () => {
      const result = deriveKnyhovykStatus({
        ...base,
        opportunities: [
          { bookId: 'book-1', price: 9000, prevPrice: 10000, savingsAmount: 1000 }, // 10% off
          { bookId: 'book-2', price: 20000, prevPrice: 40000, savingsAmount: 20000 }, // 50% off
        ],
      });
      expect(result).toEqual({ kind: 'none', label: null });
    });

    it('excludes opportunities without a valid prevPrice > price', () => {
      const result = deriveKnyhovykStatus({
        ...base,
        opportunities: [
          { bookId: 'book-1', price: 20000, prevPrice: null, savingsAmount: 0 },
          { bookId: 'book-1', price: 20000, prevPrice: 15000, savingsAmount: 0 }, // prev < price, invalid
        ],
      });
      expect(result).toEqual({ kind: 'none', label: null });
    });

    it('tie-breaks equal discountPercent by savingsAmount desc', () => {
      const result = deriveKnyhovykStatus({
        ...base,
        opportunities: [
          { bookId: 'book-1', price: 10000, prevPrice: 20000, savingsAmount: 10000 }, // 50% off, larger savings
          { bookId: 'book-2', price: 1000, prevPrice: 2000, savingsAmount: 1000 }, // 50% off, smaller savings
        ],
      });
      expect(result).toEqual({ kind: 'deal', label: 'Найбільша знижка' });
    });

    it('tie-breaks equal discountPercent and savingsAmount by bookId asc', () => {
      const result = deriveKnyhovykStatus({
        ...base,
        bookId: 'a-book',
        opportunities: [
          { bookId: 'a-book', price: 10000, prevPrice: 20000, savingsAmount: 10000 },
          { bookId: 'z-book', price: 10000, prevPrice: 20000, savingsAmount: 10000 },
        ],
      });
      expect(result).toEqual({ kind: 'deal', label: 'Найбільша знижка' });
    });

    it('does not return deal when the pick is not among the opportunities', () => {
      const result = deriveKnyhovykStatus({
        ...base,
        opportunities: [{ bookId: 'other-book', price: 10000, prevPrice: 20000, savingsAmount: 10000 }],
      });
      expect(result).toEqual({ kind: 'none', label: null });
    });
  });
});

describe('alertTargetAmount', () => {
  const alert = (status: KnyhovykAlertSlice['status']): KnyhovykAlertSlice => ({
    status,
    targetPrice: { amount: 15500 },
  });

  it('returns the target for an active alert', () => {
    expect(alertTargetAmount(alert('active'))).toBe(15500);
  });

  it('returns the target for a triggered alert (derived status when the goal is already met)', () => {
    expect(alertTargetAmount(alert('triggered'))).toBe(15500);
  });

  it('ignores paused and unavailable alerts', () => {
    expect(alertTargetAmount(alert('paused'))).toBeNull();
    expect(alertTargetAmount(alert('unavailable'))).toBeNull();
  });

  it('returns null without an alert', () => {
    expect(alertTargetAmount(null)).toBeNull();
    expect(alertTargetAmount(undefined)).toBeNull();
  });

  it('regression: a triggered alert (target 15500, price 15000) derives goal, not best/low90/drop', () => {
    // Composed path as the page uses it: alert slice → targetAmount → derivation.
    // best/low90/drop would all match here too — goal must win.
    const targetAmount = alertTargetAmount(alert('triggered'));
    expect(targetAmount).toBe(15500);

    const result = deriveKnyhovykStatus({
      bookId: 'book-1',
      currentAmount: 15000,
      prevAmount: 17500,
      allTimeMinAmount: 15000,
      min90Amount: 15000,
      targetAmount,
      opportunities: [{ bookId: 'book-1', price: 15000, prevPrice: 17500, savingsAmount: 2500 }],
    });
    expect(result).toEqual({ kind: 'goal', label: 'Ціль досягнута' });
  });
});
