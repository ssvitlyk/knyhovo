import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient, ScrapeRunKind, ScrapeRunStatus, ScrapeRunTrigger, Provider } from '@prisma/client';
import {
  startScrapeRun,
  finishScrapeRun,
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
const FINISHED_AT_A = new Date('2026-06-22T08:10:00.000Z');

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
});
