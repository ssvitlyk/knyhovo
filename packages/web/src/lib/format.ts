import type { ProviderName } from '@knyhovo/shared';
import type { MoneyDto } from './api/types';

const CURRENCY_SYMBOL: Readonly<Record<string, string>> = { UAH: '₴' };

const PROVIDER_DISPLAY_NAME: Readonly<Record<ProviderName, string>> = {
  yakaboo: 'Yakaboo',
  'book-club': 'BookClub',
  vivat: 'Vivat',
  'book-ye': 'Книгарня Є',
  bookchef: 'BookChef',
};

/** Group integer digits into 3s with a regular space (Ukrainian style). */
function groupThousands(value: number): string {
  const sign = value < 0 ? '-' : '';
  const digits = Math.abs(value).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Format a {@link MoneyDto} (amount in kopiyky) for display, e.g. `245 ₴`.
 * Whole hryvnia are shown without decimals; any kopiyky use a comma separator.
 */
export function formatMoney(money: MoneyDto): string {
  const symbol = CURRENCY_SYMBOL[money.currency] ?? money.currency;
  const whole = Math.trunc(money.amount / 100);
  const kopiyky = Math.abs(money.amount % 100);
  const main = kopiyky === 0 ? groupThousands(whole) : `${groupThousands(whole)},${String(kopiyky).padStart(2, '0')}`;
  return `${main} ${symbol}`;
}

/** Ukrainian plural for "книга": 1 → книга, 2–4 → книги, else → книг. */
export function knBookWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'книга';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'книги';
  return 'книг';
}

/** Human-facing store name for a provider slug. */
export function providerDisplayName(provider: ProviderName): string {
  return PROVIDER_DISPLAY_NAME[provider];
}
