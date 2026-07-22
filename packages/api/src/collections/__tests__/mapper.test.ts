import { describe, it, expect } from 'vitest';
import { cheapestListing, toCollectionBookDto } from '../mapper.js';
import type { CollectionBookRow, CollectionListingRow } from '../repository.js';

function listing(overrides: Partial<CollectionListingRow> = {}): CollectionListingRow {
  return {
    provider: 'YAKABOO',
    priceAmount: 1000,
    priceCurrency: 'UAH',
    availability: 'IN_STOCK',
    coverUrl: null,
    priceHistory: [],
    ...overrides,
  };
}

function bookRow(listings: CollectionListingRow[]): CollectionBookRow {
  return {
    id: 'b1',
    title: 'T',
    author: 'A',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    genreId: null,
    listings,
  };
}

describe('cheapestListing', () => {
  it('returns null when there is no priced listing', () => {
    expect(cheapestListing(bookRow([]))).toBeNull();
  });

  it('picks the cheapest in-stock priced listing', () => {
    const cheapest = cheapestListing(
      bookRow([
        listing({ provider: 'YAKABOO', priceAmount: 100 }),
        listing({ provider: 'BOOK_CLUB', priceAmount: 90 }),
      ]),
    );
    expect(cheapest?.provider).toBe('BOOK_CLUB');
    expect(cheapest?.priceAmount).toBe(90);
  });

  it('prefers in-stock over a cheaper... no — prefers in-stock at equal price (tie-break)', () => {
    // Equal price, different availability: the in-stock listing wins regardless of array order.
    const cheapest = cheapestListing(
      bookRow([
        listing({ provider: 'YAKABOO', priceAmount: 100, availability: 'OUT_OF_STOCK' }),
        listing({ provider: 'BOOK_CLUB', priceAmount: 100, availability: 'IN_STOCK' }),
      ]),
    );
    expect(cheapest?.provider).toBe('BOOK_CLUB');
  });

  it('falls back to the cheapest out-of-stock priced listing when none are in stock', () => {
    const cheapest = cheapestListing(
      bookRow([
        listing({ provider: 'YAKABOO', priceAmount: 150, availability: 'OUT_OF_STOCK' }),
        listing({ provider: 'BOOK_CLUB', priceAmount: 120, availability: 'OUT_OF_STOCK' }),
      ]),
    );
    expect(cheapest?.provider).toBe('BOOK_CLUB');
    expect(cheapest?.priceAmount).toBe(120);
  });

  it('an in-stock listing wins even when a cheaper listing is out of stock', () => {
    const cheapest = cheapestListing(
      bookRow([
        listing({ provider: 'YAKABOO', priceAmount: 80, availability: 'OUT_OF_STOCK' }),
        listing({ provider: 'BOOK_CLUB', priceAmount: 130, availability: 'IN_STOCK' }),
      ]),
    );
    expect(cheapest?.provider).toBe('BOOK_CLUB'); // first in-stock in price order
  });
});

describe('toCollectionBookDto — cheapest selection consistency', () => {
  it('minPrice/storeName reflect the same listing cheapestListing picks', () => {
    const row = bookRow([
      listing({ provider: 'YAKABOO', priceAmount: 100, availability: 'OUT_OF_STOCK' }),
      listing({ provider: 'BOOK_CLUB', priceAmount: 100, availability: 'IN_STOCK' }),
    ]);
    const dto = toCollectionBookDto(row, { wishlistCounts: new Map() });
    const cheapest = cheapestListing(row)!;
    expect(dto.minPrice?.amount).toBe(cheapest.priceAmount);
    expect(dto.storeName).toBe('BookClub'); // display name of BOOK_CLUB (the in-stock pick)
    expect(dto.inStock).toBe(true);
  });

  it('offersCount counts in-stock priced when any exist, else all priced', () => {
    const inStockMix = bookRow([
      listing({ priceAmount: 100, availability: 'IN_STOCK' }),
      listing({ priceAmount: 110, availability: 'IN_STOCK' }),
      listing({ priceAmount: 120, availability: 'OUT_OF_STOCK' }),
    ]);
    expect(toCollectionBookDto(inStockMix, { wishlistCounts: new Map() }).offersCount).toBe(2);

    const allOos = bookRow([
      listing({ priceAmount: 100, availability: 'OUT_OF_STOCK' }),
      listing({ priceAmount: 110, availability: 'OUT_OF_STOCK' }),
    ]);
    expect(toCollectionBookDto(allOos, { wishlistCounts: new Map() }).offersCount).toBe(2);
  });

  it('unpriced book → minPrice/storeName null, offersCount 0', () => {
    const dto = toCollectionBookDto(bookRow([]), { wishlistCounts: new Map() });
    expect(dto.minPrice).toBeNull();
    expect(dto.storeName).toBeNull();
    expect(dto.offersCount).toBe(0);
  });
});
