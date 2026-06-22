import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient, ScrapeRun } from '@prisma/client';
import {
  ScrapeRunKind,
  ScrapeRunStatus,
  ScrapeRunTrigger,
  Provider,
} from '@prisma/client';
import {
  deriveRunStatus,
  mapMetricsToRunCounts,
  startScrapeRun,
  finishScrapeRun,
  latestHealthByProvider,
} from '../scrape-run.repository.js';
import type { ScrapeMetrics } from '../../pipeline/types.js';

// ── Fixed test dates ──────────────────────────────────────────────────────────
const STARTED_AT = new Date('2026-06-22T10:00:00.000Z');
const FINISHED_AT = new Date('2026-06-22T10:05:00.000Z');

// ── Metrics factory ───────────────────────────────────────────────────────────
function makeMetrics(overrides: Partial<ScrapeMetrics> = {}): ScrapeMetrics {
  return {
    scraped: 100,
    matched: 50,
    created: 50,
    conflicts: 0,
    conflictsByReason: {
      ISBN_CONFLICT: 0,
      VOLUME_MISMATCH: 0,
      BUNDLE_MISMATCH: 0,
    },
    providerListingsCreated: 50,
    providerListingsUpdated: 30,
    priceHistoryCreated: 10,
    availabilityUpdated: 5,
    skippedNoPrice: 2,
    errors: 0,
    ...overrides,
  };
}

// ── Fake Prisma factory ───────────────────────────────────────────────────────
function makeFakePrisma() {
  const fakeRun: ScrapeRun = {
    id: 'run-uuid-1',
    provider: Provider.YAKABOO,
    kind: ScrapeRunKind.FULL_CATALOG,
    status: ScrapeRunStatus.RUNNING,
    triggeredBy: ScrapeRunTrigger.MANUAL,
    startedAt: STARTED_AT,
    finishedAt: null,
    durationMs: null,
    itemsFound: 0,
    itemsUpdated: 0,
    priceChanges: 0,
    availabilityChanges: 0,
    errorsCount: 0,
    errorSummary: null,
    metadata: null,
  };

  return {
    scrapeRun: {
      create: vi.fn(async () => ({ id: fakeRun.id, startedAt: fakeRun.startedAt })),
      update: vi.fn(async () => fakeRun),
      findMany: vi.fn(async () => [fakeRun]),
    },
  } as unknown as PrismaClient;
}

// ── deriveRunStatus ───────────────────────────────────────────────────────────

describe('deriveRunStatus', () => {
  it('returns SUCCESS when there are no errors', () => {
    const metrics = makeMetrics({ errors: 0 });
    expect(deriveRunStatus(metrics, [])).toBe(ScrapeRunStatus.SUCCESS);
  });

  it('returns PARTIAL when scrapeErrors is non-empty and items were scraped', () => {
    const metrics = makeMetrics({ scraped: 50, providerListingsCreated: 10, errors: 0 });
    expect(deriveRunStatus(metrics, ['network timeout'])).toBe(ScrapeRunStatus.PARTIAL);
  });

  it('returns PARTIAL when metrics.errors > 0 and items were scraped', () => {
    const metrics = makeMetrics({ errors: 3, scraped: 50, providerListingsCreated: 10 });
    expect(deriveRunStatus(metrics, [])).toBe(ScrapeRunStatus.PARTIAL);
  });

  it('returns FAILED when scrapeErrors present and nothing was scraped or written', () => {
    const metrics = makeMetrics({
      scraped: 0,
      errors: 0,
      providerListingsCreated: 0,
      providerListingsUpdated: 0,
      availabilityUpdated: 0,
    });
    expect(deriveRunStatus(metrics, ['connection refused'])).toBe(ScrapeRunStatus.FAILED);
  });

  it('returns FAILED when metrics.errors > 0 and nothing was scraped or written', () => {
    const metrics = makeMetrics({
      scraped: 0,
      errors: 2,
      providerListingsCreated: 0,
      providerListingsUpdated: 0,
      availabilityUpdated: 0,
    });
    expect(deriveRunStatus(metrics, [])).toBe(ScrapeRunStatus.FAILED);
  });
});

// ── mapMetricsToRunCounts ─────────────────────────────────────────────────────

describe('mapMetricsToRunCounts', () => {
  it('maps all fields correctly with no errors', () => {
    const metrics = makeMetrics({
      scraped: 200,
      providerListingsCreated: 100,
      providerListingsUpdated: 60,
      priceHistoryCreated: 20,
      availabilityUpdated: 8,
      errors: 0,
    });
    const result = mapMetricsToRunCounts(metrics, []);

    expect(result.itemsFound).toBe(200);
    expect(result.itemsUpdated).toBe(100 + 60 + 8); // 168
    expect(result.priceChanges).toBe(20);
    expect(result.availabilityChanges).toBe(8);
    expect(result.errorsCount).toBe(0);
    expect(result.errorSummary).toBeNull();
  });

  it('computes errorsCount as metrics.errors + scrapeErrors.length', () => {
    const metrics = makeMetrics({ errors: 3 });
    const result = mapMetricsToRunCounts(metrics, ['err1', 'err2']);
    expect(result.errorsCount).toBe(5);
  });

  it('sets errorSummary to null when scrapeErrors is empty', () => {
    const metrics = makeMetrics({ errors: 2 });
    const result = mapMetricsToRunCounts(metrics, []);
    expect(result.errorSummary).toBeNull();
  });

  it('joins first 5 scrapeErrors with semicolons', () => {
    const errors = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'];
    const result = mapMetricsToRunCounts(makeMetrics(), errors);
    expect(result.errorSummary).toBe('e1; e2; e3; e4; e5');
  });

  it('truncates errorSummary to 1000 chars', () => {
    // Each error is 251 chars; joining 5 produces >1000 chars
    const longError = 'x'.repeat(251);
    const errors = [longError, longError, longError, longError, longError];
    const result = mapMetricsToRunCounts(makeMetrics(), errors);
    expect(result.errorSummary).not.toBeNull();
    expect(result.errorSummary!.length).toBe(1000);
  });
});

// ── startScrapeRun ────────────────────────────────────────────────────────────

describe('startScrapeRun', () => {
  it('calls prisma.scrapeRun.create with RUNNING status and given params', async () => {
    const prisma = makeFakePrisma();

    await startScrapeRun(prisma, {
      provider: Provider.YAKABOO,
      kind: ScrapeRunKind.FULL_CATALOG,
      triggeredBy: ScrapeRunTrigger.CRON,
      startedAt: STARTED_AT,
    });

    expect(prisma.scrapeRun.create).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(prisma.scrapeRun.create).mock.calls[0]![0];
    expect(callArgs.data.status).toBe(ScrapeRunStatus.RUNNING);
    expect(callArgs.data.provider).toBe(Provider.YAKABOO);
    expect(callArgs.data.kind).toBe(ScrapeRunKind.FULL_CATALOG);
    expect(callArgs.data.triggeredBy).toBe(ScrapeRunTrigger.CRON);
    expect(callArgs.data.startedAt).toEqual(STARTED_AT);
  });

  it('returns { id, startedAt } from the created row', async () => {
    const prisma = makeFakePrisma();
    const result = await startScrapeRun(prisma, {
      provider: Provider.YAKABOO,
      kind: ScrapeRunKind.FULL_CATALOG,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      startedAt: STARTED_AT,
    });

    expect(result.id).toBe('run-uuid-1');
    expect(result.startedAt).toEqual(STARTED_AT);
  });
});

// ── finishScrapeRun ───────────────────────────────────────────────────────────

describe('finishScrapeRun', () => {
  it('calls prisma.scrapeRun.update with computed durationMs and mapped counts', async () => {
    const prisma = makeFakePrisma();
    const metrics = makeMetrics({
      scraped: 100,
      providerListingsCreated: 40,
      providerListingsUpdated: 20,
      priceHistoryCreated: 15,
      availabilityUpdated: 5,
      errors: 1,
    });

    await finishScrapeRun(prisma, 'run-uuid-1', {
      startedAt: STARTED_AT,
      finishedAt: FINISHED_AT,
      status: ScrapeRunStatus.PARTIAL,
      metrics,
      scrapeErrors: ['oops'],
    });

    expect(prisma.scrapeRun.update).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(prisma.scrapeRun.update).mock.calls[0]![0];
    expect(callArgs.where).toEqual({ id: 'run-uuid-1' });

    const expectedDurationMs = FINISHED_AT.getTime() - STARTED_AT.getTime(); // 300000
    expect(callArgs.data.durationMs).toBe(expectedDurationMs);
    expect(callArgs.data.status).toBe(ScrapeRunStatus.PARTIAL);
    expect(callArgs.data.itemsFound).toBe(100);
    expect(callArgs.data.itemsUpdated).toBe(40 + 20 + 5); // 65
    expect(callArgs.data.priceChanges).toBe(15);
    expect(callArgs.data.availabilityChanges).toBe(5);
    expect(callArgs.data.errorsCount).toBe(2); // metrics.errors + scrapeErrors.length
    expect(callArgs.data.errorSummary).toBe('oops');
    expect(callArgs.data.finishedAt).toEqual(FINISHED_AT);
  });
});

// ── latestHealthByProvider ────────────────────────────────────────────────────

describe('latestHealthByProvider', () => {
  it('calls findMany with distinct provider and correct orderBy', async () => {
    const prisma = makeFakePrisma();
    await latestHealthByProvider(prisma);

    expect(prisma.scrapeRun.findMany).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(prisma.scrapeRun.findMany).mock.calls[0]![0];
    expect(callArgs?.distinct).toEqual(['provider']);
    expect(callArgs?.orderBy).toEqual([{ provider: 'asc' }, { startedAt: 'desc' }]);
    expect(callArgs?.where).toEqual({});
  });

  it('filters by kind when kind param is provided', async () => {
    const prisma = makeFakePrisma();
    await latestHealthByProvider(prisma, { kind: ScrapeRunKind.FULL_CATALOG });

    const callArgs = vi.mocked(prisma.scrapeRun.findMany).mock.calls[0]![0];
    expect(callArgs?.where).toEqual({ kind: ScrapeRunKind.FULL_CATALOG });
  });

  it('returns the rows returned by findMany', async () => {
    const prisma = makeFakePrisma();
    const rows = await latestHealthByProvider(prisma);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.provider).toBe(Provider.YAKABOO);
  });
});
