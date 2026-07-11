import { describe, it, expect } from 'vitest';
import { parseSearchQuery } from '../schema.js';
import { ValidationError } from '../../errors.js';

describe('parseSearchQuery', () => {
  it('parses a valid query with defaults', () => {
    expect(parseSearchQuery({ q: 'кобзар' })).toEqual({
      q: 'кобзар',
      page: 1,
      pageSize: 20,
      sort: 'price_asc',
    });
  });

  it('trims q', () => {
    expect(parseSearchQuery({ q: '  кобзар  ' }).q).toBe('кобзар');
  });

  it('coerces numeric page/pageSize from strings', () => {
    expect(parseSearchQuery({ q: 'x', page: '3', pageSize: '10' })).toEqual({
      q: 'x',
      page: 3,
      pageSize: 10,
      sort: 'price_asc',
    });
  });

  it.each(['price_asc', 'popular', 'newest'] as const)('accepts sort=%s', (sort) => {
    expect(parseSearchQuery({ q: 'x', sort }).sort).toBe(sort);
  });

  it('defaults sort to price_asc when omitted', () => {
    expect(parseSearchQuery({ q: 'x' }).sort).toBe('price_asc');
  });

  it.each([
    ['missing q', {}],
    ['empty q', { q: '' }],
    ['whitespace q', { q: '   ' }],
    ['page < 1', { q: 'x', page: '0' }],
    ['non-integer page', { q: 'x', page: '1.5' }],
    ['non-numeric page', { q: 'x', page: 'abc' }],
    ['pageSize < 1', { q: 'x', pageSize: '0' }],
    ['pageSize > 50', { q: 'x', pageSize: '51' }],
    ['invalid sort', { q: 'x', sort: 'bogus' }],
  ])('throws ValidationError for %s', (_label, input) => {
    expect(() => parseSearchQuery(input)).toThrow(ValidationError);
  });
});
