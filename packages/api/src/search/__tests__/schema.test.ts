import { describe, it, expect } from 'vitest';
import { parseSearchQuery } from '../schema.js';
import { ValidationError } from '../../errors.js';

describe('parseSearchQuery', () => {
  it('parses a valid query with defaults', () => {
    expect(parseSearchQuery({ q: 'кобзар' })).toEqual({ q: 'кобзар', page: 1, pageSize: 20 });
  });

  it('trims q', () => {
    expect(parseSearchQuery({ q: '  кобзар  ' }).q).toBe('кобзар');
  });

  it('coerces numeric page/pageSize from strings', () => {
    expect(parseSearchQuery({ q: 'x', page: '3', pageSize: '10' })).toEqual({
      q: 'x',
      page: 3,
      pageSize: 10,
    });
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
  ])('throws ValidationError for %s', (_label, input) => {
    expect(() => parseSearchQuery(input)).toThrow(ValidationError);
  });
});
