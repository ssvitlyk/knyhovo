/**
 * Real-Postgres integration for the background enrichment engine
 * (megakniga-resumable-enrichment PRD test matrix rows 3, 6, 7, 8, 9, 14):
 * seeded megakniga listings → run → batch-committed fill-only updates
 * verified against the live schema (uuid keyset, `rawCategories: isEmpty`
 * predicate); the PR3 block covers the persisted cursor checkpoint (written
 * atomically with each batch), resume from a PARTIAL/FAILED run, keyset
 * coverage without skips/duplicates across a resume, "cursor NULL ⇔ done",
 * and the §4.3 snapshot semantics for rows created mid-campaign.
 *
 * Gated on `TEST_DATABASE_URL` — skipped entirely otherwise (same pattern as
 * `genres/__tests__/backfill.pg.test.ts`). Pg suites truncate shared tables,
 * so run pg files one at a time:
 *
 *   docker exec knyhovo-db-1 psql -U knyhovo -d postgres -c "CREATE DATABASE knyhovo_test"
 *   DATABASE_URL=postgresql://knyhovo:knyhovo@localhost:5432/knyhovo_test npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://knyhovo:knyhovo@localhost:5432/knyhovo_test npx vitest run src/enrichment/__tests__/enrichment.pg.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient, Provider, ScrapeRunKind, ScrapeRunStatus, ScrapeRunTrigger } from '@prisma/client';
import type { HtmlFetcher } from '@knyhovo/scrapers';
import type { ExtractedProductDetails } from '@knyhovo/scrapers';
import {
  deriveEnrichmentStatus,
  metricsForRunClose,
  resolveEnrichmentResume,
  runEnrichment,
} from '../engine.js';
import type { ProviderEnrichmentConfig } from '../providers.js';
import {
  checkpointScrapeRunCounters,
  findLatestScrapeRun,
  finishScrapeRun,
  startScrapeRun,
} from '../../refresh/scrape-run.repository.js';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const LONG_DESCRIPTION =
  'Опис книги для інтеграційного тесту, достатньо довгий, щоб пройти будь-яку ' +
  'санітарну нормалізацію тексту без втрат і лишитися корисним для картки.';

const TEST_CONFIG: ProviderEnrichmentConfig = {
  extract: (html: string) => JSON.parse(html) as ExtractedProductDetails,
  delayMs: 0,
  timeoutMs: 1000,
  maxRetries: 0,
  retryBaseDelayMs: 1,
  retryMaxDelayMs: 2,
};

const DETAILS_BY_CODE: Record<string, ExtractedProductDetails> = {
  'enr-1': {
    description: LONG_DESCRIPTION,
    metadata: { isbn: '9786171501232', publisher: 'Віват', format: 'Тверда' },
    rawCategories: ['Книги', 'Проза'],
  },
  'enr-2': {
    description: LONG_DESCRIPTION,
    metadata: { isbn: '9789660112345', publisher: 'КСД', format: "М'яка" },
    rawCategories: ['Книги', 'Фентезі'],
  },
  // A non-book page: nothing usable, the row stays a candidate forever.
  'enr-3': { description: null, metadata: null },
  'enr-4': {
    description: LONG_DESCRIPTION,
    metadata: { isbn: '9786170000001', publisher: 'Ранок', format: 'Тверда' },
    rawCategories: ['Книги', 'Історія'],
  },
  'enr-5': {
    description: LONG_DESCRIPTION,
    metadata: { isbn: '9786170000002', publisher: 'А-ба-ба', format: "М'яка" },
    rawCategories: ['Книги', 'Дитячі'],
  },
};

function urlOf(code: string): string {
  return `https://www.megakniga.com.ua/products/${code}`;
}

function codeOf(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1);
}

function makeFetcher(): { fetcher: HtmlFetcher; fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    fetcher: {
      fetch: (url: string): Promise<string> => {
        fetched.push(url);
        const details = DETAILS_BY_CODE[codeOf(url)];
        if (details === undefined) return Promise.reject(new Error(`no fixture for ${url}`));
        return Promise.resolve(JSON.stringify(details));
      },
    },
  };
}

const silentLogger = { info: (): void => {}, error: (): void => {} };

describe.skipIf(!TEST_DATABASE_URL)('background enrichment — Postgres integration', () => {
  const prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  let bookId: string;

  beforeAll(async () => {
    await prisma.priceHistoryPoint.deleteMany({});
    await prisma.wishlistItem.deleteMany({});
    await prisma.collectionItem.deleteMany({});
    await prisma.providerListing.deleteMany({});
    await prisma.canonicalBook.deleteMany({});
    const book = await prisma.canonicalBook.create({
      data: { title: 'Enrichment fixture', author: 'Тест' },
    });
    bookId = book.id;
  });

  beforeEach(async () => {
    await prisma.providerListing.deleteMany({ where: { provider: Provider.MEGAKNIGA } });
    await prisma.scrapeRun.deleteMany({
      where: { provider: Provider.MEGAKNIGA, kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT },
    });
  });

  afterAll(async () => {
    await prisma.providerListing.deleteMany({ where: { provider: Provider.MEGAKNIGA } });
    await prisma.scrapeRun.deleteMany({
      where: { provider: Provider.MEGAKNIGA, kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT },
    });
    await prisma.canonicalBook.deleteMany({ where: { id: bookId } });
    await prisma.$disconnect();
  });

  async function seedListing(
    code: string,
    overrides: { description?: string; publisher?: string; isbn?: string; id?: string } = {},
  ): Promise<string> {
    const row = await prisma.providerListing.create({
      data: {
        canonicalBookId: bookId,
        provider: Provider.MEGAKNIGA,
        title: `Книга ${code}`,
        author: 'Автор',
        priceAmount: 43210,
        priceCurrency: 'UAH',
        url: urlOf(code),
        lastSeenAt: new Date('2026-07-19T00:00:00.000Z'),
        ...overrides,
      },
      select: { id: true },
    });
    return row.id;
  }

  /** Deterministic uuid so keyset order is controllable in resume tests. */
  function fixedId(n: number): string {
    return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  }

  it('enriches seeded listings with batch-committed fill-only updates (real uuid keyset)', async () => {
    await seedListing('enr-1');
    await seedListing('enr-2');
    const { fetcher, fetched } = makeFetcher();

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 1, // forces multiple keyset batches over random uuids
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(summary).toMatchObject({
      totalCandidates: 2,
      processed: 2,
      enriched: 2,
      failed: 0,
      batches: 2,
      stoppedEarly: null,
    });
    expect(fetched).toHaveLength(2);

    const rows = await prisma.providerListing.findMany({
      where: { provider: Provider.MEGAKNIGA },
      orderBy: { url: 'asc' },
    });
    expect(rows[0]).toMatchObject({
      isbn: '9786171501232',
      publisher: 'Віват',
      format: 'Тверда',
      rawCategories: ['Книги', 'Проза'],
    });
    expect(rows[0]!.description).not.toBeNull();
    expect(rows[1]).toMatchObject({ isbn: '9789660112345', publisher: 'КСД' });
  });

  it('a partially-enriched row only gains its missing fields — existing values stay', async () => {
    await seedListing('enr-1', { description: 'існуючий опис', isbn: '9780000000000' });
    const { fetcher } = makeFetcher();

    await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    const row = await prisma.providerListing.findFirst({
      where: { provider: Provider.MEGAKNIGA },
    });
    expect(row).toMatchObject({
      description: 'існуючий опис',
      isbn: '9780000000000',
      publisher: 'Віват',
      format: 'Тверда',
      rawCategories: ['Книги', 'Проза'],
    });
  });

  it('a re-run after full enrichment finds zero candidates and performs zero fetches', async () => {
    await seedListing('enr-1');
    const first = makeFetcher();
    await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher: first.fetcher,
      config: TEST_CONFIG,
    });
    expect(first.fetched).toHaveLength(1);

    const second = makeFetcher();
    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher: second.fetcher,
      config: TEST_CONFIG,
    });
    expect(summary).toMatchObject({ totalCandidates: 0, processed: 0 });
    expect(second.fetched).toHaveLength(0);
  });

  it('live checkpoint (PR3, matrix rows 3+6): every batch transaction writes cursor, itemsProcessed, counters and a heartbeat touch onto the run row', async () => {
    const id1 = await seedListing('enr-1', { id: fixedId(1) });
    const id2 = await seedListing('enr-2', { id: fixedId(2) });
    const { fetcher } = makeFetcher();
    const run = await startScrapeRun(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      triggeredBy: ScrapeRunTrigger.MANUAL,
    });
    const observed: Array<{
      itemsFound: number;
      itemsUpdated: number;
      itemsProcessed: number;
      errorsCount: number;
      cursor: string | null;
      heartbeatAdvanced: boolean;
    }> = [];

    await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 1,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
      runId: run.id,
      // Observational callback (the checkpoint itself already committed
      // inside the batch transaction) — read the row back and record it.
      onBatch: async () => {
        const row = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: run.id } });
        observed.push({
          itemsFound: row.itemsFound,
          itemsUpdated: row.itemsUpdated,
          itemsProcessed: row.itemsProcessed,
          errorsCount: row.errorsCount,
          cursor: row.cursor,
          heartbeatAdvanced:
            row.lastHeartbeatAt !== null && row.lastHeartbeatAt >= run.startedAt,
        });
      },
    });

    // Mid-run visibility: counters + cursor grow batch by batch, not 0 until the end.
    expect(observed).toEqual([
      {
        itemsFound: 2,
        itemsUpdated: 1,
        itemsProcessed: 1,
        errorsCount: 0,
        cursor: id1,
        heartbeatAdvanced: true,
      },
      {
        itemsFound: 2,
        itemsUpdated: 2,
        itemsProcessed: 2,
        errorsCount: 0,
        cursor: id2,
        heartbeatAdvanced: true,
      },
    ]);
    // The run row is still RUNNING — closing it is the CLI's job, not the checkpoint's.
    const row = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(row.status).toBe(ScrapeRunStatus.RUNNING);
  });

  it('a checkpoint against a closed run reports false and modifies nothing', async () => {
    const run = await startScrapeRun(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      triggeredBy: ScrapeRunTrigger.MANUAL,
    });
    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: { status: ScrapeRunStatus.SUCCESS, itemsUpdated: 7 },
    });

    const applied = await checkpointScrapeRunCounters(prisma, run.id, {
      itemsFound: 99,
      itemsUpdated: 99,
      errorsCount: 99,
      errorSummary: 'late checkpoint',
    });

    expect(applied).toBe(false);
    const row = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(row.itemsUpdated).toBe(7);
    expect(row.errorSummary).toBeNull();
    await prisma.scrapeRun.delete({ where: { id: run.id } });
  });

  // ── PR3: persisted cursor / resume ──────────────────────────────────────────

  /** The CLI's close, condensed: derive status, persist finalCursor + processed. */
  async function closeRun(
    run: { id: string; startedAt: Date },
    summary: Awaited<ReturnType<typeof runEnrichment>>,
  ): Promise<void> {
    await finishScrapeRun(prisma, run.id, {
      startedAt: run.startedAt,
      status: deriveEnrichmentStatus(summary),
      metrics: metricsForRunClose(summary),
      scrapeErrors: summary.errorSamples,
      cursor: summary.finalCursor,
      itemsProcessed: summary.processed,
    });
  }

  it('resume (matrix rows 7+8): a stopped campaign continues from the persisted cursor — no refetch, no skip, full coverage across both runs', async () => {
    await seedListing('enr-1', { id: fixedId(1) });
    await seedListing('enr-2', { id: fixedId(2) });
    await seedListing('enr-4', { id: fixedId(3) });
    await seedListing('enr-5', { id: fixedId(4) });

    // Run 1 stops early (--limit) after two listings.
    const first = makeFetcher();
    const run1 = await startScrapeRun(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      triggeredBy: ScrapeRunTrigger.MANUAL,
    });
    const summary1 = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 2,
      limit: 2,
      logger: silentLogger,
      fetcher: first.fetcher,
      config: TEST_CONFIG,
      runId: run1.id,
    });
    await closeRun(run1, summary1);

    const closed1 = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: run1.id } });
    expect(closed1.status).toBe(ScrapeRunStatus.PARTIAL);
    expect(closed1.cursor).toBe(fixedId(2));
    expect(closed1.itemsProcessed).toBe(2);
    expect(first.fetched).toEqual([urlOf('enr-1'), urlOf('enr-2')]);

    // Run 2 resumes exactly where run 1 stopped (PRD §4.5 steps 1, 4).
    const resume = resolveEnrichmentResume(
      await findLatestScrapeRun(prisma, {
        provider: Provider.MEGAKNIGA,
        kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      }),
    );
    expect(resume).toEqual({ startCursor: fixedId(2), resumedFromRunId: run1.id });

    const second = makeFetcher();
    const run2 = await startScrapeRun(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      cursor: resume.startCursor!,
    });
    const summary2 = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 2,
      logger: silentLogger,
      fetcher: second.fetcher,
      config: TEST_CONFIG,
      startCursor: resume.startCursor,
      runId: run2.id,
    });
    await closeRun(run2, summary2);

    // Keyset coverage across the campaign: disjoint fetch sets, no row
    // fetched twice, no row skipped — together they cover the whole queue.
    expect(second.fetched).toEqual([urlOf('enr-4'), urlOf('enr-5')]);
    expect(second.fetched.filter((url) => first.fetched.includes(url))).toEqual([]);
    expect([...first.fetched, ...second.fetched].sort()).toEqual(
      ['enr-1', 'enr-2', 'enr-4', 'enr-5'].map(urlOf).sort(),
    );
    const enriched = await prisma.providerListing.count({
      where: { provider: Provider.MEGAKNIGA, isbn: { not: null } },
    });
    expect(enriched).toBe(4);

    // Queue exhausted → "cursor NULL ⇔ done" (matrix row 9): the campaign is
    // over and the next start is a fresh one.
    const closed2 = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: run2.id } });
    expect(closed2.status).toBe(ScrapeRunStatus.SUCCESS);
    expect(closed2.cursor).toBeNull();
    expect(
      resolveEnrichmentResume(
        await findLatestScrapeRun(prisma, {
          provider: Provider.MEGAKNIGA,
          kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
        }),
      ),
    ).toEqual({ startCursor: null, resumedFromRunId: null });
  });

  it('a FAILED close without an explicit cursor keeps the in-transaction checkpoint — the crash path stays resumable (matrix row 7)', async () => {
    await seedListing('enr-1', { id: fixedId(1) });
    await seedListing('enr-2', { id: fixedId(2) });
    const { fetcher } = makeFetcher();
    const run = await startScrapeRun(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      triggeredBy: ScrapeRunTrigger.MANUAL,
    });

    await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 1,
      limit: 1,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
      runId: run.id,
    });
    // Simulate the CLI's crash close: FAILED, no cursor/itemsProcessed passed.
    await finishScrapeRun(prisma, run.id, {
      startedAt: run.startedAt,
      status: ScrapeRunStatus.FAILED,
      metrics: metricsForRunClose(null),
      scrapeErrors: ['simulated crash'],
    });

    const row = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(row.status).toBe(ScrapeRunStatus.FAILED);
    // The checkpoint written inside the batch transaction survived the close…
    expect(row.cursor).toBe(fixedId(1));
    expect(row.itemsProcessed).toBe(1);
    // …and the next start resumes from it (PRD §4.5 step 4: FAILED + cursor).
    expect(
      resolveEnrichmentResume(
        await findLatestScrapeRun(prisma, {
          provider: Provider.MEGAKNIGA,
          kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
        }),
      ),
    ).toEqual({ startCursor: fixedId(1), resumedFromRunId: run.id });
  });

  it('snapshot semantics (matrix row 14): a listing created mid-campaign with id < cursor is not picked up by the resume, but the NEXT campaign gets it', async () => {
    await seedListing('enr-1', { id: fixedId(2) });
    await seedListing('enr-2', { id: fixedId(3) });

    // Campaign 1, run A: stops after the first listing, cursor = fixedId(2).
    const runA = await startScrapeRun(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      triggeredBy: ScrapeRunTrigger.MANUAL,
    });
    const summaryA = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 1,
      limit: 1,
      logger: silentLogger,
      fetcher: makeFetcher().fetcher,
      config: TEST_CONFIG,
      runId: runA.id,
    });
    await closeRun(runA, summaryA);

    // A concurrent catalog scrape creates a listing whose random uuid sorts
    // BEFORE the campaign's cursor.
    await seedListing('enr-4', { id: fixedId(1) });

    // Run B resumes campaign 1: walks the rest of the id space only.
    const resume = resolveEnrichmentResume(
      await findLatestScrapeRun(prisma, {
        provider: Provider.MEGAKNIGA,
        kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      }),
    );
    expect(resume.startCursor).toBe(fixedId(2));
    const runBFetcher = makeFetcher();
    const runB = await startScrapeRun(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      cursor: resume.startCursor!,
    });
    const summaryB = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher: runBFetcher.fetcher,
      config: TEST_CONFIG,
      startCursor: resume.startCursor,
      runId: runB.id,
    });
    await closeRun(runB, summaryB);

    // The mid-campaign row was NOT fetched (its id < cursor) — no promise of
    // covering rows created after campaign start (PRD §4.3 point 2).
    expect(runBFetcher.fetched).toEqual([urlOf('enr-2')]);

    // Campaign 2 (fresh, cursor NULL) is GUARANTEED to pick it up (§4.3 point 3).
    const resume2 = resolveEnrichmentResume(
      await findLatestScrapeRun(prisma, {
        provider: Provider.MEGAKNIGA,
        kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      }),
    );
    expect(resume2.startCursor).toBeNull();
    const runCFetcher = makeFetcher();
    const summaryC = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher: runCFetcher.fetcher,
      config: TEST_CONFIG,
    });
    expect(runCFetcher.fetched).toEqual([urlOf('enr-4')]);
    expect(summaryC).toMatchObject({ processed: 1, enriched: 1, finalCursor: null });
  });

  it('a page with no usable data is processed without writes and without failing the run', async () => {
    await seedListing('enr-3');
    const { fetcher } = makeFetcher();

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(summary).toMatchObject({ processed: 1, enriched: 0, failed: 0 });
    const row = await prisma.providerListing.findFirst({
      where: { provider: Provider.MEGAKNIGA },
    });
    expect(row!.description).toBeNull();
    expect(row!.publisher).toBeNull();
  });
});
