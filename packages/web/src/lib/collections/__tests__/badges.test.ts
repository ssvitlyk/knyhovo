import { describe, expect, it } from 'vitest';
import type { CollectionBookCardDto } from '@/lib/api/types';
import { compactUA, detailsBadgeFor, discountPercent, shelfBadgeFor } from '../badges';

function book(overrides: Partial<CollectionBookCardDto> = {}): CollectionBookCardDto {
  return {
    id: 'b1',
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    coverUrl: '/covers/kobzar.png',
    price: 24000,
    storeName: 'Yakaboo',
    inStock: true,
    url: '/books/b1',
    catalogAddedAt: '2026-01-01T00:00:00.000Z',
    wishlistCount: 0,
    ...overrides,
  };
}

const NOW = new Date('2026-07-04T00:00:00.000Z');

describe('compactUA', () => {
  it('keeps numbers under 1000 as-is', () => {
    expect(compactUA(968)).toBe('968');
  });
  it('formats thousands with a comma decimal and «к»', () => {
    expect(compactUA(1284)).toBe('1,3к');
    expect(compactUA(2000)).toBe('2к');
  });
});

describe('discountPercent', () => {
  it('computes from oldPrice when present', () => {
    expect(discountPercent(book({ price: 28500, oldPrice: 38000 }))).toBe(25);
  });
  it('falls back to discountPct', () => {
    expect(discountPercent(book({ discountPct: 30 }))).toBe(30);
  });
  it('returns null without any discount signal', () => {
    expect(discountPercent(book())).toBeNull();
  });
});

describe('shelfBadgeFor', () => {
  it('obrane → rose save-count', () => {
    expect(shelfBadgeFor('obrane', book({ wishlistCount: 1284 }), 3)).toEqual({
      tone: 'rose',
      icon: 'heart',
      text: '1,3к',
    });
  });
  it('popular → accent «В тренді»', () => {
    expect(shelfBadgeFor('popular', book(), 0)).toEqual({
      tone: 'accent',
      icon: 'trending-up',
      text: 'В тренді',
    });
  });
  it('novynky → «Новинка» without an icon', () => {
    expect(shelfBadgeFor('novynky', book(), 0)).toEqual({ tone: 'new', text: 'Новинка' });
  });
  it('znyzhky → first card «Найкраща ціна», rest «−N%», no badge without discount', () => {
    expect(shelfBadgeFor('znyzhky', book({ oldPrice: 38000, price: 28500 }), 0)).toEqual({
      tone: 'green',
      text: 'Найкраща ціна',
    });
    expect(shelfBadgeFor('znyzhky', book({ oldPrice: 38000, price: 28500 }), 1)).toEqual({
      tone: 'green',
      text: '−25%',
    });
    expect(shelfBadgeFor('znyzhky', book(), 2)).toBeNull();
  });
});

describe('detailsBadgeFor', () => {
  it('discount wins over everything', () => {
    expect(
      detailsBadgeFor(book({ oldPrice: 38000, price: 28500, inStock: false }), NOW),
    ).toEqual({ tone: 'green', text: '−25%' });
  });
  it('recent arrival → «Новинка»', () => {
    expect(detailsBadgeFor(book({ catalogAddedAt: '2026-06-20T00:00:00.000Z' }), NOW)).toEqual({
      tone: 'new',
      text: 'Новинка',
    });
  });
  it('out of stock → neutral chip', () => {
    expect(detailsBadgeFor(book({ inStock: false }), NOW)).toEqual({
      tone: 'neutral',
      text: 'Немає в наявності',
    });
  });
  it('nothing applies → null (max one badge, never stacked)', () => {
    expect(detailsBadgeFor(book(), NOW)).toBeNull();
  });
});
