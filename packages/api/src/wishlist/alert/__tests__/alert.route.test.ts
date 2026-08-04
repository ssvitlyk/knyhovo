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
  magicLinkTtlMs: 30 * 60_000,
  sessionTtlMs: SESSION_TTL_MS,
  rateWindowMs: 15 * 60_000,
  maxCodesPerWindow: 5,
  maxVerifyAttempts: 5,
  resendApiKey: null,
  fromEmail: 'Knyhovo <test@example.com>',
  linkBaseUrl: 'https://knyhovo.test',
  allowedEmails: null,
};

// ── Fake Mailer ───────────────────────────────────────────────────────────────

class FakeMailer implements Mailer {
  async sendMagicLink(email: string, url: string): Promise<void> {
    void email;
    void url;
  }

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
  // `intent` is a legacy column still written by `upsertAlert` for rollback
  // safety (see repository.ts `LEGACY_INTENT`) — kept here so the fake's
  // `create`/`update` typing matches what the real repository writes.
  intent: 'ANY_DROP' | 'FAVOURABLE_PRICE' | 'CUSTOM_PRICE';
  mode: 'ANY_DROP' | 'GOOD_PRICE' | 'MY_PRICE';
  targetPriceAmount: number;
  targetPriceCurrency: 'UAH';
  baselineAmount: number | null;
  rearmPolicy: 'FOLLOW_DOWN' | 'STATIC';
  thresholdBasis: string | null;
  thresholdProof: string | null;
  pausedAt: Date | null;
  lastNotifiedAt: Date | null;
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
    providerListing: {
      // Backs `findCanonicalPriceByBook` (src/pricing/canonical-price.ts): the
      // cheapest strictly IN_STOCK listing's price, grouped by canonicalBookId.
      // Books with no IN_STOCK listing are simply omitted from the result — the
      // real Prisma groupBy over an empty match set does the same.
      groupBy: vi.fn(
        async ({
          where,
        }: {
          by: ['canonicalBookId'];
          where: { canonicalBookId: { in: string[] }; availability: 'IN_STOCK' };
          _min: { priceAmount: true };
        }) => {
          return where.canonicalBookId.in.flatMap((id) => {
            const book = _books.find((b) => b.id === id);
            if (!book) return [];
            const inStockPrices = book.listings
              .filter((l) => l.availability === 'IN_STOCK')
              .map((l) => l.priceAmount);
            if (inStockPrices.length === 0) return [];
            return [{ canonicalBookId: id, _min: { priceAmount: Math.min(...inStockPrices) } }];
          });
        },
      ),
    },
    priceHistoryPoint: {
      // Backs `goodPriceForBook` — good-price is always PENDING_CALIBRATION
      // regardless of sample content, so an empty history is sufficient for
      // every fixture in this file.
      findMany: vi.fn(async () => []),
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
  // Seeded canonical price for BOOK_UUID_A (see beforeEach) is 34900.
  const CANONICAL_PRICE = 34900;

  it('happy path — creates alert (my-price) → 200 {alert}', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'my-price', threshold: { amount: 20000, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.alert.mode).toBe('my-price');
    expect(body.alert.threshold).toEqual({ amount: 20000, currency: 'UAH' });
    expect(_alerts).toHaveLength(1);
    expect(_alerts[0]?.mode).toBe('MY_PRICE');
    expect(_alerts[0]?.targetPriceAmount).toBe(20000);
    expect(_alerts[0]?.status).toBe('ACTIVE');
  });

  it('GET /api/wishlist shows alert after PUT (any-drop)', async () => {
    const { app } = makeApp();
    await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'any-drop' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
    });

    expect(res.statusCode).toBe(200);
    const item = res.json().items[0];
    expect(item.alert).not.toBeNull();
    expect(item.alert.mode).toBe('any-drop');
    expect(item.alert.threshold).toEqual({ amount: CANONICAL_PRICE, currency: 'UAH' });
    // No email has been sent for this alert yet → armed (state is a fact, not a
    // price comparison).
    expect(item.alert.state).toBe('armed');
    expect(item.alert.notifiedAt).toBeNull();
  });

  it('a my-price target below the current price stays armed (no false reached)', async () => {
    const { app } = makeApp();
    // Threshold below the listing price (34900): armed is a fact from the
    // notification marker, never a live price comparison.
    await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'my-price', threshold: { amount: 30000, currency: 'UAH' } },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/wishlist',
      headers: { cookie: AUTH_COOKIE },
    });

    const item = res.json().items[0];
    expect(item.alert.state).toBe('armed');
  });

  it('a my-price target at/above the current price is rejected, not stored as not-yet-reached', async () => {
    const { app } = makeApp();
    // Under the old model this was accepted and read as not-yet-triggered; the
    // new contract rejects it outright (THRESHOLD_NOT_BELOW_CURRENT) so no
    // dishonest threshold is ever persisted.
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'my-price', threshold: { amount: 35000, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('THRESHOLD_NOT_BELOW_CURRENT');
    expect(_alerts).toHaveLength(0);
  });

  it('book not in wishlist → 404 WISHLIST_ITEM_NOT_FOUND', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${MISSING_UUID}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'any-drop' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('WISHLIST_ITEM_NOT_FOUND');
  });

  it('invalid mode → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'bad-mode' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('non-positive threshold amount → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'my-price', threshold: { amount: 0, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('non-integer threshold amount → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'my-price', threshold: { amount: 199.99, currency: 'UAH' } },
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
      payload: { mode: 'my-price', threshold: { amount: 20000, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  // ── New coverage: notifications-model-v2 resolver contract end to end ──────

  it('my-price with threshold below current price → 200, armed, STATIC rearm', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'my-price', threshold: { amount: 25000, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.alert.mode).toBe('my-price');
    expect(body.alert.threshold.amount).toBe(25000);
    expect(body.alert.state).toBe('armed');
    expect(_alerts[0]?.rearmPolicy).toBe('STATIC');
  });

  it('my-price without threshold in body → 422 THRESHOLD_REQUIRED', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'my-price' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('THRESHOLD_REQUIRED');
    expect(_alerts).toHaveLength(0);
  });

  it('my-price with threshold at current price → 422 THRESHOLD_NOT_BELOW_CURRENT', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'my-price', threshold: { amount: CANONICAL_PRICE, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('THRESHOLD_NOT_BELOW_CURRENT');
    expect(_alerts).toHaveLength(0);
  });

  it('any-drop (no threshold) → 200, threshold = canonical price, FOLLOW_DOWN rearm, baseline set', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'any-drop' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.alert.mode).toBe('any-drop');
    expect(body.alert.threshold).toEqual({ amount: CANONICAL_PRICE, currency: 'UAH' });
    expect(_alerts[0]?.rearmPolicy).toBe('FOLLOW_DOWN');
    expect(_alerts[0]?.baselineAmount).toBe(CANONICAL_PRICE);
  });

  it('any-drop with a threshold in the body → 422 THRESHOLD_NOT_ALLOWED', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'any-drop', threshold: { amount: 20000, currency: 'UAH' } },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('THRESHOLD_NOT_ALLOWED');
    expect(_alerts).toHaveLength(0);
  });

  it('good-price → 409 INSUFFICIENT_HISTORY (always PENDING_CALIBRATION today)', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'good-price' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INSUFFICIENT_HISTORY');
    expect(_alerts).toHaveLength(0);
  });

  it('unknown mode string → 400 VALIDATION_ERROR', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: `/api/wishlist/${BOOK_UUID_A}/alert`,
      headers: { cookie: AUTH_COOKIE },
      payload: { mode: 'not-a-real-mode' },
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
        mode: 'ANY_DROP',
        targetPriceAmount: 20000,
        targetPriceCurrency: 'UAH',
        baselineAmount: 20000,
        rearmPolicy: 'FOLLOW_DOWN',
        thresholdBasis: 'current-price',
        thresholdProof: 'Щойно ціна впаде',
        pausedAt: null,
        lastNotifiedAt: null,
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
    expect(res.json().items[0].alert.state).toBe('paused');
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
        mode: 'ANY_DROP',
        targetPriceAmount: 20000,
        targetPriceCurrency: 'UAH',
        baselineAmount: 20000,
        rearmPolicy: 'FOLLOW_DOWN',
        thresholdBasis: 'current-price',
        thresholdProof: 'Щойно ціна впаде',
        pausedAt: null,
        lastNotifiedAt: null,
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
