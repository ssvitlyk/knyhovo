import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../../app.js';
import type { AuthDeps } from '../../../auth/service.js';
import type { AuthConfig } from '../../../auth/config.js';
import type { Mailer } from '../../../auth/mailer.js';
import { hashToken } from '../../../auth/crypto.js';

// ── Fixed test constants ──────────────────────────────────────────────────────

const FIXED_DATE = new Date('2026-07-16T00:00:00.000Z');
const FIXED_TOKEN = 'test-session-token-fixed-32bytes____';
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
const DAY_MS = 86_400_000;

const USER_ID_A = 'user-a-id-111111111111111111111111';
const USER_ID_B = 'user-b-id-222222222222222222222222';

const BOOK_UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BOOK_UUID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

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
  userId: string;
  canonicalBookId: string;
  createdAt: Date;
}

interface ListingRow {
  id: string;
  provider: 'YAKABOO' | 'BOOK_CLUB';
  priceAmount: number;
  priceCurrency: 'UAH';
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  priceHistory: {
    priceAmount: number;
    priceCurrency: 'UAH';
    availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
    recordedAt: Date;
  }[];
}

interface BookRow {
  id: string;
  title: string;
  listings: ListingRow[];
}

interface AlertRow {
  canonicalBookId: string;
  userId: string;
  status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'UNAVAILABLE';
  targetPriceAmount: number;
  targetPriceCurrency: 'UAH';
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
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
        return _wishlistItems
          .filter((i) => i.userId === where.userId)
          .map((item) => {
            const book = _books.find((b) => b.id === item.canonicalBookId);
            const alert = _alerts.find(
              (a) => a.userId === item.userId && a.canonicalBookId === item.canonicalBookId,
            );
            return {
              canonicalBook: book
                ? { id: book.id, title: book.title, listings: book.listings }
                : { id: item.canonicalBookId, title: '', listings: [] },
              alert: alert
                ? {
                    status: alert.status,
                    targetPriceAmount: alert.targetPriceAmount,
                    targetPriceCurrency: alert.targetPriceCurrency,
                  }
                : null,
            };
          });
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
const URL = '/api/wishlist/buying-opportunities';

beforeEach(() => {
  _sessions = [];
  _users = [];
  _wishlistItems = [];
  _books = [];
  _alerts = [];

  _users = [
    { id: USER_ID_A, email: 'user-a@example.com', createdAt: FIXED_DATE },
    { id: USER_ID_B, email: 'user-b@example.com', createdAt: FIXED_DATE },
  ];

  seedSession(USER_ID_A, FIXED_TOKEN);
});

describe('GET /api/wishlist/buying-opportunities — auth', () => {
  it('401 AUTH_REQUIRED without a cookie', async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: 'GET', url: URL });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REQUIRED');
  });

  it('401 AUTH_REQUIRED with an invalid/unknown session cookie', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'GET',
      url: URL,
      headers: { cookie: 'kn_session=not-a-real-token' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('AUTH_REQUIRED');
  });
});

describe('GET /api/wishlist/buying-opportunities — happy path', () => {
  it('returns an empty result for an empty wishlist', async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: 'GET', url: URL, headers: { cookie: AUTH_COOKIE } });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], totalWishlistCount: 0 });
  });

  it('returns qualifying books sorted by reason priority then savings', async () => {
    _books = [
      {
        id: BOOK_UUID_A,
        title: 'Кобзар',
        listings: [
          {
            id: 'listing-a',
            provider: 'YAKABOO',
            priceAmount: 20000,
            priceCurrency: 'UAH',
            availability: 'IN_STOCK',
            priceHistory: [],
          },
        ],
      },
      {
        id: BOOK_UUID_B,
        title: 'Лісова пісня',
        listings: [
          {
            id: 'listing-b',
            provider: 'BOOK_CLUB',
            priceAmount: 9000,
            priceCurrency: 'UAH',
            availability: 'IN_STOCK',
            priceHistory: [
              { priceAmount: 15000, priceCurrency: 'UAH', availability: 'IN_STOCK', recordedAt: new Date(FIXED_DATE.getTime() - DAY_MS) },
              { priceAmount: 9000, priceCurrency: 'UAH', availability: 'IN_STOCK', recordedAt: FIXED_DATE },
            ],
          },
        ],
      },
    ];
    _wishlistItems = [
      { userId: USER_ID_A, canonicalBookId: BOOK_UUID_A, createdAt: FIXED_DATE },
      { userId: USER_ID_A, canonicalBookId: BOOK_UUID_B, createdAt: FIXED_DATE },
    ];
    _alerts = [
      { userId: USER_ID_A, canonicalBookId: BOOK_UUID_A, status: 'ACTIVE', targetPriceAmount: 20000, targetPriceCurrency: 'UAH' },
    ];

    const { app } = makeApp();
    const res = await app.inject({ method: 'GET', url: URL, headers: { cookie: AUTH_COOKIE } });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalWishlistCount).toBe(2);
    expect(body.items).toHaveLength(2);
    // TARGET_REACHED (book A) ranks above LOWEST_90_DAYS (book B).
    expect(body.items[0]).toEqual({
      bookId: BOOK_UUID_A,
      reason: 'TARGET_REACHED',
      savingsAmount: 0,
      price: 20000,
      prevPrice: null,
      currency: 'UAH',
      store: 'yakaboo',
    });
    expect(body.items[1]).toEqual({
      bookId: BOOK_UUID_B,
      reason: 'LOWEST_90_DAYS',
      savingsAmount: 6000,
      price: 9000,
      prevPrice: 15000,
      currency: 'UAH',
      store: 'book-club',
    });
  });

  it('is scoped to the current user (other users wishlist items are not included)', async () => {
    _books = [
      {
        id: BOOK_UUID_A,
        title: 'Кобзар',
        listings: [
          {
            id: 'listing-a',
            provider: 'YAKABOO',
            priceAmount: 10000,
            priceCurrency: 'UAH',
            availability: 'IN_STOCK',
            priceHistory: [],
          },
        ],
      },
      {
        id: BOOK_UUID_B,
        title: 'Лісова пісня',
        listings: [
          {
            id: 'listing-b',
            provider: 'BOOK_CLUB',
            priceAmount: 8000,
            priceCurrency: 'UAH',
            availability: 'IN_STOCK',
            priceHistory: [],
          },
        ],
      },
    ];
    _wishlistItems = [
      { userId: USER_ID_A, canonicalBookId: BOOK_UUID_A, createdAt: FIXED_DATE },
      { userId: USER_ID_B, canonicalBookId: BOOK_UUID_B, createdAt: FIXED_DATE },
    ];

    const { app } = makeApp();
    const res = await app.inject({ method: 'GET', url: URL, headers: { cookie: AUTH_COOKIE } });

    expect(res.statusCode).toBe(200);
    expect(res.json().totalWishlistCount).toBe(1);
  });
});
