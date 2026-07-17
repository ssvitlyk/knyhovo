import { describe, expect, it } from 'vitest';
import type { BuyingOpportunityDto, WishlistItemDto } from '../../api/types';
import { splitWishlist } from '../opportunities';

function makeItem(overrides: Partial<WishlistItemDto['book']> & { id: string }): WishlistItemDto {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    alert: null,
    book: {
      id: overrides.id,
      title: overrides.title ?? `Title ${overrides.id}`,
      author: overrides.author ?? 'Author',
      isbn: null,
      coverUrl: overrides.coverUrl ?? null,
      lowestPrice: overrides.lowestPrice ?? null,
      offersCount: overrides.offersCount ?? 1,
      providers: overrides.providers ?? [],
      genre: overrides.genre ?? null,
    },
  };
}

function makeOpp(overrides: Partial<BuyingOpportunityDto> & { bookId: string }): BuyingOpportunityDto {
  return {
    bookId: overrides.bookId,
    reason: overrides.reason ?? 'PRICE_DROPPED',
    savingsAmount: overrides.savingsAmount ?? 500,
    price: overrides.price ?? 1000,
    prevPrice: overrides.prevPrice ?? 1500,
    currency: overrides.currency ?? 'UAH',
    store: overrides.store ?? 'yakaboo',
  };
}

describe('splitWishlist', () => {
  it('joins opportunities preserving their order and enriches from the wishlist book', () => {
    const items = [
      makeItem({ id: 'a', title: 'A book', author: 'A author', coverUrl: '/a.jpg' }),
      makeItem({ id: 'b', title: 'B book' }),
      makeItem({ id: 'c', title: 'C book' }),
    ];
    const opportunities = [makeOpp({ bookId: 'c' }), makeOpp({ bookId: 'a' })];

    const result = splitWishlist(items, opportunities);

    expect(result.opportunities.map((o) => o.bookId)).toEqual(['c', 'a']);
    const enrichedA = result.opportunities.find((o) => o.bookId === 'a');
    expect(enrichedA).toMatchObject({ title: 'A book', author: 'A author', coverUrl: '/a.jpg' });
  });

  it('puts every non-matched item into rest, never dropping or duplicating', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })];
    const opportunities = [makeOpp({ bookId: 'b' })];

    const result = splitWishlist(items, opportunities);

    expect(result.opportunities).toHaveLength(1);
    expect(result.rest.map((i) => i.book.id)).toEqual(['a', 'c']);
  });

  it('never drops or duplicates items across opportunities + rest', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })];
    const opportunities = [makeOpp({ bookId: 'b' }), makeOpp({ bookId: 'a' })];

    const result = splitWishlist(items, opportunities);
    const allIds = [...result.opportunities.map((o) => o.bookId), ...result.rest.map((i) => i.book.id)];

    expect(allIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('resolves ctaUrl by matching the opportunity store to a provider listing', () => {
    const items = [
      makeItem({
        id: 'a',
        providers: [
          { provider: 'yakaboo', price: { amount: 1000, currency: 'UAH' }, availability: 'in-stock', url: 'https://yakaboo.ua/a', lastSeenAt: '2026-01-01T00:00:00.000Z' },
          { provider: 'book-club', price: { amount: 1100, currency: 'UAH' }, availability: 'in-stock', url: 'https://bookclub.ua/a', lastSeenAt: '2026-01-01T00:00:00.000Z' },
        ],
      }),
    ];
    const opportunities = [makeOpp({ bookId: 'a', store: 'book-club' })];

    const result = splitWishlist(items, opportunities);

    expect(result.opportunities[0]?.ctaUrl).toBe('https://bookclub.ua/a');
  });

  it('falls back to the book details URL when no provider listing matches the store', () => {
    const items = [makeItem({ id: 'a', providers: [] })];
    const opportunities = [makeOpp({ bookId: 'a', store: 'yakaboo' })];

    const result = splitWishlist(items, opportunities);

    expect(result.opportunities[0]?.ctaUrl).toBe('/books/a');
  });

  it('drops an opportunity whose bookId has no matching wishlist item', () => {
    const items = [makeItem({ id: 'a' })];
    const opportunities = [makeOpp({ bookId: 'unknown' }), makeOpp({ bookId: 'a' })];

    const result = splitWishlist(items, opportunities);

    expect(result.opportunities.map((o) => o.bookId)).toEqual(['a']);
  });
});
