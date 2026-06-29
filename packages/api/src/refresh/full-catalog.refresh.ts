import type { PrismaClient, ScrapeRunTrigger } from '@prisma/client';
import { ScrapeRunKind, ScrapeRunStatus } from '@prisma/client';
import type { ScraperProvider, ScraperOptions, ProviderName } from '@knyhovo/shared';
import { isRateLimited } from '@knyhovo/scrapers';
import {
  runScrapePipeline,
  formatSummary,
  mapProviderName,
  createMetrics,
  bindContext,
} from '../pipeline/index.js';
import type { ScrapeMetrics, Logger } from '../pipeline/index.js';
import { startScrapeRun, finishScrapeRun, deriveRunStatus } from './scrape-run.repository.js';
import { acquireRefreshLock, releaseRefreshLock } from './concurrency-guard.js';

export interface FullCatalogRefreshOptions {
  readonly prisma: PrismaClient;
  readonly providers: readonly ScraperProvider[];
  readonly triggeredBy: ScrapeRunTrigger;
  readonly scraperOptions?: ScraperOptions;
  readonly logger?: Logger;
  /** Injectable clock for deterministic timestamps in tests. */
  readonly now?: () => Date;
}

export interface ProviderRefreshOutcome {
  readonly provider: ProviderName;
  /** The scrape_runs row id, or null when the run could not be opened. */
  readonly runId: string | null;
  readonly status: ScrapeRunStatus;
  readonly metrics: ScrapeMetrics;
  readonly scrapeErrors: readonly string[];
  /** True when the provider hit an HTTP 429/503 signal during this run. */
  readonly rateLimited: boolean;
}

export interface FullCatalogRefreshResult {
  readonly outcomes: readonly ProviderRefreshOutcome[];
  /** True when at least one provider finished SUCCESS or PARTIAL. */
  readonly anySucceeded: boolean;
}

/**
 * Orchestrate a FULL_CATALOG refresh across every provider with per-provider
 * isolation and run tracking (W10.2).
 *
 * Each provider gets its own `scrape_runs` row (start → finish). A failure in
 * one provider never stops the others: thrown errors are caught, the run is
 * closed as FAILED on a best-effort basis, and orchestration moves on.
 *
 * Rate-limit handling: the scrapers already stop on HTTP 429/503 without a
 * retry loop (`isRateLimited` in `@knyhovo/scrapers`). This layer adds no retry;
 * it only surfaces the signal for observability and lets the remaining
 * providers proceed.
 *
 * Description enrichment stays opt-in via `scraperOptions` and is off by default.
 */
export async function runFullCatalogRefresh(
  opts: FullCatalogRefreshOptions,
): Promise<FullCatalogRefreshResult> {
  const logger: Logger = opts.logger ?? {
    info: (m: string) => console.log(m),
    error: (m: string) => console.error(m),
  };
  const clock = opts.now ?? ((): Date => new Date());

  // W10.6 concurrency guard: refuse to start when another FULL_CATALOG or
  // WISHLIST_REFRESH run is already RUNNING (cron-overlap). Throws
  // RefreshAlreadyRunningError, which the CLI treats as an idempotent skip.
  const lock = await acquireRefreshLock(opts.prisma, ScrapeRunKind.FULL_CATALOG, { now: clock });

  try {
    const outcomes: ProviderRefreshOutcome[] = [];
    for (const provider of opts.providers) {
      outcomes.push(await refreshProvider(provider, opts, logger, clock));
      logger.info('');
    }

    const anySucceeded = outcomes.some(
      (o) =>
        o.status === ScrapeRunStatus.SUCCESS || o.status === ScrapeRunStatus.PARTIAL,
    );

    return { outcomes, anySucceeded };
  } finally {
    // Sweep any dangling RUNNING rows from this refresh, even on throw.
    await releaseRefreshLock(opts.prisma, lock, { now: clock });
  }
}

/**
 * Run a single provider end-to-end inside its own try/catch so a failure is
 * isolated from the rest of the refresh.
 */
async function refreshProvider(
  provider: ScraperProvider,
  opts: FullCatalogRefreshOptions,
  logger: Logger,
  clock: () => Date,
): Promise<ProviderRefreshOutcome> {
  const dbProvider = mapProviderName(provider.name);
  let runId: string | null = null;
  let startedAt: Date | null = null;

  try {
    const started = await startScrapeRun(opts.prisma, {
      provider: dbProvider,
      kind: ScrapeRunKind.FULL_CATALOG,
      triggeredBy: opts.triggeredBy,
      startedAt: clock(),
    });
    runId = started.id;
    startedAt = started.startedAt;

    // Structured-log context for everything this provider's run emits.
    const providerLogger = bindContext(logger, { runId, provider: dbProvider });

    const { results } = await runScrapePipeline({
      prisma: opts.prisma,
      providers: [provider],
      ...(opts.scraperOptions !== undefined ? { scraperOptions: opts.scraperOptions } : {}),
      logger: providerLogger,
    });
    const result = results[0]!;

    const status = deriveRunStatus(result.metrics, result.scrapeErrors);
    // The scrapers already stop on 429/503 without retrying; surface the signal.
    const rateLimited = result.scrapeErrors.some(isRateLimited);

    await finishScrapeRun(opts.prisma, runId, {
      startedAt,
      finishedAt: clock(),
      status,
      metrics: result.metrics,
      scrapeErrors: result.scrapeErrors,
    });

    providerLogger.info(formatSummary(result.provider, result.metrics, result.scrapeErrors));
    if (rateLimited) {
      providerLogger.error(`${provider.name}: rate-limited (HTTP 429/503) — stopped without retry`);
    }

    return {
      provider: result.provider,
      runId,
      status,
      metrics: result.metrics,
      scrapeErrors: result.scrapeErrors,
      rateLimited,
    };
  } catch (err) {
    // Provider isolation: one provider's failure must not stop the rest.
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Provider ${provider.name} failed: ${message}`);

    const metrics = createMetrics();
    // Best-effort: close an already-opened run as FAILED so it never dangles RUNNING.
    if (runId !== null && startedAt !== null) {
      try {
        await finishScrapeRun(opts.prisma, runId, {
          startedAt,
          finishedAt: clock(),
          status: ScrapeRunStatus.FAILED,
          metrics,
          scrapeErrors: [message],
        });
      } catch (finishErr) {
        const finishMsg = finishErr instanceof Error ? finishErr.message : String(finishErr);
        logger.error(`Failed to finalize run ${runId} for ${provider.name}: ${finishMsg}`);
      }
    }

    return {
      provider: provider.name,
      runId,
      status: ScrapeRunStatus.FAILED,
      metrics,
      scrapeErrors: [message],
      rateLimited: isRateLimited(err),
    };
  }
}
