import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../app.js';
import type { AuthDeps } from '../../auth/service.js';
import type { AuthConfig } from '../../auth/config.js';
import type { Mailer } from '../../auth/mailer.js';

// ── Fixed test constants ────────────────────────────────────────────────────

const FIXED_DATE = new Date('2026-07-03T00:00:00.000Z');
const FIXED_TOKEN = 'test-session-token-fixed-32bytes____';
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

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
  async sendMagicLink(): Promise<void> {}
  async sendLoginCode(): Promise<void> {}
}

// ── Fake in-memory rows ──────────────────────────────────────────────────────

interface FakeListing {
  provider: 'YAKABOO' | 'BOOK_CLUB';
  priceAmount: number;
  priceCurrency: 'UAH';
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  coverUrl: string | null;
  priceHistory: { priceAmount: number; priceCurrency: 'UAH'; recordedAt: Date }[];
}

interface FakeBook {
  id: string;
  title: string;
  author: string;
  createdAt: Date;
  genreId: string | null;
  listings: FakeListing[];
}

interface FakeGenre {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  displayOrder: number;
}

interface FakeMood {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  displayOrder: number;
}

interface FakeCollection {
  id: string;
  slug: string;
  type: 'FEATURED' | 'EDITORIAL' | 'CURATED' | 'DYNAMIC' | 'GENRE' | 'MOOD';
  title: string;
  eyebrow: string | null;
  description: string | null;
  statusLabel: string | null;
  icon: string | null;
  displayOrder: number;
  isActive: boolean;
}

interface FakeCollectionItem {
  collectionId: string;
  canonicalBookId: string;
  sortOrder: number;
}

interface FakeWishlistItem {
  userId: string;
  canonicalBookId: string;
}

interface FakeSession {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
}

interface FakeUser {
  id: string;
  email: string;
  createdAt: Date;
  displayName: string | null;
}

function book(
  id: string,
  title: string,
  author: string,
  opts: {
    createdAt?: Date;
    genreId?: string | null;
    listings?: FakeListing[];
  } = {},
): FakeBook {
  return {
    id,
    title,
    author,
    createdAt: opts.createdAt ?? FIXED_DATE,
    genreId: opts.genreId ?? null,
    listings: opts.listings ?? [],
  };
}

function listing(
  price: number,
  opts: Partial<FakeListing> = {},
): FakeListing {
  return {
    provider: 'YAKABOO',
    priceAmount: price,
    priceCurrency: 'UAH',
    availability: 'IN_STOCK',
    coverUrl: null,
    priceHistory: [],
    ...opts,
  };
}

interface FakeDb {
  books: FakeBook[];
  genres: FakeGenre[];
  moods: FakeMood[];
  collections: FakeCollection[];
  collectionItems: FakeCollectionItem[];
  wishlistItems: FakeWishlistItem[];
  sessions: FakeSession[];
  users: FakeUser[];
}

function makeFakePrisma(db: FakeDb): PrismaClient {
  const client = {
    canonicalBook: {
      findMany: vi.fn(async (args: { where?: { id?: { in: string[] }; genreId?: string } }) => {
        let rows = db.books;
        if (args?.where?.id?.in) {
          const ids = new Set(args.where.id.in);
          rows = rows.filter((b) => ids.has(b.id));
        }
        if (args?.where?.genreId) {
          rows = rows.filter((b) => b.genreId === args.where?.genreId);
        }
        return rows.map((b) => ({ ...b }));
      }),
      groupBy: vi.fn(async () => {
        const counts = new Map<string, number>();
        for (const b of db.books) {
          if (b.genreId) counts.set(b.genreId, (counts.get(b.genreId) ?? 0) + 1);
        }
        return [...counts.entries()].map(([genreId, count]) => ({
          genreId,
          _count: { _all: count },
        }));
      }),
    },
    genre: {
      findMany: vi.fn(async () => [...db.genres].sort((a, b) => a.displayOrder - b.displayOrder)),
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        return db.genres.find((g) => g.slug === where.slug) ?? null;
      }),
    },
    mood: {
      findMany: vi.fn(async () => [...db.moods].sort((a, b) => a.displayOrder - b.displayOrder)),
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        return db.moods.find((m) => m.slug === where.slug) ?? null;
      }),
    },
    collection: {
      findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => {
        return db.collections.find((c) => c.slug === where.slug) ?? null;
      }),
      findMany: vi.fn(async (args: { where?: { type?: string; isActive?: boolean } }) => {
        let rows = db.collections;
        if (args?.where?.type) rows = rows.filter((c) => c.type === args.where?.type);
        if (args?.where?.isActive) rows = rows.filter((c) => c.isActive);
        return [...rows].sort((a, b) => a.displayOrder - b.displayOrder);
      }),
    },
    collectionItem: {
      findMany: vi.fn(async ({ where }: { where: { collectionId: string } }) => {
        return db.collectionItems
          .filter((i) => i.collectionId === where.collectionId)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((i) => ({ canonicalBookId: i.canonicalBookId }));
      }),
    },
    wishlistItem: {
      groupBy: vi.fn(async () => {
        const counts = new Map<string, number>();
        for (const w of db.wishlistItems) {
          counts.set(w.canonicalBookId, (counts.get(w.canonicalBookId) ?? 0) + 1);
        }
        return [...counts.entries()].map(([canonicalBookId, count]) => ({
          canonicalBookId,
          _count: { _all: count },
        }));
      }),
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
        return db.wishlistItems
          .filter((w) => w.userId === where.userId)
          .map((w) => ({ canonicalBookId: w.canonicalBookId }));
      }),
    },
    session: {
      findFirst: vi.fn(
        async ({
          where,
          include,
        }: {
          where: { tokenHash: string; expiresAt: { gt: Date } };
          include?: { user?: boolean };
        }) => {
          const session = db.sessions.find(
            (s) => s.tokenHash === where.tokenHash && s.expiresAt > where.expiresAt.gt,
          );
          if (!session) return null;
          if (include?.user) {
            const user = db.users.find((u) => u.id === session.userId);
            return { ...session, user: user ?? null };
          }
          return session;
        },
      ),
    },
  };
  return client as unknown as PrismaClient;
}

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

function emptyDb(): FakeDb {
  return {
    books: [],
    genres: [],
    moods: [],
    collections: [],
    collectionItems: [],
    wishlistItems: [],
    sessions: [],
    users: [],
  };
}

function featuredCollection(): FakeCollection {
  return {
    id: 'col-featured',
    slug: 'knyhovyk-radyt',
    type: 'FEATURED',
    title: 'Книговик радить',
    eyebrow: null,
    description: 'desc',
    statusLabel: 'label',
    icon: 'bookmark',
    displayOrder: 1,
    isActive: true,
  };
}

function itemsFor(collectionId: string, bookIds: string[]): FakeCollectionItem[] {
  return bookIds.map((id, i) => ({ collectionId, canonicalBookId: id, sortOrder: i }));
}

async function buildTestApp(db: FakeDb) {
  const prisma = makeFakePrisma(db);
  const authDeps = makeAuthDeps(prisma);
  return buildApp(prisma, authDeps);
}

function withSession(db: FakeDb, userId: string, email = 'reader@example.com'): void {
  db.users.push({ id: userId, email, createdAt: FIXED_DATE, displayName: null });
  db.sessions.push({
    tokenHash: sha256Hex(FIXED_TOKEN),
    userId,
    expiresAt: new Date(FIXED_DATE.getTime() + SESSION_TTL_MS),
  });
}

// Mirrors auth/crypto.ts hashToken (sha256 hex) — re-implemented locally so the
// test file has no runtime coupling beyond the public token string.
import { createHash } from 'node:crypto';
function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('GET /api/collections/home', () => {
  it('returns featured summary and sections in the required order', async () => {
    const db = emptyDb();
    db.books.push(book('b1', 'Кобзар', 'Шевченко', { listings: [listing(20000)] }));
    const featured = featuredCollection();
    db.collections.push(featured);
    db.collectionItems.push(...itemsFor(featured.id, ['b1']));

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/home' });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.featured.slug).toBe('knyhovyk-radyt');
    expect(body.sections.map((s: { type: string }) => s.type)).toEqual([
      'wishlist-popular',
      'genres',
      'new-arrivals',
      'biggest-discounts',
      'moods',
      'popular',
      'editorial',
      'underrated',
    ]);
  });

  it('/api/collections/hub is an alias returning the same shape', async () => {
    const db = emptyDb();
    const featured = featuredCollection();
    db.collections.push(featured);

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/hub' });
    expect(res.statusCode).toBe(200);
    expect(res.json().featured.slug).toBe('knyhovyk-radyt');
  });

  it('sorts wishlist-popular section by wishlistCount descending', async () => {
    const db = emptyDb();
    db.books.push(
      book('low', 'Low', 'A', { listings: [listing(10000)] }),
      book('high', 'High', 'B', { listings: [listing(10000)] }),
    );
    db.collections.push(featuredCollection());
    db.wishlistItems.push(
      { userId: 'u1', canonicalBookId: 'low' },
      { userId: 'u1', canonicalBookId: 'high' },
      { userId: 'u2', canonicalBookId: 'high' },
      { userId: 'u3', canonicalBookId: 'high' },
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/home' });
    const body = res.json();
    const wishlistSection = body.sections.find((s: { type: string }) => s.type === 'wishlist-popular');
    expect(wishlistSection.items.map((i: { id: string }) => i.id)).toEqual(['high', 'low']);
    expect(wishlistSection.items[0].wishlistCount).toBe(3);
    expect(wishlistSection.items[1].wishlistCount).toBe(1);
  });

  it('guest requests report isWishlisted:false for every book', async () => {
    const db = emptyDb();
    db.books.push(book('b1', 'Кобзар', 'Шевченко', { listings: [listing(20000)] }));
    db.collections.push(featuredCollection());
    db.wishlistItems.push({ userId: 'someone-else', canonicalBookId: 'b1' });

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/home' });
    const body = res.json();
    const wishlistSection = body.sections.find((s: { type: string }) => s.type === 'wishlist-popular');
    expect(wishlistSection.items.every((i: { isWishlisted: boolean }) => i.isWishlisted === false)).toBe(true);
  });

  it('authenticated requests report isWishlisted correctly for the current user', async () => {
    const db = emptyDb();
    db.books.push(
      book('mine', 'Mine', 'A', { listings: [listing(10000)] }),
      book('not-mine', 'NotMine', 'B', { listings: [listing(10000)] }),
    );
    db.collections.push(featuredCollection());
    const USER_ID = 'user-aaaa';
    withSession(db, USER_ID);
    db.wishlistItems.push({ userId: USER_ID, canonicalBookId: 'mine' });

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/home',
      cookies: { kn_session: FIXED_TOKEN },
    });
    const body = res.json();
    const wishlistSection = body.sections.find((s: { type: string }) => s.type === 'wishlist-popular');
    const mine = wishlistSection.items.find((i: { id: string }) => i.id === 'mine');
    const notMine = wishlistSection.items.find((i: { id: string }) => i.id === 'not-mine');
    expect(mine.isWishlisted).toBe(true);
    expect(notMine.isWishlisted).toBe(false);
  });
});

describe('GET /api/collections/biggest-discounts', () => {
  it('excludes books without a current price and orders by discount desc', async () => {
    const db = emptyDb();
    db.books.push(
      book('no-price', 'NoPrice', 'A', { listings: [] }),
      book('small-drop', 'SmallDrop', 'B', {
        listings: [
          listing(9000, {
            priceHistory: [{ priceAmount: 10000, priceCurrency: 'UAH', recordedAt: FIXED_DATE }],
          }),
        ],
      }),
      book('big-drop', 'BigDrop', 'C', {
        listings: [
          listing(5000, {
            priceHistory: [{ priceAmount: 10000, priceCurrency: 'UAH', recordedAt: FIXED_DATE }],
          }),
        ],
      }),
      book('no-drop', 'NoDrop', 'D', { listings: [listing(8000)] }),
    );

    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/biggest-discounts' });
    expect(res.statusCode).toBe(200);
    const items = res.json();
    expect(items.map((i: { id: string }) => i.id)).toEqual(['big-drop', 'small-drop']);
    expect(items[0].discountPercent).toBe(50);
    expect(items[1].discountPercent).toBe(10);
  });
});

describe('GET /api/collections/genres/:slug/books', () => {
  it('paginates books belonging to the genre', async () => {
    const db = emptyDb();
    db.genres.push({ id: 'g1', slug: 'klasyka', name: 'Класика', icon: null, displayOrder: 1 });
    for (let i = 1; i <= 5; i += 1) {
      db.books.push(book(`k${i}`, `Book ${i}`, 'Author', { genreId: 'g1', listings: [listing(10000 + i)] }));
    }

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/genres/klasyka/books',
      query: { page: '1', limit: '2' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.books).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.totalPages).toBe(3);
    expect(body.collection.slug).toBe('klasyka');
  });

  it('returns 404 COLLECTION_NOT_FOUND for an unknown genre slug', async () => {
    const db = emptyDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/genres/unknown-genre/books' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('COLLECTION_NOT_FOUND');
  });
});

describe('GET /api/collections/moods/:slug/books', () => {
  it('paginates books linked to the mood collection', async () => {
    const db = emptyDb();
    db.moods.push({
      id: 'm1',
      slug: 'pered-snom',
      name: 'Перед сном',
      description: 'desc',
      icon: 'moon',
      displayOrder: 1,
    });
    const moodCollection: FakeCollection = {
      id: 'col-mood-1',
      slug: 'pered-snom',
      type: 'MOOD',
      title: 'Перед сном',
      eyebrow: null,
      description: 'desc',
      statusLabel: null,
      icon: 'moon',
      displayOrder: 1,
      isActive: true,
    };
    db.collections.push(moodCollection);
    db.books.push(
      book('m-a', 'A', 'Author', { listings: [listing(10000)] }),
      book('m-b', 'B', 'Author', { listings: [listing(11000)] }),
      book('m-c', 'C', 'Author', { listings: [listing(12000)] }),
    );
    db.collectionItems.push(...itemsFor(moodCollection.id, ['m-a', 'm-b', 'm-c']));

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/moods/pered-snom/books',
      query: { limit: '2' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.books).toHaveLength(2);
    expect(body.total).toBe(3);
  });

  it('returns 404 COLLECTION_NOT_FOUND for an unknown mood slug', async () => {
    const db = emptyDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/moods/unknown-mood/books' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('COLLECTION_NOT_FOUND');
  });
});

describe('GET /api/collections/:slug/books — out-of-stock ordering', () => {
  it('always places OUT_OF_STOCK books last regardless of sort', async () => {
    const db = emptyDb();
    const collection: FakeCollection = {
      id: 'col-x',
      slug: 'test-collection',
      type: 'CURATED',
      title: 'Test',
      eyebrow: null,
      description: null,
      statusLabel: null,
      icon: null,
      displayOrder: 1,
      isActive: true,
    };
    db.collections.push(collection);
    db.books.push(
      book('oos', 'OutOfStock', 'A', { listings: [listing(5000, { availability: 'OUT_OF_STOCK' })] }),
      book('cheap', 'Cheap', 'B', { listings: [listing(10000)] }),
      book('expensive', 'Expensive', 'C', { listings: [listing(20000)] }),
    );
    db.collectionItems.push(...itemsFor(collection.id, ['oos', 'cheap', 'expensive']));

    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/test-collection/books',
      query: { sort: 'price_asc' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.books.map((b: { id: string }) => b.id)).toEqual(['cheap', 'expensive', 'oos']);
  });
});

describe('GET /api/collections/:slug', () => {
  it('returns 404 COLLECTION_NOT_FOUND for an unknown slug', async () => {
    const db = emptyDb();
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/does-not-exist' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body).toEqual({ error: { code: 'COLLECTION_NOT_FOUND', message: expect.any(String) } });
  });

  it('returns collection detail for a known slug', async () => {
    const db = emptyDb();
    const collection: FakeCollection = {
      id: 'col-y',
      slug: 'buker-2026',
      type: 'EDITORIAL',
      title: 'Букерівський список',
      eyebrow: 'Свіже',
      description: 'desc',
      statusLabel: null,
      icon: 'award',
      displayOrder: 2,
      isActive: true,
    };
    db.collections.push(collection);
    const app = await buildTestApp(db);
    const res = await app.inject({ method: 'GET', url: '/api/collections/buker-2026' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ slug: 'buker-2026', type: 'EDITORIAL', title: 'Букерівський список' });
  });
});

describe('validation errors', () => {
  it('returns 400 VALIDATION_ERROR for a bad page param', async () => {
    const db = emptyDb();
    db.genres.push({ id: 'g1', slug: 'klasyka', name: 'Класика', icon: null, displayOrder: 1 });
    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/genres/klasyka/books',
      query: { page: '0' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR for a limit above the max', async () => {
    const db = emptyDb();
    db.genres.push({ id: 'g1', slug: 'klasyka', name: 'Класика', icon: null, displayOrder: 1 });
    const app = await buildTestApp(db);
    const res = await app.inject({
      method: 'GET',
      url: '/api/collections/genres/klasyka/books',
      query: { limit: '99' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});
