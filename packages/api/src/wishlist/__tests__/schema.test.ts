import { describe, it, expect } from 'vitest';
import { parseAddWishlistBody, parseWishlistParams } from '../schema.js';
import { ValidationError } from '../../errors.js';

const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('parseAddWishlistBody', () => {
  it('parses a valid bookId UUID', () => {
    expect(parseAddWishlistBody({ bookId: VALID_UUID })).toEqual({ bookId: VALID_UUID });
  });

  it.each([
    ['missing bookId', {}],
    ['non-uuid bookId', { bookId: 'not-a-uuid' }],
    ['empty string bookId', { bookId: '' }],
    ['numeric bookId', { bookId: '12345' }],
    ['null bookId', { bookId: null }],
  ])('throws ValidationError for %s', (_label, input) => {
    expect(() => parseAddWishlistBody(input)).toThrow(ValidationError);
  });
});

describe('parseWishlistParams', () => {
  it('parses a valid bookId UUID', () => {
    expect(parseWishlistParams({ bookId: VALID_UUID })).toEqual({ bookId: VALID_UUID });
  });

  it.each([
    ['non-uuid bookId', { bookId: 'not-a-uuid' }],
    ['empty string bookId', { bookId: '' }],
    ['truncated uuid', { bookId: 'aaaaaaaa-aaaa-4aaa-8aaa' }],
    ['missing bookId', {}],
  ])('throws ValidationError for %s', (_label, input) => {
    expect(() => parseWishlistParams(input)).toThrow(ValidationError);
  });
});
