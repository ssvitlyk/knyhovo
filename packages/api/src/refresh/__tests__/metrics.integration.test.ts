import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ScrapeRunStatus, ScrapeRunTrigger, ScrapeRunKind } from '@prisma/client';
import type { ScraperProvider, ScraperResult } from '@knyhovo/shared';
import type { ScrapeMetrics } from '../../pipeline/types.js';

// Same isolation strategy as full-catalog.refresh.test.ts: mock the repository,
// the pipeline, and the concurrency guard so the refresh runs without a DB.
vi.mock('../scrape-run.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../scrape-run.repository.js')>();
  return { ...actual, startScrapeRun: vi.fn(), finishScrapeRun: vi.fn() };
});

vi.mock('../../pipeline/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../pipeline/index.js')>();
  return { ...actual, runScrapePipeline: vi.fn() };
});

vi.mock('../concurrency-guard.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../concurrency-guard.js')>();
  return {
    ...actual,
    acquireRefreshLock: vi.fn(async () => ({ acquiredAt: new Date(), kind: ScrapeRunKind.FULL_CATALOG })),
    releaseRefreshLock: vi.fn(async () => undefined),
  };
});

import { runFullCatalogRefresh } from '../full-catalog.refresh.js';
import { startScrapeRun, finishScrapeRun } from '../scrape-run.repository.js';
import { runScrapePipeline } from '../../pipeline/index.js';
import { acquireRefreshLock, releaseRefreshLock } from '../concurrency-guard.js';
import { ProductionMetricsRegistry } from '../../metrics/index.js';
import type { CounterSnapshot, HistogramSnapshot } from '../../metrics/index.js';

const mockStart = vi.mocked(startScrapeRun);
const mockFinish = vi.mocked(finishScrapeRun);
const mockPipeline = vi.mocked(runScrapePipeline);
const mockAcquire = vi.mocked(acquireRefreshLock);
const mockRelease = vi.mocked(releaseRefreshLock);

const STARTED_AT = new Date('2026-06-22T08:00:00.000Z');
const FINISHED_AT = new Date('2026-06-22T08:00:05.000Z'); // +5s
const SCRAPED_AT = '2026-06-22T08:00:00.000Z';
const silentLogger = { info: vi.fn(), error: vi.fn() };
const prisma = {} as unknown as PrismaClient;

class FakeScraper implements ScraperProvider {
  readonly scrape = vi.fn(
    async (): Promise<ScraperResult> => ({ provider: this.name, listings: [], scrapedAt: SCRAPED_AT, errors: [] }),
  );
  constructor(readonly name: ScraperProvider['name']) {}
}

function makeMetrics(overrides: Partial<ScrapeMetrics> = {}): ScrapeMetrics {
  return {
    scraped: 0,
    matched: 0,
    created: 0,
    conflicts: 0,
    conflictsByReason: { ISBN_CONFLICT: 0, VOLUME_MISMATCH: 0, BUNDLE_MISMATCH: 0 },
    providerListingsCreated: 0,
    providerListingsUpdated: 0,
    priceHistoryCreated: 0,
    availabilityUpdated: 0,
    skippedNoPrice: 0,
    errors: 0,
    ...overrides,
  };
}

function counterValue(reg: ProductionMetricsRegistry, name: string, labels: Record<string, string>): number {
  const metric = reg.snapshot().metrics.find((m) => m.name === name) as CounterSnapshot | undefined;
  if (!metric) return 0;
  const key = JSON.stringify(Object.entries(labels).sort());
  return metric.samples.find((s) => JSON.stringify(Object.entries(s.labels).sort()) === key)?.value ?? 0;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStart.mockImplementation(async (_prisma, params) => ({
    id: `run-${params.provider}`,
    startedAt: STARTED_AT,
  }));
  mockFinish.mockResolvedValue(undefined);
  mockAcquire.mockResolvedValue({ acquiredAt: STARTED_AT, kind: ScrapeRunKind.FULL_CATALOG });
  mockRelease.mockResolvedValue(undefined);
});

// Clock: first call (startScrapeRun) -> STARTED_AT, finish call -> FINISHED_AT.
function makeClock(): () => Date {
  const queue = [STARTED_AT, FINISHED_AT];
  return () => queue.shift() ?? FINISHED_AT;
}

describe('pipeline integration — metrics recording', () => {
  it('records each successful provider run into the registry', async () => {
    mockPipeline.mockImplementation(async ({ providers }) => ({
      results: [
        {
          provider: providers[0]!.name,
          metrics: makeMetrics({ scraped: 20, providerListingsCreated: 8, providerListingsUpdated: 4, created: 8, matched: 4, priceHistoryCreated: 12 }),
          scrapeErrors: [],
        },
      ],
    }));

    const metrics = new ProductionMetricsRegistry();
    await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo'), new FakeScraper('vivat')],
      triggeredBy: ScrapeRunTrigger.CRON,
      logger: silentLogger,
      now: makeClock(),
      metrics,
    });

    expect(counterValue(metrics, 'scrape_runs_total', { provider: 'yakaboo' })).toBe(1);
    expect(counterValue(metrics, 'provider_success_total', { provider: 'yakaboo' })).toBe(1);
    expect(counterValue(metrics, 'products_scraped_total', { provider: 'yakaboo' })).toBe(20);
    expect(counterValue(metrics, 'products_written_total', { provider: 'yakaboo' })).toBe(12);
    expect(counterValue(metrics, 'price_history_inserted_total', { provider: 'vivat' })).toBe(12);
  });

  it('observes run duration from the injected clock', async () => {
    mockPipeline.mockImplementation(async ({ providers }) => ({
      results: [{ provider: providers[0]!.name, metrics: makeMetrics({ scraped: 1 }), scrapeErrors: [] }],
    }));

    const metrics = new ProductionMetricsRegistry();
    await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo')],
      triggeredBy: ScrapeRunTrigger.CRON,
      logger: silentLogger,
      now: makeClock(),
      metrics,
    });

    const hist = metrics.snapshot().metrics.find((m) => m.name === 'scrape_duration_ms') as HistogramSnapshot;
    const sample = hist.samples.find((s) => s.labels['provider'] === 'yakaboo')!;
    expect(sample.count).toBe(1);
    expect(sample.sum).toBe(5000); // FINISHED_AT - STARTED_AT
  });

  it('records a FAILED run when the pipeline throws', async () => {
    mockPipeline.mockRejectedValue(new Error('network down'));

    const metrics = new ProductionMetricsRegistry();
    await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo')],
      triggeredBy: ScrapeRunTrigger.CRON,
      logger: silentLogger,
      now: makeClock(),
      metrics,
    });

    expect(counterValue(metrics, 'provider_failed_total', { provider: 'yakaboo' })).toBe(1);
    expect(counterValue(metrics, 'scrape_runs_total', { provider: 'yakaboo' })).toBe(1);
  });

  it('records the rate-limit signal', async () => {
    mockPipeline.mockResolvedValue({
      results: [{ provider: 'yakaboo', metrics: makeMetrics({ scraped: 5, providerListingsUpdated: 2 }), scrapeErrors: ['HTTP 429 Too Many Requests'] }],
    });

    const metrics = new ProductionMetricsRegistry();
    await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo')],
      triggeredBy: ScrapeRunTrigger.CRON,
      logger: silentLogger,
      now: makeClock(),
      metrics,
    });

    expect(counterValue(metrics, 'rate_limited_total', { provider: 'yakaboo' })).toBe(1);
    expect(counterValue(metrics, 'provider_partial_total', { provider: 'yakaboo' })).toBe(1);
  });

  it('does nothing when no registry is supplied (behavior unchanged)', async () => {
    mockPipeline.mockImplementation(async ({ providers }) => ({
      results: [{ provider: providers[0]!.name, metrics: makeMetrics({ scraped: 10 }), scrapeErrors: [] }],
    }));

    const result = await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo')],
      triggeredBy: ScrapeRunTrigger.CRON,
      logger: silentLogger,
      now: makeClock(),
    });

    // Refresh still works exactly as before; no throw, normal outcome.
    expect(result.outcomes[0]!.status).toBe(ScrapeRunStatus.SUCCESS);
  });
});
