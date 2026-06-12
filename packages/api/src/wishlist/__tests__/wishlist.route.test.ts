import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../app.js';
import type { AuthDeps } from '../../auth/service.js';
import type { AuthConfig } from '../../auth/config.js';
import type { Mailer } from '../../auth/mailer.js';
import { hashToken } from '../../auth/crypto.js';

// ── Fixed test constants ──────────────────────────────────────────────────────

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');
const FIXED_TOKEN = 'test-session-token-fixed-32bytes____';
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

const USER_ID_A = 'user-a-id-111111111111111111111111';
const USER_ID_B = 'user-b-id-222222222222222222222222';

const BOOK_UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BOOK_UUID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MISSING_UUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const TEST_CONFIG: AuthConfig = {
  secret: 'test-secret',
  cookieSecure: false,
  codeTtlMs: 10 * 60_000,
  sessionTtlMs: SESSION_TTL_MS,
  rateWindowMs: 15 * 60_000,
  maxCodesPerWindow: 5,
  maxVerifyAttempts: 5,
};

// ── Fake Mailer ───────────────────────────────────────────────────────────────

class FakeMailer implements Mailer {
  async sendLoginCode(email: string, code: string): Promise<void> {
    // no-op fake — suppress unused-var warnings by satisfying the Mailer interface
    void email;
    void code;
  }
}

// ── Fake Prisma state ─────────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

interface UserRow {
  id: string;
  email: string;
  createdAt: Date;
}

interface WishlistItemRow {
  userId: string;
  canonicalBookId: string;
  createdAt: Date;
}

interface BookRow {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  listings: ListingRow[];
}

interface ListingRow {
  provider: 'YAKABOO' | 'BOOK_CLUB';
  priceAmount: number;
  priceCurrency: 'UAH';
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  url: string;
  lastSeenAt: Date;
}

let _sessions: SessionRow[] = [];
let _users: UserRow[] = [];
let _wishlistItems: WishlistItemRow[] = [];
let _books: BookRow[] = [];

function makeFakePrisma(): PrismaClient {
  const db = {
    session: {
      findFirst: vi.fn(
        async ({
          where,
          include,
        }: {
          where: { tokenHash: string; expiresAt: { gt: Date } };
          include?: { user?: boolean };
        }) => {
          const session = _sessions.find(
            (s) => s.tokenHash === where.tokenHash && s.expiresAt > where.expiresAt.gt,
          );
          if (!session) return null;
          if (include?.user) {
            const user = _users.find((u) => u.id === session.userId);
            return { ...session, user: user ?? null };
          }
          return session;
        },
      ),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        return _users.find((u) => u.id === where.id || u.email === where.email) ?? null;
      }),
    },
    wishlistItem: {
      findMany: vi.fn(
        async ({
          where,
          orderBy,
        }: {
          where: { userId: string };
          orderBy?: { createdAt?: 'desc' | 'asc' };
          select?: unknown;
        }) => {
          let items = _wishlistItems.filter((i) => i.userId === where.userId);
          if (orderBy?.createdAt === 'desc') {
            items = [...items].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }
          return items.map((item) => {
            const book = _books.find((b) => b.id === item.canonicalBookId);
            return {
              createdAt: item.createdAt,
              canonicalBook: book
                ? {
                    id: book.id,
                    title: book.title,
                    author: book.author,
                    isbn: book.isbn,
                    listings: book.listings,
                  }
                : null,
            };
          });
        },
      ),
      upsert: vi.fn(
        async ({
          where,
          create,
        }: {
          where: { userId_canonicalBookId: { userId: string; canonicalBookId: string } };
          create: { userId: string; canonicalBookId: string };
          update: object;
        }) => {
          const existing = _wishlistItems.find(
            (i) =>
              i.userId === where.userId_canonicalBookId.userId &&
              i.canonicalBookId === where.userId_canonicalBookId.canonicalBookId,
          );
          if (!existing) {
            const item: WishlistItemRow = {
              userId: create.userId,
              canonicalBookId: create.canonicalBookId,
              createdAt: FIXED_DATE,
            };
            _wishlistItems.push(item);
            return item;
          }
          return existing;
        },
      ),
      deleteMany: vi.fn(
        async ({ where }: { where: { userId: string; canonicalBookId: string } }) => {
          const before = _wishlistItems.length;
          _wishlistItems = _wishlistItems.filter(
            (i) => !(i.userId === where.userId && i.canonicalBookId === where.canonicalBookId),
          );
          return { count: before - _wishlistItems.length };
        },
      ),
      count: vi.fn(
        async ({ where }: { where: { userId: string; canonicalBookId: string } }) => {
          return _wishlistItems.filter(
            (i) => i.userId === where.userId && i.canonicalBookId === where.canonicalBookId,
          ).length;
        },
      ),
    },
    canonicalBook: {
      count: vi.fn(async ({ where }: { where: { id: string } }) => {
        return _books.filter((b) => b.id === where.id).length;
      }),
    },
  };
  return db as unknown as PrismaClient;
}

// ── Auth deps factory ─────────────────────────────────────────────────────────

function makeAuthDeps(prisma: PrismaClient): AuthDeps {
  return {
    prisma,
    mailer: new FakeMailer(),
    config: TEST_CONFIG,
    now: () => FIXED_DATE,
    generateCode: () => '123456',
    generateToken: () => FIXED_TOKEN,
  };
}

// ── Session seed helper ───────────────────────────────────────────────────────

function seedSession(userId: string, token: string): void {
  _sessions.push({
    id: `session-${userId}`,
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(FIXED_DATE.getTime() + SESSION_TTL_MS),
    createdAt: FIXED_DATE,
  });
}

// ── App factory ───────────────────────────────────────────────────────────────

function makeApp() {
  const prisma = makeFakePrisma();
  const authDeps = makeAuthDeps(prisma);
  const app = buildApp(prisma, authDeps);
  return { app, prisma };
}

const AUTH_COOKIE = `kn_session=${FIXED_TOKEN}`;

beforeEach(() => {
  _sessions = [];
  _users = [];
  _wishlistItems = [];
  _books = [
    {
      id: BOOK_UUID_A,
      title: 'Кобзар',
      author: 'Тарас Шевченко',
      isbn: null,
      listings: [
        {
          provider: 'YAKABOO',
          priceAmount: 34900,
          priceCurrency: 'UAH',
          availability: 'IN_STOCK',
          url: 'https://example.com/a',
          lastSeenAt: FIXED_DATE,
        },
      ],
    },
    {
      id: BOOK_UUID_B,
      title: 'Лісова пісня',
      author: 'Леся Українка',
      isbn: null,
      listings: [],
    },
  ];

  _users = [
    { id: USER_ID_A, email: 'user-a@example.com', createdAt: FIXED_DATE },
    { id: USER_ID_B, email: 'user-b@example.com', createdAt: FIXED_DATE },
  ];

  seedSession(USER_ID_A, FIXED_TOKEN);
});

// ── 401 without cookie ────────────────────────────────────────────────────────

describe('401 AUTH_REQUIRED without cookie', () => {
  it('GET /api/wishlist → 401', async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/wishlist' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REQUIRED');
  });

  it('POST /api/wishlist → 401', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      payload: { bookId: BOOK_UUID_A },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REQUIRED');
  });

  it('GET /api/wishlist/status/:bookId → 401', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/wishlist/status/${BOOK_UUID_A}`,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REQUIRED');
  });

  it('DELETE /api/wishlist/:bookId → 401', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/wishlist/${BOOK_UUID_A}`,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REQUIRED');
  });
});

// ── GET /api/wishlist ─────────────────────────────────────────────────────────

describe('GET /api/wishlist', () => {
  it('returns only the current user items (not other users items)', async () => {
    // Seed items for both users — user A has BOOK_UUID_A, user B has BOOK_UUID_B
    _wishlistItems = [
      { userId: USER_ID_A, canonicalBookId: BOOK_UUID_A, createdAt: FIXED_DATE },
      { userId: USER_ID_B, canonicalBookId: BOOK_UUID_B, createdAt: FIXED_DATE },
    ];

    const { app } = makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].book.id).toBe(BOOK_UUID_A);
  });

  it('returns empty items when wishlist is empty', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([]);
  });
});

// ── POST /api/wishlist ────────────────────────────────────────────────────────

describe('POST /api/wishlist', () => {
  it('adds book → 200 {ok: true}', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
      payload: { bookId: BOOK_UUID_A },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(_wishlistItems.some((i) => i.userId === USER_ID_A && i.canonicalBookId === BOOK_UUID_A)).toBe(true);
  });

  it('duplicate add → 200 {ok: true} (idempotent)', async () => {
    const { app } = makeApp();

    await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
      payload: { bookId: BOOK_UUID_A },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
      payload: { bookId: BOOK_UUID_A },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('missing book → 404 BOOK_NOT_FOUND', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
      payload: { bookId: MISSING_UUID },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('BOOK_NOT_FOUND');
  });

  it('invalid UUID in body → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
      payload: { bookId: 'not-a-uuid' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

// ── DELETE /api/wishlist/:bookId ──────────────────────────────────────────────

describe('DELETE /api/wishlist/:bookId', () => {
  it('removes existing item → 200 {ok: true}', async () => {
    _wishlistItems = [
      { userId: USER_ID_A, canonicalBookId: BOOK_UUID_A, createdAt: FIXED_DATE },
    ];

    const { app } = makeApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/wishlist/${BOOK_UUID_A}`,
      headers: { cookie: AUTH_COOKIE },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(_wishlistItems.filter((i) => i.userId === USER_ID_A)).toHaveLength(0);
  });

  it('removing non-existent item → 200 {ok: true} (idempotent)', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/wishlist/${MISSING_UUID}`,
      headers: { cookie: AUTH_COOKIE },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('invalid UUID in path → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/wishlist/not-a-uuid',
      headers: { cookie: AUTH_COOKIE },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

// ── GET /api/wishlist/status/:bookId ─────────────────────────────────────────

describe('GET /api/wishlist/status/:bookId', () => {
  it('returns {inWishlist: true} when book is in wishlist', async () => {
    _wishlistItems = [
      { userId: USER_ID_A, canonicalBookId: BOOK_UUID_A, createdAt: FIXED_DATE },
    ];

    const { app } = makeApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/wishlist/status/${BOOK_UUID_A}`,
      headers: { cookie: AUTH_COOKIE },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ inWishlist: true });
  });

  it('returns {inWishlist: false} when book is not in wishlist', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/wishlist/status/${BOOK_UUID_A}`,
      headers: { cookie: AUTH_COOKIE },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ inWishlist: false });
  });

  it('invalid UUID in path → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/wishlist/status/not-a-uuid',
      headers: { cookie: AUTH_COOKIE },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});
