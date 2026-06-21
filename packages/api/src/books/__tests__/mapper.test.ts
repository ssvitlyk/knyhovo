import { describe, it, expect } from 'vitest';
import { toBookDetails } from '../mapper.js';
import type { BookDetailsRow, BookListingRow } from '../repository.js';

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

function row(overrides: Partial<BookDetailsRow> = {}): BookDetailsRow {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'Кобзар',
    author: 'Тарас Шевченко',
    isbn: null,
    listings: [],
    ...overrides,
  };
}

function listing(
  provider: BookListingRow['provider'],
  priceAmount: number,
  availability: BookListingRow['availability'] = 'IN_STOCK',
  url = 'https://example.com',
  lastSeenAt = FIXED_DATE,
  description: string | null = null,
): BookListingRow {
  return { provider, priceAmount, priceCurrency: 'UAH', availability, url, lastSeenAt, description };
}

describe('toBookDetails', () => {
  it('maps provider enums to slugs and computes lowest price', () => {
    const dto = toBookDetails(
      row({ listings: [listing('YAKABOO', 34900), listing('BOOK_CLUB', 29900)] }),
    );
    expect(dto.providers).toEqual([
      {
        provider: 'book-club',
        price: { amount: 29900, currency: 'UAH' },
        availability: 'in-stock',
        url: 'https://example.com',
        lastSeenAt: '2026-01-01T00:00:00.000Z',
      },
      {
        provider: 'yakaboo',
        price: { amount: 34900, currency: 'UAH' },
        availability: 'in-stock',
        url: 'https://example.com',
        lastSeenAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    expect(dto.lowestPrice).toEqual({ amount: 29900, currency: 'UAH' });
    expect(dto.offersCount).toBe(2);
  });

  it('counts IN_STOCK and UNKNOWN listings, drops OUT_OF_STOCK', () => {
    const dto = toBookDetails(
      row({
        listings: [
          listing('YAKABOO', 34900, 'IN_STOCK'),
          listing('BOOK_CLUB', 29900, 'UNKNOWN'),
        ],
      }),
    );
    expect(dto.offersCount).toBe(2);
    expect(dto.providers.map((p) => p.availability)).toEqual(['unknown', 'in-stock']);
  });

  it('excludes OUT_OF_STOCK from providers/lowestPrice/offersCount', () => {
    const dto = toBookDetails(
      row({
        listings: [
          listing('YAKABOO', 34900, 'IN_STOCK'),
          listing('BOOK_CLUB', 29900, 'OUT_OF_STOCK'),
        ],
      }),
    );
    expect(dto.offersCount).toBe(1);
    expect(dto.lowestPrice).toEqual({ amount: 34900, currency: 'UAH' });
    expect(dto.providers.map((p) => p.provider)).toEqual(['yakaboo']);
  });

  it('sorts providers ascending by price', () => {
    const dto = toBookDetails(
      row({
        listings: [
          listing('YAKABOO', 50000),
          listing('BOOK_CLUB', 10000),
        ],
      }),
    );
    expect(dto.providers.map((p) => p.price.amount)).toEqual([10000, 50000]);
  });

  it('returns providers: [], lowestPrice: null, offersCount: 0 when all OUT_OF_STOCK, but still returns the book', () => {
    const dto = toBookDetails(
      row({
        listings: [
          listing('YAKABOO', 34900, 'OUT_OF_STOCK'),
          listing('BOOK_CLUB', 29900, 'OUT_OF_STOCK'),
        ],
      }),
    );
    expect(dto.providers).toEqual([]);
    expect(dto.lowestPrice).toBeNull();
    expect(dto.offersCount).toBe(0);
    expect(dto.id).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(dto.title).toBe('Кобзар');
    expect(dto.author).toBe('Тарас Шевченко');
  });

  it('returns providers: [], lowestPrice: null, offersCount: 0 for empty listings', () => {
    const dto = toBookDetails(row({ listings: [] }));
    expect(dto.providers).toEqual([]);
    expect(dto.lowestPrice).toBeNull();
    expect(dto.offersCount).toBe(0);
  });

  it('coverUrl is always null (not wired in F2)', () => {
    const dto = toBookDetails(row());
    expect(dto.coverUrl).toBeNull();
  });

  it('description is null when no listing carries one', () => {
    const dto = toBookDetails(
      row({ listings: [listing('YAKABOO', 34900), listing('BOOK_CLUB', 29900)] }),
    );
    expect(dto.description).toBeNull();
  });

  it('selects description by provider priority (yakaboo over vivat)', () => {
    const dto = toBookDetails(
      row({
        listings: [
          listing('VIVAT', 10000, 'IN_STOCK', 'https://vivat', FIXED_DATE, 'Vivat опис'),
          listing('YAKABOO', 50000, 'IN_STOCK', 'https://yakaboo', FIXED_DATE, 'Yakaboo опис'),
        ],
      }),
    );
    expect(dto.description).toBe('Yakaboo опис');
  });

  it('selects description from OUT_OF_STOCK listings too (uses ALL listings)', () => {
    const dto = toBookDetails(
      row({
        listings: [listing('YAKABOO', 34900, 'OUT_OF_STOCK', 'https://yakaboo', FIXED_DATE, 'Опис попри out-of-stock')],
      }),
    );
    expect(dto.providers).toEqual([]);
    expect(dto.description).toBe('Опис попри out-of-stock');
  });

  it('passes through a string isbn', () => {
    const dto = toBookDetails(row({ isbn: '978-0-00-000000-0' }));
    expect(dto.isbn).toBe('978-0-00-000000-0');
  });

  it('passes through null isbn', () => {
    const dto = toBookDetails(row({ isbn: null }));
    expect(dto.isbn).toBeNull();
  });

  it('emits availability as the correct slug', () => {
    const dto = toBookDetails(
      row({
        listings: [
          listing('YAKABOO', 10000, 'UNKNOWN'),
        ],
      }),
    );
    expect(dto.providers[0]!.availability).toBe('unknown');
  });

  it('emits lastSeenAt as ISO string', () => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    const dto = toBookDetails(
      row({ listings: [listing('YAKABOO', 10000, 'IN_STOCK', 'https://example.com', date)] }),
    );
    expect(dto.providers[0]!.lastSeenAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
