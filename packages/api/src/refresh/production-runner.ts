import type { PrismaClient, ScrapeRunTrigger } from '@prisma/client';
import { ScrapeRunStatus } from '@prisma/client';
import type { ScraperProvider, ScraperOptions, ProviderName } from '@knyhovo/shared';
import type { Logger } from '../pipeline/index.js';
import { runFullCatalogRefresh } from './full-catalog.refresh.js';
import type { ProviderRefreshOutcome } from './full-catalog.refresh.js';
import { RefreshAlreadyRunningError } from './concurrency-guard.js';
import type { ProductionMetricsRegistry } from '../metrics/index.js';
import { runPostScrapeGenreAssignment } from '../genres/post-scrape-assignment.js';

/**
 * Production runner: a thin, testable contract around `runFullCatalogRefresh`
 * that turns provider outcomes into a process exit code and fires an
 * operational alert hook when the whole refresh fails.
 *
 * It deliberately owns NO process lifecycle (no `process.exit`, no
 * `prisma.$disconnect`, no browser teardown) — that stays in the CLI wrapper —
 * so its exit semantics can be unit-tested without side effects.
 */

export type IngestionAlertReason = 'all-providers-failed';

export interface IngestionAlert {
  readonly reason: IngestionAlertReason;
  readonly failedProviders: readonly ProviderName[];
  readonly runIds: readonly (string | null)[];
}

/** Operational-alert channel. PR1 ships a logging stub; a real channel is PR3. */
export type IngestionAlertHook = (alert: IngestionAlert) => void | Promise<void>;

export interface ProductionRunResult {
  /** `0` when at least one provider succeeded (or an idempotent skip); `1` when all failed. */
  readonly exitCode: 0 | 1;
  /** True when another refresh held the lock and this run was skipped. */
  readonly skipped: boolean;
  readonly outcomes: readonly ProviderRefreshOutcome[];
}

export interface RunProductionScrapeDeps {
  readonly prisma: PrismaClient;
  readonly providers: readonly ScraperProvider[];
  readonly triggeredBy: ScrapeRunTrigger;
  readonly logger: Logger;
  /** Operational-alert hook fired on exit≠0. Defaults to a structured-log stub. */
  readonly alertHook?: IngestionAlertHook;
  readonly scraperOptions?: ScraperOptions;
  readonly now?: () => Date;
  /** Injectable refresh implementation for deterministic exit-semantics tests. */
  readonly refresh?: typeof runFullCatalogRefresh;
  /** Optional production metrics registry; passed through to the refresh layer. */
  readonly metrics?: ProductionMetricsRegistry;
  /**
   * Genres-taxonomy PRD G5: run post-scrape genre assignment for the books
   * this refresh touched. Env-gated (`GENRE_ASSIGN_AFTER_SCRAPE=true`),
   * default disabled — the CLI resolves the env var and passes the result
   * here so this function stays a pure, injectable contract.
   */
  readonly genreAssignAfterScrape?: boolean;
  /** Injectable genre-assignment implementation for deterministic tests. */
  readonly runGenreAssignment?: typeof runPostScrapeGenreAssignment;
}

/** Default alert channel for PR1: emit a structured error line. Real email/Slack is PR3. */
function defaultAlertHook(logger: Logger): IngestionAlertHook {
  return (alert: IngestionAlert): void => {
    logger.error(
      `operational-alert [${alert.reason}]: providers=${alert.failedProviders.join(',')} ` +
        `runIds=${alert.runIds.map((id) => id ?? 'null').join(',')} (stub channel — real alert is PR3)`,
    );
  };
}

/**
 * Genres-taxonomy PRD G5: optional post-scrape genre assignment, scoped to
 * exactly the books this refresh touched. Isolated on purpose — a failure
 * here is logged and swallowed; it never changes `exitCode`, `outcomes`, or
 * `anySucceeded`, and it never runs at all when disabled or when nothing was
 * affected (no DB access in that case, not even `loadEngineContext`).
 */
async function runPostScrapeAssignmentHook(
  deps: RunProductionScrapeDeps,
  outcomes: readonly ProviderRefreshOutcome[],
  runGenreAssignment: typeof runPostScrapeGenreAssignment,
): Promise<void> {
  const affected = new Set<string>();
  for (const o of outcomes) {
    for (const id of o.affectedCanonicalBookIds) affected.add(id);
  }
  if (affected.size === 0) return;

  const runContext = outcomes.map((o) => `${o.provider}:${o.runId ?? 'null'}`).join(',');
  deps.logger.info(
    `genre assignment (post-scrape) enabled — runs=[${runContext}] affectedBookCount=${affected.size}`,
  );

  const startedAt = Date.now();
  try {
    const result = await runGenreAssignment(deps.prisma, [...affected]);
    const { counters } = result;
    deps.logger.info(
      `genre assignment (post-scrape) done — processed=${counters.processed} assigned=${counters.assigned} ` +
        `changed=${counters.changed} cleared=${counters.cleared} unchanged=${counters.unchanged} ` +
        `manual-skipped=${counters.manualSkipped} no-signal=${counters.noSignal} ` +
        `unmapped=${counters.unmappedBooks} durationMs=${result.durationMs}`,
    );
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    deps.logger.error(
      `genre assignment (post-scrape) failed — runs=[${runContext}] affectedBookCount=${affected.size} ` +
        `durationMs=${durationMs}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
    );
  }
}

export async function runProductionScrape(
  deps: RunProductionScrapeDeps,
): Promise<ProductionRunResult> {
  const refresh = deps.refresh ?? runFullCatalogRefresh;
  const alertHook = deps.alertHook ?? defaultAlertHook(deps.logger);
  const runGenreAssignment = deps.runGenreAssignment ?? runPostScrapeGenreAssignment;

  try {
    const { outcomes, anySucceeded } = await refresh({
      prisma: deps.prisma,
      providers: [...deps.providers],
      triggeredBy: deps.triggeredBy,
      logger: deps.logger,
      ...(deps.scraperOptions !== undefined ? { scraperOptions: deps.scraperOptions } : {}),
      ...(deps.now !== undefined ? { now: deps.now } : {}),
      ...(deps.metrics !== undefined ? { metrics: deps.metrics } : {}),
    });

    if (deps.genreAssignAfterScrape === true) {
      await runPostScrapeAssignmentHook(deps, outcomes, runGenreAssignment);
    }

    if (anySucceeded) {
      return { exitCode: 0, skipped: false, outcomes };
    }

    // Every provider failed — surface a non-zero exit and fire the alert hook.
    const failed = outcomes.filter((o) => o.status === ScrapeRunStatus.FAILED);
    await alertHook({
      reason: 'all-providers-failed',
      failedProviders: failed.map((o) => o.provider),
      runIds: failed.map((o) => o.runId),
    });
    return { exitCode: 1, skipped: false, outcomes };
  } catch (err) {
    // Cron-overlap is not a failure: another refresh holds the lock. Skip idempotently.
    if (err instanceof RefreshAlreadyRunningError) {
      deps.logger.info(`skip: ${err.message}`);
      return { exitCode: 0, skipped: true, outcomes: [] };
    }
    throw err;
  }
}
