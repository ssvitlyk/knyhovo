import type { PrismaClient, ScrapeRunTrigger, Prisma } from '@prisma/client';
import { ScrapeRunKind, ScrapeRunStatus } from '@prisma/client';
import type { ScraperProvider, ScraperOptions, ProviderName } from '@knyhovo/shared';
import { isRateLimited, planIncrementalFetch } from '@knyhovo/scrapers';
import {
  runScrapePipeline,
  formatSummary,
  mapProviderName,
  createMetrics,
  bindContext,
} from '../pipeline/index.js';
import type { ScrapeMetrics, Logger } from '../pipeline/index.js';
import {
  loadKnownSourceLastmod,
  recordSitemapPresence,
  countVanished,
  sweepStaleState,
} from '../pipeline/scrape-state.repository.js';
import { startScrapeRun, finishScrapeRun, deriveRunStatus } from './scrape-run.repository.js';
import { acquireRefreshLock, releaseRefreshLock } from './concurrency-guard.js';
import type { ProductionMetricsRegistry } from '../metrics/index.js';
import { INCREMENTAL_SITEMAP_PROVIDERS } from './incremental-providers.js';
import { shouldAutoEscalateToFull, findPreviousFullSitemapTotal } from './auto-escalation.js';

export interface FullCatalogRefreshOptions {
  readonly prisma: PrismaClient;
  readonly providers: readonly ScraperProvider[];
  readonly triggeredBy: ScrapeRunTrigger;
  readonly scraperOptions?: ScraperOptions;
  readonly logger?: Logger;
  /** Injectable clock for deterministic timestamps in tests. */
  readonly now?: () => Date;
  /**
   * Optional production metrics registry. When supplied, each finished provider
   * run is folded into the metrics via `record(...)`. Recording is observation
   * only — it never alters control flow or persistence.
   */
  readonly metrics?: ProductionMetricsRegistry;
  /**
   * Requested scrape mode (bookchef-incremental-scraping PRD §5). Only affects
   * providers in `INCREMENTAL_SITEMAP_PROVIDERS` — every other provider always
   * runs a full scrape regardless of this value. Omitted behaves exactly like
   * `'full'` (no behavior change for existing callers).
   */
  readonly mode?: 'full' | 'incremental';
  /**
   * TTL (days) for stale `provider_scrape_state` rows, swept after a
   * successful full run for an incremental-capable provider. Defaults to 90
   * (see `getScrapeStateRetentionDays` in `scripts/scrape-env.ts`).
   */
  readonly retentionDays?: number;
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
  /** canonicalBookIds this provider's run actually persisted (genres-taxonomy PRD G5 §1). */
  readonly affectedCanonicalBookIds: readonly string[];
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

    // bookchef-incremental-scraping PRD: only sitemap-diff-capable providers
    // get a known-watermark map / incremental mode. Every other provider's
    // scraperOptions stay byte-identical to `opts.scraperOptions`.
    const isIncrementalCapable = INCREMENTAL_SITEMAP_PROVIDERS.has(provider.name);
    let knownSnapshot: Map<string, string> = new Map();
    let effectiveMode: 'full' | 'incremental' = 'full';

    if (isIncrementalCapable) {
      // Loaded regardless of requested mode — needed both to drive an
      // incremental scrape AND as the shadow-validation prediction basis on
      // full runs (§7).
      knownSnapshot = await loadKnownSourceLastmod(opts.prisma, dbProvider);

      if (opts.mode === 'incremental') {
        const autoFull = await shouldAutoEscalateToFull(opts.prisma, dbProvider, knownSnapshot, clock());
        effectiveMode = autoFull ? 'full' : 'incremental';
        if (autoFull) {
          providerLogger.error(
            `${provider.name}: auto-escalated incremental→full (self-heal — empty state or stale/missing last full run)`,
          );
        }
      }
    }

    const scraperOptionsForProvider: ScraperOptions | undefined =
      effectiveMode === 'incremental'
        ? { ...opts.scraperOptions, knownSourceLastmod: knownSnapshot }
        : opts.scraperOptions;

    const { results } = await runScrapePipeline({
      prisma: opts.prisma,
      providers: [provider],
      ...(scraperOptionsForProvider !== undefined ? { scraperOptions: scraperOptionsForProvider } : {}),
      logger: providerLogger,
    });
    const result = results[0]!;

    const status = deriveRunStatus(result.metrics, result.scrapeErrors);
    // The scrapers already stop on 429/503 without retrying; surface the signal.
    const rateLimited = result.scrapeErrors.some(isRateLimited);

    const finishedAt = clock();

    let metadata: Record<string, unknown> | undefined;
    if (isIncrementalCapable && result.sitemap?.entries !== undefined) {
      const entries = result.sitemap.entries;
      const seenAt = finishedAt;
      await recordSitemapPresence(opts.prisma, dbProvider, entries, seenAt);
      const vanishedFromSitemap = await countVanished(
        opts.prisma,
        dbProvider,
        new Set(entries.map((e) => e.url)),
        seenAt,
      );

      const shadowPlan = planIncrementalFetch(entries, knownSnapshot);
      const toFetch = effectiveMode === 'incremental' ? shadowPlan.toFetch.length : entries.length;
      const unchangedSkipped = effectiveMode === 'incremental' ? shadowPlan.unchangedCount : 0;

      const allLastmodNull = entries.length > 0 && entries.every((e) => e.lastmod === null);
      if (allLastmodNull) {
        providerLogger.error(
          `${provider.name}: sitemap parsed with zero lastmod values across ${entries.length} entries — lastmod signal may have disappeared`,
        );
      }

      metadata = {
        mode: effectiveMode,
        sitemapTotal: entries.length,
        toFetch,
        unchangedSkipped,
        vanishedFromSitemap,
        ...(allLastmodNull ? { allLastmodMissing: true } : {}),
      };

      if (effectiveMode === 'incremental') {
        const savedFetches = entries.length - toFetch;
        const savedPercent = entries.length > 0 ? savedFetches / entries.length : 0;
        const fetchedListingsCount = result.metrics.scraped;
        const avgFetchMs = (result.scrapeDurationMs ?? 0) / Math.max(fetchedListingsCount, 1);
        const estimatedSavedTimeMs = savedFetches * avgFetchMs;
        metadata['efficiency'] = { savedFetches, savedPercent, estimatedSavedTimeMs };
        providerLogger.info(
          `${provider.name}: incremental efficiency — savedFetches=${savedFetches} ` +
            `savedPercent=${(savedPercent * 100).toFixed(1)}% estimatedSavedTimeMs=${Math.round(estimatedSavedTimeMs)}`,
        );
      }

      if (effectiveMode === 'full' && knownSnapshot.size > 0) {
        const predicted = new Set(shadowPlan.toFetch.map((e) => e.url));
        const actualChanged = new Set(result.changedListingUrls ?? []);
        const intersection = [...actualChanged].filter((u) => predicted.has(u));
        const missedUrls = [...actualChanged].filter((u) => !predicted.has(u));
        const predictedCount = predicted.size;
        const actualChangedCount = actualChanged.size;
        const recall = actualChangedCount === 0 ? 1 : intersection.length / actualChangedCount;
        const precision = predictedCount === 0 ? null : intersection.length / predictedCount;
        metadata['validation'] = {
          predictedCount,
          actualChangedCount,
          missedUrls: missedUrls.slice(0, 50),
          recall,
          precision,
        };
        providerLogger.info(
          `${provider.name}: shadow validation — predicted=${predictedCount} actualChanged=${actualChangedCount} ` +
            `recall=${recall.toFixed(3)} precision=${precision === null ? 'n/a' : precision.toFixed(3)}` +
            `${missedUrls.length > 0 ? ` MISSED=${missedUrls.length}` : ''}`,
        );
      }

      // TTL sweep: only after a successful (SUCCESS) FULL run.
      if (effectiveMode === 'full' && status === ScrapeRunStatus.SUCCESS) {
        const previousFullSitemapTotal = await findPreviousFullSitemapTotal(opts.prisma, dbProvider, runId);
        const guardOk = previousFullSitemapTotal === null || entries.length >= previousFullSitemapTotal * 0.5;
        if (guardOk) {
          const retentionDays = opts.retentionDays ?? 90;
          const cutoff = new Date(clock().getTime() - retentionDays * 24 * 3_600_000);
          const deleted = await sweepStaleState(opts.prisma, dbProvider, cutoff);
          providerLogger.info(
            `${provider.name}: TTL sweep deleted ${deleted} stale provider_scrape_state rows (cutoff ${cutoff.toISOString()})`,
          );
        } else {
          providerLogger.error(
            `${provider.name}: TTL sweep skipped — this run's sitemapTotal (${entries.length}) is less than half ` +
              `the previous full run's (${previousFullSitemapTotal}), possible sitemap generation problem`,
          );
        }
      }
    }

    await finishScrapeRun(opts.prisma, runId, {
      startedAt,
      finishedAt,
      status,
      metrics: result.metrics,
      scrapeErrors: result.scrapeErrors,
      ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {}),
    });

    providerLogger.info(formatSummary(result.provider, result.metrics, result.scrapeErrors));
    if (rateLimited) {
      providerLogger.error(`${provider.name}: rate-limited (HTTP 429/503) — stopped without retry`);
    }

    opts.metrics?.record({
      provider: result.provider,
      status,
      metrics: result.metrics,
      rateLimited,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    });

    return {
      provider: result.provider,
      runId,
      status,
      metrics: result.metrics,
      scrapeErrors: result.scrapeErrors,
      rateLimited,
      affectedCanonicalBookIds: result.affectedCanonicalBookIds,
    };
  } catch (err) {
    // Provider isolation: one provider's failure must not stop the rest.
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Provider ${provider.name} failed: ${message}`);

    const metrics = createMetrics();
    const rateLimited = isRateLimited(err);
    const finishedAt = clock();
    // Best-effort: close an already-opened run as FAILED so it never dangles RUNNING.
    if (runId !== null && startedAt !== null) {
      try {
        // If the failure above was a dropped DB connection (e.g. after a long
        // enrichment pass), this touch lets the pool re-establish it so the
        // run row can still be closed instead of dangling RUNNING.
        try {
          await opts.prisma.$queryRaw`SELECT 1`;
        } catch {
          // Touch is best-effort only; finishScrapeRun below has its own guard.
        }
        await finishScrapeRun(opts.prisma, runId, {
          startedAt,
          finishedAt,
          status: ScrapeRunStatus.FAILED,
          metrics,
          scrapeErrors: [message],
        });
      } catch (finishErr) {
        const finishMsg = finishErr instanceof Error ? finishErr.message : String(finishErr);
        logger.error(`Failed to finalize run ${runId} for ${provider.name}: ${finishMsg}`);
      }
    }

    opts.metrics?.record({
      provider: provider.name,
      status: ScrapeRunStatus.FAILED,
      metrics,
      rateLimited,
      ...(startedAt !== null ? { durationMs: finishedAt.getTime() - startedAt.getTime() } : {}),
    });

    return {
      provider: provider.name,
      runId,
      status: ScrapeRunStatus.FAILED,
      metrics,
      scrapeErrors: [message],
      rateLimited,
      affectedCanonicalBookIds: [],
    };
  }
}
