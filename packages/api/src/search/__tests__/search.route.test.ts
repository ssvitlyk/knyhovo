import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../app.js';

// ── In-memory fake Prisma ─────────────────────────────────────────────────────
// Implements only canonicalBook.findMany({ where: { OR: [...] }, include }),
// honouring case-insensitive substring matching on title/author — the single
// query the search repository issues.

interface FakeBook {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  createdAt: Date;
}

interface FakeListing {
  id: string;
  canonicalBookId: string;
  provider: 'YAKABOO' | 'BOOK_CLUB';
  priceAmount: number;
  priceCurrency: 'UAH';
}

interface FindManyArgs {
  where?: { OR?: { title?: { contains?: string }; author?: { contains?: string } }[] };
}

function makeFakePrisma(books: FakeBook[], listings: FakeListing[]): PrismaClient {
  const db = {
    canonicalBook: {
      findMany: vi.fn(async (args: FindManyArgs) => {
        const or = args.where?.OR ?? [];
        const needle = (or[0]?.title?.contains ?? '').toLowerCase();
        return books
          .filter(
            (b) =>
              b.title.toLowerCase().includes(needle) ||
              b.author.toLowerCase().includes(needle),
          )
          .map((b) => ({
            ...b,
            listings: listings.filter((l) => l.canonicalBookId === b.id),
          }));
      }),
    },
  };
  return db as unknown as PrismaClient;
}

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

function book(id: string, title: string, author: string): FakeBook {
  return { id, title, author, isbn: null, createdAt: FIXED_DATE };
}

function listing(
  id: string,
  canonicalBookId: string,
  provider: FakeListing['provider'],
  priceAmount: number,
): FakeListing {
  return { id, canonicalBookId, provider, priceAmount, priceCurrency: 'UAH' };
}

// Shared dataset:
// - 'a' Кобзар: two priced offers (book-club cheaper than yakaboo)
// - 'b' Лісова пісня: one offer
// - 'c' Тіні: NO offers (must be excluded)
const BOOKS = [
  book('a', 'Кобзар', 'Тарас Шевченко'),
  book('b', 'Лісова пісня', 'Леся Українка'),
  book('c', 'Тіні забутих предків', 'Михайло Коцюбинський'),
];
const LISTINGS = [
  listing('l1', 'a', 'YAKABOO', 34900),
  listing('l2', 'a', 'BOOK_CLUB', 29900),
  listing('l3', 'b', 'YAKABOO', 15000),
];

function appWith(books: FakeBook[], listings: FakeListing[]) {
  return buildApp(makeFakePrisma(books, listings));
}

describe('GET /api/search', () => {
  it('returns a well-formed result for a successful search', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: '/api/search', query: { q: 'Кобзар' } });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      items: [
        {
          id: 'a',
          title: 'Кобзар',
          author: 'Тарас Шевченко',
          lowestPrice: { amount: 29900, currency: 'UAH' },
          offersCount: 2,
          providers: [
            { provider: 'book-club', price: { amount: 29900, currency: 'UAH' } },
            { provider: 'yakaboo', price: { amount: 34900, currency: 'UAH' } },
          ],
        },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    });
  });

  it('returns 200 for a percent-encoded Cyrillic query (q=Кобзар)', async () => {
    const app = appWith(BOOKS, LISTINGS);
    // Encoded exactly as a correct client (e.g. the web app's encodeURIComponent) sends it.
    const res = await app.inject({
      method: 'GET',
      url: '/api/search?q=%D0%9A%D0%BE%D0%B1%D0%B7%D0%B0%D1%80',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe('Кобзар');
    expect(body).toMatchObject({ page: 1, pageSize: 20 });
  });

  it('matches on title', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: '/api/search', query: { q: 'пісня' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('b');
  });

  it('matches on author', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: '/api/search', query: { q: 'Українка' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('b');
  });

  it('is case-insensitive', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: '/api/search', query: { q: 'кобзар' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('a');
  });

  it('trims surrounding whitespace from the query', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: '/api/search', query: { q: '  Кобзар  ' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(1);
  });

  it('excludes books with no priced listings', async () => {
    const app = appWith(BOOKS, LISTINGS);
    // 'Тіні' (book 'c') matches but has zero listings → must be excluded.
    const res = await app.inject({ method: 'GET', url: '/api/search', query: { q: 'Тіні' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(0);
    expect(body.totalItems).toBe(0);
  });

  it('sorts results by ascending lowest price', async () => {
    const books = [
      book('x', 'Sort X', 'A'),
      book('y', 'Sort Y', 'B'),
      book('z', 'Sort Z', 'C'),
    ];
    const listings = [
      listing('lx', 'x', 'YAKABOO', 50000),
      listing('ly', 'y', 'YAKABOO', 10000),
      listing('lz', 'z', 'YAKABOO', 30000),
    ];
    const app = appWith(books, listings);
    const res = await app.inject({ method: 'GET', url: '/api/search', query: { q: 'Sort' } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(['y', 'z', 'x']);
  });

  it('sorts providers within an item by ascending price', async () => {
    const books = [book('m', 'Multi', 'Author')];
    const listings = [
      listing('m1', 'm', 'YAKABOO', 45000),
      listing('m2', 'm', 'BOOK_CLUB', 12000),
    ];
    const app = appWith(books, listings);
    const res = await app.inject({ method: 'GET', url: '/api/search', query: { q: 'Multi' } });
    const body = res.json();
    expect(body.items[0].providers.map((p: { provider: string }) => p.provider)).toEqual([
      'book-club',
      'yakaboo',
    ]);
    expect(body.items[0].lowestPrice.amount).toBe(12000);
  });

  it('paginates results', async () => {
    const books = [
      book('r1', 'Роман 1', 'Author'),
      book('r2', 'Роман 2', 'Author'),
      book('r3', 'Роман 3', 'Author'),
    ];
    const listings = [
      listing('p1', 'r1', 'YAKABOO', 100),
      listing('p2', 'r2', 'YAKABOO', 200),
      listing('p3', 'r3', 'YAKABOO', 300),
    ];
    const app = appWith(books, listings);

    const page1 = await app.inject({
      method: 'GET',
      url: '/api/search',
      query: { q: 'Роман', page: '1', pageSize: '2' },
    });
    const b1 = page1.json();
    expect(b1.items.map((i: { id: string }) => i.id)).toEqual(['r1', 'r2']);
    expect(b1).toMatchObject({ page: 1, pageSize: 2, totalItems: 3, totalPages: 2 });

    const page2 = await app.inject({
      method: 'GET',
      url: '/api/search',
      query: { q: 'Роман', page: '2', pageSize: '2' },
    });
    const b2 = page2.json();
    expect(b2.items.map((i: { id: string }) => i.id)).toEqual(['r3']);
    expect(b2).toMatchObject({ page: 2, pageSize: 2, totalItems: 3, totalPages: 2 });
  });

  it('uses default pagination (page=1, pageSize=20)', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: '/api/search', query: { q: 'Кобзар' } });
    const body = res.json();
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
  });

  // ── 400 cases ────────────────────────────────────────────────────────────
  it('returns 400 when q is missing', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: '/api/search' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when q is empty', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: '/api/search', query: { q: '' } });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when q is whitespace only', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({ method: 'GET', url: '/api/search', query: { q: '   ' } });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when page < 1', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({
      method: 'GET',
      url: '/api/search',
      query: { q: 'Кобзар', page: '0' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when pageSize > 50', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({
      method: 'GET',
      url: '/api/search',
      query: { q: 'Кобзар', pageSize: '51' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when pageSize < 1', async () => {
    const app = appWith(BOOKS, LISTINGS);
    const res = await app.inject({
      method: 'GET',
      url: '/api/search',
      query: { q: 'Кобзар', pageSize: '0' },
    });
    expect(res.statusCode).toBe(400);
  });
});
