import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../app.js';

// ── In-memory fake Prisma ─────────────────────────────────────────────────────
// Implements only canonicalBook.findUnique({ where: { id } }),
// returning the matching book with its nested listings, or null.

interface FakeBook {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
}

interface FakeListing {
  canonicalBookId: string;
  provider: 'YAKABOO' | 'BOOK_CLUB';
  priceAmount: number;
  priceCurrency: 'UAH';
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  url: string;
  lastSeenAt: Date;
}

interface FindUniqueArgs {
  where?: { id?: string };
}

function makeFakePrisma(books: FakeBook[], listings: FakeListing[]): PrismaClient {
  const db = {
    canonicalBook: {
      findUnique: vi.fn(async (args: FindUniqueArgs) => {
        const id = args.where?.id;
        const found = books.find((b) => b.id === id);
        if (!found) return null;
        return {
          ...found,
          listings: listings.filter((l) => l.canonicalBookId === found.id),
        };
      }),
    },
  };
  return db as unknown as PrismaClient;
}

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

function book(id: string, title: string, author: string, isbn: string | null = null): FakeBook {
  return { id, title, author, isbn };
}

function listing(
  canonicalBookId: string,
  provider: FakeListing['provider'],
  priceAmount: number,
  availability: FakeListing['availability'] = 'IN_STOCK',
  url = 'https://example.com',
): FakeListing {
  return { canonicalBookId, provider, priceAmount, priceCurrency: 'UAH', availability, url, lastSeenAt: FIXED_DATE };
}

function appWith(books: FakeBook[], listingsArr: FakeListing[]) {
  return buildApp(makeFakePrisma(books, listingsArr));
}

// Valid UUIDs for test data
const BOOK_UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BOOK_UUID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MISSING_UUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const BOOKS = [
  book(BOOK_UUID_A, 'Кобзар', 'Тарас Шевченко', '978-0-00-000000-0'),
  book(BOOK_UUID_B, 'Лісова пісня', 'Леся Українка'),
];
const LISTINGS = [
  listing(BOOK_UUID_A, 'YAKABOO', 34900),
  listing(BOOK_UUID_A, 'BOOK_CLUB', 29900),
  listing(BOOK_UUID_B, 'YAKABOO', 15000, 'OUT_OF_STOCK'),
];

describe('GET /api/books/:id', () => {
  it('200: returns full DTO with sorted providers for an existing book', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: `/api/books/${BOOK_UUID_A}` });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      id: BOOK_UUID_A,
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: '978-0-00-000000-0',
      description: null,
      coverUrl: null,
      lowestPrice: { amount: 29900, currency: 'UAH' },
      offersCount: 2,
      providers: [
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
      ],
    });
  });

  it('200: book with only OOS listings → providers: [], lowestPrice: null, offersCount: 0', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: `/api/books/${BOOK_UUID_B}` });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.providers).toEqual([]);
    expect(body.lowestPrice).toBeNull();
    expect(body.offersCount).toBe(0);
    expect(body.id).toBe(BOOK_UUID_B);
    expect(body.description).toBeNull();
    expect(body.coverUrl).toBeNull();
  });

  it('200: OOS offers excluded, only IN_STOCK count toward offersCount and lowestPrice', async () => {
    const books = [book(BOOK_UUID_A, 'Test', 'Author')];
    const listings = [
      listing(BOOK_UUID_A, 'YAKABOO', 34900, 'IN_STOCK'),
      listing(BOOK_UUID_A, 'BOOK_CLUB', 15000, 'OUT_OF_STOCK'),
    ];
    const app = appWith(books, listings);
    const res = await app.inject({ method: 'GET', url: `/api/books/${BOOK_UUID_A}` });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.offersCount).toBe(1);
    expect(body.lowestPrice).toEqual({ amount: 34900, currency: 'UAH' });
    expect(body.providers).toHaveLength(1);
    expect(body.providers[0].provider).toBe('yakaboo');
  });

  it('400: invalid UUID in path → BAD_REQUEST', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: '/api/books/not-a-uuid' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
  });

  it('404: valid UUID but book does not exist → BOOK_NOT_FOUND', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: `/api/books/${MISSING_UUID}` });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('BOOK_NOT_FOUND');
  });
});
