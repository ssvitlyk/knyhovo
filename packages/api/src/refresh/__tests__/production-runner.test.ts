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
): ProviderRefreshOutcome {
  return {
    provider,
    runId,
    status,
    metrics: createMetrics(),
    scrapeErrors: status === ScrapeRunStatus.FAILED ? ['boom'] : [],
    rateLimited: false,
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
