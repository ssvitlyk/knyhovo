import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ScrapeRunStatus, ScrapeRunTrigger } from '@prisma/client';
import type { ScraperProvider, ScraperResult } from '@knyhovo/shared';
import type { ScrapeMetrics } from '../../pipeline/types.js';

// Mock the repository but keep the pure helpers (deriveRunStatus, mapMetricsToRunCounts).
vi.mock('../scrape-run.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../scrape-run.repository.js')>();
  return {
    ...actual,
    startScrapeRun: vi.fn(),
    finishScrapeRun: vi.fn(),
  };
});

// Mock only runScrapePipeline; keep formatSummary, mapProviderName, createMetrics real.
vi.mock('../../pipeline/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../pipeline/index.js')>();
  return {
    ...actual,
    runScrapePipeline: vi.fn(),
  };
});

import { runFullCatalogRefresh } from '../full-catalog.refresh.js';
import { startScrapeRun, finishScrapeRun } from '../scrape-run.repository.js';
import { runScrapePipeline } from '../../pipeline/index.js';

const mockStart = vi.mocked(startScrapeRun);
const mockFinish = vi.mocked(finishScrapeRun);
const mockPipeline = vi.mocked(runScrapePipeline);

const FIXED_NOW = new Date('2026-06-22T08:00:00.000Z');
const SCRAPED_AT = '2026-06-22T08:00:00.000Z';
const now = (): Date => FIXED_NOW;
const silentLogger = { info: vi.fn(), error: vi.fn() };
const prisma = {} as unknown as PrismaClient;

class FakeScraper implements ScraperProvider {
  // Never actually invoked — runScrapePipeline is mocked — but required by the interface.
  readonly scrape = vi.fn(
    async (): Promise<ScraperResult> => ({
      provider: this.name,
      listings: [],
      scrapedAt: SCRAPED_AT,
      errors: [],
    }),
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

function successResult(name: ScraperProvider['name']) {
  return {
    results: [
      {
        provider: name,
        metrics: makeMetrics({ scraped: 10, providerListingsCreated: 5 }),
        scrapeErrors: [] as string[],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStart.mockImplementation(async (_prisma, params) => ({
    id: `run-${params.provider}`,
    startedAt: FIXED_NOW,
  }));
  mockFinish.mockResolvedValue(undefined);
});

describe('runFullCatalogRefresh', () => {
  it('marks every run SUCCESS when all providers succeed', async () => {
    mockPipeline.mockImplementation(async ({ providers }) => successResult(providers[0]!.name));

    const result = await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo'), new FakeScraper('vivat')],
      triggeredBy: ScrapeRunTrigger.MANUAL,
      logger: silentLogger,
      now,
    });

    expect(result.anySucceeded).toBe(true);
    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes.every((o) => o.status === ScrapeRunStatus.SUCCESS)).toBe(true);
    expect(mockStart).toHaveBeenCalledTimes(2);
    expect(mockFinish).toHaveBeenCalledTimes(2);
    for (const call of mockFinish.mock.calls) {
      expect(call[2].status).toBe(ScrapeRunStatus.SUCCESS);
    }
  });

  it('isolates a provider whose scrape collects errors: it FAILS, the rest succeed', async () => {
    mockPipeline.mockImplementation(async ({ providers }) => {
      const name = providers[0]!.name;
      if (name === 'vivat') {
        return { results: [{ provider: 'vivat', metrics: makeMetrics(), scrapeErrors: ['boom'] }] };
      }
      return successResult(name);
    });

    const result = await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo'), new FakeScraper('vivat')],
      triggeredBy: ScrapeRunTrigger.MANUAL,
      logger: silentLogger,
      now,
    });

    const yak = result.outcomes.find((o) => o.provider === 'yakaboo')!;
    const vivat = result.outcomes.find((o) => o.provider === 'vivat')!;
    expect(yak.status).toBe(ScrapeRunStatus.SUCCESS);
    expect(vivat.status).toBe(ScrapeRunStatus.FAILED);
    // A single provider failure must not be fatal for the whole refresh.
    expect(result.anySucceeded).toBe(true);
    expect(mockPipeline).toHaveBeenCalledTimes(2);
  });

  it('isolates a provider whose pipeline throws: it FAILS but the rest run', async () => {
    mockPipeline.mockImplementation(async ({ providers }) => {
      if (providers[0]!.name === 'yakaboo') {
        throw new Error('network down');
      }
      return successResult(providers[0]!.name);
    });

    const result = await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo'), new FakeScraper('vivat')],
      triggeredBy: ScrapeRunTrigger.MANUAL,
      logger: silentLogger,
      now,
    });

    const yak = result.outcomes.find((o) => o.provider === 'yakaboo')!;
    expect(yak.status).toBe(ScrapeRunStatus.FAILED);
    expect(yak.scrapeErrors).toContain('network down');
    expect(result.outcomes.find((o) => o.provider === 'vivat')!.status).toBe(
      ScrapeRunStatus.SUCCESS,
    );
    expect(result.anySucceeded).toBe(true);
    // Both providers were attempted (no early exit), and the opened run was finalized FAILED.
    expect(mockPipeline).toHaveBeenCalledTimes(2);
    const yakFinish = mockFinish.mock.calls.find((c) => c[1] === 'run-YAKABOO');
    expect(yakFinish).toBeDefined();
    expect(yakFinish![2].status).toBe(ScrapeRunStatus.FAILED);
  });

  it('reports anySucceeded=false when every provider fails (non-zero CLI exit)', async () => {
    mockPipeline.mockRejectedValue(new Error('all down'));

    const result = await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo'), new FakeScraper('vivat')],
      triggeredBy: ScrapeRunTrigger.MANUAL,
      logger: silentLogger,
      now,
    });

    expect(result.outcomes.every((o) => o.status === ScrapeRunStatus.FAILED)).toBe(true);
    expect(result.anySucceeded).toBe(false);
  });

  it('does not throw when finalizing a failed run also fails', async () => {
    mockPipeline.mockRejectedValue(new Error('network down'));
    mockFinish.mockRejectedValue(new Error('db gone'));

    const result = await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo')],
      triggeredBy: ScrapeRunTrigger.MANUAL,
      logger: silentLogger,
      now,
    });

    expect(result.outcomes[0]!.status).toBe(ScrapeRunStatus.FAILED);
    expect(result.anySucceeded).toBe(false);
  });

  it('passes the exact metrics to finishScrapeRun', async () => {
    const metrics = makeMetrics({ scraped: 42, providerListingsUpdated: 7, priceHistoryCreated: 3 });
    mockPipeline.mockResolvedValue({
      results: [{ provider: 'yakaboo', metrics, scrapeErrors: [] }],
    });

    await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo')],
      triggeredBy: ScrapeRunTrigger.MANUAL,
      logger: silentLogger,
      now,
    });

    expect(mockFinish).toHaveBeenCalledWith(
      prisma,
      'run-YAKABOO',
      expect.objectContaining({ metrics, status: ScrapeRunStatus.SUCCESS }),
    );
  });

  it('propagates triggeredBy to startScrapeRun', async () => {
    mockPipeline.mockImplementation(async ({ providers }) => successResult(providers[0]!.name));

    await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo')],
      triggeredBy: ScrapeRunTrigger.CRON,
      logger: silentLogger,
      now,
    });

    expect(mockStart).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ triggeredBy: ScrapeRunTrigger.CRON }),
    );
  });

  it('does not retry on 429/503 and does not stop the remaining providers', async () => {
    mockPipeline.mockImplementation(async ({ providers }) => {
      const name = providers[0]!.name;
      if (name === 'yakaboo') {
        return {
          results: [
            {
              provider: 'yakaboo',
              metrics: makeMetrics(),
              scrapeErrors: ['HTTP 429 Too Many Requests'],
            },
          ],
        };
      }
      return successResult(name);
    });

    const result = await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo'), new FakeScraper('vivat'), new FakeScraper('book-ye')],
      triggeredBy: ScrapeRunTrigger.MANUAL,
      logger: silentLogger,
      now,
    });

    const yak = result.outcomes.find((o) => o.provider === 'yakaboo')!;
    expect(yak.rateLimited).toBe(true);
    // All three providers were processed; the rate-limit did not stop the run.
    expect(result.outcomes).toHaveLength(3);
    expect(result.outcomes.filter((o) => o.status === ScrapeRunStatus.SUCCESS)).toHaveLength(2);
    expect(result.anySucceeded).toBe(true);
    // No retry-loop: the rate-limited provider's pipeline ran exactly once.
    const yakCalls = mockPipeline.mock.calls.filter((c) => c[0].providers[0]!.name === 'yakaboo');
    expect(yakCalls).toHaveLength(1);
  });

  it('derives PARTIAL when a rate-limited provider still wrote some data', async () => {
    mockPipeline.mockResolvedValue({
      results: [
        {
          provider: 'yakaboo',
          metrics: makeMetrics({ scraped: 5, providerListingsUpdated: 2 }),
          scrapeErrors: ['HTTP 503 Service Unavailable'],
        },
      ],
    });

    const result = await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo')],
      triggeredBy: ScrapeRunTrigger.MANUAL,
      logger: silentLogger,
      now,
    });

    expect(result.outcomes[0]!.status).toBe(ScrapeRunStatus.PARTIAL);
    expect(result.outcomes[0]!.rateLimited).toBe(true);
    expect(result.anySucceeded).toBe(true);
  });
});
