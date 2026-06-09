/**
 * Supported currencies. Extend this union when new markets are added.
 * Values are ISO 4217 currency codes.
 */
export type Currency = 'UAH';

/**
 * A monetary amount in the smallest unit of the given currency (e.g. копійки for UAH)
 * to avoid floating-point precision errors.
 *
 * Example: 349.99 UAH → { amount: 34999, currency: 'UAH' }
 */
export interface Money {
  /** Price in the smallest currency unit (копійки, cents, etc.). Always a non-negative integer. */
  readonly amount: number;
  readonly currency: Currency;
}
