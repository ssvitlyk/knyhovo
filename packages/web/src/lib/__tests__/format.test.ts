import { describe, expect, it } from 'vitest';
import { formatMoney, knBookWord, providerDisplayName } from '../format';

describe('formatMoney', () => {
  it('renders whole hryvnia without decimals and a space before the symbol', () => {
    expect(formatMoney({ amount: 29900, currency: 'UAH' })).toBe('299 ₴');
    expect(formatMoney({ amount: 34900, currency: 'UAH' })).toBe('349 ₴');
  });

  it('groups thousands with a space', () => {
    expect(formatMoney({ amount: 120000, currency: 'UAH' })).toBe('1 200 ₴');
  });

  it('shows kopiyky with a comma separator when present', () => {
    expect(formatMoney({ amount: 24550, currency: 'UAH' })).toBe('245,50 ₴');
  });

  it('falls back to the currency code for unknown currencies', () => {
    expect(formatMoney({ amount: 1000, currency: 'USD' })).toBe('10 USD');
  });
});

describe('knBookWord', () => {
  it('selects the correct Ukrainian plural form', () => {
    expect(knBookWord(1)).toBe('книга');
    expect(knBookWord(2)).toBe('книги');
    expect(knBookWord(4)).toBe('книги');
    expect(knBookWord(5)).toBe('книг');
    expect(knBookWord(11)).toBe('книг');
    expect(knBookWord(21)).toBe('книга');
    expect(knBookWord(22)).toBe('книги');
    expect(knBookWord(0)).toBe('книг');
  });
});

describe('providerDisplayName', () => {
  it('maps provider slugs to store names', () => {
    expect(providerDisplayName('yakaboo')).toBe('Yakaboo');
    expect(providerDisplayName('book-club')).toBe('BookClub');
  });
});
