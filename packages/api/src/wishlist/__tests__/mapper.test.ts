import { describe, it, expect } from 'vitest';
import { toWishlistResponse } from '../mapper.js';
import type { WishlistRow, WishlistListingRow } from '../repository.js';

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

const BOOK_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ITEM_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

import type { WishlistAlertRow } from '../repository.js';

function makeRow(overrides: {
  id?: string;
  title?: string;
  author?: string;
  isbn?: string | null;
  listings?: WishlistListingRow[];
  createdAt?: Date;
  alert?: WishlistAlertRow | null;
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
    alert: overrides.alert ?? null,
  };
}

function listing(
  provider: WishlistListingRow['provider'],
  priceAmount: number,
  availability: WishlistListingRow['availability'] = 'IN_STOCK',
  url = 'https://example.com',
  lastSeenAt = FIXED_DATE,
  coverUrl: string | null = null,
): WishlistListingRow {
  return { provider, priceAmount, priceCurrency: 'UAH', availability, url, lastSeenAt, coverUrl };
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

  it('returns null coverUrl when no listing has a cover', () => {
    const rows = [makeRow({ listings: [listing('YAKABOO', 10000)] })];
    const dto = toWishlistResponse(rows);

    expect(dto.items[0]!.book.coverUrl).toBeNull();
  });

  it('returns coverUrl when a listing has one', () => {
    const rows = [
      makeRow({
        listings: [
          listing('YAKABOO', 10000, 'IN_STOCK', 'https://example.com', FIXED_DATE, 'https://cdn.yakaboo.ua/cover.jpg'),
        ],
      }),
    ];
    const dto = toWishlistResponse(rows);

    expect(dto.items[0]!.book.coverUrl).toBe('https://cdn.yakaboo.ua/cover.jpg');
  });

  it('provider priority — yakaboo cover wins over vivat cover regardless of price', () => {
    const rows = [
      makeRow({
        listings: [
          // YAKABOO is more expensive but has higher priority
          listing('YAKABOO', 50000, 'IN_STOCK', 'https://example.com', FIXED_DATE, 'https://cdn.yakaboo.ua/cover.jpg'),
          // VIVAT is cheaper but lower priority
          listing('VIVAT', 10000, 'IN_STOCK', 'https://vivat.com', FIXED_DATE, 'https://cdn.vivat.com/cover.jpg'),
        ],
      }),
    ];
    const dto = toWishlistResponse(rows);

    expect(dto.items[0]!.book.coverUrl).toBe('https://cdn.yakaboo.ua/cover.jpg');
  });

  it('out-of-stock-only book still yields its cover', () => {
    const rows = [
      makeRow({
        listings: [
          listing('YAKABOO', 34900, 'OUT_OF_STOCK', 'https://example.com', FIXED_DATE, 'https://cdn.yakaboo.ua/cover.jpg'),
        ],
      }),
    ];
    const dto = toWishlistResponse(rows);
    const item = dto.items[0]!;

    // Providers empty and lowestPrice null because all listings are OUT_OF_STOCK
    expect(item.book.providers).toEqual([]);
    expect(item.book.lowestPrice).toBeNull();
    // But the cover is still selected from all listings
    expect(item.book.coverUrl).toBe('https://cdn.yakaboo.ua/cover.jpg');
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

// ── Alert mapping ─────────────────────────────────────────────────────────────

describe('toWishlistResponse — alert mapping', () => {
  const BASE_ALERT: WishlistAlertRow = {
    status: 'ACTIVE',
    intent: 'ANY_DROP',
    targetPriceAmount: 20000,
    targetPriceCurrency: 'UAH',
    pausedAt: null,
  };

  it('alert is null when no alert row', () => {
    const rows = [makeRow({ alert: null })];
    const dto = toWishlistResponse(rows);
    expect(dto.items[0]!.alert).toBeNull();
  });

  it('alert is null when alert field is undefined (legacy row)', () => {
    // Simulate a row that predates the alert column (no alert key at all)
    const row = makeRow({});
    delete (row as { alert?: WishlistAlertRow | null }).alert;
    const dto = toWishlistResponse([row]);
    expect(dto.items[0]!.alert).toBeNull();
  });

  it('derives status=triggered when lowestPrice ≤ targetPriceAmount', () => {
    const rows = [
      makeRow({
        listings: [listing('YAKABOO', 15000)],   // lowestPrice = 15000 ≤ target 20000
        alert: { ...BASE_ALERT, targetPriceAmount: 20000 },
      }),
    ];
    const dto = toWishlistResponse(rows);
    expect(dto.items[0]!.alert?.status).toBe('triggered');
  });

  it('derives status=unavailable when offersCount = 0', () => {
    const rows = [
      makeRow({
        listings: [],   // no available offers → offersCount = 0
        alert: BASE_ALERT,
      }),
    ];
    const dto = toWishlistResponse(rows);
    expect(dto.items[0]!.alert?.status).toBe('unavailable');
  });

  it('derives status=active when lowestPrice > targetPriceAmount', () => {
    const rows = [
      makeRow({
        listings: [listing('YAKABOO', 30000)],   // lowestPrice = 30000 > target 20000
        alert: BASE_ALERT,
      }),
    ];
    const dto = toWishlistResponse(rows);
    expect(dto.items[0]!.alert?.status).toBe('active');
  });

  it('derives status=paused regardless of price when persisted status is PAUSED', () => {
    const rows = [
      makeRow({
        listings: [listing('YAKABOO', 5000)],   // would be triggered if not PAUSED
        alert: { ...BASE_ALERT, status: 'PAUSED', targetPriceAmount: 20000 },
      }),
    ];
    const dto = toWishlistResponse(rows);
    expect(dto.items[0]!.alert?.status).toBe('paused');
  });

  it('maps intent enum to slug correctly — ANY_DROP → any-drop', () => {
    const rows = [makeRow({ alert: { ...BASE_ALERT, intent: 'ANY_DROP' } })];
    const dto = toWishlistResponse(rows);
    expect(dto.items[0]!.alert?.intent).toBe('any-drop');
  });

  it('maps intent enum to slug correctly — BELOW_CURRENT → below-current', () => {
    const rows = [makeRow({ alert: { ...BASE_ALERT, intent: 'BELOW_CURRENT' } })];
    const dto = toWishlistResponse(rows);
    expect(dto.items[0]!.alert?.intent).toBe('below-current');
  });

  it('maps intent enum to slug correctly — FAVOURABLE_PRICE → favourable-price', () => {
    const rows = [makeRow({ alert: { ...BASE_ALERT, intent: 'FAVOURABLE_PRICE' } })];
    const dto = toWishlistResponse(rows);
    expect(dto.items[0]!.alert?.intent).toBe('favourable-price');
  });

  it('maps intent enum to slug correctly — CUSTOM_PRICE → custom-price', () => {
    const rows = [makeRow({ alert: { ...BASE_ALERT, intent: 'CUSTOM_PRICE' } })];
    const dto = toWishlistResponse(rows);
    expect(dto.items[0]!.alert?.intent).toBe('custom-price');
  });

  it('maps targetPrice correctly', () => {
    const rows = [makeRow({ alert: { ...BASE_ALERT, targetPriceAmount: 34900 } })];
    const dto = toWishlistResponse(rows);
    expect(dto.items[0]!.alert?.targetPrice).toEqual({ amount: 34900, currency: 'UAH' });
  });

  it('maps pausedAt as ISO string when set', () => {
    const pausedAt = new Date('2026-05-01T12:00:00.000Z');
    const rows = [makeRow({ alert: { ...BASE_ALERT, status: 'PAUSED', pausedAt } })];
    const dto = toWishlistResponse(rows);
    expect(dto.items[0]!.alert?.pausedAt).toBe('2026-05-01T12:00:00.000Z');
  });

  it('maps pausedAt as null when not set', () => {
    const rows = [makeRow({ alert: { ...BASE_ALERT, pausedAt: null } })];
    const dto = toWishlistResponse(rows);
    expect(dto.items[0]!.alert?.pausedAt).toBeNull();
  });
});
