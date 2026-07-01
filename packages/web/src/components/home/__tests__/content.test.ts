import { describe, expect, it } from 'vitest';
import {
  POPULAR_QUERIES,
  POPULAR_NOW,
  NEW_RELEASES,
  RECOMMENDS,
  type HomeBook,
} from '../content';

const SHELVES: ReadonlyArray<readonly [string, readonly HomeBook[]]> = [
  ['POPULAR_NOW', POPULAR_NOW],
  ['NEW_RELEASES', NEW_RELEASES],
  ['RECOMMENDS', RECOMMENDS],
];

describe('home content module', () => {
  it('exposes non-empty curated shelves + popular queries', () => {
    expect(POPULAR_QUERIES.length).toBeGreaterThan(0);
    expect(POPULAR_NOW.length).toBe(8);
    expect(NEW_RELEASES.length).toBe(8);
    expect(RECOMMENDS.length).toBe(8);
  });

  it.each(SHELVES)('%s books have required, well-formed fields', (_name, books) => {
    for (const b of books) {
      expect(b.title.trim().length).toBeGreaterThan(0);
      expect(b.author.trim().length).toBeGreaterThan(0);
      expect(b.price).toMatch(/₴/);
      expect(b.cover).toMatch(/^\/covers\/.+\.png$/);
    }
  });

  it.each(SHELVES)('%s badges use the frozen spec vocabulary', (_name, books) => {
    for (const b of books) {
      if (b.badge == null) continue;
      expect(b.badge === 'green' || b.badge.startsWith('solid:') || b.badge.startsWith('accent:')).toBe(true);
    }
  });

  it('popular queries are unique non-empty strings', () => {
    expect(new Set(POPULAR_QUERIES).size).toBe(POPULAR_QUERIES.length);
    for (const q of POPULAR_QUERIES) expect(q.trim().length).toBeGreaterThan(0);
  });
});
