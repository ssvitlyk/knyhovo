import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../../app.js';
import type { AuthDeps } from '../../../auth/service.js';
import type { AuthConfig } from '../../../auth/config.js';
import type { Mailer } from '../../../auth/mailer.js';
import { hashToken } from '../../../auth/crypto.js';

// ── Fixed test constants ──────────────────────────────────────────────────────

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');
const FIXED_TOKEN = 'test-session-token-fixed-32bytes____';
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

const USER_ID_A = 'user-a-id-111111111111111111111111';

const BOOK_UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MISSING_UUID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const WISHLIST_ITEM_ID = 'witem-aaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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
  id: string;
  userId: string;
  canonicalBookId: string;
  createdAt: Date;
}

interface ListingRow {
  provider: 'YAKABOO' | 'BOOK_CLUB';
  priceAmount: number;
  priceCurrency: 'UAH';
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  url: string;
  lastSeenAt: Date;
}

interface BookRow {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  listings: ListingRow[];
}

interface AlertRow {
  wishlistItemId: string;
  status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'UNAVAILABLE';
  intent: 'ANY_DROP' | 'BELOW_CURRENT' | 'FAVOURABLE_PRICE' | 'CUSTOM_PRICE';
  targetPriceAmount: number;
  targetPriceCurrency: 'UAH';
  pausedAt: Date | null;
}

let _sessions: SessionRow[] = [];
let _users: UserRow[] = [];
let _wishlistItems: WishlistItemRow[] = [];
let _books: BookRow[] = [];
let _alerts: AlertRow[] = [];

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
            const alert = _alerts.find((a) => a.wishlistItemId === item.id) ?? null;
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
              alert,
            };
          });
        },
      ),
      findUnique: vi.fn(
        async ({
          where,
          select,
        }: {
          where: { userId_canonicalBookId: { userId: string; canonicalBookId: string } };
          select?: { id?: boolean };
        }) => {
          const item = _wishlistItems.find(
            (i) =>
              i.userId === where.userId_canonicalBookId.userId &&
              i.canonicalBookId === where.userId_canonicalBookId.canonicalBookId,
          );
          if (!item) return null;
          if (select?.id) return { id: item.id };
          return item;
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
              id: `witem-${create.canonicalBookId}`,
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
    alert: {
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { wishlistItemId: string };
          create: AlertRow;
          update: Partial<AlertRow>;
        }) => {
          const idx = _alerts.findIndex((a) => a.wishlistItemId === where.wishlistItemId);
          if (idx >= 0) {
            _alerts[idx] = { ..._alerts[idx]!, ...update };
            return _alerts[idx];
          }
          _alerts.push(create);
          return create;
        },
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { wishlistItemId: string };
          data: Partial<AlertRow>;
        }) => {
          let count = 0;
          _alerts = _alerts.map((a) => {
            if (a.wishlistItemId === where.wishlistItemId) {
              count++;
              return { ...a, ...data };
            }
            return a;
          });
          return { count };
        },
      ),
      deleteMany: vi.fn(async ({ where }: { where: { wishlistItemId: string } }) => {
        const before = _alerts.length;
        _alerts = _alerts.filter((a) => a.wishlistItemId !== where.wishlistItemId);
        return { count: before - _alerts.length };
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

function seedSession(userId: string, token: string): void {
  _sessions.push({
    id: `session-${userId}`,
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(FIXED_DATE.getTime() + SESSION_TTL_MS),
    createdAt: FIXED_DATE,
  });
}

function makeApp() {
  const prisma = makeFakePrisma();
  const authDeps = makeAuthDeps(prisma);
  const app = buildApp(prisma, authDeps);
  return { app, prisma };
}

const AUTH_COOKIE = `kn_session=${FIXED_TOKEN}`;

beforeEach(() => {
  _sessions = [];
  _users = [{ id: USER_ID_A, email: 'user-a@example.com', createdAt: FIXED_DATE }];
  _wishlistItems = [
    {
      id: WISHLIST_ITEM_ID,
      userId: USER_ID_A,
      canonicalBookId: BOOK_UUID_A,
      createdAt: FIXED_DATE,
    },
  ];
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
  ];
  _alerts = [];

  seedSession(USER_ID_A, FIXED_TOKEN);
});

// ── 401 without cookie ────────────────────────────────────────────────────────

describe('401 AUTH_REQUIRED without cookie', () => {
  it('PUT /api/wishlist/:bookId/alert → 401', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      payload: { intent: 'any-drop', targetPrice: { amount: 20000, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REQUIRED');
  });

  it('PATCH /api/wishlist/:bookId/alert → 401', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      payload: { paused: true },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REQUIRED');
  });

  it('DELETE /api/wishlist/:bookId/alert → 401', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REQUIRED');
  });
});

// ── PUT /api/wishlist/:bookId/alert ───────────────────────────────────────────

describe('PUT /api/wishlist/:bookId/alert', () => {
  it('happy path — creates alert → 200 {ok: true}', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { intent: 'any-drop', targetPrice: { amount: 20000, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(_alerts).toHaveLength(1);
    expect(_alerts[0]?.intent).toBe('ANY_DROP');
    expect(_alerts[0]?.targetPriceAmount).toBe(20000);
    expect(_alerts[0]?.status).toBe('ACTIVE');
  });

  it('GET /api/wishlist shows alert after PUT', async () => {
    const { app } = makeApp();
    await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { intent: 'below-current', targetPrice: { amount: 30000, currency: 'UAH' } },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
    });

    expect(res.statusCode).toBe(200);
    const item = res.json().items[0];
    expect(item.alert).not.toBeNull();
    expect(item.alert.intent).toBe('below-current');
    expect(item.alert.targetPrice).toEqual({ amount: 30000, currency: 'UAH' });
    // lowestPrice (34900) > target (30000) → active
    expect(item.alert.status).toBe('active');
  });

  it('GET /api/wishlist shows status=triggered when lowestPrice ≤ target', async () => {
    const { app } = makeApp();
    // Set target above the listing price (34900)
    await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { intent: 'custom-price', targetPrice: { amount: 35000, currency: 'UAH' } },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
    });

    const item = res.json().items[0];
    // lowestPrice (34900) ≤ target (35000) → triggered
    expect(item.alert.status).toBe('triggered');
  });

  it('book not in wishlist → 404 WISHLIST_ITEM_NOT_FOUND', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${MISSING_UUID}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { intent: 'any-drop', targetPrice: { amount: 20000, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('WISHLIST_ITEM_NOT_FOUND');
  });

  it('invalid intent → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { intent: 'bad-intent', targetPrice: { amount: 20000, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('non-positive targetPrice amount → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { intent: 'any-drop', targetPrice: { amount: 0, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('non-integer targetPrice amount → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { intent: 'any-drop', targetPrice: { amount: 199.99, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('invalid bookId in path → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/wishlist/not-a-uuid/alert',
      headers: { cookie: AUTH_COOKIE },
      payload: { intent: 'any-drop', targetPrice: { amount: 20000, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

// ── PATCH /api/wishlist/:bookId/alert ─────────────────────────────────────────

describe('PATCH /api/wishlist/:bookId/alert', () => {
  beforeEach(() => {
    _alerts = [
      {
        wishlistItemId: WISHLIST_ITEM_ID,
        status: 'ACTIVE',
        intent: 'ANY_DROP',
        targetPriceAmount: 20000,
        targetPriceCurrency: 'UAH',
        pausedAt: null,
      },
    ];
  });

  it('paused=true → status PAUSED in store', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { paused: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(_alerts[0]?.status).toBe('PAUSED');
    expect(_alerts[0]?.pausedAt).not.toBeNull();
  });

  it('paused=true → GET /api/wishlist shows status=paused', async () => {
    const { app } = makeApp();
    await app.inject({
      method: 'PATCH',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { paused: true },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
    });
    expect(res.json().items[0].alert.status).toBe('paused');
  });

  it('paused=false after paused=true → status back to active/triggered', async () => {
    const { app } = makeApp();
    await app.inject({
      method: 'PATCH',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { paused: true },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { paused: false },
    });
    expect(res.statusCode).toBe(200);
    expect(_alerts[0]?.status).toBe('ACTIVE');
    expect(_alerts[0]?.pausedAt).toBeNull();
  });

  it('book not in wishlist → 404 WISHLIST_ITEM_NOT_FOUND', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/wishlist/${MISSING_UUID}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { paused: true },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('WISHLIST_ITEM_NOT_FOUND');
  });

  it('bad paused value → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { paused: 'yes' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

// ── DELETE /api/wishlist/:bookId/alert ────────────────────────────────────────

describe('DELETE /api/wishlist/:bookId/alert', () => {
  beforeEach(() => {
    _alerts = [
      {
        wishlistItemId: WISHLIST_ITEM_ID,
        status: 'ACTIVE',
        intent: 'ANY_DROP',
        targetPriceAmount: 20000,
        targetPriceCurrency: 'UAH',
        pausedAt: null,
      },
    ];
  });

  it('removes alert → 200 {ok: true} and alert gone', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(_alerts).toHaveLength(0);
  });

  it('GET /api/wishlist shows alert=null after DELETE', async () => {
    const { app } = makeApp();
    await app.inject({
      method: 'DELETE',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
    });
    expect(res.json().items[0].alert).toBeNull();
  });

  it('delete non-existent alert (no alert row) → 200 {ok: true} (idempotent)', async () => {
    _alerts = [];
    const { app } = makeApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('book not in wishlist → 404 WISHLIST_ITEM_NOT_FOUND', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/wishlist/${MISSING_UUID}/alert`,
      headers: { cookie: AUTH_COOKIE },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('WISHLIST_ITEM_NOT_FOUND');
  });

  it('invalid UUID in path → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/wishlist/not-a-uuid/alert',
      headers: { cookie: AUTH_COOKIE },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});
