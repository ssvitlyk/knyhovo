import { describe, it, expect } from 'vitest';
import { normalizeText, normalizeTitle, normalizeAuthor } from '../normalize.js';

describe('normalizeText', () => {
  it('lowercases', () => {
    expect(normalizeText('КОБЗАР')).toBe('кобзар');
  });

  it('trims whitespace', () => {
    expect(normalizeText('  кобзар  ')).toBe('кобзар');
  });

  it('removes diacritics', () => {
    expect(normalizeText('café')).toBe('cafe');
    expect(normalizeText('naïve')).toBe('naive');
  });

  it('replaces ґ with г', () => {
    expect(normalizeText('ґанок')).toBe('ганок');
    expect(normalizeText('Ґрунт')).toBe('грунт');
  });

  it('replaces standalone й with і', () => {
    expect(normalizeText('сіль й перець')).toBe('сіль і перець');
    expect(normalizeText('й то й се')).toBe('і то і се');
  });

  it('does not replace й inside words', () => {
    expect(normalizeText('синій')).toBe('синій');
    expect(normalizeText('вітрильний')).toBe('вітрильний');
    expect(normalizeText('Тарасій')).toBe('тарасій');
  });

  it('removes punctuation', () => {
    expect(normalizeText('книга, яка змінила!')).toBe('книга яка змінила');
    expect(normalizeText('а. с. пушкін')).toBe('а с пушкін');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeText('кобзар   тараса   шевченка')).toBe('кобзар тараса шевченка');
  });
});

describe('normalizeTitle', () => {
  it('removes "Книга N"', () => {
    expect(normalizeTitle('Гра Престолів. Книга 1')).toBe('гра престолів');
    expect(normalizeTitle('Буря мечів. Книга 3')).toBe('буря мечів');
  });

  it('removes "Том N"', () => {
    expect(normalizeTitle('Одіссея. Том 2')).toBe('одіссея');
  });

  it('removes "Частина N"', () => {
    expect(normalizeTitle('Майстер. Частина 1')).toBe('майстер');
  });

  it('removes "(суперобкладинка)"', () => {
    expect(normalizeTitle('Гаррі Поттер (суперобкладинка)')).toBe('гаррі поттер');
    expect(normalizeTitle('Гаррі Поттер (нова суперобкладинка)')).toBe('гаррі поттер');
  });

  it('removes damage/discount markers', () => {
    expect(normalizeTitle('Кобзар (уцінка)')).toBe('кобзар');
    expect(normalizeTitle('Лісова пісня (з пошкодженням)')).toBe('лісова пісня');
    expect(normalizeTitle('Книга (брак)')).toBe('книга');
  });

  it('preserves meaningful content after stripping volume marker', () => {
    expect(normalizeTitle('Пісня льоду й полум\'я. Книга 1. Гра Престолів')).toBe(
      'пісня льоду і полумя гра престолів',
    );
  });

  it('normalizes й → і (EC-2)', () => {
    expect(normalizeTitle('Пісня льоду й полум\'я')).toBe(
      normalizeTitle('Пісня льоду і полум\'я'),
    );
  });

  it('does not destroy short meaningful titles', () => {
    const result = normalizeTitle('Кобзар');
    expect(result).toBe('кобзар');
  });
});

describe('normalizeAuthor', () => {
  it('normalizes same author regardless of word order (EC-4)', () => {
    expect(normalizeAuthor('Михайло Коцюбинський')).toBe(
      normalizeAuthor('Коцюбинський Михайло'),
    );
  });

  it('normalizes multiple authors in different order', () => {
    expect(normalizeAuthor('Іван Франко, Леся Українка')).toBe(
      normalizeAuthor('Леся Українка, Іван Франко'),
    );
  });

  it('handles semicolon separator', () => {
    expect(normalizeAuthor('Тарас Шевченко; Іван Франко')).toBe(
      normalizeAuthor('Іван Франко; Тарас Шевченко'),
    );
  });

  it('handles ampersand separator', () => {
    expect(normalizeAuthor('Адам Смит & Давід Рікардо')).toBe(
      normalizeAuthor('Давід Рікардо & Адам Смит'),
    );
  });

  it('does not aggressively merge different authors', () => {
    const frankoShevchenko = normalizeAuthor('Іван Франко, Тарас Шевченко');
    const lesyaFranko = normalizeAuthor('Леся Українка, Іван Франко');
    expect(frankoShevchenko).not.toBe(lesyaFranko);
  });

  it('handles empty string', () => {
    expect(normalizeAuthor('')).toBe('');
  });
});
