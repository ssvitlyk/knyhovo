import { describe, it, expect } from 'vitest';
import {
  formatUah,
  providerLabel,
  renderPriceDropEmail,
  renderBackInStockEmail,
  type AlertTemplateData,
} from '../templates.js';

const base: AlertTemplateData = {
  bookTitle: 'Кобзар',
  bookAuthor: 'Тарас Шевченко',
  priceAmount: 24999,
  targetPriceAmount: 30000,
  provider: 'YAKABOO',
  url: 'https://yakaboo.ua/kobzar',
  unsubscribeUrl: 'https://knyhovo.com/api/notifications/unsubscribe?token=abc',
};

describe('formatUah', () => {
  it('formats копійки as UAH with two decimals', () => {
    expect(formatUah(24999)).toBe('249,99 ₴');
    expect(formatUah(30000)).toBe('300,00 ₴');
    expect(formatUah(5)).toBe('0,05 ₴');
  });
});

describe('providerLabel', () => {
  it('maps known providers to friendly labels', () => {
    expect(providerLabel('YAKABOO')).toBe('Yakaboo');
    expect(providerLabel('BOOK_CLUB')).toBe('КСД (BookClub)');
  });
});

describe('renderPriceDropEmail', () => {
  it('includes title, new price, target and link', () => {
    const email = renderPriceDropEmail(base);
    expect(email.subject).toContain('Кобзар');
    expect(email.subject).toContain('249,99 ₴');
    expect(email.text).toContain('Тарас Шевченко');
    expect(email.text).toContain('249,99 ₴');
    expect(email.text).toContain('300,00 ₴'); // target
    expect(email.text).toContain('https://yakaboo.ua/kobzar');
    expect(email.text).toContain(base.unsubscribeUrl);
    expect(email.html).toContain('Yakaboo');
  });

  it('escapes HTML special characters in the title', () => {
    const email = renderPriceDropEmail({ ...base, bookTitle: 'A & B <x>' });
    expect(email.html).toContain('A &amp; B &lt;x&gt;');
    expect(email.html).not.toContain('<x>');
  });
});

describe('renderBackInStockEmail', () => {
  it('announces availability with price and link', () => {
    const email = renderBackInStockEmail(base);
    expect(email.subject).toContain('Знову в наявності');
    expect(email.subject).toContain('Кобзар');
    expect(email.text).toContain('249,99 ₴');
    expect(email.text).toContain('https://yakaboo.ua/kobzar');
    expect(email.text).toContain(base.unsubscribeUrl);
  });
});
