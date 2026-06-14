import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../../app.js';

// ── Fake Prisma ────────────────────────────────────────────────────────────────
// Implements canonicalBook.findUnique keyed on id, returning the configured
// book row with nested listings and their priceHistory, or null.

interface FakePointRow {
  priceAmount: number;
  priceCurrency: 'UAH';
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  recordedAt: Date;
}

interface FakeListingRow {
  id: string;
  priceAmount: number;
  priceCurrency: 'UAH';
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  priceHistory: FakePointRow[];
}

interface FakeBookRow {
  id: string;
  listings: FakeListingRow[];
}

interface FindUniqueArgs {
  where?: { id?: string };
}

function makeFakePrisma(books: FakeBookRow[]): PrismaClient {
  const db = {
    canonicalBook: {
      findUnique: vi.fn(async (args: FindUniqueArgs) => {
        const id = args.where?.id;
        return books.find((b) => b.id === id) ?? null;
      }),
    },
  };
  return db as unknown as PrismaClient;
}

// ── Test constants ─────────────────────────────────────────────────────────────
const BOOK_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MISSING_UUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const LISTING_ID = 'listing-00-0000-0000-0000-000000000001';

// The route handler uses a real clock (`new Date()`); mock the system clock to a
// fixed instant so the time-window logic is deterministic (project testing rule).
const NOW = new Date('2026-06-14T08:00:00.000Z');
const D1 = new Date('2026-05-25T08:00:00.000Z'); // 20 days before NOW
const D2 = new Date('2026-06-04T08:00:00.000Z'); // 10 days before NOW

function point(priceAmount: number, recordedAt: Date): FakePointRow {
  return { priceAmount, priceCurrency: 'UAH', availability: 'IN_STOCK', recordedAt };
}

function bookWithHistory(history: FakePointRow[]): FakeBookRow {
  return {
    id: BOOK_UUID,
    listings: [
      {
        id: LISTING_ID,
        priceAmount: 30000,
        priceCurrency: 'UAH',
        availability: 'IN_STOCK',
        priceHistory: history,
      },
    ],
  };
}

function bookWithNoHistory(): FakeBookRow {
  return {
    id: BOOK_UUID,
    listings: [],
  };
}

describe('GET /api/books/:id/price-history', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('200: returns chart-ready DTO for a book with history', async () => {
    const app = buildApp(makeFakePrisma([bookWithHistory([point(30000, D1), point(28000, D2)])]));
    const res = await app.inject({
      method: 'GET',
      url: `/api/books/${BOOK_UUID}/price-history?period=90d`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.bookId).toBe(BOOK_UUID);
    expect(body.period).toBe('90d');
    expect(body.currency).toBe('UAH');
    expect(body.points).toHaveLength(2);
    expect(body.current.amount).toBe(28000);
    expect(body.lowest.amount).toBe(28000);
    expect(body.highest.amount).toBe(30000);
    expect(body.change).toEqual({ amount: -2000, percent: -7 });
  });

  it('200: defaults to period=90d when query param is omitted', async () => {
    const app = buildApp(makeFakePrisma([bookWithHistory([point(30000, D1)])]));
    const res = await app.inject({
      method: 'GET',
      url: `/api/books/${BOOK_UUID}/price-history`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().period).toBe('90d');
  });

  it('200: respects ?period=30d query param', async () => {
    const app = buildApp(makeFakePrisma([bookWithHistory([point(30000, D1)])]));
    const res = await app.inject({
      method: 'GET',
      url: `/api/books/${BOOK_UUID}/price-history?period=30d`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().period).toBe('30d');
  });

  it('200: returns empty-state DTO (null aggregates, points: []) for book with no history', async () => {
    const app = buildApp(makeFakePrisma([bookWithNoHistory()]));
    const res = await app.inject({
      method: 'GET',
      url: `/api/books/${BOOK_UUID}/price-history?period=90d`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.bookId).toBe(BOOK_UUID);
    expect(body.current).toBeNull();
    expect(body.lowest).toBeNull();
    expect(body.highest).toBeNull();
    expect(body.typicalRange).toBeNull();
    expect(body.change).toBeNull();
    expect(body.points).toEqual([]);
  });

  it('400 BAD_REQUEST: invalid UUID in path', async () => {
    const app = buildApp(makeFakePrisma([]));
    const res = await app.inject({
      method: 'GET',
      url: '/api/books/not-a-uuid/price-history',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
    expect(res.json().error.message).toBe('Invalid book id');
  });

  it('400 VALIDATION_ERROR: invalid period query param', async () => {
    const app = buildApp(makeFakePrisma([]));
    const res = await app.inject({
      method: 'GET',
      url: `/api/books/${BOOK_UUID}/price-history?period=7d`,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('404 BOOK_NOT_FOUND: valid UUID but book does not exist', async () => {
    const app = buildApp(makeFakePrisma([]));
    const res = await app.inject({
      method: 'GET',
      url: `/api/books/${MISSING_UUID}/price-history`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('BOOK_NOT_FOUND');
  });

  it('200: period=all returns DTO with all history points', async () => {
    const app = buildApp(
      makeFakePrisma([bookWithHistory([point(35000, D1), point(30000, D2)])]),
    );
    const res = await app.inject({
      method: 'GET',
      url: `/api/books/${BOOK_UUID}/price-history?period=all`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.period).toBe('all');
    expect(body.points).toHaveLength(2);
  });

  it('200: period=1y is accepted and returns DTO', async () => {
    const app = buildApp(makeFakePrisma([bookWithHistory([point(30000, D1)])]));
    const res = await app.inject({
      method: 'GET',
      url: `/api/books/${BOOK_UUID}/price-history?period=1y`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().period).toBe('1y');
  });
});
