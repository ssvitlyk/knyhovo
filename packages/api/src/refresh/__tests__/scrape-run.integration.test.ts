import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, ScrapeRunKind, ScrapeRunStatus, ScrapeRunTrigger, Provider } from '@prisma/client';
import {
  startScrapeRun,
  finishScrapeRun,
  latestHealthByProvider,
  deriveRunStatus,
} from '../scrape-run.repository.js';
import type { ScrapeMetrics } from '../../pipeline/types.js';

/**
 * Integration test: verifies that scrape_runs rows are created, updated, and
 * queried correctly against a real Postgres database.
 *
 * This is OPT-IN — skipped unless `RUN_DB_INTEGRATION=1` is set so the default
 * unit run never attempts a DB connection. Run it locally with:
 *
 *   RUN_DB_INTEGRATION=1 DATABASE_URL=postgresql://... \
 *     pnpm --filter @knyhovo/api exec vitest run \
 *       src/refresh/__tests__/scrape-run.integration.test.ts
 */
const RUN_DB_INTEGRATION = process.env['RUN_DB_INTEGRATION'] === '1';

// Fixed dates for deterministic duration assertions.
const STARTED_AT_A = new Date('2026-06-22T08:00:00.000Z');
const STARTED_AT_B = new Date('2026-06-22T09:00:00.000Z'); // newer run for same provider
const FINISHED_AT_A = new Date('2026-06-22T08:10:00.000Z');
const FINISHED_AT_B = new Date('2026-06-22T09:10:00.000Z');

function makeMetrics(overrides: Partial<ScrapeMetrics> = {}): ScrapeMetrics {
  return {
    scraped: 10,
    matched: 5,
    created: 5,
    conflicts: 0,
    conflictsByReason: { ISBN_CONFLICT: 0, VOLUME_MISMATCH: 0, BUNDLE_MISMATCH: 0 },
    providerListingsCreated: 5,
    providerListingsUpdated: 3,
    priceHistoryCreated: 2,
    availabilityUpdated: 1,
    skippedNoPrice: 0,
    errors: 0,
    ...overrides,
  };
}

describe.skipIf(!RUN_DB_INTEGRATION)('scrape_runs — DB integration', () => {
  const prisma = new PrismaClient();
  const createdIds: string[] = [];

  async function cleanup(): Promise<void> {
    if (createdIds.length > 0) {
      await prisma.scrapeRun.deleteMany({ where: { id: { in: createdIds } } });
    }
  }

  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('starts a run with RUNNING status and finishes it as SUCCESS', async () => {
    const { id, startedAt } = await startScrapeRun(prisma, {
      provider: Provider.VIVAT,
      kind: ScrapeRunKind.FULL_CATALOG,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      startedAt: STARTED_AT_A,
    });
    createdIds.push(id);

    // Verify RUNNING state before finishing
    const running = await prisma.scrapeRun.findUniqueOrThrow({ where: { id } });
    expect(running.status).toBe(ScrapeRunStatus.RUNNING);
    expect(running.finishedAt).toBeNull();

    const metrics = makeMetrics();
    const status = deriveRunStatus(metrics, []);
    await finishScrapeRun(prisma, id, {
      startedAt,
      finishedAt: FINISHED_AT_A,
      status,
      metrics,
      scrapeErrors: [],
    });

    const finished = await prisma.scrapeRun.findUniqueOrThrow({ where: { id } });
    expect(finished.status).toBe(ScrapeRunStatus.SUCCESS);
    expect(finished.durationMs).toBe(FINISHED_AT_A.getTime() - STARTED_AT_A.getTime());
    expect(finished.itemsFound).toBe(10);
    expect(finished.errorsCount).toBe(0);
    expect(finished.errorSummary).toBeNull();
  });

  it('latestHealthByProvider returns the newest run per provider', async () => {
    // Create an OLDER Yakaboo run
    const { id: idOld } = await startScrapeRun(prisma, {
      provider: Provider.YAKABOO,
      kind: ScrapeRunKind.FULL_CATALOG,
      triggeredBy: ScrapeRunTrigger.CRON,
      startedAt: STARTED_AT_A,
    });
    createdIds.push(idOld);
    await finishScrapeRun(prisma, idOld, {
      startedAt: STARTED_AT_A,
      finishedAt: FINISHED_AT_A,
      status: ScrapeRunStatus.SUCCESS,
      metrics: makeMetrics({ scraped: 5 }),
      scrapeErrors: [],
    });

    // Create a NEWER Yakaboo run
    const { id: idNew } = await startScrapeRun(prisma, {
      provider: Provider.YAKABOO,
      kind: ScrapeRunKind.FULL_CATALOG,
      triggeredBy: ScrapeRunTrigger.CRON,
      startedAt: STARTED_AT_B,
    });
    createdIds.push(idNew);
    await finishScrapeRun(prisma, idNew, {
      startedAt: STARTED_AT_B,
      finishedAt: FINISHED_AT_B,
      status: ScrapeRunStatus.SUCCESS,
      metrics: makeMetrics({ scraped: 20 }),
      scrapeErrors: [],
    });

    const rows = await latestHealthByProvider(prisma, { kind: ScrapeRunKind.FULL_CATALOG });
    const yakabooRow = rows.find((r) => r.provider === Provider.YAKABOO);

    expect(yakabooRow).toBeDefined();
    // The newer run should be returned, not the older one
    expect(yakabooRow!.id).toBe(idNew);
    expect(yakabooRow!.itemsFound).toBe(20);
  });

  it('creates runs for two different providers; latestHealthByProvider returns one row each', async () => {
    const providers = [Provider.BOOK_CLUB, Provider.BOOK_YE] as const;
    for (const provider of providers) {
      const { id, startedAt } = await startScrapeRun(prisma, {
        provider,
        kind: ScrapeRunKind.WISHLIST_REFRESH,
        triggeredBy: ScrapeRunTrigger.SYSTEM,
        startedAt: STARTED_AT_A,
      });
      createdIds.push(id);
      await finishScrapeRun(prisma, id, {
        startedAt,
        finishedAt: FINISHED_AT_A,
        status: ScrapeRunStatus.SUCCESS,
        metrics: makeMetrics(),
        scrapeErrors: [],
      });
    }

    const rows = await latestHealthByProvider(prisma, { kind: ScrapeRunKind.WISHLIST_REFRESH });
    const providerIds = rows.map((r) => r.provider);
    expect(providerIds).toContain(Provider.BOOK_CLUB);
    expect(providerIds).toContain(Provider.BOOK_YE);

    // Distinct — each provider appears exactly once
    const bookClubRows = rows.filter((r) => r.provider === Provider.BOOK_CLUB);
    const bookYeRows = rows.filter((r) => r.provider === Provider.BOOK_YE);
    expect(bookClubRows).toHaveLength(1);
    expect(bookYeRows).toHaveLength(1);
  });
});
