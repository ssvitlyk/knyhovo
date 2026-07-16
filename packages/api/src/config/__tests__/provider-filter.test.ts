import { describe, it, expect } from 'vitest';
import { getDisabledProviders } from '../provider-filter.js';

describe('getDisabledProviders', () => {
  it('returns an empty set when SCRAPE_DISABLED_PROVIDERS is absent', () => {
    const result = getDisabledProviders({});
    expect(result.size).toBe(0);
  });

  it('returns an empty set when SCRAPE_DISABLED_PROVIDERS is empty', () => {
    const result = getDisabledProviders({ SCRAPE_DISABLED_PROVIDERS: '' });
    expect(result.size).toBe(0);
  });

  it('returns an empty set when SCRAPE_DISABLED_PROVIDERS is only whitespace', () => {
    const result = getDisabledProviders({ SCRAPE_DISABLED_PROVIDERS: '   ' });
    expect(result.size).toBe(0);
  });

  it('parses a single slug', () => {
    const result = getDisabledProviders({ SCRAPE_DISABLED_PROVIDERS: 'bookchef' });
    expect(result.size).toBe(1);
    expect(result.has('bookchef')).toBe(true);
  });

  it('parses multiple comma-separated slugs with surrounding whitespace', () => {
    const result = getDisabledProviders({ SCRAPE_DISABLED_PROVIDERS: ' bookchef , vivat  ,knigoland' });
    expect(result.size).toBe(3);
    expect(result.has('bookchef')).toBe(true);
    expect(result.has('vivat')).toBe(true);
    expect(result.has('knigoland')).toBe(true);
  });

  it('ignores empty segments from stray/trailing commas', () => {
    const result = getDisabledProviders({ SCRAPE_DISABLED_PROVIDERS: 'bookchef,,vivat,' });
    expect(result.size).toBe(2);
    expect(result.has('bookchef')).toBe(true);
    expect(result.has('vivat')).toBe(true);
  });

  it('throws a clear error for an unknown slug', () => {
    expect(() => getDisabledProviders({ SCRAPE_DISABLED_PROVIDERS: 'bogus' })).toThrow(
      /Invalid SCRAPE_DISABLED_PROVIDERS entry 'bogus' — expected one of:/,
    );
  });

  it('throws when one entry among valid ones is unknown', () => {
    expect(() => getDisabledProviders({ SCRAPE_DISABLED_PROVIDERS: 'bookchef,bogus' })).toThrow(
      /Invalid SCRAPE_DISABLED_PROVIDERS entry 'bogus'/,
    );
  });
});
