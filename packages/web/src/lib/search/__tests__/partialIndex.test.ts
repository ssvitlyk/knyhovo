import { describe, expect, it } from 'vitest';
import { readPartialIndexMeta } from '../partialIndex';

describe('readPartialIndexMeta', () => {
  it('returns meta for a valid partial-coverage response (2 of 5)', () => {
    const response = { storeCoverage: { responded: 2, total: 5 } };
    expect(readPartialIndexMeta(response)).toEqual({ responded: 2, total: 5 });
  });

  it('returns meta for responded=0 (no stores responded yet)', () => {
    const response = { storeCoverage: { responded: 0, total: 3 } };
    expect(readPartialIndexMeta(response)).toEqual({ responded: 0, total: 3 });
  });

  it('returns null for full coverage (responded === total)', () => {
    const response = { storeCoverage: { responded: 5, total: 5 } };
    expect(readPartialIndexMeta(response)).toBeNull();
  });

  it('returns null when storeCoverage is missing', () => {
    expect(readPartialIndexMeta({ items: [] })).toBeNull();
  });

  it('returns null for null input', () => {
    expect(readPartialIndexMeta(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(readPartialIndexMeta(undefined)).toBeNull();
  });

  it('returns null for an array input', () => {
    expect(readPartialIndexMeta([{ responded: 2, total: 5 }])).toBeNull();
  });

  it('returns null when responded is a string', () => {
    expect(readPartialIndexMeta({ storeCoverage: { responded: '2', total: 5 } })).toBeNull();
  });

  it('returns null when total is a string', () => {
    expect(readPartialIndexMeta({ storeCoverage: { responded: 2, total: '5' } })).toBeNull();
  });

  it('returns null when responded > total', () => {
    expect(readPartialIndexMeta({ storeCoverage: { responded: 6, total: 5 } })).toBeNull();
  });

  it('returns null when responded equals total (full coverage)', () => {
    expect(readPartialIndexMeta({ storeCoverage: { responded: 3, total: 3 } })).toBeNull();
  });

  it('returns null when total is zero', () => {
    expect(readPartialIndexMeta({ storeCoverage: { responded: 0, total: 0 } })).toBeNull();
  });

  it('returns null when total is negative', () => {
    expect(readPartialIndexMeta({ storeCoverage: { responded: -1, total: -2 } })).toBeNull();
  });

  it('returns null when responded is negative', () => {
    expect(readPartialIndexMeta({ storeCoverage: { responded: -1, total: 5 } })).toBeNull();
  });

  it('returns null when values are non-integer floats', () => {
    expect(readPartialIndexMeta({ storeCoverage: { responded: 2.5, total: 5 } })).toBeNull();
  });

  it('returns null when storeCoverage is null', () => {
    expect(readPartialIndexMeta({ storeCoverage: null })).toBeNull();
  });

  it('returns null when storeCoverage is an array', () => {
    expect(readPartialIndexMeta({ storeCoverage: [2, 5] })).toBeNull();
  });

  it('returns null when responded is Infinity', () => {
    expect(readPartialIndexMeta({ storeCoverage: { responded: Infinity, total: 5 } })).toBeNull();
  });

  it('never throws on completely malformed input', () => {
    expect(() => readPartialIndexMeta('just a string')).not.toThrow();
    expect(() => readPartialIndexMeta(42)).not.toThrow();
    expect(() => readPartialIndexMeta({ storeCoverage: { responded: NaN, total: NaN } })).not.toThrow();
  });
});
