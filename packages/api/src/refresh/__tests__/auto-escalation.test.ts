import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient, ScrapeRun } from '@prisma/client';
import { Provider, ScrapeRunKind, ScrapeRunStatus, ScrapeRunTrigger } from '@prisma/client';
import { shouldAutoEscalateToFull, findPreviousFullSitemapTotal } from '../auto-escalation.js';

const NOW = new Date('2026-07-14T00:00:00.000Z');

let runCounter = 0;
function fakeRun(overrides: Partial<ScrapeRun> = {}): ScrapeRun {
  runCounter++;
  return {
    id: `run-${runCounter}`,
    provider: Provider.BOOKCHEF,
    kind: ScrapeRunKind.FULL_CATALOG,
    status: ScrapeRunStatus.SUCCESS,
    triggeredBy: ScrapeRunTrigger.CRON,
    startedAt: NOW,
    finishedAt: new Date(NOW.getTime() + 60_000),
    durationMs: 60_000,
    itemsFound: 100,
    itemsUpdated: 10,
    priceChanges: 1,
    availabilityChanges: 0,
    errorsCount: 0,
    errorSummary: null,
    metadata: null,
    ...overrides,
  };
}

function fakePrisma(runs: ScrapeRun[]): PrismaClient {
  return {
    scrapeRun: { findMany: vi.fn(async () => runs) },
  } as unknown as PrismaClient;
}

describe('shouldAutoEscalateToFull', () => {
  it('escalates when the known-state snapshot is empty, without querying scrapeRun', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = { scrapeRun: { findMany } } as unknown as PrismaClient;

    const result = await shouldAutoEscalateToFull(prisma, Provider.BOOKCHEF, new Map(), NOW);

    expect(result).toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('does not escalate when the last full run (metadata null, legacy) is recent', async () => {
    const runs = [fakeRun({ startedAt: new Date(NOW.getTime() - 2 * 24 * 3_600_000), metadata: null })];
    const prisma = fakePrisma(runs);

    const result = await shouldAutoEscalateToFull(prisma, Provider.BOOKCHEF, new Map([['u', 'x']]), NOW);
    expect(result).toBe(false);
  });

  it('does not escalate when the last full run (metadata mode=full) is recent', async () => {
    const runs = [
      fakeRun({
        startedAt: new Date(NOW.getTime() - 2 * 24 * 3_600_000),
        metadata: { mode: 'full', sitemapTotal: 100 },
      }),
    ];
    const prisma = fakePrisma(runs);

    const result = await shouldAutoEscalateToFull(prisma, Provider.BOOKCHEF, new Map([['u', 'x']]), NOW);
    expect(result).toBe(false);
  });

  it('escalates when the last full run is older than 10 days', async () => {
    const runs = [
      fakeRun({
        startedAt: new Date(NOW.getTime() - 11 * 24 * 3_600_000),
        metadata: { mode: 'full', sitemapTotal: 100 },
      }),
    ];
    const prisma = fakePrisma(runs);

    const result = await shouldAutoEscalateToFull(prisma, Provider.BOOKCHEF, new Map([['u', 'x']]), NOW);
    expect(result).toBe(true);
  });

  it('does not escalate when the last full run is exactly at the 10-day boundary', async () => {
    const runs = [
      fakeRun({
        startedAt: new Date(NOW.getTime() - 10 * 24 * 3_600_000),
        metadata: { mode: 'full', sitemapTotal: 100 },
      }),
    ];
    const prisma = fakePrisma(runs);

    const result = await shouldAutoEscalateToFull(prisma, Provider.BOOKCHEF, new Map([['u', 'x']]), NOW);
    expect(result).toBe(false);
  });

  it('escalates when there is no FULL_CATALOG run at all', async () => {
    const prisma = fakePrisma([]);
    const result = await shouldAutoEscalateToFull(prisma, Provider.BOOKCHEF, new Map([['u', 'x']]), NOW);
    expect(result).toBe(true);
  });

  it('skips incremental-mode runs (metadata.mode==="incremental") when looking for the last full run', async () => {
    const runs = [
      // Recent, but incremental — doesn't count as "a full run happened recently".
      fakeRun({
        startedAt: new Date(NOW.getTime() - 1 * 24 * 3_600_000),
        metadata: { mode: 'incremental', sitemapTotal: 100 },
      }),
      // Older full run — this is the one that matters, and it's stale.
      fakeRun({
        startedAt: new Date(NOW.getTime() - 15 * 24 * 3_600_000),
        metadata: { mode: 'full', sitemapTotal: 100 },
      }),
    ];
    const prisma = fakePrisma(runs);
    const result = await shouldAutoEscalateToFull(prisma, Provider.BOOKCHEF, new Map([['u', 'x']]), NOW);
    expect(result).toBe(true);
  });

  it('still counts a FAILED full-mode attempt as "the last full attempt" (cron not silently broken)', async () => {
    const runs = [
      fakeRun({
        status: ScrapeRunStatus.FAILED,
        startedAt: new Date(NOW.getTime() - 1 * 24 * 3_600_000),
        metadata: { mode: 'full', sitemapTotal: 100 },
      }),
    ];
    const prisma = fakePrisma(runs);
    const result = await shouldAutoEscalateToFull(prisma, Provider.BOOKCHEF, new Map([['u', 'x']]), NOW);
    expect(result).toBe(false);
  });
});

describe('findPreviousFullSitemapTotal', () => {
  it('returns null when there is no previous full run', async () => {
    const prisma = fakePrisma([]);
    const result = await findPreviousFullSitemapTotal(prisma, Provider.BOOKCHEF, 'current-run');
    expect(result).toBeNull();
  });

  it('returns the sitemapTotal of the most recent previous full-mode run', async () => {
    // The real query filters `id: { not: currentRunId }` at the DB level, so the
    // current run never appears in what findMany returns here.
    const runs = [
      fakeRun({
        startedAt: new Date(NOW.getTime() - 7 * 24 * 3_600_000),
        metadata: { mode: 'full', sitemapTotal: 14700 },
      }),
    ];
    const prisma = fakePrisma(runs);
    const result = await findPreviousFullSitemapTotal(prisma, Provider.BOOKCHEF, 'current-run');
    expect(result).toBe(14700);
  });

  it('skips incremental-mode runs and runs without a numeric sitemapTotal', async () => {
    const runs = [
      fakeRun({
        startedAt: new Date(NOW.getTime() - 1 * 24 * 3_600_000),
        metadata: { mode: 'incremental', sitemapTotal: 500 },
      }),
      fakeRun({ startedAt: new Date(NOW.getTime() - 2 * 24 * 3_600_000), metadata: { mode: 'full' } }),
      fakeRun({
        startedAt: new Date(NOW.getTime() - 3 * 24 * 3_600_000),
        metadata: { mode: 'full', sitemapTotal: 14700 },
      }),
    ];
    const prisma = fakePrisma(runs);
    const result = await findPreviousFullSitemapTotal(prisma, Provider.BOOKCHEF, 'current-run');
    expect(result).toBe(14700);
  });
});
