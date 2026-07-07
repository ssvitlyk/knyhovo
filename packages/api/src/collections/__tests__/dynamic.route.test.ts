import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { clearCache } from '../cache.js';
import { emptyDb, makeFakePrisma, book, listing, collection } from './fake-prisma.js';
import type { FakeDb } from './fake-prisma.js';

const FIXED_DATE = new Date('2026-07-03T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number): Date => new Date(FIXED_DATE.getTime() - n * DAY_MS);

async function buildTestApp(db: FakeDb) {
  const prisma = makeFakePrisma(db);
  return buildApp(prisma);
}

describe('GET /api/collections/novynky/books', () => {
  beforeEach(() => clearCache());

  it('includes only books added within the last 30 days, newest first, when the window already has >= 24', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'novynky', 'DYNAMIC'));
    const ids: string[] = [];
    for (let i = 0; i < 24; i += 1) {
      const id = `window${i}`;
      ids.push(id);
      // Spread across the window, distinct createdAt so newest-first order is unambiguous.
      db.books.push(book(id, `Window ${i}`, 'A', { createdAt: daysAgo(i), listings: [listing(1000)] }));
    }
    db.books.push(book('old', 'Old', 'C', { createdAt: daysAgo(200), listings: [listing(1000)] }));

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/novynky/books' });
    const resultIds = res.json().books.map((b: { id: string }) => b.id);
    // Window is already >= NOVYNKY_MIN_POOL -> no fallback, old book excluded.
    expect(resultIds).toEqual(ids); // already newest-first (daysAgo(0)..daysAgo(23))
    expect(resultIds).not.toContain('old');
  });

  it('falls back to the newest older priced books when the 30-day window is thin (< 24)', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'novynky', 'DYNAMIC'));
    db.books.push(
      book('recent1', 'Recent1', 'A', { createdAt: daysAgo(10), listings: [listing(1000)] }),
      book('recent2', 'Recent2', 'B', { createdAt: daysAgo(20), listings: [listing(1000)] }),
      book('older1', 'Older1', 'C', { createdAt: daysAgo(40), listings: [listing(1000)] }),
      book('older2', 'Older2', 'D', { createdAt: daysAgo(60), listings: [listing(1000)] }),
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/novynky/books' });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    // Window (recent1, recent2) comes first, newest first; fallback fills with
    // the newest remaining priced books, also newest first.
    expect(ids).toEqual(['recent1', 'recent2', 'older1', 'older2']);
  });

  it('returns an empty pool when there are no priced books at all (nothing to fall back to)', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'novynky', 'DYNAMIC'));
    db.books.push(book('old', 'Old', 'A', { createdAt: daysAgo(200), listings: [] }));

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/novynky/books' });
    expect(res.json().total).toBe(0);
  });

  it('caps the pool to a share of the catalog when a bulk backfill puts everything inside the 30-day window', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'novynky', 'DYNAMIC'));
    // Simulates a mass ingestion backfill: all 100 catalog books "created"
    // (scraped) within the window, which would otherwise make novynky ==
    // the whole catalog. Cap = NOVYNKY_MAX_SHARE (0.25) * 100 = 25.
    for (let i = 0; i < 100; i += 1) {
      db.books.push(book(`bulk${i}`, `Bulk ${i}`, 'A', { createdAt: daysAgo(i % 30), listings: [listing(1000)] }));
    }

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/novynky/books' });
    expect(res.json().total).toBe(25);
  });

  it('the cap never drops below NOVYNKY_MIN_POOL on a small catalog, even if that exceeds the 25% share', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'novynky', 'DYNAMIC'));
    // 30 books, all in-window: 25% of 30 is 7 (< NOVYNKY_MIN_POOL), so the
    // MIN_POOL floor wins — capped to 24, not down to 7.
    for (let i = 0; i < 30; i += 1) {
      db.books.push(book(`b${i}`, `B ${i}`, 'A', { createdAt: daysAgo(i), listings: [listing(1000)] }));
    }

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/novynky/books' });
    expect(res.json().total).toBe(24);
  });
});

describe('GET /api/collections/znyzhky/books', () => {
  beforeEach(() => clearCache());

  it('includes only books with a real historical drop, ordered by discount desc', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'znyzhky', 'DYNAMIC'));
    db.books.push(
      book('no-drop', 'NoDrop', 'A', { listings: [listing(8000)] }),
      book('small-drop', 'SmallDrop', 'B', {
        listings: [listing(9000, { priceHistory: [{ priceAmount: 10000, priceCurrency: 'UAH', recordedAt: daysAgo(14) }] })],
      }),
      book('big-drop', 'BigDrop', 'C', {
        listings: [listing(5000, { priceHistory: [{ priceAmount: 10000, priceCurrency: 'UAH', recordedAt: daysAgo(14) }] })],
      }),
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/znyzhky/books' });
    const body = res.json();
    expect(body.books.map((b: { id: string }) => b.id)).toEqual(['big-drop', 'small-drop']);
    expect(body.books[0].discountPercent).toBe(50);
    expect(body.books[1].discountPercent).toBe(10);
  });
});

describe('GET /api/collections/ponyzhena-tsina/books', () => {
  beforeEach(() => clearCache());

  it('includes only books whose price fell vs. ~7 days ago, ordered by drop size desc', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'ponyzhena-tsina', 'DYNAMIC'));
    db.books.push(
      // No point >= 7 days old -> excluded.
      book('too-recent', 'TooRecent', 'A', {
        listings: [listing(9000, { priceHistory: [{ priceAmount: 12000, priceCurrency: 'UAH', recordedAt: daysAgo(2) }] })],
      }),
      // 7-day-old price higher than current -> included.
      book('small-fall', 'SmallFall', 'B', {
        listings: [listing(9000, { priceHistory: [{ priceAmount: 9500, priceCurrency: 'UAH', recordedAt: daysAgo(8) }] })],
      }),
      book('big-fall', 'BigFall', 'C', {
        listings: [listing(5000, { priceHistory: [{ priceAmount: 9000, priceCurrency: 'UAH', recordedAt: daysAgo(9) }] })],
      }),
      // Price didn't fall -> excluded.
      book('no-fall', 'NoFall', 'D', {
        listings: [listing(9000, { priceHistory: [{ priceAmount: 9000, priceCurrency: 'UAH', recordedAt: daysAgo(8) }] })],
      }),
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/ponyzhena-tsina/books' });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    expect(ids).toEqual(['big-fall', 'small-fall']);
  });
});

describe('GET /api/collections/najbilsh-bazhani/books', () => {
  beforeEach(() => clearCache());

  it('includes only wishlisted (>0) books, ordered by wishlistCount desc', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'najbilsh-bazhani', 'DYNAMIC'));
    db.books.push(
      book('none', 'None', 'A', { listings: [listing(1000)] }),
      book('low', 'Low', 'B', { listings: [listing(1000)] }),
      book('high', 'High', 'C', { listings: [listing(1000)] }),
    );
    db.wishlistItems.push(
      { userId: 'u1', canonicalBookId: 'low' },
      { userId: 'u1', canonicalBookId: 'high' },
      { userId: 'u2', canonicalBookId: 'high' },
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/najbilsh-bazhani/books' });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    expect(ids).toEqual(['high', 'low']);
  });
});

describe('GET /api/collections/rekordno-nyzka-tsina/books', () => {
  beforeEach(() => clearCache());

  it('includes only books whose current price equals their historical minimum', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'rekordno-nyzka-tsina', 'DYNAMIC'));
    db.books.push(
      // Current price 5000 is the lowest ever recorded, over 2 real observations -> included.
      book('at-low', 'AtLow', 'A', {
        listings: [
          listing(5000, {
            priceHistory: [
              { priceAmount: 8000, priceCurrency: 'UAH', recordedAt: daysAgo(30) },
              { priceAmount: 7000, priceCurrency: 'UAH', recordedAt: daysAgo(15) },
            ],
          }),
        ],
      }),
      // Current price 6000 is higher than a past low of 4000 -> excluded.
      book('not-low', 'NotLow', 'B', {
        listings: [
          listing(6000, {
            priceHistory: [
              { priceAmount: 4000, priceCurrency: 'UAH', recordedAt: daysAgo(30) },
              { priceAmount: 4500, priceCurrency: 'UAH', recordedAt: daysAgo(15) },
            ],
          }),
        ],
      }),
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/rekordno-nyzka-tsina/books' });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    expect(ids).toEqual(['at-low']);
  });

  it('excludes a book scraped only once — a single price_history point matching the current price is not a real record', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'rekordno-nyzka-tsina', 'DYNAMIC'));
    db.books.push(
      book('scraped-once', 'ScrapedOnce', 'A', {
        listings: [listing(5000, { priceHistory: [{ priceAmount: 5000, priceCurrency: 'UAH', recordedAt: daysAgo(1) }] })],
      }),
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/rekordno-nyzka-tsina/books' });
    expect(res.json().total).toBe(0);
  });
});

describe('unpriced books are excluded from every dynamic feed', () => {
  beforeEach(() => clearCache());

  const DYNAMIC_SLUGS = ['novynky', 'znyzhky', 'ponyzhena-tsina', 'najbilsh-bazhani', 'rekordno-nyzka-tsina', 'populyarne-zaraz'];

  it.each(DYNAMIC_SLUGS)('%s excludes a book with zero priced listings, even if wishlisted', async (slug) => {
    const db = emptyDb();
    db.collections.push(collection('c1', slug, 'DYNAMIC'));
    db.books.push(
      book('unpriced', 'Unpriced', 'A', { createdAt: daysAgo(1), listings: [] }),
      book('priced', 'Priced', 'B', {
        createdAt: daysAgo(1),
        listings: [
          listing(5000, {
            priceHistory: [
              { priceAmount: 9000, priceCurrency: 'UAH', recordedAt: daysAgo(14) },
              { priceAmount: 4000, priceCurrency: 'UAH', recordedAt: daysAgo(9) },
            ],
          }),
        ],
      }),
    );
    db.wishlistItems.push({ userId: 'u1', canonicalBookId: 'unpriced' }, { userId: 'u1', canonicalBookId: 'priced' });

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: `/api/collections/${slug}/books` });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    expect(ids).not.toContain('unpriced');
  });
});

describe('GET /api/collections/populyarne-zaraz/books', () => {
  beforeEach(() => clearCache());

  it('orders the full pool by wishlistCount desc (proxy for popularity)', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'populyarne-zaraz', 'DYNAMIC'));
    db.books.push(
      book('low', 'Low', 'A', { listings: [listing(1000)] }),
      book('high', 'High', 'B', { listings: [listing(1000)] }),
    );
    db.wishlistItems.push(
      { userId: 'u1', canonicalBookId: 'high' },
      { userId: 'u2', canonicalBookId: 'high' },
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/populyarne-zaraz/books' });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    expect(ids).toEqual(['high', 'low']);
  });

  it('composite tiebreak: equal wishlistCount -> in-stock first, then newer catalogAddedAt first', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'populyarne-zaraz', 'DYNAMIC'));
    db.books.push(
      // All three have the same wishlistCount (0) -> tiebreak kicks in.
      book('oos-newer', 'OosNewer', 'A', {
        createdAt: daysAgo(1),
        listings: [listing(1000, { availability: 'OUT_OF_STOCK' })],
      }),
      book('in-older', 'InOlder', 'B', { createdAt: daysAgo(10), listings: [listing(1000)] }),
      book('in-newer', 'InNewer', 'C', { createdAt: daysAgo(2), listings: [listing(1000)] }),
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/populyarne-zaraz/books' });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    // In-stock books first (newest first among them), out-of-stock last.
    expect(ids).toEqual(['in-newer', 'in-older', 'oos-newer']);
  });
});
