import type { Money } from '@knyhovo/shared';

/**
 * Convert a provider price (a number like 540 or a numeric string like
 * "320.00") to an amount in kopecks, or null when the value is not a usable
 * price.
 *
 * Returns null for 0, negative, NaN, Infinity, null and undefined.
 */
export function priceToKopecks(value: unknown): number | null {
  const num =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : NaN;
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num * 100);
}

export function toMoney(kopecks: number): Money {
  return { amount: kopecks, currency: 'UAH' };
}
