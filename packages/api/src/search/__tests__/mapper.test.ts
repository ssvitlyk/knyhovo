import { describe, it, expect } from 'vitest';
import { toSearchItem } from '../mapper.js';
import type { CanonicalBookRow, ListingRow } from '../repository.js';

function row(overrides: Partial<CanonicalBookRow> = {}): CanonicalBookRow {
  return {
    id: 'id-1',
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    listings: [],
    ...overrides,
  };
}

function listing(provider: ListingRow['provider'], priceAmount: number, availability: ListingRow['availability'] = 'IN_STOCK'): ListingRow {
  return { provider, priceAmount, priceCurrency: 'UAH', availability };
}

describe('toSearchItem', () => {
  it('maps provider enums to slugs and computes lowest price', () => {
    const item = toSearchItem(
      row({ listings: [listing('YAKABOO', 34900), listing('BOOK_CLUB', 29900)] }),
    );
    expect(item).not.toBeNull();
    expect(item!.providers).toEqual([
      { provider: 'book-club', price: { amount: 29900, currency: 'UAH' } },
      { provider: 'yakaboo', price: { amount: 34900, currency: 'UAH' } },
    ]);
    expect(item!.lowestPrice).toEqual({ amount: 29900, currency: 'UAH' });
    expect(item!.offersCount).toBe(2);
  });

  it('returns null when the book has no listings', () => {
    expect(toSearchItem(row({ listings: [] }))).toBeNull();
  });

  it('ignores listings with a non-finite/null price (defensive) and excludes empties', () => {
    // Cast through unknown to simulate a null price slipping through.
    const bad = { provider: 'YAKABOO', priceAmount: null, priceCurrency: 'UAH', availability: 'IN_STOCK' } as unknown as ListingRow;
    expect(toSearchItem(row({ listings: [bad] }))).toBeNull();
  });

  it('keeps only priced listings when some are valid', () => {
    const bad = { provider: 'YAKABOO', priceAmount: null, priceCurrency: 'UAH', availability: 'IN_STOCK' } as unknown as ListingRow;
    const item = toSearchItem(row({ listings: [bad, listing('BOOK_CLUB', 15000)] }));
    expect(item!.offersCount).toBe(1);
    expect(item!.providers[0]!.provider).toBe('book-club');
  });

  it('excludes OUT_OF_STOCK listings from providers/lowestPrice/offersCount', () => {
    const item = toSearchItem(
      row({ listings: [listing('YAKABOO', 34900, 'IN_STOCK'), listing('BOOK_CLUB', 29900, 'OUT_OF_STOCK')] }),
    );
    expect(item).not.toBeNull();
    expect(item!.offersCount).toBe(1);
    expect(item!.lowestPrice).toEqual({ amount: 34900, currency: 'UAH' });
    expect(item!.providers.map((p) => p.provider)).toEqual(['yakaboo']);
  });

  it('returns null when all listings are OUT_OF_STOCK', () => {
    const item = toSearchItem(
      row({ listings: [listing('YAKABOO', 34900, 'OUT_OF_STOCK'), listing('BOOK_CLUB', 29900, 'OUT_OF_STOCK')] }),
    );
    expect(item).toBeNull();
  });

  it('includes UNKNOWN listings', () => {
    const item = toSearchItem(
      row({ listings: [listing('YAKABOO', 34900, 'UNKNOWN')] }),
    );
    expect(item).not.toBeNull();
    expect(item!.offersCount).toBe(1);
    expect(item!.providers[0]!.provider).toBe('yakaboo');
  });
});
