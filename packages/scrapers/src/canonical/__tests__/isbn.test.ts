import { describe, it, expect } from 'vitest';
import { normalizeIsbn, toIsbn13 } from '../isbn.js';

describe('toIsbn13', () => {
  it('converts valid ISBN-10 to ISBN-13 (EC-3)', () => {
    // "O'Reilly Learning Python" — known pair
    expect(toIsbn13('0596008929')).toBe('9780596008925');
  });

  it('returns null for invalid ISBN-10 checksum', () => {
    expect(toIsbn13('0596008920')).toBeNull();
  });

  it('handles ISBN-10 with X check digit', () => {
    // ISBN-10: 0-306-40615-2 → ISBN-13: 978-0-306-40615-7
    expect(toIsbn13('080442957X')).toBe('9780804429573');
  });

  it('returns null for wrong length', () => {
    expect(toIsbn13('123456789')).toBeNull();
    expect(toIsbn13('12345678901')).toBeNull();
  });
});

describe('normalizeIsbn', () => {
  it('returns null for null input', () => {
    expect(normalizeIsbn(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeIsbn(undefined)).toBeNull();
  });

  it('strips hyphens from ISBN-13', () => {
    expect(normalizeIsbn('978-617-7933-10-5')).toBe('9786177933105');
  });

  it('strips spaces from ISBN-13', () => {
    expect(normalizeIsbn('978 617 793310 5')).toBe('9786177933105');
  });

  it('validates ISBN-13 checksum — valid', () => {
    expect(normalizeIsbn('9786177933105')).toBe('9786177933105');
  });

  it('validates ISBN-13 checksum — invalid', () => {
    expect(normalizeIsbn('9786177933100')).toBeNull();
  });

  it('converts ISBN-10 to ISBN-13 (EC-3)', () => {
    expect(normalizeIsbn('0596008929')).toBe('9780596008925');
  });

  it('strips hyphens from ISBN-10 before converting', () => {
    expect(normalizeIsbn('0-596-00892-9')).toBe('9780596008925');
  });

  it('returns null for too short', () => {
    expect(normalizeIsbn('123456789')).toBeNull();
  });

  it('returns null for too long', () => {
    expect(normalizeIsbn('97861779331050000')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeIsbn('')).toBeNull();
  });

  it('returns null for non-numeric garbage', () => {
    expect(normalizeIsbn('не ISBN')).toBeNull();
  });
});
