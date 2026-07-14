import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ScrapeRunStatus, ScrapeRunTrigger, ScrapeRunKind, Provider } from '@prisma/client';
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

// Mock the concurrency-guard so tests can control lock behaviour without a real DB.
vi.mock('../concurrency-guard.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../concurrency-guard.js')>();
  return {
    ...actual,
    acquireRefreshLock: vi.fn(async () => ({ acquiredAt: new Date(), kind: ScrapeRunKind.FULL_CATALOG })),
    releaseRefreshLock: vi.fn(async () => undefined),
  };
});

// Mock the scrape-state repository (bookchef-incremental-scraping PRD) — no real DB.
vi.mock('../../pipeline/scrape-state.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../pipeline/scrape-state.repository.js')>();
  return {
    ...actual,
    loadKnownSourceLastmod: vi.fn(async () => new Map<string, string>()),
    recordSitemapPresence: vi.fn(async () => undefined),
    countVanished: vi.fn(async () => 0),
    sweepStaleState: vi.fn(async () => 0),
  };
});

// Mock auto-escalation — its own logic is covered by auto-escalation.test.ts; here we
// only need to control the wiring (does the orchestrator honor its decision).
vi.mock('../auto-escalation.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auto-escalation.js')>();
  return {
    ...actual,
    shouldAutoEscalateToFull: vi.fn(async () => false),
    findPreviousFullSitemapTotal: vi.fn(async () => null),
  };
});

import { runFullCatalogRefresh } from '../full-catalog.refresh.js';
import { startScrapeRun, finishScrapeRun } from '../scrape-run.repository.js';
import { runScrapePipeline } from '../../pipeline/index.js';
import { acquireRefreshLock, releaseRefreshLock, RefreshAlreadyRunningError } from '../concurrency-guard.js';
import {
  loadKnownSourceLastmod,
  recordSitemapPresence,
  countVanished,
  sweepStaleState,
} from '../../pipeline/scrape-state.repository.js';
import { shouldAutoEscalateToFull, findPreviousFullSitemapTotal } from '../auto-escalation.js';

const mockStart = vi.mocked(startScrapeRun);
const mockFinish = vi.mocked(finishScrapeRun);
const mockPipeline = vi.mocked(runScrapePipeline);
const mockAcquire = vi.mocked(acquireRefreshLock);
const mockRelease = vi.mocked(releaseRefreshLock);
const mockLoadKnown = vi.mocked(loadKnownSourceLastmod);
const mockRecordPresence = vi.mocked(recordSitemapPresence);
const mockCountVanished = vi.mocked(countVanished);
const mockSweepStale = vi.mocked(sweepStaleState);
const mockAutoEscalate = vi.mocked(shouldAutoEscalateToFull);
const mockFindPrevFullTotal = vi.mocked(findPreviousFullSitemapTotal);

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
        affectedCanonicalBookIds: [] as string[],
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
  // Default: guard allows — no running lock
  mockAcquire.mockResolvedValue({ acquiredAt: FIXED_NOW, kind: ScrapeRunKind.FULL_CATALOG });
  mockRelease.mockResolvedValue(undefined);
  mockLoadKnown.mockResolvedValue(new Map());
  mockRecordPresence.mockResolvedValue(undefined);
  mockCountVanished.mockResolvedValue(0);
  mockSweepStale.mockResolvedValue(0);
  mockAutoEscalate.mockResolvedValue(false);
  mockFindPrevFullTotal.mockResolvedValue(null);
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
        return {
          results: [
            { provider: 'vivat', metrics: makeMetrics(), scrapeErrors: ['boom'], affectedCanonicalBookIds: [] },
          ],
        };
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
      results: [{ provider: 'yakaboo', metrics, scrapeErrors: [], affectedCanonicalBookIds: [] }],
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
              affectedCanonicalBookIds: [],
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
          affectedCanonicalBookIds: [],
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

  // ── W10.6 concurrency guard integration ─────────────────────────────────────

  it('guard: rejects with RefreshAlreadyRunningError when acquireRefreshLock throws', async () => {
    const runningInfo = {
      id: 'existing-run',
      provider: Provider.YAKABOO,
      kind: ScrapeRunKind.WISHLIST_REFRESH,
      startedAt: FIXED_NOW,
    };
    mockAcquire.mockRejectedValue(new RefreshAlreadyRunningError(runningInfo));

    await expect(
      runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('yakaboo')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
      }),
    ).rejects.toThrow(RefreshAlreadyRunningError);

    // No provider scrape_runs should be started
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('propagates affectedCanonicalBookIds from the pipeline result onto the outcome', async () => {
    mockPipeline.mockResolvedValue({
      results: [
        {
          provider: 'yakaboo',
          metrics: makeMetrics(),
          scrapeErrors: [],
          affectedCanonicalBookIds: ['book-1', 'book-2'],
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

    expect(result.outcomes[0]!.affectedCanonicalBookIds).toEqual(['book-1', 'book-2']);
  });

  it('reports an empty affectedCanonicalBookIds when the provider run throws', async () => {
    mockPipeline.mockRejectedValue(new Error('network down'));

    const result = await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo')],
      triggeredBy: ScrapeRunTrigger.MANUAL,
      logger: silentLogger,
      now,
    });

    expect(result.outcomes[0]!.affectedCanonicalBookIds).toEqual([]);
  });

  it('guard: releaseRefreshLock is called in the finally block on happy path', async () => {
    mockPipeline.mockImplementation(async ({ providers }) => successResult(providers[0]!.name));

    await runFullCatalogRefresh({
      prisma,
      providers: [new FakeScraper('yakaboo')],
      triggeredBy: ScrapeRunTrigger.MANUAL,
      logger: silentLogger,
      now,
    });

    expect(mockRelease).toHaveBeenCalledOnce();
  });

  // ── bookchef-incremental-scraping PRD wiring ────────────────────────────────

  describe('incremental-capable provider (bookchef) wiring', () => {
    function sitemapResult(overrides: {
      entries: Array<{ url: string; lastmod: string | null }>;
      changedListingUrls?: string[];
      scrapeDurationMs?: number;
      scraped?: number;
    }) {
      return {
        results: [
          {
            provider: 'bookchef' as const,
            metrics: makeMetrics({ scraped: overrides.scraped ?? overrides.entries.length }),
            scrapeErrors: [] as string[],
            affectedCanonicalBookIds: [] as string[],
            sitemap: { entries: overrides.entries },
            changedListingUrls: overrides.changedListingUrls ?? [],
            scrapeDurationMs: overrides.scrapeDurationMs ?? 1000,
          },
        ],
      };
    }

    it('(a) incremental mode passes the loaded knownSourceLastmod map through to the scraper options', async () => {
      const known = new Map([['https://bookchef.ua/a', '2026-07-01T00:00:00.000Z']]);
      mockLoadKnown.mockResolvedValue(known);
      mockAutoEscalate.mockResolvedValue(false);
      mockPipeline.mockImplementation(async ({ providers }) => successResult(providers[0]!.name));

      await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('bookchef')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
        mode: 'incremental',
      });

      const call = mockPipeline.mock.calls[0]![0];
      expect(call.scraperOptions?.knownSourceLastmod).toBe(known);
    });

    it('(b) auto-full escalation (state empty) forces a full scrape: no knownSourceLastmod passed', async () => {
      mockLoadKnown.mockResolvedValue(new Map());
      mockAutoEscalate.mockResolvedValue(true);
      mockPipeline.mockImplementation(async ({ providers }) => successResult(providers[0]!.name));

      await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('bookchef')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
        mode: 'incremental',
      });

      const call = mockPipeline.mock.calls[0]![0];
      expect(call.scraperOptions?.knownSourceLastmod).toBeUndefined();
    });

    it('(c) auto-full escalation (stale last full run) forces a full scrape the same way', async () => {
      // Wiring-only: the "is the last full run >10 days old" decision itself is
      // unit-tested against real dates in auto-escalation.test.ts. Here we just
      // assert the orchestrator honors whatever shouldAutoEscalateToFull returns.
      mockLoadKnown.mockResolvedValue(new Map([['u', 'x']]));
      mockAutoEscalate.mockResolvedValue(true);
      mockPipeline.mockImplementation(async () =>
        sitemapResult({ entries: [{ url: 'u', lastmod: 'x' }] }),
      );

      await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('bookchef')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
        mode: 'incremental',
      });

      const finishCall = mockFinish.mock.calls[0]!;
      expect((finishCall[2].metadata as Record<string, unknown>)['mode']).toBe('full');
    });

    it('(d) writes metadata with mode/sitemapTotal/toFetch/unchangedSkipped/vanishedFromSitemap', async () => {
      const known = new Map([['u1', '2026-07-01T00:00:00.000Z']]); // unchanged
      mockLoadKnown.mockResolvedValue(known);
      mockAutoEscalate.mockResolvedValue(false);
      mockCountVanished.mockResolvedValue(3);
      mockPipeline.mockImplementation(async () =>
        sitemapResult({
          entries: [
            { url: 'u1', lastmod: '2026-07-01T00:00:00.000Z' }, // unchanged
            { url: 'u2', lastmod: '2026-07-05T00:00:00.000Z' }, // new
            { url: 'u3', lastmod: null }, // no signal
          ],
        }),
      );

      await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('bookchef')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
        mode: 'incremental',
      });

      const metadata = mockFinish.mock.calls[0]![2].metadata as Record<string, unknown>;
      expect(metadata['mode']).toBe('incremental');
      expect(metadata['sitemapTotal']).toBe(3);
      expect(metadata['toFetch']).toBe(2); // u2 + u3, u1 unchanged
      expect(metadata['unchangedSkipped']).toBe(1);
      expect(metadata['vanishedFromSitemap']).toBe(3);
      expect(mockRecordPresence).toHaveBeenCalledOnce();
    });

    it('(e) shadow-validation math: recall/precision/missedUrls, including edge cases', async () => {
      // known snapshot has u1 (unchanged) and u2 (stale watermark → predicted toFetch)
      const known = new Map([
        ['u1', '2026-07-01T00:00:00.000Z'],
        ['u2', '2026-07-01T00:00:00.000Z'],
      ]);
      mockLoadKnown.mockResolvedValue(known);
      // mode stays 'full' (default) — shadow validation always runs on full when state exists.
      mockPipeline.mockImplementation(async () =>
        sitemapResult({
          entries: [
            { url: 'u1', lastmod: '2026-07-01T00:00:00.000Z' }, // unchanged → NOT predicted
            { url: 'u2', lastmod: '2026-07-05T00:00:00.000Z' }, // changed → predicted
            { url: 'u3', lastmod: null }, // no signal → predicted (new/no-watermark)
          ],
          // u2 correctly predicted (hit); u1 is a miss (actual change lastmod said "unchanged").
          changedListingUrls: ['u1', 'u2'],
        }),
      );

      const result = await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('bookchef')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
      });
      expect(result.outcomes[0]!.status).toBe(ScrapeRunStatus.SUCCESS);

      const metadata = mockFinish.mock.calls[0]![2].metadata as Record<string, unknown>;
      const validation = metadata['validation'] as {
        predictedCount: number;
        actualChangedCount: number;
        missedUrls: string[];
        recall: number;
        precision: number | null;
      };
      // predicted = {u2, u3}; actualChanged = {u1, u2}; intersection = {u2}
      expect(validation.predictedCount).toBe(2);
      expect(validation.actualChangedCount).toBe(2);
      expect(validation.missedUrls).toEqual(['u1']);
      expect(validation.recall).toBeCloseTo(0.5); // 1/2
      expect(validation.precision).toBeCloseTo(0.5); // 1/2
    });

    it('(e) edge case: empty actualChanged → recall = 1', async () => {
      const known = new Map([['u1', '2026-07-01T00:00:00.000Z']]);
      mockLoadKnown.mockResolvedValue(known);
      mockPipeline.mockImplementation(async () =>
        sitemapResult({
          entries: [{ url: 'u2', lastmod: '2026-07-05T00:00:00.000Z' }], // new → predicted
          changedListingUrls: [],
        }),
      );

      await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('bookchef')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
      });

      const metadata = mockFinish.mock.calls[0]![2].metadata as Record<string, unknown>;
      const validation = metadata['validation'] as { recall: number; precision: number | null };
      expect(validation.recall).toBe(1);
    });

    it('(e) edge case: predictedCount === 0 → precision = null', async () => {
      const known = new Map([['u1', '2026-07-05T00:00:00.000Z']]);
      mockLoadKnown.mockResolvedValue(known);
      mockPipeline.mockImplementation(async () =>
        sitemapResult({
          // lastmod did not advance past the known watermark → unchanged → not predicted.
          entries: [{ url: 'u1', lastmod: '2026-07-05T00:00:00.000Z' }],
          changedListingUrls: [],
        }),
      );

      await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('bookchef')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
      });

      const metadata = mockFinish.mock.calls[0]![2].metadata as Record<string, unknown>;
      const validation = metadata['validation'] as { predictedCount: number; precision: number | null };
      expect(validation.predictedCount).toBe(0);
      expect(validation.precision).toBeNull();
    });

    it('(e) full run with empty known-state skips shadow validation entirely (no baseline to predict from)', async () => {
      mockLoadKnown.mockResolvedValue(new Map());
      mockPipeline.mockImplementation(async () =>
        sitemapResult({ entries: [{ url: 'u1', lastmod: '2026-07-01T00:00:00.000Z' }] }),
      );

      await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('bookchef')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
      });

      const metadata = mockFinish.mock.calls[0]![2].metadata as Record<string, unknown>;
      expect(metadata['validation']).toBeUndefined();
    });

    it('(f) efficiency metrics math: savedFetches/savedPercent/estimatedSavedTimeMs', async () => {
      const known = new Map([
        ['u1', '2026-07-01T00:00:00.000Z'], // unchanged
        ['u2', '2026-07-01T00:00:00.000Z'], // unchanged
      ]);
      mockLoadKnown.mockResolvedValue(known);
      mockAutoEscalate.mockResolvedValue(false);
      mockPipeline.mockImplementation(async () =>
        sitemapResult({
          entries: [
            { url: 'u1', lastmod: '2026-07-01T00:00:00.000Z' }, // unchanged
            { url: 'u2', lastmod: '2026-07-01T00:00:00.000Z' }, // unchanged
            { url: 'u3', lastmod: '2026-07-05T00:00:00.000Z' }, // new → toFetch
          ],
          scraped: 1, // only u3 actually fetched
          scrapeDurationMs: 500,
        }),
      );

      await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('bookchef')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
        mode: 'incremental',
      });

      const metadata = mockFinish.mock.calls[0]![2].metadata as Record<string, unknown>;
      const efficiency = metadata['efficiency'] as {
        savedFetches: number;
        savedPercent: number;
        estimatedSavedTimeMs: number;
      };
      // sitemapTotal=3, toFetch=1 → savedFetches=2, savedPercent=2/3
      expect(efficiency.savedFetches).toBe(2);
      expect(efficiency.savedPercent).toBeCloseTo(2 / 3);
      // avgFetchMs = 500 / max(1,1) = 500; estimatedSavedTimeMs = 2 * 500 = 1000
      expect(efficiency.estimatedSavedTimeMs).toBe(1000);
    });

    it('(g) TTL sweep fires after a successful full run when the anomalous-drop guard passes', async () => {
      mockLoadKnown.mockResolvedValue(new Map());
      mockFindPrevFullTotal.mockResolvedValue(100); // previous full had 100 entries
      mockSweepStale.mockResolvedValue(7);
      mockPipeline.mockImplementation(async () =>
        // 80 >= 100 * 0.5 → guard passes
        sitemapResult({ entries: Array.from({ length: 80 }, (_, i) => ({ url: `u${i}`, lastmod: null })) }),
      );

      await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('bookchef')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
        retentionDays: 30,
      });

      expect(mockSweepStale).toHaveBeenCalledOnce();
      const [, provider, cutoff] = mockSweepStale.mock.calls[0]!;
      expect(provider).toBe(Provider.BOOKCHEF);
      expect(cutoff.getTime()).toBe(FIXED_NOW.getTime() - 30 * 24 * 3_600_000);
    });

    it('(g) TTL sweep is skipped when this run\'s sitemapTotal is less than half the previous full run\'s', async () => {
      mockLoadKnown.mockResolvedValue(new Map());
      mockFindPrevFullTotal.mockResolvedValue(100);
      mockPipeline.mockImplementation(async () =>
        // 40 < 100 * 0.5 → guard trips, sweep skipped
        sitemapResult({ entries: Array.from({ length: 40 }, (_, i) => ({ url: `u${i}`, lastmod: null })) }),
      );

      await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('bookchef')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
      });

      expect(mockSweepStale).not.toHaveBeenCalled();
    });

    it('(g) TTL sweep does not fire for a PARTIAL run even when the guard would pass', async () => {
      mockLoadKnown.mockResolvedValue(new Map());
      mockFindPrevFullTotal.mockResolvedValue(null);
      mockPipeline.mockImplementation(async () => ({
        results: [
          {
            provider: 'bookchef' as const,
            metrics: makeMetrics({ scraped: 1, errors: 1 }),
            scrapeErrors: ['some error'],
            affectedCanonicalBookIds: [] as string[],
            sitemap: { entries: [{ url: 'u1', lastmod: null }] },
            changedListingUrls: [] as string[],
            scrapeDurationMs: 100,
          },
        ],
      }));

      const result = await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('bookchef')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
      });

      expect(result.outcomes[0]!.status).toBe(ScrapeRunStatus.PARTIAL);
      expect(mockSweepStale).not.toHaveBeenCalled();
    });

    it('(h) non-incremental providers are completely unaffected: no metadata, no extra queries', async () => {
      mockPipeline.mockImplementation(async ({ providers }) => successResult(providers[0]!.name));

      await runFullCatalogRefresh({
        prisma,
        providers: [new FakeScraper('yakaboo')],
        triggeredBy: ScrapeRunTrigger.MANUAL,
        logger: silentLogger,
        now,
        mode: 'incremental',
      });

      expect(mockLoadKnown).not.toHaveBeenCalled();
      expect(mockRecordPresence).not.toHaveBeenCalled();
      expect(mockCountVanished).not.toHaveBeenCalled();
      expect(mockSweepStale).not.toHaveBeenCalled();
      expect(mockAutoEscalate).not.toHaveBeenCalled();

      const finishCall = mockFinish.mock.calls[0]!;
      expect(finishCall[2].metadata).toBeUndefined();

      const pipelineCall = mockPipeline.mock.calls[0]![0];
      expect(pipelineCall.scraperOptions).toBeUndefined();
    });
  });
});
