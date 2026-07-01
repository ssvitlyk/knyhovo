import { describe, it, expect } from 'vitest';
import { isSafeReturnTo, sanitizeReturnTo, buildMagicLinkUrl } from '../return-to.js';

describe('isSafeReturnTo', () => {
  it('accepts simple internal paths', () => {
    expect(isSafeReturnTo('/wishlist')).toBe(true);
    expect(isSafeReturnTo('/settings/notifications')).toBe(true);
    expect(isSafeReturnTo('/books/abc?ref=1#top')).toBe(true);
    expect(isSafeReturnTo('/')).toBe(true);
  });

  it('rejects external / protocol-relative / scheme URLs (open-redirect)', () => {
    expect(isSafeReturnTo('//evil.com')).toBe(false);
    expect(isSafeReturnTo('/\\evil.com')).toBe(false);
    expect(isSafeReturnTo('https://evil.com')).toBe(false);
    expect(isSafeReturnTo('http://evil.com/path')).toBe(false);
    expect(isSafeReturnTo('javascript:alert(1)')).toBe(false);
  });

  it('rejects non-absolute, empty, whitespace, and non-string inputs', () => {
    expect(isSafeReturnTo('wishlist')).toBe(false);
    expect(isSafeReturnTo('')).toBe(false);
    expect(isSafeReturnTo('/with space')).toBe(false);
    expect(isSafeReturnTo('/with\nnewline')).toBe(false);
    expect(isSafeReturnTo(null)).toBe(false);
    expect(isSafeReturnTo(undefined)).toBe(false);
    expect(isSafeReturnTo(42)).toBe(false);
  });

  it('rejects overly long paths', () => {
    expect(isSafeReturnTo(`/${'a'.repeat(3000)}`)).toBe(false);
  });
});

describe('sanitizeReturnTo', () => {
  it('returns the path when safe, null otherwise', () => {
    expect(sanitizeReturnTo('/wishlist')).toBe('/wishlist');
    expect(sanitizeReturnTo('//evil.com')).toBeNull();
    expect(sanitizeReturnTo(null)).toBeNull();
  });
});

describe('buildMagicLinkUrl', () => {
  it('builds a verify URL on the web origin with the encoded token', () => {
    expect(buildMagicLinkUrl('https://knyhovo.com', 'abc123')).toBe(
      'https://knyhovo.com/auth/verify?token=abc123',
    );
  });

  it('percent-encodes tokens with reserved characters', () => {
    expect(buildMagicLinkUrl('https://knyhovo.com', 'a+b/c=')).toBe(
      'https://knyhovo.com/auth/verify?token=a%2Bb%2Fc%3D',
    );
  });
});
