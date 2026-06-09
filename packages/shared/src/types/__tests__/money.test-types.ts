/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * Compile-time checks for Currency and Money types.
 */
import type { Currency, Money } from '../money.js';

// Valid currency
const _uah: Currency = 'UAH';

// Unknown currency must fail
// @ts-expect-error 'USD' is not assignable to Currency
const _usd: Currency = 'USD';
// @ts-expect-error plain string is not assignable to Currency
const _str: Currency = 'whatever';

// Money accepts valid currency
const _price: Money = { amount: 34999, currency: 'UAH' };

// Money rejects unknown currency
// @ts-expect-error 'EUR' is not assignable to Currency
const _badCurrency: Money = { amount: 100, currency: 'EUR' };

export {};
