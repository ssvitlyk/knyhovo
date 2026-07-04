import { describe, expect, it } from 'vitest';
import { kindFor, resolveUiSort, sortConfigFor, toApiSort } from '../sort';

describe('kindFor', () => {
  it('maps znyzhky → deal, novynky → fresh, everything else → _default', () => {
    expect(kindFor({ slug: 'znyzhky' })).toBe('deal');
    expect(kindFor({ slug: 'novynky' })).toBe('fresh');
    expect(kindFor({ slug: 'fentezi' })).toBe('_default');
  });
});

describe('sortConfigFor (frozen SORT_CONFIG)', () => {
  it('deal: default popular, options popular/price_asc/price_desc/newest', () => {
    expect(sortConfigFor('deal')).toEqual({
      default: 'popular',
      options: ['popular', 'price_asc', 'price_desc', 'newest'],
    });
  });
  it('fresh: default newest, includes oldest', () => {
    const cfg = sortConfigFor('fresh');
    expect(cfg.default).toBe('newest');
    expect(cfg.options).toContain('oldest');
  });
  it('_default: default popular, no oldest', () => {
    const cfg = sortConfigFor('_default');
    expect(cfg.default).toBe('popular');
    expect(cfg.options).not.toContain('oldest');
  });
});

describe('resolveUiSort', () => {
  it('accepts a valid option', () => {
    expect(resolveUiSort('fresh', 'oldest')).toBe('oldest');
  });
  it('falls back to the kind default for unknown or off-kind values', () => {
    expect(resolveUiSort('deal', 'oldest')).toBe('popular');
    expect(resolveUiSort('_default', 'nonsense')).toBe('popular');
    expect(resolveUiSort('_default', undefined)).toBe('popular');
  });
});

describe('toApiSort', () => {
  it('maps popular → relevance, the rest are same-named', () => {
    expect(toApiSort('popular')).toBe('relevance');
    expect(toApiSort('newest')).toBe('newest');
    expect(toApiSort('oldest')).toBe('oldest');
    expect(toApiSort('price_asc')).toBe('price_asc');
    expect(toApiSort('price_desc')).toBe('price_desc');
  });
});
