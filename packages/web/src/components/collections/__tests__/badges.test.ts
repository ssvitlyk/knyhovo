import { describe, expect, it } from 'vitest';
import { badgeFor } from '../badges';
import type { CollectionBookDto } from '@/lib/api/types';

function makeBook(over: Partial<CollectionBookDto> = {}): CollectionBookDto {
  return {
    id: 'b1',
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    coverUrl: '/covers/kobzar.png',
    minPrice: { amount: 24900, currency: 'UAH' },
    oldPrice: null,
    discountPercent: null,
    storeName: 'Yakaboo',
    rating: null,
    reviewsCount: null,
    wishlistCount: 0,
    isWishlisted: false,
    inStock: true,
    catalogAddedAt: new Date().toISOString(),
    ...over,
  };
}

const NOW = Date.UTC(2026, 6, 3);
const RECENT = new Date(NOW - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days ago
const OLD = new Date(NOW - 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days ago

describe('badgeFor — one honest, backend-signal badge per card', () => {
  it('isBestPrice always wins with the green «Найкраща ціна» badge', () => {
    const badge = badgeFor(makeBook({ discountPercent: 40 }), 'discount', { isBestPrice: true, now: NOW });
    expect(badge).toEqual({ tone: 'green', text: 'Найкраща ціна' });
  });

  it('discount: shows −N% (solid, like Homepage) only when a real discountPercent exists', () => {
    expect(badgeFor(makeBook({ discountPercent: 30 }), 'discount', { now: NOW })).toEqual({
      tone: 'solid',
      text: '−30%',
    });
    expect(badgeFor(makeBook({ discountPercent: null }), 'discount', { now: NOW })).toBeNull();
    expect(badgeFor(makeBook({ discountPercent: 0 }), 'discount', { now: NOW })).toBeNull();
  });

  it('new: «Новинка» only within the 30-day window', () => {
    expect(badgeFor(makeBook({ catalogAddedAt: RECENT }), 'new', { now: NOW })).toEqual({
      tone: 'accent',
      text: 'Новинка',
    });
    expect(badgeFor(makeBook({ catalogAddedAt: OLD }), 'new', { now: NOW })).toBeNull();
  });

  it('trending: always «В тренді» (section-level hint, no per-book fabrication)', () => {
    expect(badgeFor(makeBook(), 'trending', { now: NOW })).toEqual({
      tone: 'accent',
      icon: 'trending-up',
      text: 'В тренді',
    });
  });

  it('wishlist-count: rose heart with compact UA number, only when count > 0', () => {
    expect(badgeFor(makeBook({ wishlistCount: 1284 }), 'wishlist-count', { now: NOW })).toEqual({
      tone: 'rose',
      icon: 'heart',
      text: '1,3к',
    });
    expect(badgeFor(makeBook({ wishlistCount: 2000 }), 'wishlist-count', { now: NOW })).toEqual({
      tone: 'rose',
      icon: 'heart',
      text: '2к',
    });
    expect(badgeFor(makeBook({ wishlistCount: 42 }), 'wishlist-count', { now: NOW })).toEqual({
      tone: 'rose',
      icon: 'heart',
      text: '42',
    });
    expect(badgeFor(makeBook({ wishlistCount: 0 }), 'wishlist-count', { now: NOW })).toBeNull();
  });

  it('best-price/none kinds produce no badge', () => {
    expect(badgeFor(makeBook(), 'best-price', { now: NOW })).toBeNull();
    expect(badgeFor(makeBook(), 'none', { now: NOW })).toBeNull();
  });
});
