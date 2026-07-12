/**
 * G4 real-Postgres integration for `genres:backfill` (PRD §10 G4 tests):
 * seeded books + listings + mappings → pass → assignments verified, MANUAL
 * untouched, second run writes nothing, cursor-resume equivalent, dry-run
 * writes nothing, --only-unassigned scoped, --clear-stale, the §8.2 rollback
 * SQL, and the ad-hoc `unnest GROUP BY` distribution (§8.1 step 6).
 *
 * Gated on `TEST_DATABASE_URL` — skipped entirely otherwise (same pattern as
 * `collections/__tests__/feeds.pg.test.ts`). Both pg suites truncate shared
 * tables, so run pg files one at a time, e.g.:
 *
 *   docker exec knyhovo-db-1 psql -U knyhovo -d postgres -c "CREATE DATABASE knyhovo_test"
 *   DATABASE_URL=postgresql://knyhovo:knyhovo@localhost:5432/knyhovo_test npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://knyhovo:knyhovo@localhost:5432/knyhovo_test npx vitest run src/genres/__tests__/backfill.pg.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenreSource, PrismaClient, Provider } from '@prisma/client';
import { runGenreBackfill, type BackfillBatchProgress } from '../backfill.js';
import { listRawCategoryDistribution } from '../repository.js';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const NOW = new Date('2026-07-12T12:00:00.000Z');
const SEED_TIME = new Date('2026-07-01T00:00:00.000Z');

describe.skipIf(!TEST_DATABASE_URL)('genres:backfill — Postgres integration (G4)', () => {
  const prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });

  const G_FENTEZI = 'g4-genre-fentezi';
  const G_FANTASTYKA = 'g4-genre-fantastyka';
  const G_BIZNES = 'g4-genre-biznes';

  /** id → seed genre state; used to reset between scenarios. */
  const SEED_ASSIGNMENTS: Record<
    string,
    { genreId: string | null; genreSource: GenreSource | null; genreConfidence: number | null }
  > = {
    'g4-b1': { genreId: null, genreSource: null, genreConfidence: null },
    'g4-b2': { genreId: G_BIZNES, genreSource: GenreSource.MANUAL, genreConfidence: null },
    'g4-b3': { genreId: G_BIZNES, genreSource: GenreSource.SEED, genreConfidence: null },
    'g4-b4': { genreId: G_BIZNES, genreSource: GenreSource.SEED, genreConfidence: null },
    'g4-b5': { genreId: G_FENTEZI, genreSource: GenreSource.PROVIDER_MAPPING, genreConfidence: 95 },
    'g4-b6': { genreId: null, genreSource: null, genreConfidence: null },
    'g4-b7': { genreId: null, genreSource: null, genreConfidence: null },
  };

  async function resetAssignments(): Promise<void> {
    for (const [id, state] of Object.entries(SEED_ASSIGNMENTS)) {
      await prisma.canonicalBook.update({
        where: { id },
        data: { ...state, genreUpdatedAt: state.genreSource === null ? null : SEED_TIME },
      });
    }
  }

  interface GenreState {
    genreId: string | null;
    genreSource: GenreSource | null;
    genreConfidence: number | null;
    genreUpdatedAt: Date | null;
  }

  async function genreStates(): Promise<Map<string, GenreState>> {
    const rows = await prisma.canonicalBook.findMany({
      where: { id: { startsWith: 'g4-b' } },
      select: { id: true, genreId: true, genreSource: true, genreConfidence: true, genreUpdatedAt: true },
    });
    return new Map(rows.map(({ id, ...state }) => [id, state]));
  }

  beforeAll(async () => {
    await prisma.priceHistoryPoint.deleteMany({});
    await prisma.wishlistItem.deleteMany({});
    await prisma.collectionItem.deleteMany({});
    await prisma.providerListing.deleteMany({});
    await prisma.canonicalBook.deleteMany({});
    await prisma.genreMapping.deleteMany({});
    await prisma.collection.deleteMany({});
    await prisma.user.deleteMany({});

    await prisma.collection.createMany({
      data: [
        { id: G_FENTEZI, slug: 'fentezi', type: 'TAXONOMIC', name: 'Фентезі', description: 'ф' },
        { id: G_FANTASTYKA, slug: 'fantastyka', type: 'TAXONOMIC', name: 'Фантастика', description: 'ф' },
        { id: G_BIZNES, slug: 'biznes', type: 'TAXONOMIC', name: 'Бізнес', description: 'б' },
      ],
    });

    await prisma.genreMapping.createMany({
      data: [
        { provider: Provider.BOOK_CLUB, sourceCategory: 'фентезі', genreId: G_FENTEZI, confidence: 95 },
        { provider: Provider.BOOK_CLUB, sourceCategory: 'фантастика', genreId: G_FANTASTYKA, confidence: 90 },
        { provider: Provider.BOOK_CLUB, sourceCategory: 'сучасна проза', genreId: G_FENTEZI, confidence: 50 },
        { provider: Provider.BOOKCHEF, sourceCategory: 'фентезі', genreId: G_FENTEZI, confidence: 91 },
        { provider: Provider.KNIGOLAND, sourceCategory: 'акції', genreId: null, confidence: 100 },
      ],
    });

    const books: {
      id: string;
      title: string;
      listings: { provider: Provider; rawCategories: string[] }[];
    }[] = [
      // unassigned + mapped KSD signal → assigned (95)
      { id: 'g4-b1', title: 'Відьмак', listings: [{ provider: Provider.BOOK_CLUB, rawCategories: ['Фентезі'] }] },
      // MANUAL → absolute lock, whatever the signal
      { id: 'g4-b2', title: 'Ручна книга', listings: [{ provider: Provider.BOOK_CLUB, rawCategories: ['Фентезі'] }] },
      // SEED + confidence 95 ≥ 70 → overwritten
      { id: 'g4-b3', title: 'Сідована книга', listings: [{ provider: Provider.BOOK_CLUB, rawCategories: ['Фентезі'] }] },
      // SEED + confidence 50 < 70 → kept
      { id: 'g4-b4', title: 'Слабкий сигнал', listings: [{ provider: Provider.BOOK_CLUB, rawCategories: ['Сучасна проза'] }] },
      // PROVIDER_MAPPING with vanished signal → kept; cleared only with --clear-stale
      { id: 'g4-b5', title: 'Зниклий сигнал', listings: [{ provider: Provider.BOOK_CLUB, rawCategories: [] }] },
      // no listings at all → no-signal
      { id: 'g4-b6', title: 'Без лістингів', listings: [] },
      // signal present but unmapped → unmapped report feed
      { id: 'g4-b7', title: 'Незамаплена', listings: [{ provider: Provider.KNIGOLAND, rawCategories: ['Невідома категорія'] }] },
    ];

    for (const [index, bookSeed] of books.entries()) {
      await prisma.canonicalBook.create({
        data: {
          id: bookSeed.id,
          title: bookSeed.title,
          author: 'Автор',
          isbn: `978-000000000-${index}`,
          listings: {
            create: bookSeed.listings.map((listing, li) => ({
              id: `${bookSeed.id}-l${li}`,
              provider: listing.provider,
              title: bookSeed.title,
              author: 'Автор',
              priceAmount: 10000,
              priceCurrency: 'UAH',
              url: `https://example.com/${bookSeed.id}/${li}`,
              lastSeenAt: SEED_TIME,
              rawCategories: listing.rawCategories,
            })),
          },
        },
      });
    }

    await resetAssignments();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('dry-run computes the full pass but writes nothing', async () => {
    await resetAssignments();
    const before = await genreStates();

    const result = await runGenreBackfill(prisma, {
      dryRun: true,
      collectReports: true,
      now: () => NOW,
    });

    expect(await genreStates()).toEqual(before);
    expect(result.counters).toMatchObject({
      processed: 7,
      assigned: 1, // b1
      changed: 1, // b3
      manualSkipped: 1, // b2
      noSignal: 2, // b5 (empty array), b6 (no listings)
      unmappedBooks: 1, // b7
    });
    expect(result.unmappedReport?.rows()).toMatchObject([
      { provider: 'knigoland', normalizedKey: 'невідома категорія', listingCount: 1 },
    ]);
  });

  it('assigns per the §4.4 rules; MANUAL stays untouched (§4.5)', async () => {
    await resetAssignments();

    await runGenreBackfill(prisma, { now: () => NOW });
    const state = await genreStates();

    expect(state.get('g4-b1')).toEqual({
      genreId: G_FENTEZI,
      genreSource: GenreSource.PROVIDER_MAPPING,
      genreConfidence: 95,
      genreUpdatedAt: NOW,
    });
    expect(state.get('g4-b2')).toMatchObject({
      genreId: G_BIZNES,
      genreSource: GenreSource.MANUAL,
      genreUpdatedAt: SEED_TIME,
    });
    expect(state.get('g4-b3')).toEqual({
      genreId: G_FENTEZI,
      genreSource: GenreSource.PROVIDER_MAPPING,
      genreConfidence: 95,
      genreUpdatedAt: NOW,
    });
    expect(state.get('g4-b4')).toMatchObject({ genreId: G_BIZNES, genreSource: GenreSource.SEED });
    expect(state.get('g4-b5')).toMatchObject({
      genreId: G_FENTEZI,
      genreSource: GenreSource.PROVIDER_MAPPING,
      genreUpdatedAt: SEED_TIME, // graceful: vanished signal, no clearStale → untouched
    });
    expect(state.get('g4-b6')).toMatchObject({ genreId: null });
    expect(state.get('g4-b7')).toMatchObject({ genreId: null });
  });

  it('is idempotent: a second run performs zero writes', async () => {
    const before = await genreStates(); // state after the previous full run

    const second = await runGenreBackfill(prisma, {
      now: () => new Date('2026-07-13T00:00:00.000Z'),
    });

    expect(await genreStates()).toEqual(before);
    expect(second.counters).toMatchObject({ assigned: 0, changed: 0, cleared: 0 });
  });

  it('cursor-resume after an interrupted run converges to the full-run state', async () => {
    await resetAssignments();
    await runGenreBackfill(prisma, { now: () => NOW });
    const fullRunState = await genreStates();

    await resetAssignments();
    class StopAfterFirstBatch extends Error {}
    let savedCursor: string | null = null;
    await expect(
      runGenreBackfill(prisma, {
        batchSize: 3,
        now: () => NOW,
        onBatch: (progress: BackfillBatchProgress) => {
          if (savedCursor === null) {
            savedCursor = progress.cursor;
            throw new StopAfterFirstBatch();
          }
        },
      }),
    ).rejects.toBeInstanceOf(StopAfterFirstBatch);
    expect(savedCursor).not.toBeNull();

    await runGenreBackfill(prisma, { batchSize: 3, cursor: savedCursor, now: () => NOW });

    expect(await genreStates()).toEqual(fullRunState);
  });

  it('--only-unassigned processes only genre_id IS NULL books', async () => {
    await resetAssignments();

    const result = await runGenreBackfill(prisma, { onlyUnassigned: true, now: () => NOW });
    const state = await genreStates();

    expect(result.counters.processed).toBe(3); // b1, b6, b7
    expect(state.get('g4-b1')?.genreId).toBe(G_FENTEZI);
    // b3 would be overwritten by a full pass, but is out of scope here.
    expect(state.get('g4-b3')).toMatchObject({ genreId: G_BIZNES, genreSource: GenreSource.SEED });
  });

  it('--clear-stale resets PROVIDER_MAPPING with vanished signal to all-null', async () => {
    await resetAssignments();

    const result = await runGenreBackfill(prisma, { clearStale: true, now: () => NOW });
    const state = await genreStates();

    expect(result.counters.cleared).toBe(1);
    expect(state.get('g4-b5')).toEqual({
      genreId: null,
      genreSource: null,
      genreConfidence: null,
      genreUpdatedAt: null,
    });
    // The lock holds under clearStale too.
    expect(state.get('g4-b2')).toMatchObject({ genreId: G_BIZNES, genreSource: GenreSource.MANUAL });
  });

  it('rollback SQL (§8.2) removes engine assignments only, MANUAL/SEED intact', async () => {
    await resetAssignments();
    await runGenreBackfill(prisma, { now: () => NOW });

    await prisma.$executeRaw`
      UPDATE canonical_books
      SET genre_id = NULL, genre_source = NULL, genre_confidence = NULL, genre_updated_at = NULL
      WHERE genre_source = 'provider-mapping'
    `;

    const state = await genreStates();
    const cleared = { genreId: null, genreSource: null, genreConfidence: null, genreUpdatedAt: null };
    expect(state.get('g4-b1')).toEqual(cleared); // was assigned by the engine
    expect(state.get('g4-b3')).toEqual(cleared); // engine took ownership from SEED
    expect(state.get('g4-b5')).toEqual(cleared); // pre-existing provider-mapping
    expect(state.get('g4-b2')).toMatchObject({ genreId: G_BIZNES, genreSource: GenreSource.MANUAL });
    expect(state.get('g4-b4')).toMatchObject({ genreId: G_BIZNES, genreSource: GenreSource.SEED });
  });

  it('listRawCategoryDistribution groups raw categories per provider (§8.1 step 6)', async () => {
    const rows = await listRawCategoryDistribution(prisma);

    expect(rows).toContainEqual({ provider: 'book-club', rawCategory: 'Фентезі', listingCount: 3 });
    expect(rows).toContainEqual({ provider: 'book-club', rawCategory: 'Сучасна проза', listingCount: 1 });
    expect(rows).toContainEqual({ provider: 'knigoland', rawCategory: 'Невідома категорія', listingCount: 1 });
    // Ordered by count desc.
    expect(rows[0]).toMatchObject({ rawCategory: 'Фентезі', listingCount: 3 });
  });
});
