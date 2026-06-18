import { describe, expect, it } from 'vitest';
import { detectIsbn, looksLikeIsbn } from '../isbn';

describe('detectIsbn', () => {
  describe('ISBN-13', () => {
    it('detects a plain 13-digit ISBN-13 starting with 978', () => {
      const result = detectIsbn('9780306406157');
      expect(result).toEqual({ normalized: '9780306406157', kind: 'isbn-13' });
    });

    it('detects a plain 13-digit ISBN-13 starting with 979', () => {
      const result = detectIsbn('9791032301616');
      expect(result).toEqual({ normalized: '9791032301616', kind: 'isbn-13' });
    });

    it('strips hyphens from a formatted ISBN-13', () => {
      const result = detectIsbn('978-0-306-40615-7');
      expect(result).toEqual({ normalized: '9780306406157', kind: 'isbn-13' });
    });

    it('strips spaces from a formatted ISBN-13', () => {
      const result = detectIsbn('978 0 306 40615 7');
      expect(result).toEqual({ normalized: '9780306406157', kind: 'isbn-13' });
    });

    it('strips en-dashes from a formatted ISBN-13', () => {
      const result = detectIsbn('978–0306406157');
      expect(result).toEqual({ normalized: '9780306406157', kind: 'isbn-13' });
    });

    it('strips em-dashes from a formatted ISBN-13', () => {
      const result = detectIsbn('978—0306406157');
      expect(result).toEqual({ normalized: '9780306406157', kind: 'isbn-13' });
    });
  });

  describe('ISBN-10', () => {
    it('detects a plain 10-digit ISBN-10', () => {
      const result = detectIsbn('0306406152');
      expect(result).toEqual({ normalized: '0306406152', kind: 'isbn-10' });
    });

    it('detects ISBN-10 with trailing uppercase X', () => {
      const result = detectIsbn('030640615X');
      expect(result).toEqual({ normalized: '030640615X', kind: 'isbn-10' });
    });

    it('uppercases trailing lowercase x', () => {
      const result = detectIsbn('030640615x');
      expect(result).toEqual({ normalized: '030640615X', kind: 'isbn-10' });
    });

    it('strips hyphens from a formatted ISBN-10', () => {
      const result = detectIsbn('0-306-40615-2');
      expect(result).toEqual({ normalized: '0306406152', kind: 'isbn-10' });
    });
  });

  describe('rejection cases', () => {
    it('returns null for a 12-digit number', () => {
      expect(detectIsbn('978030640615')).toBeNull();
    });

    it('returns null for a 14-digit number', () => {
      expect(detectIsbn('97803064061570')).toBeNull();
    });

    it('returns null for a free-text book title', () => {
      expect(detectIsbn('Гаррі Поттер')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(detectIsbn('')).toBeNull();
    });

    it('returns null for a number not starting with 978/979 when 13 digits', () => {
      expect(detectIsbn('9770306406157')).toBeNull();
    });

    it('returns null for an 11-digit number', () => {
      expect(detectIsbn('03064061520')).toBeNull();
    });
  });
});

describe('looksLikeIsbn', () => {
  it('returns true for a valid ISBN-13', () => {
    expect(looksLikeIsbn('9780306406157')).toBe(true);
  });

  it('returns true for a valid ISBN-10', () => {
    expect(looksLikeIsbn('0306406152')).toBe(true);
  });

  it('returns false for a title', () => {
    expect(looksLikeIsbn('Кобзар')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(looksLikeIsbn('')).toBe(false);
  });
});
