import { describe, it, expect } from 'vitest';
import { toWishlistResponse } from '../mapper.js';
import type { WishlistRow, WishlistListingRow } from '../repository.js';

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

const BOOK_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ITEM_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function makeRow(overrides: {
  id?: string;
  title?: string;
  author?: string;
  isbn?: string | null;
  listings?: WishlistListingRow[];
  createdAt?: Date;
}): WishlistRow {
  return {
    createdAt: overrides.createdAt ?? FIXED_DATE,
    canonicalBook: {
      id: overrides.id ?? BOOK_UUID,
      title: overrides.title ?? 'Кобзар',
      author: overrides.author ?? 'Тарас Шевченко',
      isbn: overrides.isbn ?? null,
      listings: overrides.listings ?? [],
    },
  };
}

function listing(
  provider: WishlistListingRow['provider'],
  priceAmount: number,
  availability: WishlistListingRow['availability'] = 'IN_STOCK',
  url = 'https://example.com',
  lastSeenAt = FIXED_DATE,
): WishlistListingRow {
  return { provider, priceAmount, priceCurrency: 'UAH', availability, url, lastSeenAt };
}

describe('toWishlistResponse', () => {
  it('maps a rich item correctly', () => {
    const rows = [
      makeRow({
        listings: [listing('YAKABOO', 34900), listing('BOOK_CLUB', 29900)],
      }),
    ];
    const dto = toWishlistResponse(rows);

    expect(dto.items).toHaveLength(1);
    const item = dto.items[0]!;
    expect(item.book.id).toBe(BOOK_UUID);
    expect(item.book.title).toBe('Кобзар');
    expect(item.book.author).toBe('Тарас Шевченко');
    expect(item.book.isbn).toBeNull();
    expect(item.book.coverUrl).toBeNull();
    expect(item.book.lowestPrice).toEqual({ amount: 29900, currency: 'UAH' });
    expect(item.book.offersCount).toBe(2);
    expect(item.book.providers).toEqual([
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
    expect(item.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('excludes OUT_OF_STOCK listings from providers/lowestPrice/offersCount', () => {
    const rows = [
      makeRow({
        listings: [
          listing('YAKABOO', 34900, 'IN_STOCK'),
          listing('BOOK_CLUB', 29900, 'OUT_OF_STOCK'),
        ],
      }),
    ];
    const dto = toWishlistResponse(rows);
    const item = dto.items[0]!;

    expect(item.book.offersCount).toBe(1);
    expect(item.book.lowestPrice).toEqual({ amount: 34900, currency: 'UAH' });
    expect(item.book.providers).toHaveLength(1);
    expect(item.book.providers[0]!.provider).toBe('yakaboo');
  });

  it('keeps book visible when ALL providers are OUT_OF_STOCK (providers: [], lowestPrice: null, offersCount: 0)', () => {
    const rows = [
      makeRow({
        listings: [
          listing('YAKABOO', 34900, 'OUT_OF_STOCK'),
          listing('BOOK_CLUB', 29900, 'OUT_OF_STOCK'),
        ],
      }),
    ];
    const dto = toWishlistResponse(rows);

    expect(dto.items).toHaveLength(1);
    const item = dto.items[0]!;
    expect(item.book.providers).toEqual([]);
    expect(item.book.lowestPrice).toBeNull();
    expect(item.book.offersCount).toBe(0);
    expect(item.book.id).toBe(BOOK_UUID);
  });

  it('returns lowestPrice null when no visible providers', () => {
    const rows = [makeRow({ listings: [] })];
    const dto = toWishlistResponse(rows);

    expect(dto.items[0]!.book.lowestPrice).toBeNull();
  });

  it('sorts providers ascending by price', () => {
    const rows = [
      makeRow({
        listings: [listing('YAKABOO', 50000), listing('BOOK_CLUB', 10000)],
      }),
    ];
    const dto = toWishlistResponse(rows);
    const amounts = dto.items[0]!.book.providers.map((p) => p.price.amount);

    expect(amounts).toEqual([10000, 50000]);
  });

  it('UNKNOWN availability is treated as visible (included in offersCount)', () => {
    const rows = [
      makeRow({
        listings: [listing('YAKABOO', 34900, 'UNKNOWN')],
      }),
    ];
    const dto = toWishlistResponse(rows);

    expect(dto.items[0]!.book.offersCount).toBe(1);
    expect(dto.items[0]!.book.providers[0]!.availability).toBe('unknown');
  });

  it('emits createdAt as ISO string', () => {
    const rows = [makeRow({ createdAt: new Date('2026-03-15T12:00:00.000Z') })];
    const dto = toWishlistResponse(rows);

    expect(dto.items[0]!.createdAt).toBe('2026-03-15T12:00:00.000Z');
  });

  it('passes through isbn when present', () => {
    const rows = [makeRow({ isbn: '978-0-00-000000-0' })];
    const dto = toWishlistResponse(rows);

    expect(dto.items[0]!.book.isbn).toBe('978-0-00-000000-0');
  });

  it('maps coverUrl as null always', () => {
    const rows = [makeRow({ listings: [listing('YAKABOO', 10000)] })];
    const dto = toWishlistResponse(rows);

    expect(dto.items[0]!.book.coverUrl).toBeNull();
  });

  it('maps provider enums to slugs correctly', () => {
    const rows = [
      makeRow({
        listings: [
          listing('YAKABOO', 10000, 'IN_STOCK'),
          listing('BOOK_CLUB', 20000, 'UNKNOWN'),
        ],
      }),
    ];
    const dto = toWishlistResponse(rows);
    const providers = dto.items[0]!.book.providers;

    expect(providers[0]!.provider).toBe('yakaboo');
    expect(providers[1]!.provider).toBe('book-club');
  });

  it('returns empty items array when no rows', () => {
    const dto = toWishlistResponse([]);

    expect(dto.items).toEqual([]);
  });

  it('maps multiple items preserving order', () => {
    const newerDate = new Date('2026-02-01T00:00:00.000Z');
    const rows = [
      makeRow({ id: BOOK_UUID, createdAt: newerDate }),
      makeRow({ id: ITEM_UUID, createdAt: FIXED_DATE }),
    ];
    const dto = toWishlistResponse(rows);

    expect(dto.items).toHaveLength(2);
    expect(dto.items[0]!.book.id).toBe(BOOK_UUID);
    expect(dto.items[1]!.book.id).toBe(ITEM_UUID);
  });
});
