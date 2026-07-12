import { describe, expect, it, vi } from 'vitest';
import { GenreSource, Provider, type PrismaClient } from '@prisma/client';
import { runPostScrapeGenreAssignment } from '../post-scrape-assignment.js';

/**
 * Orchestration tests for the G5 post-scrape assignment hook processor: it
 * must reuse the exact same mapping/decision/write primitives as
 * `genres:backfill` (verified indirectly here through identical outcomes),
 * scoped to an explicit id list instead of keyset pagination. Fully
 * deterministic — injected clock, no DB.
 */

const NOW = new Date('2026-07-12T12:00:00.000Z');
const OLD = new Date('2026-07-01T00:00:00.000Z');

const GENRES = [
  { id: 'g-fentezi', slug: 'fentezi' },
  { id: 'g-biznes', slug: 'biznes' },
];

const MAPPINGS = [
  { provider: Provider.BOOK_CLUB, sourceCategory: 'фентезі', genreId: 'g-fentezi', confidence: 95 },
  { provider: Provider.BOOK_CLUB, sourceCategory: 'бізнес', genreId: 'g-biznes', confidence: 90 },
];

interface FakeListing {
  provider: Provider;
  rawCategories: string[];
  url: string;
}

interface FakeBook {
  id: string;
  title: string;
  isbn: string | null;
  genreId: string | null;
  genreSource: GenreSource | null;
  genreConfidence: number | null;
  genreUpdatedAt: Date | null;
  listings: FakeListing[];
}

interface FakeDb {
  books: FakeBook[];
}

function book(id: string, overrides: Partial<FakeBook> = {}): FakeBook {
  return {
    id,
    title: `Книга ${id}`,
    isbn: `978-${id}`,
    genreId: null,
    genreSource: null,
    genreConfidence: null,
    genreUpdatedAt: null,
    listings: [],
    ...overrides,
  };
}

function ksd(categories: string[], url = 'https://ksd.example/b'): FakeListing {
  return { provider: Provider.BOOK_CLUB, rawCategories: categories, url };
}

interface FakeStats {
  updates: number;
  transactions: number;
  findManyCalls: { id: { in: string[] } }[];
}

function makeFakePrisma(db: FakeDb): { prisma: PrismaClient; stats: FakeStats } {
  const stats: FakeStats = { updates: 0, transactions: 0, findManyCalls: [] };

  const client = {
    genreMapping: { findMany: vi.fn(async () => MAPPINGS.map((m) => ({ ...m }))) },
    collection: { findMany: vi.fn(async () => GENRES.map((g) => ({ ...g }))) },
    canonicalBook: {
      findMany: vi.fn(async (args: { where: { id: { in: string[] } } }) => {
        stats.findManyCalls.push(args.where);
        const ids = new Set(args.where.id.in);
        return db.books
          .filter((b) => ids.has(b.id))
          .map((b) => ({ ...b, listings: b.listings.map((l) => ({ ...l })) }));
      }),
      update: vi.fn(
        async (args: {
          where: { id: string };
          data: {
            genreId: string | null;
            genreSource: GenreSource | null;
            genreConfidence: number | null;
            genreUpdatedAt: Date | null;
          };
        }) => {
          stats.updates += 1;
          const target = db.books.find((b) => b.id === args.where.id);
          if (!target) throw new Error(`fake update: no book ${args.where.id}`);
          target.genreId = args.data.genreId;
          target.genreSource = args.data.genreSource;
          target.genreConfidence = args.data.genreConfidence;
          target.genreUpdatedAt = args.data.genreUpdatedAt;
          return { ...target };
        },
      ),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      stats.transactions += 1;
      return cb(client);
    }),
  };

  return { prisma: client as unknown as PrismaClient, stats };
}

describe('runPostScrapeGenreAssignment', () => {
  it('is a no-op and touches nothing when the id list is empty', async () => {
    const { prisma, stats } = makeFakePrisma({ books: [] });

    const result = await runPostScrapeGenreAssignment(prisma, [], { now: () => NOW });

    expect(result).toMatchObject({ affectedBookCount: 0, batches: 0 });
    expect(result.counters.processed).toBe(0);
    expect(prisma.genreMapping.findMany).not.toHaveBeenCalled();
    expect(stats.transactions).toBe(0);
  });

  it('assigns a mapped genre only to the requested book, ignoring the rest of the table', async () => {
    const db: FakeDb = {
      books: [
        book('b1', { listings: [ksd(['Фентезі'])] }),
        book('b2', { listings: [ksd(['Бізнес'])] }), // not in the affected list
      ],
    };
    const { prisma, stats } = makeFakePrisma(db);

    const result = await runPostScrapeGenreAssignment(prisma, ['b1'], { now: () => NOW });

    expect(db.books[0]).toMatchObject({ genreId: 'g-fentezi', genreSource: GenreSource.PROVIDER_MAPPING });
    expect(db.books[1]!.genreId).toBeNull(); // untouched — was never in the affected set
    expect(result.counters).toMatchObject({ processed: 1, assigned: 1 });
    expect(result.affectedBookCount).toBe(1);
    expect(stats.updates).toBe(1);
  });

  it('dedupes repeated ids into a single processed book', async () => {
    const db: FakeDb = { books: [book('b1', { listings: [ksd(['Фентезі'])] })] };
    const { prisma } = makeFakePrisma(db);

    const result = await runPostScrapeGenreAssignment(prisma, ['b1', 'b1', 'b1'], { now: () => NOW });

    expect(result.affectedBookCount).toBe(1);
    expect(result.counters.processed).toBe(1);
  });

  it('never touches a MANUAL assignment (§4.5 absolute lock)', async () => {
    const db: FakeDb = {
      books: [
        book('b1', {
          genreId: 'g-biznes',
          genreSource: GenreSource.MANUAL,
          genreUpdatedAt: OLD,
          listings: [ksd(['Фентезі'])],
        }),
      ],
    };
    const { prisma, stats } = makeFakePrisma(db);

    const result = await runPostScrapeGenreAssignment(prisma, ['b1'], { now: () => NOW });

    expect(db.books[0]).toMatchObject({ genreId: 'g-biznes', genreSource: GenreSource.MANUAL });
    expect(result.counters.manualSkipped).toBe(1);
    expect(stats.updates).toBe(0);
  });

  it('overwrites a PROVIDER_MAPPING assignment when the result changes', async () => {
    const db: FakeDb = {
      books: [
        book('b1', {
          genreId: 'g-biznes',
          genreSource: GenreSource.PROVIDER_MAPPING,
          genreConfidence: 90,
          listings: [ksd(['Фентезі'])],
        }),
      ],
    };
    const { prisma } = makeFakePrisma(db);

    const result = await runPostScrapeGenreAssignment(prisma, ['b1'], { now: () => NOW });

    expect(db.books[0]!.genreId).toBe('g-fentezi');
    expect(result.counters.changed).toBe(1);
  });

  it('overwrites SEED only at confidence ≥ 70', async () => {
    const db: FakeDb = {
      books: [
        book('b1', {
          genreId: 'g-biznes',
          genreSource: GenreSource.SEED,
          listings: [ksd(['Фентезі'])], // confidence 95 ≥ 70
        }),
      ],
    };
    const { prisma } = makeFakePrisma(db);

    await runPostScrapeGenreAssignment(prisma, ['b1'], { now: () => NOW });

    expect(db.books[0]!.genreId).toBe('g-fentezi');
  });

  it('never clears a stale PROVIDER_MAPPING assignment (clearStale is never used here)', async () => {
    const db: FakeDb = {
      books: [
        book('b1', {
          genreId: 'g-fentezi',
          genreSource: GenreSource.PROVIDER_MAPPING,
          genreConfidence: 95,
          listings: [ksd([])], // signal vanished
        }),
      ],
    };
    const { prisma, stats } = makeFakePrisma(db);

    const result = await runPostScrapeGenreAssignment(prisma, ['b1'], { now: () => NOW });

    expect(db.books[0]!.genreId).toBe('g-fentezi'); // kept, never cleared
    expect(result.counters.cleared).toBe(0);
    expect(stats.updates).toBe(0);
  });

  it('does not assign when there is no mapping result (no-signal book)', async () => {
    const db: FakeDb = { books: [book('b1')] };
    const { prisma, stats } = makeFakePrisma(db);

    const result = await runPostScrapeGenreAssignment(prisma, ['b1'], { now: () => NOW });

    expect(result.counters.noSignal).toBe(1);
    expect(stats.updates).toBe(0);
  });

  it('chunks lookups by batchSize and loads the engine context exactly once', async () => {
    const db: FakeDb = {
      books: ['b1', 'b2', 'b3'].map((id) => book(id, { listings: [ksd(['Фентезі'])] })),
    };
    const { prisma, stats } = makeFakePrisma(db);

    const result = await runPostScrapeGenreAssignment(prisma, ['b1', 'b2', 'b3'], {
      now: () => NOW,
      batchSize: 2,
    });

    expect(result.batches).toBe(2);
    expect(stats.findManyCalls).toHaveLength(2);
    expect(prisma.genreMapping.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.collection.findMany).toHaveBeenCalledTimes(1);
    expect(db.books.every((b) => b.genreId === 'g-fentezi')).toBe(true);
  });

  it('is idempotent: a second pass over the same ids writes nothing new', async () => {
    const db: FakeDb = { books: [book('b1', { listings: [ksd(['Фентезі'])] })] };
    const { prisma, stats } = makeFakePrisma(db);

    await runPostScrapeGenreAssignment(prisma, ['b1'], { now: () => NOW });
    expect(stats.updates).toBe(1);

    const second = await runPostScrapeGenreAssignment(prisma, ['b1'], {
      now: () => new Date('2026-07-13T00:00:00Z'),
    });

    expect(stats.updates).toBe(1); // no new write
    expect(second.counters).toMatchObject({ assigned: 0, changed: 0, unchanged: 1 });
  });
});
