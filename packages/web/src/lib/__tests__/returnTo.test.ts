import { describe, expect, it } from 'vitest';
import { isSafeReturnTo, safeReturnTo } from '../returnTo';

describe('isSafeReturnTo', () => {
  it('accepts internal paths', () => {
    expect(isSafeReturnTo('/wishlist')).toBe(true);
    expect(isSafeReturnTo('/settings/notifications')).toBe(true);
    expect(isSafeReturnTo('/books/abc?ref=1#x')).toBe(true);
  });

  it('rejects external / protocol-relative / scheme / empty / non-string', () => {
    expect(isSafeReturnTo('//evil.com')).toBe(false);
    expect(isSafeReturnTo('https://evil.com')).toBe(false);
    expect(isSafeReturnTo('/\\evil.com')).toBe(false);
    expect(isSafeReturnTo('wishlist')).toBe(false);
    expect(isSafeReturnTo('')).toBe(false);
    expect(isSafeReturnTo(null)).toBe(false);
    expect(isSafeReturnTo(undefined)).toBe(false);
  });
});

describe('safeReturnTo', () => {
  it('returns the path when safe', () => {
    expect(safeReturnTo('/wishlist')).toBe('/wishlist');
  });
  it('returns the fallback when unsafe', () => {
    expect(safeReturnTo('//evil.com')).toBe('/');
    expect(safeReturnTo(null, '/search')).toBe('/search');
  });
});
