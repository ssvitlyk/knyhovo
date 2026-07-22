import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { clearCache } from '../../collections/cache.js';
import { buildHome, getHome } from '../service.js';
import { HOME_LAYOUT } from '../layout.js';
import { fixedClock } from '../../clock.js';
import { emptyDb, makeFakePrisma, book, listing, collection, itemsFor, hashTokenSeed, makeAuthDeps } from './fixtures.js';
import type { FakeDb } from './fixtures.js';

// The C1 SQL feed-query functions have nothing to run against the in-memory
// FakeDb — swap them for the pure-JS equivalents (same candidate-pool/order
// semantics), exactly as the collections route tests do.
vi.mock('../../collections/repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../collections/repository.js')>();
  const { fakeFeedRepositoryOverrides } = await import('../../collections/__tests__/fake-feed-repository.js');
  return { ...actual, ...fakeFeedRepositoryOverrides() };
});

const NOW = new Date('2026-07-03T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number): Date => new Date(NOW.getTime() - n * DAY_MS);

/** Silence the structured build log in tests + pin the clock (deterministic novynky window). */
const SILENT = { clock: fixedClock(NOW), logSink: () => {} };

const SLUG_TO_COLLECTION: Record<string, { id: string; type: 'EDITORIAL' | 'DYNAMIC' }> = {
  'knyhovyk-radyt': { id: 'col-knyhovyk', type: 'EDITORIAL' },
  novynky: { id: 'col-novynky', type: 'DYNAMIC' },
  'populyarne-zaraz': { id: 'col-popular', type: 'DYNAMIC' },
};

/** Push only the requested Home collection rows (absent feeds compose to empty/omitted shelves). */
function withCollections(db: FakeDb, ...slugs: string[]): FakeDb {
  for (const slug of slugs) {
    const meta = SLUG_TO_COLLECTION[slug]!;
    db.collections.push(collection(meta.id, slug, meta.type));
  }
  return db;
}

function shelfKeys(home: { shelves: readonly { key: string }[] }): string[] {
  return home.shelves.map((s) => s.key);
}
function shelfBy(home: { shelves: readonly { key: string; books: readonly { id: string; storeName?: string | null }[] }[] }, key: string) {
  return home.shelves.find((s) => s.key === key);
}

/**
 * A pool large enough that all three shelves fill to 12 after cross-section
 * dedup: 48 in-window priced books across 4 providers; editorial curates 12.
 */
function bigDb(): FakeDb {
  const db = withCollections(emptyDb(), 'knyhovyk-radyt', 'novynky', 'populyarne-zaraz');
  const providers = ['KNIGOLAND', 'YAKABOO', 'BOOK_CLUB', 'VIVAT'] as const;
  for (let i = 0; i < 48; i += 1) {
    db.books.push(
      book(`b${i}`, `B${i}`, 'A', {
        createdAt: daysAgo(i % 25), // all within the 30-day novynky window
        listings: [listing(1000 + i, { provider: providers[i % 4] })],
      }),
    );
  }
  db.collectionItems.push(...itemsFor('col-knyhovyk', Array.from({ length: 12 }, (_, i) => `ed${i}`)));
  for (let i = 0; i < 12; i += 1) {
    db.books.push(book(`ed${i}`, `Ed${i}`, 'A', { createdAt: daysAgo(100 + i), listings: [listing(500 + i, { provider: 'LABORATORY' })] }));
  }
  return db;
}

describe('buildHome — composition', () => {
  beforeEach(() => clearCache());

  it('returns shelves in DISPLAY order (popular → novynky → knyhovyk)', async () => {
    const home = await buildHome(makeFakePrisma(bigDb()), SILENT);
    expect(shelfKeys(home)).toEqual(['popular', 'novynky', 'knyhovyk']);
  });

  it('fills each shelf to 12 when the pool is deep enough', async () => {
    const home = await buildHome(makeFakePrisma(bigDb()), SILENT);
    expect(shelfBy(home, 'popular')!.books).toHaveLength(12);
    expect(shelfBy(home, 'novynky')!.books).toHaveLength(12);
    expect(shelfBy(home, 'knyhovyk')!.books).toHaveLength(12);
  });

  it('no canonicalBookId repeats across shelves', async () => {
    const home = await buildHome(makeFakePrisma(bigDb()), SILENT);
    const all = home.shelves.flatMap((s) => s.books.map((b) => b.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('reserves editorial first (allocation order): a curated book never appears on popular', async () => {
    // knyhovyk + popular only. `shared` is curated AND in the popular pool → knyhovyk reserves it.
    const db = withCollections(emptyDb(), 'knyhovyk-radyt', 'populyarne-zaraz');
    db.books.push(
      book('shared', 'Shared', 'A', { createdAt: daysAgo(2), listings: [listing(1000)] }),
      book('p-only', 'PopOnly', 'A', { createdAt: daysAgo(3), listings: [listing(1100)] }),
    );
    db.collectionItems.push(...itemsFor('col-knyhovyk', ['shared']));
    const home = await buildHome(makeFakePrisma(db), SILENT);
    expect(shelfBy(home, 'knyhovyk')!.books.map((b) => b.id)).toContain('shared');
    expect(shelfBy(home, 'popular')!.books.map((b) => b.id)).not.toContain('shared');
  });

  it('editorial keeps curated sort_order and is NOT diversified (all one provider, order intact)', async () => {
    const db = withCollections(emptyDb(), 'knyhovyk-radyt');
    const ids = ['k2', 'k0', 'k1']; // curated order = item insertion order
    db.books.push(
      book('k0', 'K0', 'A', { listings: [listing(100, { provider: 'KNIGOLAND' })] }),
      book('k1', 'K1', 'A', { listings: [listing(100, { provider: 'KNIGOLAND' })] }),
      book('k2', 'K2', 'A', { listings: [listing(100, { provider: 'KNIGOLAND' })] }),
    );
    db.collectionItems.push(...itemsFor('col-knyhovyk', ids));
    const home = await buildHome(makeFakePrisma(db), SILENT);
    expect(shelfBy(home, 'knyhovyk')!.books.map((b) => b.id)).toEqual(ids);
  });

  it('popular is diversified: no provider exceeds cap=4 when alternatives exist', async () => {
    // popular-only (no novynky/knyhovyk to reserve first) → popular sees the full pool.
    const db = withCollections(emptyDb(), 'populyarne-zaraz');
    const providers = ['KNIGOLAND', 'YAKABOO', 'BOOK_CLUB'] as const;
    let n = 0;
    for (const provider of providers) {
      for (let i = 0; i < 6; i += 1) {
        n += 1;
        db.books.push(book(`${provider}-${i}`, `B${n}`, 'A', { createdAt: daysAgo(n), listings: [listing(1000, { provider })] }));
      }
    }
    const home = await buildHome(makeFakePrisma(db), SILENT);
    const popular = shelfBy(home, 'popular')!;
    expect(popular.books).toHaveLength(12);
    const byStore = new Map<string, number>();
    for (const b of popular.books) byStore.set(b.storeName!, (byStore.get(b.storeName!) ?? 0) + 1);
    for (const count of byStore.values()) expect(count).toBeLessThanOrEqual(4);
  });

  it('novynky is diversified: no provider exceeds cap=4 when alternatives exist', async () => {
    const db = withCollections(emptyDb(), 'novynky');
    const providers = ['KNIGOLAND', 'YAKABOO', 'BOOK_CLUB'] as const;
    let n = 0;
    for (const provider of providers) {
      for (let i = 0; i < 6; i += 1) {
        n += 1;
        db.books.push(book(`${provider}-${i}`, `B${n}`, 'A', { createdAt: daysAgo(n % 25), listings: [listing(1000, { provider })] }));
      }
    }
    const home = await buildHome(makeFakePrisma(db), SILENT);
    const novynky = shelfBy(home, 'novynky')!;
    expect(novynky.books.length).toBeGreaterThan(0);
    const byStore = new Map<string, number>();
    for (const b of novynky.books) byStore.set(b.storeName!, (byStore.get(b.storeName!) ?? 0) + 1);
    for (const count of byStore.values()) expect(count).toBeLessThanOrEqual(4);
  });

  it('single-provider pool: relaxation still fills the popular shelf to 12', async () => {
    const db = withCollections(emptyDb(), 'populyarne-zaraz');
    for (let i = 0; i < 15; i += 1) {
      db.books.push(book(`p${i}`, `P${i}`, 'A', { createdAt: daysAgo(i), listings: [listing(1000, { provider: 'KNIGOLAND' })] }));
    }
    const home = await buildHome(makeFakePrisma(db), SILENT);
    expect(shelfBy(home, 'popular')!.books).toHaveLength(12);
  });

  it('underfilled shelf: returns what remains (< 12), still a valid shelf', async () => {
    const db = withCollections(emptyDb(), 'populyarne-zaraz');
    db.books.push(
      book('p1', 'P1', 'A', { createdAt: daysAgo(2), listings: [listing(1000)] }),
      book('p2', 'P2', 'A', { createdAt: daysAgo(3), listings: [listing(1100)] }),
    );
    const home = await buildHome(makeFakePrisma(db), SILENT);
    expect(shelfBy(home, 'popular')!.books).toHaveLength(2);
  });

  it('omits a fully empty shelf', async () => {
    const db = withCollections(emptyDb(), 'populyarne-zaraz');
    db.books.push(book('p1', 'P1', 'A', { createdAt: daysAgo(2), listings: [listing(1000)] }));
    const home = await buildHome(makeFakePrisma(db), SILENT);
    expect(shelfKeys(home)).toEqual(['popular']);
  });

  it('unpriced curated books are excluded before compose; editorial backfills the next valid book', async () => {
    const db = withCollections(emptyDb(), 'knyhovyk-radyt');
    db.books.push(book('unp', 'Unpriced', 'A', { listings: [] }));
    for (let i = 0; i < 12; i += 1) {
      db.books.push(book(`v${i}`, `V${i}`, 'A', { listings: [listing(1000 + i)] }));
    }
    // Curated order lists the unpriced book first — it must NOT occupy a slot,
    // and the shelf still fills to 12 with the next valid curated books.
    db.collectionItems.push(...itemsFor('col-knyhovyk', ['unp', ...Array.from({ length: 12 }, (_, i) => `v${i}`)]));
    const home = await buildHome(makeFakePrisma(db), SILENT);
    const knyhovyk = shelfBy(home, 'knyhovyk')!;
    expect(knyhovyk.books.map((b) => b.id)).not.toContain('unp');
    expect(knyhovyk.books).toHaveLength(12);
    expect(knyhovyk.books.map((b) => b.id)).toEqual(Array.from({ length: 12 }, (_, i) => `v${i}`));
  });

  it('novynky window boundary is pinned to the injected clock (out-of-window book excluded, no fallback)', async () => {
    const db = withCollections(emptyDb(), 'novynky');
    for (let i = 0; i < 30; i += 1) {
      db.books.push(book(`w${i}`, `W${i}`, 'A', { createdAt: daysAgo(2), listings: [listing(1000 + i)] }));
    }
    db.books.push(book('old', 'Old', 'A', { createdAt: daysAgo(200), listings: [listing(999)] }));
    // window has >= 24 books → no fallback → the daysAgo(200) book is out of the
    // 30-day window measured from the FIXED now, so it must be excluded.
    const home = await buildHome(makeFakePrisma(db), SILENT);
    const novynky = shelfBy(home, 'novynky')!;
    expect(novynky.books.map((b) => b.id)).not.toContain('old');
    expect(novynky.books).toHaveLength(12);
  });

  it('deterministic: same DB → identical output', async () => {
    const prisma = makeFakePrisma(bigDb());
    const a = await buildHome(prisma, SILENT);
    const b = await buildHome(prisma, SILENT);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('candidate limits follow take × multiplier (36/60/120), not magic numbers', () => {
    const bySlug = new Map(HOME_LAYOUT.sections.map((s) => [s.slug, s]));
    expect(bySlug.get('knyhovyk-radyt')!.take * bySlug.get('knyhovyk-radyt')!.candidateMultiplier).toBe(36);
    expect(bySlug.get('novynky')!.take * bySlug.get('novynky')!.candidateMultiplier).toBe(60);
    expect(bySlug.get('populyarne-zaraz')!.take * bySlug.get('populyarne-zaraz')!.candidateMultiplier).toBe(120);
  });
});

describe('GET /api/home — route + cache + wishlist', () => {
  beforeEach(() => clearCache());

  /** Flatten all books across shelves (dedup guarantees each id appears once). */
  function allBooks(body: { shelves: { key: string; books: { id: string; isWishlisted: boolean }[] }[] }) {
    return body.shelves.flatMap((s) => s.books);
  }

  it('responds { shelves: [{ key, books }] } and is public (guest 200, isWishlisted false)', async () => {
    const app = buildApp(makeFakePrisma(bigDb()), undefined, { clock: fixedClock(NOW) });
    const res = await app.inject({ method: 'GET', url: '/api/home' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { shelves: { key: string; books: { isWishlisted: boolean }[] }[] };
    expect(body.shelves.length).toBeGreaterThan(0);
    expect(body.shelves.flatMap((s) => s.books).every((b) => b.isWishlisted === false)).toBe(true);
  });

  it('guest and auth get the SAME composition; only isWishlisted differs', async () => {
    const db = bigDb();
    const userId = 'user-a-id-111111111111111111111111';
    const token = 'home-token-a-fixed-32bytes__________';
    db.users.push({ id: userId, email: 'a@example.com', createdAt: NOW });
    db.sessions.push({ id: 'sa', userId, tokenHash: hashTokenSeed(token), expiresAt: new Date(NOW.getTime() + 30 * DAY_MS), createdAt: NOW });
    db.wishlistItems.push({ userId, canonicalBookId: 'ed0' }); // ed0 is a curated book → lands on knyhovyk
    const prisma = makeFakePrisma(db);
    const app = buildApp(prisma, makeAuthDeps(prisma, NOW), { clock: fixedClock(NOW) });

    const guest = await app.inject({ method: 'GET', url: '/api/home' });
    const auth = await app.inject({ method: 'GET', url: '/api/home', headers: { cookie: `kn_session=${token}` } });

    const idsOf = (res: typeof guest) =>
      (res.json().shelves as { key: string; books: { id: string }[] }[]).map((s) => ({ key: s.key, ids: s.books.map((b) => b.id) }));
    expect(idsOf(auth)).toEqual(idsOf(guest)); // identical composition + order

    const authBooks = allBooks(auth.json());
    expect(authBooks.find((b) => b.id === 'ed0')?.isWishlisted).toBe(true);
    expect(authBooks.filter((b) => b.id !== 'ed0').every((b) => b.isWishlisted === false)).toBe(true);
    // Guest sees the same book, but not wishlisted.
    expect(allBooks(guest.json()).find((b) => b.id === 'ed0')?.isWishlisted).toBe(false);
  });

  it('cache is user-agnostic: A warms, B sees false, A still true', async () => {
    const db = bigDb();
    const userA = 'user-a-id-111111111111111111111111';
    const userB = 'user-b-id-222222222222222222222222';
    const tokenA = 'home-token-a-fixed-32bytes__________';
    const tokenB = 'home-token-b-fixed-32bytes__________';
    db.users.push({ id: userA, email: 'a@example.com', createdAt: NOW }, { id: userB, email: 'b@example.com', createdAt: NOW });
    db.sessions.push(
      { id: 'sa', userId: userA, tokenHash: hashTokenSeed(tokenA), expiresAt: new Date(NOW.getTime() + 30 * DAY_MS), createdAt: NOW },
      { id: 'sb', userId: userB, tokenHash: hashTokenSeed(tokenB), expiresAt: new Date(NOW.getTime() + 30 * DAY_MS), createdAt: NOW },
    );
    db.wishlistItems.push({ userId: userA, canonicalBookId: 'ed0' });
    const prisma = makeFakePrisma(db);
    const app = buildApp(prisma, makeAuthDeps(prisma, NOW), { clock: fixedClock(NOW) });

    const wishOf = (res: Awaited<ReturnType<typeof app.inject>>): boolean | undefined =>
      allBooks(res.json()).find((b) => b.id === 'ed0')?.isWishlisted;

    const a1 = await app.inject({ method: 'GET', url: '/api/home', headers: { cookie: `kn_session=${tokenA}` } });
    expect(wishOf(a1)).toBe(true);
    const b = await app.inject({ method: 'GET', url: '/api/home', headers: { cookie: `kn_session=${tokenB}` } });
    expect(wishOf(b)).toBe(false);
    const a2 = await app.inject({ method: 'GET', url: '/api/home', headers: { cookie: `kn_session=${tokenA}` } });
    expect(wishOf(a2)).toBe(true);
  });

  it('cache hit path: getHome returns identical composition on a warm second call', async () => {
    const prisma = makeFakePrisma(bigDb());
    const first = await getHome(prisma, null, fixedClock(NOW));
    const second = await getHome(prisma, null, fixedClock(NOW));
    expect(JSON.stringify(second)).toEqual(JSON.stringify(first));
  });

  it('cold build issues exactly one wishlist-count query (no redundant build-time query)', async () => {
    const prisma = makeFakePrisma(bigDb());
    await getHome(prisma, null, fixedClock(NOW));
    // wishlistCount is decorated live post-cache only — the user-agnostic build
    // must NOT also query wishlist counts.
    const groupBy = prisma.wishlistItem.groupBy as unknown as ReturnType<typeof vi.fn>;
    expect(groupBy).toHaveBeenCalledTimes(1);
  });
});
