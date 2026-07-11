import { describe, it, expect } from 'vitest';
import { booksTtlFor } from '../service.js';
import type { CollectionRow } from '../repository.js';

function row(overrides: Partial<CollectionRow>): CollectionRow {
  return {
    id: 'c1',
    slug: 'slug',
    type: 'EDITORIAL',
    name: 'Name',
    description: '',
    icon: null,
    displayOrder: 0,
    isActive: true,
    updatedAt: new Date('2026-07-03T00:00:00.000Z'),
    ...overrides,
  };
}

describe('booksTtlFor — cache TTL classification (PRD §3.1)', () => {
  it('scrape-derived dynamic feeds get the 30-minute TTL', () => {
    for (const slug of ['novynky', 'znyzhky', 'ponyzhena-tsina', 'rekordno-nyzka-tsina']) {
      expect(booksTtlFor(row({ type: 'DYNAMIC', slug }))).toBe(30 * 60 * 1000);
    }
  });

  it('wishlist-derived dynamic feeds get the 5-minute TTL', () => {
    for (const slug of ['najbilsh-bazhani', 'populyarne-zaraz']) {
      expect(booksTtlFor(row({ type: 'DYNAMIC', slug }))).toBe(5 * 60 * 1000);
    }
  });

  it('an unrecognized DYNAMIC slug defaults to the shorter (wishlist-derived) TTL, not the longer one', () => {
    expect(booksTtlFor(row({ type: 'DYNAMIC', slug: 'some-future-dynamic-feed' }))).toBe(5 * 60 * 1000);
  });

  it('EDITORIAL and TAXONOMIC keep the 60-minute static TTL', () => {
    expect(booksTtlFor(row({ type: 'EDITORIAL' }))).toBe(60 * 60 * 1000);
    expect(booksTtlFor(row({ type: 'TAXONOMIC' }))).toBe(60 * 60 * 1000);
  });
});
