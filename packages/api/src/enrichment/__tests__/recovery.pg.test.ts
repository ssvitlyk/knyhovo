/**
 * Real-Postgres recovery integration for the background enrichment engine
 * (megakniga-resumable-enrichment PRD §4.7, PR5 test-matrix rows 12, 13, 15 and
 * the circuit-breaker scenario): a graceful AbortSignal stop that checkpoints a
 * resumable cursor and is picked up by a follow-up run to completion (kill →
 * resume → complete), a circuit-breaker stop that stays resumable, and the
 * no-progress restart-loop guard over real run rows.
 *
 * Gated on `TEST_DATABASE_URL` — skipped entirely otherwise (same pattern as
 * `enrichment.pg.test.ts`). Pg suites truncate shared tables, so run pg files
 * one at a time:
 *
 *   docker exec knyhovo-db-1 psql -U knyhovo -d postgres -c "CREATE DATABASE knyhovo_test"
 *   DATABASE_URL=postgresql://knyhovo:knyhovo@localhost:5432/knyhovo_test npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://knyhovo:knyhovo@localhost:5432/knyhovo_test npx vitest run src/enrichment/__tests__/recovery.pg.test.ts
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  PrismaClient,
  Provider,
  ScrapeRunKind,
  ScrapeRunStatus,
  ScrapeRunTrigger,
} from '@prisma/client';
import type { HtmlFetcher } from '@knyhovo/scrapers';
import type { ExtractedProductDetails } from '@knyhovo/scrapers';
import {
  deriveEnrichmentStatus,
  metricsForRunClose,
  openEnrichmentRun,
  runEnrichment,
} from '../engine.js';
import { countLeadingNoProgressRuns, shouldBlockForNoProgress } from '../lifecycle.js';
import type { ProviderEnrichmentConfig } from '../providers.js';
import {
  finishScrapeRun,
  findRecentScrapeRuns,
  startScrapeRun,
} from '../../refresh/scrape-run.repository.js';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const LONG_DESCRIPTION =
  'Опис книги для recovery-тесту, достатньо довгий, щоб пройти санітарну ' +
  'нормалізацію тексту без втрат і лишитися корисним для картки товару.';

const TEST_CONFIG: ProviderEnrichmentConfig = {
  extract: (html: string) => JSON.parse(html) as ExtractedProductDetails,
  delayMs: 0,
  timeoutMs: 1000,
  maxRetries: 0,
  retryBaseDelayMs: 1,
  retryMaxDelayMs: 2,
};

const DETAILS: ExtractedProductDetails = {
  description: LONG_DESCRIPTION,
  metadata: { isbn: '9786171501232', publisher: 'Віват', format: 'Тверда' },
  rawCategories: ['Книги', 'Проза'],
};

const STALE_REAP = { heartbeatTimeoutMs: 15 * 60_000, legacyStartedAtTimeoutMs: 24 * 3_600_000 };
const silentLogger = { info: (): void => {}, error: (): void => {} };

function fixedId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
function urlOf(n: number): string {
  return `https://www.megakniga.com.ua/products/rec-${n}`;
}

describe.skipIf(!TEST_DATABASE_URL)('enrichment recovery — Postgres integration', () => {
  const prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });
  let bookId: string;

  beforeAll(async () => {
    await prisma.priceHistoryPoint.deleteMany({});
    await prisma.wishlistItem.deleteMany({});
    await prisma.collectionItem.deleteMany({});
    await prisma.providerListing.deleteMany({});
    await prisma.canonicalBook.deleteMany({});
    const book = await prisma.canonicalBook.create({
      data: { title: 'Recovery fixture', author: 'Тест' },
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

  async function seed(n: number): Promise<void> {
    await prisma.providerListing.create({
      data: {
        id: fixedId(n),
        canonicalBookId: bookId,
        provider: Provider.MEGAKNIGA,
        title: `Книга ${n}`,
        author: 'Автор',
        priceAmount: 43210,
        priceCurrency: 'UAH',
        url: urlOf(n),
        lastSeenAt: new Date('2026-07-20T00:00:00.000Z'),
      },
    });
  }

  function healthyFetcher(): { fetcher: HtmlFetcher; fetched: string[] } {
    const fetched: string[] = [];
    return {
      fetched,
      fetcher: {
        fetch: (url: string): Promise<string> => {
          fetched.push(url);
          return Promise.resolve(JSON.stringify(DETAILS));
        },
      },
    };
  }

  it('kill → resume → complete: an abort mid-campaign persists a resumable cursor a second run finishes from (matrix 13)', async () => {
    for (let n = 1; n <= 5; n++) await seed(n);

    // ── Run 1: open a real run, abort while fetching the 2nd listing ──────────
    const opened1 = await openEnrichmentRun({
      prisma,
      provider: 'megakniga',
      triggeredBy: ScrapeRunTrigger.MANUAL,
      metadata: { batchSize: 50 },
      staleReap: STALE_REAP,
      logger: silentLogger,
    });
    const controller = new AbortController();
    const run1Fetcher: HtmlFetcher = {
      fetch: (url: string): Promise<string> => {
        if (url === urlOf(2)) controller.abort();
        return Promise.resolve(JSON.stringify(DETAILS));
      },
    };

    const summary1 = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher: run1Fetcher,
      config: TEST_CONFIG,
      runId: opened1.run.id,
      startCursor: opened1.resume.startCursor,
      signal: controller.signal,
    });

    expect(summary1.stoppedEarly).toBe('aborted');
    expect(summary1).toMatchObject({ processed: 2, enriched: 2, finalCursor: fixedId(2) });

    await finishScrapeRun(prisma, opened1.run.id, {
      startedAt: opened1.run.startedAt,
      status: deriveEnrichmentStatus(summary1),
      metrics: metricsForRunClose(summary1),
      scrapeErrors: summary1.errorSamples,
      cursor: summary1.finalCursor,
      itemsProcessed: summary1.processed,
    });

    const run1Row = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: opened1.run.id } });
    // PARTIAL with a NOT-NULL cursor ⇔ resumable (PRD §4.2).
    expect(run1Row.status).toBe(ScrapeRunStatus.PARTIAL);
    expect(run1Row.cursor).toBe(fixedId(2));
    expect(run1Row.itemsProcessed).toBe(2);

    // ── Run 2: a fresh process resumes from the persisted cursor ─────────────
    const opened2 = await openEnrichmentRun({
      prisma,
      provider: 'megakniga',
      triggeredBy: ScrapeRunTrigger.MANUAL,
      metadata: { batchSize: 50 },
      staleReap: STALE_REAP,
      logger: silentLogger,
    });
    // The resume decision inherited run 1's checkpoint.
    expect(opened2.resume).toEqual({
      startCursor: fixedId(2),
      resumedFromRunId: opened1.run.id,
    });

    const { fetcher: run2Fetcher, fetched: run2Fetched } = healthyFetcher();
    const summary2 = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher: run2Fetcher,
      config: TEST_CONFIG,
      runId: opened2.run.id,
      startCursor: opened2.resume.startCursor,
    });

    await finishScrapeRun(prisma, opened2.run.id, {
      startedAt: opened2.run.startedAt,
      status: deriveEnrichmentStatus(summary2),
      metrics: metricsForRunClose(summary2),
      scrapeErrors: summary2.errorSamples,
      cursor: summary2.finalCursor,
      itemsProcessed: summary2.processed,
    });

    // Only the remaining 3 listings were fetched — the prefix was never re-fetched.
    expect(run2Fetched).toEqual([urlOf(3), urlOf(4), urlOf(5)]);
    expect(summary2).toMatchObject({ processed: 3, enriched: 3, finalCursor: null });

    const run2Row = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: opened2.run.id } });
    expect(run2Row.status).toBe(ScrapeRunStatus.SUCCESS);
    expect(run2Row.cursor).toBeNull(); // "cursor NULL ⇔ done"

    // Every listing ended up enriched exactly once.
    const listings = await prisma.providerListing.findMany({
      where: { provider: Provider.MEGAKNIGA },
    });
    expect(listings).toHaveLength(5);
    expect(listings.every((l) => l.isbn !== null && l.description !== null)).toBe(true);
  });

  it('circuit breaker: a mass outage stops resumable — good prefix committed, cursor held, a later run completes', async () => {
    for (let n = 1; n <= 5; n++) await seed(n);

    const opened1 = await openEnrichmentRun({
      prisma,
      provider: 'megakniga',
      triggeredBy: ScrapeRunTrigger.MANUAL,
      metadata: { batchSize: 2 },
      staleReap: STALE_REAP,
      logger: silentLogger,
    });
    // Batch 1 (ids 1,2) succeeds; from id 3 on the site is "down".
    const outageFetcher: HtmlFetcher = {
      fetch: (url: string): Promise<string> => {
        const n = Number(url.slice(url.lastIndexOf('-') + 1));
        if (n >= 3) return Promise.reject(new Error('connect ETIMEDOUT 1.2.3.4:443'));
        return Promise.resolve(JSON.stringify(DETAILS));
      },
    };

    const summary1 = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 2,
      logger: silentLogger,
      fetcher: outageFetcher,
      config: TEST_CONFIG,
      runId: opened1.run.id,
      startCursor: opened1.resume.startCursor,
      circuitBreakerThreshold: 2,
    });

    expect(summary1.stoppedEarly).toBe('circuit-breaker');
    // Batch 1 committed; the cursor never advanced past the failed tail.
    expect(summary1.finalCursor).toBe(fixedId(2));

    await finishScrapeRun(prisma, opened1.run.id, {
      startedAt: opened1.run.startedAt,
      status: deriveEnrichmentStatus(summary1),
      metrics: metricsForRunClose(summary1),
      scrapeErrors: summary1.errorSamples,
      cursor: summary1.finalCursor,
      itemsProcessed: summary1.processed,
    });

    const run1Row = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: opened1.run.id } });
    expect(run1Row.status).toBe(ScrapeRunStatus.PARTIAL);
    expect(run1Row.cursor).toBe(fixedId(2)); // resumable

    // The site recovers — a resume run finishes the tail.
    const opened2 = await openEnrichmentRun({
      prisma,
      provider: 'megakniga',
      triggeredBy: ScrapeRunTrigger.MANUAL,
      metadata: { batchSize: 50 },
      staleReap: STALE_REAP,
      logger: silentLogger,
    });
    expect(opened2.resume.startCursor).toBe(fixedId(2));
    const { fetcher: healthy, fetched } = healthyFetcher();
    const summary2 = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher: healthy,
      config: TEST_CONFIG,
      runId: opened2.run.id,
      startCursor: opened2.resume.startCursor,
    });

    // Only the un-enriched tail (ids 3,4,5) is re-walked.
    expect(fetched).toEqual([urlOf(3), urlOf(4), urlOf(5)]);
    expect(summary2).toMatchObject({ enriched: 3, finalCursor: null });
  });

  it('no-progress guard: three consecutive zero-progress runs block the next start; a run with progress resets it (matrix 15)', async () => {
    // Three FAILED runs that each processed nothing.
    for (let i = 0; i < 3; i++) {
      const run = await startScrapeRun(prisma, {
        provider: Provider.MEGAKNIGA,
        kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
        triggeredBy: ScrapeRunTrigger.SYSTEM,
        startedAt: new Date(Date.now() - (3 - i) * 60_000),
      });
      await finishScrapeRun(prisma, run.id, {
        startedAt: new Date(Date.now() - (3 - i) * 60_000),
        status: ScrapeRunStatus.FAILED,
        metrics: metricsForRunClose(null),
        scrapeErrors: ['boom'],
        itemsProcessed: 0,
      });
    }

    const recent = await findRecentScrapeRuns(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      take: 3,
    });
    expect(recent).toHaveLength(3);
    const leading = countLeadingNoProgressRuns(recent);
    expect(leading).toBe(3);
    expect(shouldBlockForNoProgress(leading, 3)).toBe(true);

    // A subsequent run that made progress becomes the newest row and resets the streak.
    const progressRun = await startScrapeRun(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      triggeredBy: ScrapeRunTrigger.SYSTEM,
    });
    await finishScrapeRun(prisma, progressRun.id, {
      startedAt: new Date(),
      status: ScrapeRunStatus.PARTIAL,
      metrics: metricsForRunClose({
        totalCandidates: 100,
        enriched: 50,
        failed: 0,
        errorSamples: [],
      }),
      scrapeErrors: [],
      itemsProcessed: 50,
      cursor: fixedId(9),
    });

    const afterProgress = await findRecentScrapeRuns(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      take: 3,
    });
    const leadingAfter = countLeadingNoProgressRuns(afterProgress);
    expect(leadingAfter).toBe(0);
    expect(shouldBlockForNoProgress(leadingAfter, 3)).toBe(false);
  });
});
