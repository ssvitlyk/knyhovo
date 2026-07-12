import { describe, expect, it, vi } from 'vitest';
import { GenreSource, Provider, type PrismaClient } from '@prisma/client';
import {
  formatBackfillSummary,
  formatBatchProgress,
  runGenreBackfill,
  type BackfillBatchProgress,
} from '../backfill.js';

/**
 * Orchestration tests for the `genres:backfill` pass (PRD §8.1, G4) on an
 * in-memory fake Prisma client: batching, keyset cursor + resume, dry-run,
 * idempotency, --only-unassigned, --clear-stale, the MANUAL lock (§4.5) and
 * the report accumulators. Fully deterministic — injected clock, no DB.
 *
 * The engine/assignment semantics themselves are covered by
 * `mapping-engine.test.ts` and `assignment.test.ts`; here we only verify the
 * pass wires them together and touches the database correctly.
 */

const NOW = new Date('2026-07-12T12:00:00.000Z');
const OLD = new Date('2026-07-01T00:00:00.000Z');

const GENRES = [
  { id: 'g-fentezi', slug: 'fentezi' },
  { id: 'g-fantastyka', slug: 'fantastyka' },
  { id: 'g-biznes', slug: 'biznes' },
];

const MAPPINGS = [
  { provider: Provider.BOOK_CLUB, sourceCategory: 'фентезі', genreId: 'g-fentezi', confidence: 95 },
  { provider: Provider.BOOK_CLUB, sourceCategory: 'фантастика', genreId: 'g-fantastyka', confidence: 90 },
  { provider: Provider.BOOK_CLUB, sourceCategory: 'бізнес', genreId: 'g-biznes', confidence: 90 },
  { provider: Provider.BOOKCHEF, sourceCategory: 'фентезі', genreId: 'g-fentezi', confidence: 91 },
  { provider: Provider.KNIGOLAND, sourceCategory: 'акції', genreId: null, confidence: 100 },
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

function bookchef(categories: string[], url = 'https://bookchef.example/b'): FakeListing {
  return { provider: Provider.BOOKCHEF, rawCategories: categories, url };
}

interface FakeStats {
  updates: number;
  transactions: number;
  findManyPages: number;
}

function makeFakePrisma(db: FakeDb): { prisma: PrismaClient; stats: FakeStats } {
  const stats: FakeStats = { updates: 0, transactions: 0, findManyPages: 0 };

  const client = {
    genreMapping: {
      findMany: vi.fn(async () => MAPPINGS.map((m) => ({ ...m }))),
    },
    collection: {
      findMany: vi.fn(async () => GENRES.map((g) => ({ ...g }))),
    },
    canonicalBook: {
      findMany: vi.fn(
        async (args: {
          where?: { id?: { gt: string }; genreId?: string | null };
          take?: number;
        }) => {
          stats.findManyPages += 1;
          let rows = [...db.books].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
          const gt = args.where?.id?.gt;
          if (gt !== undefined) rows = rows.filter((b) => b.id > gt);
          if (args.where !== undefined && 'genreId' in args.where) {
            rows = rows.filter((b) => b.genreId === args.where?.genreId);
          }
          if (args.take !== undefined) rows = rows.slice(0, args.take);
          return rows.map((b) => ({ ...b, listings: b.listings.map((l) => ({ ...l })) }));
        },
      ),
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

function snapshot(db: FakeDb): ReadonlyMap<string, string> {
  return new Map(
    db.books.map((b) => [
      b.id,
      `${b.genreId ?? '∅'}|${b.genreSource ?? '∅'}|${b.genreConfidence ?? '∅'}|${b.genreUpdatedAt?.toISOString() ?? '∅'}`,
    ]),
  );
}

describe('runGenreBackfill — assignment orchestration', () => {
  it('assigns mapped genres to unassigned books and stamps the injected clock', async () => {
    const db: FakeDb = { books: [book('b1', { listings: [ksd(['Фентезі'])] })] };
    const { prisma, stats } = makeFakePrisma(db);

    const result = await runGenreBackfill(prisma, { now: () => NOW });

    expect(db.books[0]).toMatchObject({
      genreId: 'g-fentezi',
      genreSource: GenreSource.PROVIDER_MAPPING,
      genreConfidence: 95,
      genreUpdatedAt: NOW,
    });
    expect(result.counters).toMatchObject({ processed: 1, assigned: 1, changed: 0 });
    expect(stats.updates).toBe(1);
    expect(stats.transactions).toBe(1);
  });

  it('never touches MANUAL assignments (§4.5), whatever the signal says', async () => {
    const db: FakeDb = {
      books: [
        book('b1', {
          genreId: 'g-biznes',
          genreSource: GenreSource.MANUAL,
          genreUpdatedAt: OLD,
          listings: [ksd(['Фентезі']), bookchef(['Художня література', 'Фентезі'])],
        }),
      ],
    };
    const { prisma, stats } = makeFakePrisma(db);

    const result = await runGenreBackfill(prisma, { now: () => NOW, clearStale: true });

    expect(db.books[0]).toMatchObject({
      genreId: 'g-biznes',
      genreSource: GenreSource.MANUAL,
      genreUpdatedAt: OLD,
    });
    expect(result.counters.manualSkipped).toBe(1);
    expect(stats.updates).toBe(0);
    expect(stats.transactions).toBe(0);
  });

  it('overwrites SEED only through the assignment layer rules (confidence ≥ 70)', async () => {
    const db: FakeDb = {
      books: [
        book('b1', {
          genreId: 'g-biznes',
          genreSource: GenreSource.SEED,
          listings: [ksd(['Фентезі'])], // 95 ≥ 70 → overwritten
        }),
      ],
    };
    const { prisma } = makeFakePrisma(db);

    const result = await runGenreBackfill(prisma, { now: () => NOW });

    expect(db.books[0]).toMatchObject({
      genreId: 'g-fentezi',
      genreSource: GenreSource.PROVIDER_MAPPING,
    });
    expect(result.counters.changed).toBe(1);
  });

  it('dry-run computes everything but writes nothing', async () => {
    const db: FakeDb = {
      books: [
        book('b1', { listings: [ksd(['Фентезі'])] }),
        book('b2', { listings: [ksd(['Бізнес'])] }),
      ],
    };
    const { prisma, stats } = makeFakePrisma(db);

    const result = await runGenreBackfill(prisma, { dryRun: true, now: () => NOW });

    expect(result.counters.assigned).toBe(2);
    expect(result.dryRun).toBe(true);
    expect(stats.updates).toBe(0);
    expect(stats.transactions).toBe(0);
    expect(db.books.every((b) => b.genreId === null)).toBe(true);
  });

  it('is idempotent: a second run performs zero writes', async () => {
    const db: FakeDb = {
      books: [
        book('b1', { listings: [ksd(['Фентезі'])] }),
        book('b2', { listings: [bookchef(['Художня література', 'Фентезі'])] }),
        book('b3'), // no listings at all
      ],
    };
    const { prisma, stats } = makeFakePrisma(db);

    await runGenreBackfill(prisma, { now: () => NOW });
    const afterFirst = snapshot(db);
    const firstWrites = stats.updates;
    expect(firstWrites).toBe(2);

    const second = await runGenreBackfill(prisma, { now: () => new Date('2026-07-13T00:00:00Z') });

    expect(stats.updates).toBe(firstWrites); // no new writes
    expect(snapshot(db)).toEqual(afterFirst); // genreUpdatedAt untouched too
    expect(second.counters).toMatchObject({ assigned: 0, changed: 0, unchanged: 2, noSignal: 1 });
  });

  it('paginates with keyset batches and reports a resume cursor per batch', async () => {
    const db: FakeDb = {
      books: ['b1', 'b2', 'b3', 'b4', 'b5'].map((id) => book(id, { listings: [ksd(['Фентезі'])] })),
    };
    const { prisma, stats } = makeFakePrisma(db);
    const progress: BackfillBatchProgress[] = [];

    const result = await runGenreBackfill(prisma, {
      batchSize: 2,
      now: () => NOW,
      onBatch: (p) => progress.push(p),
    });

    expect(result.batches).toBe(3);
    expect(progress.map((p) => p.cursor)).toEqual(['b2', 'b4', 'b5']);
    expect(progress.map((p) => p.batchBooks)).toEqual([2, 2, 1]);
    expect(progress.map((p) => p.batchWrites)).toEqual([2, 2, 1]);
    expect(result.lastCursor).toBe('b5');
    expect(stats.transactions).toBe(3); // one per batch with writes
    expect(db.books.every((b) => b.genreId === 'g-fentezi')).toBe(true);
  });

  it('resumes from a cursor: interrupted-then-resumed equals one full run', async () => {
    const seed = (): FakeDb => ({
      books: [
        book('b1', { listings: [ksd(['Фентезі'])] }),
        book('b2', { listings: [ksd(['Бізнес'])] }),
        book('b3', { listings: [bookchef(['Художня література', 'Фентезі'])] }),
        book('b4', { genreId: 'g-biznes', genreSource: GenreSource.MANUAL, genreUpdatedAt: OLD }),
        book('b5', { listings: [ksd(['Фантастика'])] }),
      ],
    });

    // Reference: one uninterrupted full run.
    const full = seed();
    await runGenreBackfill(makeFakePrisma(full).prisma, { batchSize: 2, now: () => NOW });

    // Crash after the first committed batch (onBatch fires post-commit), then
    // resume from the logged cursor — the PRD §8.1 resume mechanism.
    const resumed = seed();
    const { prisma } = makeFakePrisma(resumed);
    class StopAfterFirstBatch extends Error {}
    let savedCursor: string | null = null;
    await expect(
      runGenreBackfill(prisma, {
        batchSize: 2,
        now: () => NOW,
        onBatch: (p) => {
          savedCursor = p.cursor;
          throw new StopAfterFirstBatch();
        },
      }),
    ).rejects.toBeInstanceOf(StopAfterFirstBatch);
    expect(savedCursor).toBe('b2');

    await runGenreBackfill(prisma, { batchSize: 2, cursor: savedCursor, now: () => NOW });

    expect(snapshot(resumed)).toEqual(snapshot(full));
  });

  it('--only-unassigned processes only books with genre_id IS NULL', async () => {
    const db: FakeDb = {
      books: [
        book('b1', { listings: [ksd(['Фентезі'])] }),
        book('b2', {
          genreId: 'g-biznes',
          genreSource: GenreSource.SEED,
          genreUpdatedAt: OLD,
          listings: [ksd(['Фентезі'])], // would be overwritten in a full pass
        }),
      ],
    };
    const { prisma } = makeFakePrisma(db);

    const result = await runGenreBackfill(prisma, { onlyUnassigned: true, now: () => NOW });

    expect(result.counters.processed).toBe(1);
    expect(db.books[0]?.genreId).toBe('g-fentezi');
    expect(db.books[1]).toMatchObject({ genreId: 'g-biznes', genreSource: GenreSource.SEED });
  });

  it('keeps a PROVIDER_MAPPING assignment on vanished signal by default (graceful)', async () => {
    const db: FakeDb = {
      books: [
        book('b1', {
          genreId: 'g-fentezi',
          genreSource: GenreSource.PROVIDER_MAPPING,
          genreConfidence: 95,
          genreUpdatedAt: OLD,
          listings: [ksd([])],
        }),
      ],
    };
    const { prisma, stats } = makeFakePrisma(db);

    const result = await runGenreBackfill(prisma, { now: () => NOW });

    expect(db.books[0]?.genreId).toBe('g-fentezi');
    expect(result.counters.noSignal).toBe(1);
    expect(stats.updates).toBe(0);
  });

  it('clears a stale PROVIDER_MAPPING assignment only with clearStale (§8.2 parity)', async () => {
    const db: FakeDb = {
      books: [
        book('b1', {
          genreId: 'g-fentezi',
          genreSource: GenreSource.PROVIDER_MAPPING,
          genreConfidence: 95,
          genreUpdatedAt: OLD,
          listings: [ksd([])],
        }),
      ],
    };
    const { prisma } = makeFakePrisma(db);

    const result = await runGenreBackfill(prisma, { clearStale: true, now: () => NOW });

    expect(db.books[0]).toMatchObject({
      genreId: null,
      genreSource: null,
      genreConfidence: null,
      genreUpdatedAt: null,
    });
    expect(result.counters.cleared).toBe(1);
  });

  it('separates no-signal from unmapped-signal books in the counters (PRD §13)', async () => {
    const db: FakeDb = {
      books: [
        book('b1'), // no listings → no-signal
        book('b2', { listings: [ksd(['Щось геть невідоме'])] }), // signal, unmapped
        book('b3', { listings: [{ provider: Provider.KNIGOLAND, rawCategories: ['Акції'], url: 'u' }] }), // ignore rule only
      ],
    };
    const { prisma } = makeFakePrisma(db);

    const result = await runGenreBackfill(prisma, { now: () => NOW });

    expect(result.counters.noSignal).toBe(1);
    expect(result.counters.unmappedBooks).toBe(2); // b2 unmapped, b3 all-ignored (signal, no result)
    expect(result.coverage).toEqual({
      booksWithSignal: 2,
      booksWithGenre: 0,
      booksWithSignalAndGenre: 0,
    });
  });

  it('collects unmapped and ambiguous reports when asked (§8.3, §8.4)', async () => {
    const db: FakeDb = {
      books: [
        book('b1', {
          title: 'Дюна',
          isbn: '978-dune',
          listings: [ksd(['Фантастика']), bookchef(['Художня література', 'Фентезі'])],
        }),
        book('b2', { listings: [ksd(['Щось геть невідоме'])] }),
      ],
    };
    const { prisma } = makeFakePrisma(db);

    const result = await runGenreBackfill(prisma, { collectReports: true, now: () => NOW });

    // Every unresolved element is observable: the unknown KSD category AND the
    // broad bookchef root that has neither a rule nor a DB-resolvable alias.
    const unmappedRows = result.unmappedReport?.rows() ?? [];
    expect(unmappedRows).toHaveLength(2);
    expect(unmappedRows).toContainEqual(
      expect.objectContaining({
        provider: 'book-club',
        normalizedKey: 'щось геть невідоме',
        listingCount: 1,
      }),
    );
    expect(unmappedRows).toContainEqual(
      expect.objectContaining({ provider: 'bookchef', normalizedKey: 'художня література' }),
    );

    // 91 (bookchef фентезі) vs 90 (ksd фантастика) → distance 1 ≤ 5 → ambiguous.
    const ambiguous = result.ambiguousReport?.entries() ?? [];
    expect(ambiguous).toHaveLength(1);
    expect(ambiguous[0]?.book).toEqual({ title: 'Дюна', isbn: '978-dune' });
    // Assignment still follows the deterministic rules: fentezi (91) wins.
    expect(db.books[0]?.genreId).toBe('g-fentezi');
  });

  it('skips report accumulation entirely by default', async () => {
    const db: FakeDb = { books: [book('b1', { listings: [ksd(['Щось геть невідоме'])] })] };
    const { prisma } = makeFakePrisma(db);

    const result = await runGenreBackfill(prisma);

    expect(result.unmappedReport).toBeNull();
    expect(result.ambiguousReport).toBeNull();
  });

  it('returns null lastCursor and zero batches on an empty book set', async () => {
    const { prisma, stats } = makeFakePrisma({ books: [] });

    const result = await runGenreBackfill(prisma, { now: () => NOW });

    expect(result).toMatchObject({ batches: 0, lastCursor: null });
    expect(result.counters.processed).toBe(0);
    expect(stats.transactions).toBe(0);
  });
});

describe('progress and summary formatting', () => {
  it('formats the §8.1 progress line with all counters and the cursor', () => {
    const line = formatBatchProgress({
      batch: 3,
      batchBooks: 500,
      batchWrites: 12,
      cursor: 'book-abc',
      counters: {
        processed: 1500,
        assigned: 10,
        changed: 2,
        cleared: 0,
        unchanged: 1400,
        manualSkipped: 3,
        noSignal: 80,
        unmappedBooks: 5,
      },
    });
    expect(line).toContain('batch 3');
    expect(line).toContain('assigned=10');
    expect(line).toContain('manual-skipped=3');
    expect(line).toContain('no-signal=80');
    expect(line).toContain('cursor=book-abc');
  });

  it('formats the summary with mapping coverage, n/a when no book has signal', async () => {
    const { prisma } = makeFakePrisma({ books: [book('b1')] });
    const result = await runGenreBackfill(prisma, { now: () => NOW });
    const summary = formatBackfillSummary(result);
    expect(summary).toContain('processed=1');
    expect(summary).toContain('mapping-coverage=n/a');
    expect(summary).toContain('dryRun=false');
  });

  it('formats mapping coverage as a percentage of books with signal', async () => {
    const db: FakeDb = {
      books: [
        book('b1', { listings: [ksd(['Фентезі'])] }),
        book('b2', { listings: [ksd(['Щось геть невідоме'])] }),
      ],
    };
    const { prisma } = makeFakePrisma(db);
    const result = await runGenreBackfill(prisma, { now: () => NOW });
    expect(formatBackfillSummary(result)).toContain('mapping-coverage=50.0%');
  });
});
