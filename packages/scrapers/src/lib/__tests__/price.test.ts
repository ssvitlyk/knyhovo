import { describe, it, expect } from 'vitest';
import { priceToKopecks, toMoney } from '../price.js';

describe('priceToKopecks', () => {
  it('converts numbers and numeric strings', () => {
    expect(priceToKopecks(540)).toBe(54000);
    expect(priceToKopecks('320.00')).toBe(32000);
    expect(priceToKopecks('  99.99 ')).toBe(9999);
  });

  it('rounds to whole kopecks', () => {
    expect(priceToKopecks(1.234)).toBe(123);
  });

  it('returns null for unusable values', () => {
    for (const v of [0, -1, NaN, Infinity, '', 'abc', '0', null, undefined, {}, true]) {
      expect(priceToKopecks(v)).toBeNull();
    }
  });
});

describe('toMoney', () => {
  it('wraps kopecks as UAH money', () => {
    expect(toMoney(12345)).toEqual({ amount: 12345, currency: 'UAH' });
  });
});
