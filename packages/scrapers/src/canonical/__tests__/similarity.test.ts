import { describe, it, expect } from 'vitest';
import { levenshteinDistance, stringSimilarity, titleSimilarity, authorSimilarity } from '../similarity.js';
import { normalizeTitle, normalizeAuthor } from '../normalize.js';

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('кобзар', 'кобзар')).toBe(0);
  });

  it('returns length of b when a is empty', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
  });

  it('returns length of a when b is empty', () => {
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  it('counts single substitution', () => {
    expect(levenshteinDistance('кіт', 'кот')).toBe(1);
  });

  it('counts single insertion', () => {
    expect(levenshteinDistance('кот', 'коти')).toBe(1);
  });

  it('counts single deletion', () => {
    expect(levenshteinDistance('коти', 'кот')).toBe(1);
  });
});

describe('stringSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(stringSimilarity('кобзар', 'кобзар')).toBe(1);
  });

  it('returns 1 for two empty strings', () => {
    expect(stringSimilarity('', '')).toBe(1);
  });

  it('returns value in [0..1] range', () => {
    const sim = stringSimilarity('кобзар', 'незнайомець');
    expect(sim).toBeGreaterThanOrEqual(0);
    expect(sim).toBeLessThanOrEqual(1);
  });

  it('returns low score for completely different strings', () => {
    expect(stringSimilarity('абвгд', 'їжакклинок')).toBeLessThan(0.5);
  });
});

describe('titleSimilarity', () => {
  it('returns 1 for identical normalized titles', () => {
    const t = normalizeTitle('Кобзар');
    expect(titleSimilarity(t, t)).toBe(1);
  });

  it('handles suffix containment (EC-1): short title is suffix of long title', () => {
    const yakaboo = normalizeTitle('Гра Престолів');
    const bookclub = normalizeTitle('Пісня льоду і полум\'я. Гра Престолів');
    expect(titleSimilarity(yakaboo, bookclub)).toBeGreaterThanOrEqual(0.9);
  });

  it('returns high score for titles that differ only by й vs і (EC-2)', () => {
    const a = normalizeTitle('Пісня льоду й полум\'я');
    const b = normalizeTitle('Пісня льоду і полум\'я');
    expect(titleSimilarity(a, b)).toBe(1);
  });

  it('returns low score for clearly different titles', () => {
    const a = normalizeTitle('Кобзар');
    const b = normalizeTitle('Злочин і кара');
    expect(titleSimilarity(a, b)).toBeLessThan(0.5);
  });

  it('returns < 0.85 for author-similar but title-different books', () => {
    const a = normalizeTitle('Кобзар');
    const b = normalizeTitle('Гайдамаки');
    expect(titleSimilarity(a, b)).toBeLessThan(0.85);
  });
});

describe('authorSimilarity', () => {
  it('returns 1 for same author regardless of name order (EC-4)', () => {
    const a = normalizeAuthor('Михайло Коцюбинський');
    const b = normalizeAuthor('Коцюбинський Михайло');
    expect(authorSimilarity(a, b)).toBe(1);
  });

  it('returns < 0.8 for completely different authors', () => {
    const a = normalizeAuthor('Тарас Шевченко');
    const b = normalizeAuthor('Іван Франко');
    expect(authorSimilarity(a, b)).toBeLessThan(0.8);
  });
});
