import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../../app.js';
import { clearCache } from '../cache.js';
import type { AuthDeps } from '../../auth/service.js';
import type { AuthConfig } from '../../auth/config.js';
import type { Mailer } from '../../auth/mailer.js';
import { hashToken } from '../../auth/crypto.js';
import { emptyDb, makeFakePrisma, book, listing, collection, itemsFor } from './fake-prisma.js';
import type { FakeDb } from './fake-prisma.js';

/**
 * isWishlisted decoration + cache anonymity for the collections endpoints.
 *
 * Auth fixture machinery (FakeMailer / AuthConfig / seedSession) mirrors
 * `wishlist/__tests__/wishlist.route.test.ts` — the collections fake Prisma
 * (`fake-prisma.ts`) now also implements `session.findFirst`/`user.findUnique`
 * so the same `buildApp(prisma, authDeps)` path can be exercised here.
 */

const FIXED_DATE = new Date('2026-07-03T00:00:00.000Z');
const FIXED_TOKEN = 'test-session-token-fixed-32bytes____';
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

const USER_A = 'user-a-id-111111111111111111111111';
const USER_B = 'user-b-id-222222222222222222222222';

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

function makeAuthDeps(prisma: ReturnType<typeof makeFakePrisma>): AuthDeps {
  return {
    prisma,
    mailer: new FakeMailer(),
    config: TEST_CONFIG,
    now: () => FIXED_DATE,
    generateCode: () => '123456',
    generateToken: () => FIXED_TOKEN,
  };
}

function seedSession(db: FakeDb, userId: string, token: string): void {
  db.sessions.push({
    id: `session-${userId}`,
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(FIXED_DATE.getTime() + SESSION_TTL_MS),
    createdAt: FIXED_DATE,
  });
}

const FEATURED_SLUG = 'knyhovyk-radyt';
const TOKEN_A = FIXED_TOKEN;
const TOKEN_B = 'test-session-token-user-b-32bytes___';
const COOKIE_A = `kn_session=${TOKEN_A}`;
const COOKIE_B = `kn_session=${TOKEN_B}`;

/** Fixture: one featured (hub) collection with 2 books, and a plain editorial collection with 2 books. */
function baseDb(): FakeDb {
  const db = emptyDb();

  const featured = collection('col-featured', FEATURED_SLUG, 'EDITORIAL');
  db.collections.push(featured);
  db.books.push(
    book('fb1', 'Featured One', 'Author A', { listings: [listing(10000)] }),
    book('fb2', 'Featured Two', 'Author B', { listings: [listing(11000)] }),
  );
  db.collectionItems.push(...itemsFor(featured.id, ['fb1', 'fb2']));

  const plain = collection('col-plain', 'plain-col', 'EDITORIAL');
  db.collections.push(plain);
  db.books.push(
    book('pb1', 'Plain One', 'Author C', { listings: [listing(5000)] }),
    book('pb2', 'Plain Two', 'Author D', { listings: [listing(6000)] }),
  );
  db.collectionItems.push(...itemsFor(plain.id, ['pb1', 'pb2']));

  db.users.push({ id: USER_A, email: 'a@example.com', createdAt: FIXED_DATE });
  db.users.push({ id: USER_B, email: 'b@example.com', createdAt: FIXED_DATE });
  seedSession(db, USER_A, TOKEN_A);
  seedSession(db, USER_B, TOKEN_B);

  return db;
}

beforeEach(() => {
  clearCache();
});

describe('isWishlisted decoration', () => {
  it('logged-in user sees isWishlisted:true only on their own wishlisted books (hub previewBooks)', async () => {
    const db = baseDb();
    db.wishlistItems.push({ userId: USER_A, canonicalBookId: 'fb1' });
    const prisma = makeFakePrisma(db);
    const authDeps = makeAuthDeps(prisma);
    const app = buildApp(prisma, authDeps);

    const res = await app.inject({ method: 'GET', url: '/api/collections/hub', headers: { cookie: COOKIE_A } });
    expect(res.statusCode).toBe(200);
    const previewBooks = res.json().featured.previewBooks as { id: string; isWishlisted: boolean }[];
    expect(previewBooks.find((b) => b.id === 'fb1')?.isWishlisted).toBe(true);
    expect(previewBooks.find((b) => b.id === 'fb2')?.isWishlisted).toBe(false);
  });

  it('logged-in user sees isWishlisted:true only on their own wishlisted books (/:slug/books)', async () => {
    const db = baseDb();
    db.wishlistItems.push({ userId: USER_A, canonicalBookId: 'pb1' });
    const prisma = makeFakePrisma(db);
    const authDeps = makeAuthDeps(prisma);
    const app = buildApp(prisma, authDeps);

    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/plain-col/books',
      headers: { cookie: COOKIE_A },
    });
    expect(res.statusCode).toBe(200);
    const books = res.json().books as { id: string; isWishlisted: boolean }[];
    expect(books.find((b) => b.id === 'pb1')?.isWishlisted).toBe(true);
    expect(books.find((b) => b.id === 'pb2')?.isWishlisted).toBe(false);
  });

  it('a different logged-in user does not see another user\'s wishlisted books as true', async () => {
    const db = baseDb();
    db.wishlistItems.push({ userId: USER_A, canonicalBookId: 'pb1' });
    const prisma = makeFakePrisma(db);
    const authDeps = makeAuthDeps(prisma);
    const app = buildApp(prisma, authDeps);

    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/plain-col/books',
      headers: { cookie: COOKIE_B },
    });
    expect(res.statusCode).toBe(200);
    const books = res.json().books as { id: string; isWishlisted: boolean }[];
    expect(books.every((b) => b.isWishlisted === false)).toBe(true);
  });

  it('guest (no cookie) gets 200 with all isWishlisted:false, never 401', async () => {
    const db = baseDb();
    db.wishlistItems.push({ userId: USER_A, canonicalBookId: 'pb1' });
    const prisma = makeFakePrisma(db);
    const authDeps = makeAuthDeps(prisma);
    const app = buildApp(prisma, authDeps);

    const hubRes = await app.inject({ method: 'GET', url: '/api/collections/hub' });
    expect(hubRes.statusCode).toBe(200);
    expect(
      (hubRes.json().featured.previewBooks as { isWishlisted: boolean }[]).every((b) => b.isWishlisted === false),
    ).toBe(true);

    const booksRes = await app.inject({ method: 'GET', url: '/api/collections/plain-col/books' });
    expect(booksRes.statusCode).toBe(200);
    expect((booksRes.json().books as { isWishlisted: boolean }[]).every((b) => b.isWishlisted === false)).toBe(true);
  });

  it('buildApp(prisma) without authDeps returns isWishlisted:false for everyone, even with a session cookie', async () => {
    const db = baseDb();
    db.wishlistItems.push({ userId: USER_A, canonicalBookId: 'pb1' });
    const prisma = makeFakePrisma(db);
    const app = buildApp(prisma);

    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/plain-col/books',
      headers: { cookie: COOKIE_A },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json().books as { isWishlisted: boolean }[]).every((b) => b.isWishlisted === false)).toBe(true);
  });
});

describe('cache anonymity', () => {
  it('does not leak isWishlisted across users: A warms the cache, B sees false, A still sees true', async () => {
    const db = baseDb();
    db.wishlistItems.push({ userId: USER_A, canonicalBookId: 'pb1' });
    const prisma = makeFakePrisma(db);
    const authDeps = makeAuthDeps(prisma);
    const app = buildApp(prisma, authDeps);

    const resA1 = await app.inject({
      method: 'GET',
      url: '/api/collections/plain-col/books',
      headers: { cookie: COOKIE_A },
    });
    const booksA1 = resA1.json().books as { id: string; isWishlisted: boolean }[];
    expect(booksA1.find((b) => b.id === 'pb1')?.isWishlisted).toBe(true);

    const resB = await app.inject({
      method: 'GET',
      url: '/api/collections/plain-col/books',
      headers: { cookie: COOKIE_B },
    });
    const booksB = resB.json().books as { id: string; isWishlisted: boolean }[];
    expect(booksB.find((b) => b.id === 'pb1')?.isWishlisted).toBe(false);

    const resA2 = await app.inject({
      method: 'GET',
      url: '/api/collections/plain-col/books',
      headers: { cookie: COOKIE_A },
    });
    const booksA2 = resA2.json().books as { id: string; isWishlisted: boolean }[];
    expect(booksA2.find((b) => b.id === 'pb1')?.isWishlisted).toBe(true);
  });

  it('same anonymity guarantee on the hub endpoint', async () => {
    const db = baseDb();
    db.wishlistItems.push({ userId: USER_A, canonicalBookId: 'fb1' });
    const prisma = makeFakePrisma(db);
    const authDeps = makeAuthDeps(prisma);
    const app = buildApp(prisma, authDeps);

    const a1 = await app.inject({ method: 'GET', url: '/api/collections/hub', headers: { cookie: COOKIE_A } });
    const previewA1 = a1.json().featured.previewBooks as { id: string; isWishlisted: boolean }[];
    expect(previewA1.find((b) => b.id === 'fb1')?.isWishlisted).toBe(true);

    const b = await app.inject({ method: 'GET', url: '/api/collections/hub', headers: { cookie: COOKIE_B } });
    const previewB = b.json().featured.previewBooks as { id: string; isWishlisted: boolean }[];
    expect(previewB.find((b2) => b2.id === 'fb1')?.isWishlisted).toBe(false);

    const a2 = await app.inject({ method: 'GET', url: '/api/collections/hub', headers: { cookie: COOKIE_A } });
    const previewA2 = a2.json().featured.previewBooks as { id: string; isWishlisted: boolean }[];
    expect(previewA2.find((b) => b.id === 'fb1')?.isWishlisted).toBe(true);
  });
});
