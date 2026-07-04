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

  it('includes only books added within the last 90 days, newest first, with no fallback', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'novynky', 'DYNAMIC'));
    db.books.push(
      book('recent1', 'Recent1', 'A', { createdAt: daysAgo(10), listings: [listing(1000)] }),
      book('recent2', 'Recent2', 'B', { createdAt: daysAgo(50), listings: [listing(1000)] }),
      book('old', 'Old', 'C', { createdAt: daysAgo(200), listings: [listing(1000)] }),
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/novynky/books' });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    expect(ids).toEqual(['recent1', 'recent2']);
  });

  it('returns an empty pool (no fallback) when nothing is within the 90-day window', async () => {
    const db = emptyDb();
    db.collections.push(collection('c1', 'novynky', 'DYNAMIC'));
    db.books.push(book('old', 'Old', 'A', { createdAt: daysAgo(200), listings: [listing(1000)] }));

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/novynky/books' });
    expect(res.json().total).toBe(0);
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
    expect(body.books[0].discountPct).toBe(50);
    expect(body.books[1].discountPct).toBe(10);
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
      // Current price 5000 is the lowest ever recorded -> included.
      book('at-low', 'AtLow', 'A', {
        listings: [listing(5000, { priceHistory: [{ priceAmount: 8000, priceCurrency: 'UAH', recordedAt: daysAgo(30) }] })],
      }),
      // Current price 6000 is higher than a past low of 4000 -> excluded.
      book('not-low', 'NotLow', 'B', {
        listings: [listing(6000, { priceHistory: [{ priceAmount: 4000, priceCurrency: 'UAH', recordedAt: daysAgo(30) }] })],
      }),
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/rekordno-nyzka-tsina/books' });
    const ids = res.json().books.map((b: { id: string }) => b.id);
    expect(ids).toEqual(['at-low']);
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
});
