import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ScrapeRunStatus, ScrapeRunTrigger, ScrapeRunKind, Provider } from '@prisma/client';
import type { ProviderName } from '@knyhovo/shared';
import { createMetrics } from '../../pipeline/index.js';
import { runProductionScrape } from '../production-runner.js';
import type { RunProductionScrapeDeps } from '../production-runner.js';
import type { ProviderRefreshOutcome, FullCatalogRefreshResult } from '../full-catalog.refresh.js';
import { RefreshAlreadyRunningError } from '../concurrency-guard.js';

const FIXED_NOW = new Date('2026-06-29T08:00:00.000Z');
const now = (): Date => FIXED_NOW;
const prisma = {} as unknown as PrismaClient;

function makeLogger(): { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> } {
  return { info: vi.fn(), error: vi.fn() };
}

function outcome(
  provider: ProviderName,
  status: ScrapeRunStatus,
  runId: string | null = `run-${provider}`,
  affectedCanonicalBookIds: readonly string[] = [],
): ProviderRefreshOutcome {
  return {
    provider,
    runId,
    status,
    metrics: createMetrics(),
    scrapeErrors: status === ScrapeRunStatus.FAILED ? ['boom'] : [],
    rateLimited: false,
    affectedCanonicalBookIds,
  };
}

/** Build an injectable `refresh` stub returning a fixed result. */
function fakeRefresh(result: FullCatalogRefreshResult): RunProductionScrapeDeps['refresh'] {
  return vi.fn(async () => result);
}

function baseDeps(
  refresh: RunProductionScrapeDeps['refresh'],
  alertHook = vi.fn(),
): RunProductionScrapeDeps {
  return {
    prisma,
    providers: [],
    triggeredBy: ScrapeRunTrigger.MANUAL,
    logger: makeLogger(),
    alertHook,
    now,
    refresh,
  };
}

describe('runProductionScrape', () => {
  it('returns exitCode 0 when every provider succeeds and does not alert', async () => {
    const alertHook = vi.fn();
    const refresh = fakeRefresh({
      outcomes: [
        outcome('yakaboo', ScrapeRunStatus.SUCCESS),
        outcome('vivat', ScrapeRunStatus.SUCCESS),
      ],
      anySucceeded: true,
    });

    const result = await runProductionScrape(baseDeps(refresh, alertHook));

    expect(result.exitCode).toBe(0);
    expect(result.skipped).toBe(false);
    expect(alertHook).not.toHaveBeenCalled();
  });

  it('returns exitCode 0 for a mixed result (at least one SUCCESS/PARTIAL)', async () => {
    const alertHook = vi.fn();
    const refresh = fakeRefresh({
      outcomes: [
        outcome('yakaboo', ScrapeRunStatus.FAILED),
        outcome('vivat', ScrapeRunStatus.PARTIAL),
      ],
      anySucceeded: true,
    });

    const result = await runProductionScrape(baseDeps(refresh, alertHook));

    expect(result.exitCode).toBe(0);
    expect(alertHook).not.toHaveBeenCalled();
  });

  it('returns exitCode 1 and fires the alert hook when all providers fail', async () => {
    const alertHook = vi.fn();
    const refresh = fakeRefresh({
      outcomes: [
        outcome('yakaboo', ScrapeRunStatus.FAILED, 'run-1'),
        outcome('vivat', ScrapeRunStatus.FAILED, 'run-2'),
      ],
      anySucceeded: false,
    });

    const result = await runProductionScrape(baseDeps(refresh, alertHook));

    expect(result.exitCode).toBe(1);
    expect(result.skipped).toBe(false);
    expect(alertHook).toHaveBeenCalledTimes(1);
    expect(alertHook).toHaveBeenCalledWith({
      reason: 'all-providers-failed',
      failedProviders: ['yakaboo', 'vivat'],
      runIds: ['run-1', 'run-2'],
    });
  });

  it('uses the default logging alert hook when none is provided (no throw)', async () => {
    const logger = makeLogger();
    const refresh = fakeRefresh({
      outcomes: [outcome('yakaboo', ScrapeRunStatus.FAILED)],
      anySucceeded: false,
    });

    const result = await runProductionScrape({
      prisma,
      providers: [],
      triggeredBy: ScrapeRunTrigger.MANUAL,
      logger,
      now,
      refresh,
    });

    expect(result.exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('operational-alert [all-providers-failed]'),
    );
  });

  it('treats RefreshAlreadyRunningError as an idempotent skip (exitCode 0, no alert)', async () => {
    const alertHook = vi.fn();
    const running = {
      id: 'existing-run',
      provider: Provider.YAKABOO,
      kind: ScrapeRunKind.FULL_CATALOG,
      startedAt: FIXED_NOW,
    };
    const refresh = vi.fn(async () => {
      throw new RefreshAlreadyRunningError(running);
    });

    const result = await runProductionScrape(baseDeps(refresh, alertHook));

    expect(result.exitCode).toBe(0);
    expect(result.skipped).toBe(true);
    expect(result.outcomes).toHaveLength(0);
    expect(alertHook).not.toHaveBeenCalled();
  });

  it('rethrows non-overlap fatal errors', async () => {
    const refresh = vi.fn(async () => {
      throw new Error('db gone');
    });

    await expect(runProductionScrape(baseDeps(refresh))).rejects.toThrow('db gone');
  });
});

// ── Genres-taxonomy PRD G5: optional post-scrape genre assignment ─────────────

function fakeGenreCounters() {
  return {
    processed: 0,
    assigned: 0,
    changed: 0,
    cleared: 0,
    unchanged: 0,
    manualSkipped: 0,
    noSignal: 0,
    unmappedBooks: 0,
  };
}

describe('runProductionScrape — post-scrape genre assignment hook (G5)', () => {
  it('does not call the processor when genreAssignAfterScrape is disabled', async () => {
    const refresh = fakeRefresh({
      outcomes: [outcome('yakaboo', ScrapeRunStatus.SUCCESS, 'run-1', ['book-1'])],
      anySucceeded: true,
    });
    const runGenreAssignment = vi.fn();

    await runProductionScrape({ ...baseDeps(refresh), runGenreAssignment });

    expect(runGenreAssignment).not.toHaveBeenCalled();
  });

  it('does not call the processor when enabled but nothing was affected', async () => {
    const refresh = fakeRefresh({
      outcomes: [outcome('yakaboo', ScrapeRunStatus.SUCCESS, 'run-1', [])],
      anySucceeded: true,
    });
    const runGenreAssignment = vi.fn();

    await runProductionScrape({
      ...baseDeps(refresh),
      genreAssignAfterScrape: true,
      runGenreAssignment,
    });

    expect(runGenreAssignment).not.toHaveBeenCalled();
  });

  it('calls the processor once with the deduped affected ids across providers', async () => {
    const refresh = fakeRefresh({
      outcomes: [
        outcome('yakaboo', ScrapeRunStatus.SUCCESS, 'run-1', ['book-1', 'book-2']),
        outcome('vivat', ScrapeRunStatus.SUCCESS, 'run-2', ['book-2', 'book-3']),
      ],
      anySucceeded: true,
    });
    const runGenreAssignment = vi.fn(
      async (_prisma: unknown, ids: readonly string[]) => ({
        counters: fakeGenreCounters(),
        affectedBookCount: ids.length,
        batches: 1,
        durationMs: 5,
      }),
    );

    await runProductionScrape({
      ...baseDeps(refresh),
      genreAssignAfterScrape: true,
      runGenreAssignment: runGenreAssignment as unknown as RunProductionScrapeDeps['runGenreAssignment'],
    });

    expect(runGenreAssignment).toHaveBeenCalledTimes(1);
    const [, calledIds] = runGenreAssignment.mock.calls[0]!;
    expect(new Set(calledIds)).toEqual(new Set(['book-1', 'book-2', 'book-3']));
  });

  it('does not change exitCode/outcomes when the processor throws (failure isolation)', async () => {
    const logger = makeLogger();
    const refresh = fakeRefresh({
      outcomes: [outcome('yakaboo', ScrapeRunStatus.SUCCESS, 'run-1', ['book-1'])],
      anySucceeded: true,
    });
    const runGenreAssignment = vi.fn(async () => {
      throw new Error('engine exploded');
    });

    const result = await runProductionScrape({
      ...baseDeps(refresh),
      logger,
      genreAssignAfterScrape: true,
      runGenreAssignment,
    });

    expect(result.exitCode).toBe(0);
    expect(result.outcomes).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('genre assignment (post-scrape) failed'),
    );
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('engine exploded'));
  });

  it('does not affect exitCode=1 (all-failed) path when the hook also runs', async () => {
    const refresh = fakeRefresh({
      outcomes: [outcome('yakaboo', ScrapeRunStatus.FAILED, 'run-1', ['book-1'])],
      anySucceeded: false,
    });
    const runGenreAssignment = vi.fn(async () => ({
      counters: fakeGenreCounters(),
      affectedBookCount: 1,
      batches: 1,
      durationMs: 1,
    }));

    const result = await runProductionScrape({
      ...baseDeps(refresh),
      genreAssignAfterScrape: true,
      runGenreAssignment,
    });

    expect(result.exitCode).toBe(1);
    expect(runGenreAssignment).toHaveBeenCalledTimes(1);
  });

  it('logs a done summary with counters on success', async () => {
    const logger = makeLogger();
    const refresh = fakeRefresh({
      outcomes: [outcome('yakaboo', ScrapeRunStatus.SUCCESS, 'run-1', ['book-1'])],
      anySucceeded: true,
    });
    const runGenreAssignment = vi.fn(async () => ({
      counters: { ...fakeGenreCounters(), processed: 1, assigned: 1 },
      affectedBookCount: 1,
      batches: 1,
      durationMs: 7,
    }));

    await runProductionScrape({
      ...baseDeps(refresh),
      logger,
      genreAssignAfterScrape: true,
      runGenreAssignment,
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('genre assignment (post-scrape) enabled'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('genre assignment (post-scrape) done'),
    );
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('assigned=1'));
  });

  // ── bookchef-incremental-scraping PRD: mode/retentionDays threading ─────────

  it('passes mode and retentionDays through to the refresh layer when provided', async () => {
    const refresh = fakeRefresh({
      outcomes: [outcome('bookchef', ScrapeRunStatus.SUCCESS)],
      anySucceeded: true,
    });

    await runProductionScrape({
      ...baseDeps(refresh),
      mode: 'incremental',
      retentionDays: 30,
    });

    expect(refresh).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'incremental', retentionDays: 30 }),
    );
  });

  it('omits mode and retentionDays from the refresh call when not provided (no behavior change)', async () => {
    const refresh = fakeRefresh({
      outcomes: [outcome('yakaboo', ScrapeRunStatus.SUCCESS)],
      anySucceeded: true,
    });

    await runProductionScrape(baseDeps(refresh));

    const call = vi.mocked(refresh!).mock.calls[0]![0];
    expect(call).not.toHaveProperty('mode');
    expect(call).not.toHaveProperty('retentionDays');
  });
});
