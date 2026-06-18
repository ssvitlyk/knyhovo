import { describe, expect, it } from 'vitest';
import { lookupCorrection, CORRECTION_DICTIONARY } from '../corrections';

describe('lookupCorrection', () => {
  it('corrects "гари потер"', () => {
    expect(lookupCorrection('гари потер')).toEqual({
      original: 'гари потер',
      corrected: 'Гаррі Поттер',
    });
  });

  it('corrects "гарі потер"', () => {
    expect(lookupCorrection('гарі потер')).toEqual({
      original: 'гарі потер',
      corrected: 'Гаррі Поттер',
    });
  });

  it('corrects "гаррі потер"', () => {
    expect(lookupCorrection('гаррі потер')).toEqual({
      original: 'гаррі потер',
      corrected: 'Гаррі Поттер',
    });
  });

  it('corrects "сапиенс"', () => {
    expect(lookupCorrection('сапиенс')).toEqual({
      original: 'сапиенс',
      corrected: 'Sapiens',
    });
  });

  it('corrects "сапієнс"', () => {
    expect(lookupCorrection('сапієнс')).toEqual({
      original: 'сапієнс',
      corrected: 'Sapiens',
    });
  });

  it('corrects "атомні звичкі"', () => {
    expect(lookupCorrection('атомні звичкі')).toEqual({
      original: 'атомні звичкі',
      corrected: 'Атомні звички',
    });
  });

  it('corrects "кафка на пляжи"', () => {
    expect(lookupCorrection('кафка на пляжи')).toEqual({
      original: 'кафка на пляжи',
      corrected: 'Кафка на пляжі',
    });
  });

  it('corrects "сергий жадан"', () => {
    expect(lookupCorrection('сергий жадан')).toEqual({
      original: 'сергий жадан',
      corrected: 'Сергій Жадан',
    });
  });

  it('returns null for an unknown query', () => {
    expect(lookupCorrection('невідома книга')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(lookupCorrection('')).toBeNull();
  });

  it('is case-insensitive (uppercase typo)', () => {
    const result = lookupCorrection('Гари Потер');
    expect(result).toEqual({
      original: 'Гари Потер',
      corrected: 'Гаррі Поттер',
    });
  });

  it('is whitespace-insensitive (leading/trailing/extra spaces)', () => {
    const result = lookupCorrection('  Гари   Потер ');
    expect(result).toEqual({
      original: 'Гари   Потер',
      corrected: 'Гаррі Поттер',
    });
  });

  it('returns null for a query that is already a dictionary value (no self-correction)', () => {
    // 'Гаррі Поттер' normalizes to 'гаррі поттер' which is NOT a key in the dictionary
    // (only 'гаррі потер' with one т is). So this tests that an already-correct query
    // not present as a key returns null.
    expect(lookupCorrection('Гаррі Поттер')).toBeNull();
  });

  it('returns null for "Sapiens" (correct form — not a dictionary key)', () => {
    expect(lookupCorrection('Sapiens')).toBeNull();
  });
});

describe('CORRECTION_DICTIONARY', () => {
  it('is a non-empty frozen-like object with string values', () => {
    expect(typeof CORRECTION_DICTIONARY).toBe('object');
    expect(Object.keys(CORRECTION_DICTIONARY).length).toBeGreaterThan(0);
    for (const [, value] of Object.entries(CORRECTION_DICTIONARY)) {
      expect(typeof value).toBe('string');
    }
  });
});
