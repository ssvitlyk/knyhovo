import { describe, it, expect } from 'vitest';
import { parsePriceHistoryParams, parsePriceHistoryQuery } from '../schema.js';

const VALID_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('parsePriceHistoryParams', () => {
  it('returns parsed id for a valid UUID', () => {
    expect(parsePriceHistoryParams({ id: VALID_UUID })).toEqual({ id: VALID_UUID });
  });

  it('throws BadRequestError for a non-UUID id', () => {
    expect(() => parsePriceHistoryParams({ id: 'not-a-uuid' })).toThrow('Invalid book id');
  });

  it('throws BadRequestError when id is missing', () => {
    expect(() => parsePriceHistoryParams({})).toThrow('Invalid book id');
  });

  it('throws BadRequestError for an empty string id', () => {
    expect(() => parsePriceHistoryParams({ id: '' })).toThrow('Invalid book id');
  });
});

describe('parsePriceHistoryQuery', () => {
  it('returns 30d for period=30d', () => {
    expect(parsePriceHistoryQuery({ period: '30d' })).toEqual({ period: '30d' });
  });

  it('returns 90d for period=90d', () => {
    expect(parsePriceHistoryQuery({ period: '90d' })).toEqual({ period: '90d' });
  });

  it('returns 1y for period=1y', () => {
    expect(parsePriceHistoryQuery({ period: '1y' })).toEqual({ period: '1y' });
  });

  it('returns all for period=all', () => {
    expect(parsePriceHistoryQuery({ period: 'all' })).toEqual({ period: 'all' });
  });

  it('defaults to 90d when period is missing', () => {
    expect(parsePriceHistoryQuery({})).toEqual({ period: '90d' });
  });

  it('throws ValidationError for an invalid period value', () => {
    expect(() => parsePriceHistoryQuery({ period: '7d' })).toThrow(
      'Invalid period. Must be one of: 30d, 90d, 1y, all.',
    );
  });

  it('throws ValidationError for a numeric period', () => {
    expect(() => parsePriceHistoryQuery({ period: 30 })).toThrow();
  });
});
