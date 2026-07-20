import { ScrapeRunKind, ScrapeRunStatus, ScrapeRunTrigger } from '@prisma/client';
import type { ProviderName } from '@knyhovo/shared';
import { prisma } from '../db.js';
import {
  countEnrichmentCandidates,
  deriveEnrichmentStatus,
  EnrichmentAlreadyRunningError,
  metricsForRunClose,
  openEnrichmentRun,
  resolveEnrichmentResume,
  runEnrichment,
  type EnrichmentBatchProgress,
} from '../enrichment/engine.js';
import {
  buildCampaignMetadata,
  countLeadingNoProgressRuns,
  exitCodeForReason,
  reasonForSummary,
  shouldBlockForNoProgress,
  type EnrichmentExitReason,
} from '../enrichment/lifecycle.js';
import { ENRICHMENT_PROVIDERS } from '../enrichment/providers.js';
import { createLogger } from '../pipeline/index.js';
import { mapProviderName } from '../pipeline/persist-listing.js';
import type { StaleReapConfig } from '../refresh/concurrency-guard.js';
import {
  findRecentScrapeRuns,
  finishScrapeRun,
  startHeartbeat,
} from '../refresh/scrape-run.repository.js';
import { ENRICHMENT_USAGE, parseEnrichmentArgs } from './run-enrichment-args.js';
import {
  getEnrichBatchSize,
  getEnrichCircuitBreakerThreshold,
  getEnrichDelayMs,
  getEnrichMaxNoProgressRestarts,
  getHeartbeatIntervalSeconds,
  getHeartbeatTimeoutMinutes,
  getLegacyStaleTimeoutHours,
} from './scrape-env.js';

/**
 * `scrape:enrich` CLI entrypoint (megakniga-resumable-enrichment PRD §4.9, PR1).
 *
 * The production way to run a long product-page enrichment: a non-interactive
 * one-shot command for a Railway Job — NOT the Railway Console (a Console
 * shell dies with the operator's laptop/session and takes the run with it).
 *
 *   pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga
 *   pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga --limit=20   # smoke
 *   pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga --dry-run    # queue + last run
 *   pnpm --filter @knyhovo/api scrape:enrich -- --provider=megakniga --force      # re-walk all rows
 *
 * Every batch commits in its own transaction — listing updates atomically
 * with the run checkpoint (cursor + live counters) — so a kill at any point
 * loses at most one batch, and a re-run resumes exactly from the persisted
 * cursor of the last stopped run (PRD §4.5). Progress is tracked as a
 * `scrape_runs` row with kind DESCRIPTION_ENRICHMENT.
 *
 * PR5 lifecycle (PRD §4.7, §3, §4):
 *   - SIGINT/SIGTERM → an AbortController the engine watches: the in-flight
 *     fetch finishes, the gathered batch commits, the cursor checkpoints, the
 *     run closes PARTIAL (resumable). A SECOND signal forces an immediate exit.
 *   - Exit-code contract via one pure function ({@link exitCodeForReason}):
 *     0 (clean / SIGINT / rate-limit / --limit / no-progress guard),
 *     75 (SIGTERM / circuit breaker / transient crash — restart & resume),
 *     1 (already-running / config error).
 *   - No-progress restart-loop guard: refuse to start after N consecutive
 *     zero-progress runs, breaking a Railway restart loop even under `Always`.
 *   - Circuit breaker: stop on a mass infrastructure outage instead of
 *     fetch-failing all ~27k listings.
 *
 * Mirrors the run-genre-backfill pattern: shared `prisma` singleton,
 * pino-backed logger, `process.exitCode` on the normal path (never
 * `process.exit()` except the forced double-signal hard-exit), and a `finally`
 * that always clears the heartbeat, removes signal handlers, and disconnects.
 */

/** Resolve a raw --provider value to a configured enrichable provider, or null. */
function asEnrichableProvider(name: string): ProviderName | null {
  for (const key of ENRICHMENT_PROVIDERS.keys()) {
    if (key === name) return key;
  }
  return null;
}

/**
 * Same SCRAPE_TRIGGERED_BY convention as run-scrape.ts (kept local: that file
 * is a script entrypoint with top-level execution, not an importable module).
 */
function parseTriggeredBy(val: string | undefined): ScrapeRunTrigger {
  switch (val?.toUpperCase()) {
    case 'CRON':
      return ScrapeRunTrigger.CRON;
    case 'SYSTEM':
      return ScrapeRunTrigger.SYSTEM;
    default:
      return ScrapeRunTrigger.MANUAL;
  }
}

async function main(): Promise<void> {
  const logger = createLogger();
  const startedAtMs = Date.now();

  // Config errors (bad args/env, unknown provider, missing DATABASE_URL) all
  // exit 1 via the one contract — a restart cannot fix a misconfiguration
  // (PRD §4.7).
  const configError = (message: string): void => {
    logger.error(message);
    process.exitCode = exitCodeForReason('config-error');
  };

  if (process.env['DATABASE_URL'] === undefined || process.env['DATABASE_URL'] === '') {
    configError('scrape:enrich: DATABASE_URL is required');
    return;
  }

  let args;
  try {
    args = parseEnrichmentArgs(process.argv.slice(2));
  } catch (err: unknown) {
    configError(err instanceof Error ? err.message : String(err));
    return;
  }

  const provider = asEnrichableProvider(args.provider);
  if (provider === null) {
    configError(
      `scrape:enrich: provider '${args.provider}' does not support background enrichment ` +
        `(supported: ${[...ENRICHMENT_PROVIDERS.keys()].join(', ')})\n${ENRICHMENT_USAGE}`,
    );
    return;
  }

  const batchSize = args.batchSize ?? getEnrichBatchSize(process.env);
  const delayMs = getEnrichDelayMs(process.env);
  const triggeredBy = parseTriggeredBy(process.env['SCRAPE_TRIGGERED_BY']);

  if (args.dryRun) {
    // Report-only: queue size + last run state + resume decision, zero
    // fetches/writes/run rows.
    const candidates = await countEnrichmentCandidates(prisma, provider, args.force);
    const lastRun = await prisma.scrapeRun.findFirst({
      where: { provider: mapProviderName(provider), kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT },
      orderBy: { startedAt: 'desc' },
    });
    logger.info(
      `scrape:enrich --dry-run: provider=${provider} candidates=${candidates}` +
        `${args.force ? ' (force)' : ''}`,
    );
    logger.info(
      lastRun === null
        ? 'scrape:enrich --dry-run: no previous enrichment runs'
        : `scrape:enrich --dry-run: last run ${lastRun.id} status=${lastRun.status} ` +
            `startedAt=${lastRun.startedAt.toISOString()} ` +
            `itemsFound=${lastRun.itemsFound} itemsUpdated=${lastRun.itemsUpdated} ` +
            `itemsProcessed=${lastRun.itemsProcessed} errorsCount=${lastRun.errorsCount} ` +
            `cursor=${lastRun.cursor ?? 'NULL'}`,
    );
    const resume = resolveEnrichmentResume(lastRun);
    logger.info(
      resume.startCursor === null
        ? 'scrape:enrich --dry-run: a run now would start a fresh campaign from the beginning'
        : `scrape:enrich --dry-run: a run now would resume run ${resume.resumedFromRunId} ` +
            `from cursor=${resume.startCursor}`,
    );
    process.exitCode = 0;
    return;
  }

  logger.info(
    `scrape:enrich starting at ${new Date(startedAtMs).toISOString()} ` +
      `(provider=${provider} batchSize=${batchSize} limit=${args.limit ?? '—'} ` +
      `force=${args.force} delayMs=${delayMs ?? 'provider default'} triggeredBy=${triggeredBy})`,
  );

  const baseMetadata = {
    batchSize,
    ...(args.limit !== null ? { limit: args.limit } : {}),
    ...(delayMs !== undefined ? { delayMs } : {}),
    ...(args.force ? { force: true } : {}),
  };

  const circuitBreakerThreshold = getEnrichCircuitBreakerThreshold(process.env);
  const maxNoProgressRestarts = getEnrichMaxNoProgressRestarts(process.env);

  // Same env-driven staleness thresholds as run-scrape.ts / run-wishlist-refresh.ts.
  const staleReap: StaleReapConfig = {
    heartbeatTimeoutMs: getHeartbeatTimeoutMinutes(process.env) * 60_000,
    legacyStartedAtTimeoutMs: getLegacyStaleTimeoutHours(process.env) * 3_600_000,
  };

  // Restart-loop guard (PRD §4.7 layer 2): if the last N runs each made zero
  // progress, a resumable-but-repeatedly-failing cause is looping under
  // Railway's restart policy. Refuse to start, leave a FAILED marker, and exit
  // 0 (deliberately — 0 breaks the loop even under a misconfigured `Always`).
  const recentRuns = await findRecentScrapeRuns(prisma, {
    provider: mapProviderName(provider),
    kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
    take: maxNoProgressRestarts,
  });
  const leadingNoProgress = countLeadingNoProgressRuns(recentRuns);
  if (shouldBlockForNoProgress(leadingNoProgress, maxNoProgressRestarts)) {
    const guardMessage =
      `restart loop guard: ${leadingNoProgress} consecutive runs made no progress ` +
      `(items_processed=0) — refusing to start; investigate before re-running ` +
      `(reset via a run that makes progress, or clear the recent FAILED/PARTIAL rows)`;
    logger.error(`scrape:enrich: ${guardMessage}`);
    // A FAILED marker records WHY the campaign stopped (test-matrix row 15). It
    // itself has items_processed=0, so the guard stays engaged until an
    // operator intervenes — by design: the loop is ended, not silently retried.
    try {
      await prisma.scrapeRun.create({
        data: {
          provider: mapProviderName(provider),
          kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
          status: ScrapeRunStatus.FAILED,
          triggeredBy,
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 0,
          errorSummary: guardMessage.slice(0, 1000),
          metadata: { ...baseMetadata, stopReason: 'no-progress-guard', leadingNoProgress },
        },
      });
    } catch (markerErr: unknown) {
      logger.error(
        `scrape:enrich: could not write no-progress guard marker: ` +
          `${markerErr instanceof Error ? markerErr.message : String(markerErr)}`,
      );
    }
    process.exitCode = exitCodeForReason('no-progress-guard');
    return;
  }

  // PR4 start sequence (PRD §4.5 steps 2–5, §4.6): reap stale enrichment
  // RUNNING rows, refuse a fresh one, resume from the last persisted cursor,
  // and INSERT the run — the partial unique index turns a concurrent second
  // start into a clean "already running" error with zero side effects.
  let opened;
  try {
    opened = await openEnrichmentRun({
      prisma,
      provider,
      triggeredBy,
      metadata: baseMetadata,
      staleReap,
      logger,
    });
  } catch (err: unknown) {
    if (err instanceof EnrichmentAlreadyRunningError) {
      logger.error(`scrape:enrich: ${err.message} — this process created nothing and exits`);
      process.exitCode = exitCodeForReason('already-running');
      return;
    }
    throw err;
  }
  const { run, resume, predecessor } = opened;

  logger.info(
    resume.startCursor === null
      ? 'scrape:enrich: no resumable previous run — starting a fresh campaign'
      : `scrape:enrich: resuming campaign of run ${resume.resumedFromRunId} ` +
          `from cursor=${resume.startCursor}`,
  );
  logger.info(`scrape:enrich run ${run.id} opened (kind=DESCRIPTION_ENRICHMENT)`);

  // Campaign-scoped trace (PRD §3): root run id, resume attempt, and the
  // starting cursor/processed baseline — stamped on every close so a chain of
  // resumes is auditable and the no-progress guard is explainable.
  const campaign = buildCampaignMetadata({
    runId: run.id,
    startCursor: resume.startCursor,
    resumedFromRunId: resume.resumedFromRunId,
    predecessor,
  });
  logger.info(
    `scrape:enrich campaign root=${campaign.campaignRootRunId} ` +
      `resumeAttempt=${campaign.resumeAttempt} startItemsProcessed=${campaign.startItemsProcessed}`,
  );

  // finishScrapeRun rewrites metadata wholesale, so the close must carry the
  // resume marker openEnrichmentRun stamped onto the row at start plus the
  // campaign trace.
  const runMetadata = {
    ...baseMetadata,
    ...(resume.resumedFromRunId !== null ? { resumedFromRunId: resume.resumedFromRunId } : {}),
    campaignRootRunId: campaign.campaignRootRunId,
    resumeAttempt: campaign.resumeAttempt,
    startCursor: campaign.startCursor,
    startItemsProcessed: campaign.startItemsProcessed,
  };

  // Liveness signal (stale-scrape-recovery reuse, PRD §4.4): without it a
  // SIGKILL'd job would look alive forever and could never be auto-reaped.
  const stopHeartbeat = startHeartbeat(prisma, run.id, {
    intervalMs: getHeartbeatIntervalSeconds(process.env) * 1000,
  });

  // Graceful shutdown (PRD §4.7): both signals abort the engine identically
  // (no new fetches → commit the batch prefix → checkpoint → PARTIAL); only
  // the SOURCE decides the exit code (SIGINT → 0 manual stop, SIGTERM → 75
  // platform restart). A SECOND signal forces an immediate exit. Handlers are
  // removed in the finally so they never outlive the run.
  const abortController = new AbortController();
  let abortedBy: 'SIGINT' | 'SIGTERM' | null = null;
  const handleSignal = (signal: 'SIGINT' | 'SIGTERM') => (): void => {
    if (abortedBy === null) {
      abortedBy = signal;
      logger.info(
        `scrape:enrich: received ${signal} — graceful shutdown (finishing in-flight fetch, ` +
          `committing the current batch, checkpointing the cursor). Send ${signal} again to force-exit.`,
      );
      abortController.abort();
    } else {
      // Second signal: the operator/platform wants out now. This is the only
      // process.exit() in the CLI, deliberately outside the normal path.
      logger.error(`scrape:enrich: received ${signal} again — forcing immediate exit`);
      process.exit(signal === 'SIGINT' ? 130 : 143);
    }
  };
  const sigintHandler = handleSignal('SIGINT');
  const sigtermHandler = handleSignal('SIGTERM');
  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigtermHandler);

  // The last committed batch's progress — on a mid-run crash this is what the
  // FAILED close reports, so checkpointed counters are never wiped to zero.
  // (Ref-holder: assignment happens inside the onBatch closure, which TS's
  // control-flow analysis would otherwise narrow away at the catch site.)
  const lastProgress: { current: EnrichmentBatchProgress | null } = { current: null };

  try {
    const summary = await runEnrichment({
      prisma,
      provider,
      batchSize,
      force: args.force,
      logger,
      ...(args.limit !== null ? { limit: args.limit } : {}),
      ...(delayMs !== undefined ? { delayMs } : {}),
      // PR3: the engine checkpoints cursor + live counters onto this run row
      // INSIDE each batch transaction — atomically with the listing updates.
      startCursor: resume.startCursor,
      runId: run.id,
      // PR5: graceful shutdown + circuit breaker.
      signal: abortController.signal,
      circuitBreakerThreshold,
      // Observational only: keeps the last committed progress at hand so a
      // crash can close the run with truthful counters.
      onBatch: (progress) => {
        lastProgress.current = progress;
      },
    });

    const status = deriveEnrichmentStatus(summary);
    const reason = reasonForSummary(summary, abortedBy);
    await finishScrapeRun(prisma, run.id, {
      startedAt: run.startedAt,
      status,
      metrics: metricsForRunClose(summary),
      scrapeErrors: summary.errorSamples,
      // "cursor NULL ⇔ done" (PRD §4.2): null when the queue was exhausted,
      // the resume point when the run stopped early (--limit / rate limit /
      // abort / circuit breaker).
      cursor: summary.finalCursor,
      itemsProcessed: summary.processed,
      metadata: {
        ...runMetadata,
        processed: summary.processed,
        enriched: summary.enriched,
        failed: summary.failed,
        totalCandidates: summary.totalCandidates,
        batches: summary.batches,
        stopReason: reason,
        ...(summary.stoppedEarly !== null ? { stoppedEarly: summary.stoppedEarly } : {}),
      },
    });

    logger.info(
      `scrape:enrich run ${run.id} closed as ${status} (reason=${reason}) — ` +
        `processed=${summary.processed}/${summary.totalCandidates} ` +
        `enriched=${summary.enriched} failed=${summary.failed} ` +
        `cursor=${summary.finalCursor ?? 'NULL (campaign done)'}`,
    );
    // Single exit-code contract (PRD §4.7): the reason maps to 0 / 75 / 1.
    process.exitCode = exitCodeForReason(reason);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(err instanceof Error ? err.stack ?? message : message);
    // A crash with the checkpoint intact is a resumable temporary stop — exit
    // 75 so Railway restarts with a fresh process that resumes from the cursor
    // (PRD §4.7: transient DB / exhausted batch-tx retries). The no-progress
    // guard bounds a crash that never makes progress.
    const crashReason: EnrichmentExitReason = 'crash-resumable';
    try {
      // Close with the last committed batch's counters (audit fix): a crash
      // on batch N must not report items_updated=0 after N-1 committed
      // batches. Null lastProgress (crash before the first batch) => zeros
      // are the truth. The crash message leads the error list, followed by
      // the per-item samples gathered so far. `cursor`/`itemsProcessed` are
      // deliberately OMITTED: the in-transaction checkpoint already holds the
      // last committed position, and a FAILED close must keep it (PRD §4.2:
      // FAILED with cursor NOT NULL = resumable).
      await finishScrapeRun(prisma, run.id, {
        startedAt: run.startedAt,
        status: ScrapeRunStatus.FAILED,
        metrics: metricsForRunClose(lastProgress.current),
        scrapeErrors: [message, ...(lastProgress.current?.errorSamples ?? [])],
        metadata: {
          ...runMetadata,
          ...(lastProgress.current !== null
            ? {
                processed: lastProgress.current.processed,
                enriched: lastProgress.current.enriched,
                failed: lastProgress.current.failed,
                batches: lastProgress.current.batch,
              }
            : {}),
          stopReason: crashReason,
        },
      });
    } catch (finishErr: unknown) {
      logger.error(
        `scrape:enrich: could not close run ${run.id}: ` +
          `${finishErr instanceof Error ? finishErr.message : String(finishErr)}`,
      );
    }
    process.exitCode = exitCodeForReason(crashReason);
  } finally {
    // Always tear down the run's process resources — on success, crash, abort
    // and early return alike. A heartbeat tick that already fired against a
    // closed run is a no-op (heartbeatScrapeRun is gated on status=RUNNING).
    stopHeartbeat();
    process.off('SIGINT', sigintHandler);
    process.off('SIGTERM', sigtermHandler);
    const durationMs = Date.now() - startedAtMs;
    logger.info(`scrape:enrich finished in ${durationMs}ms (exitCode=${process.exitCode ?? 0})`);
  }
}

void main().finally(async () => {
  await prisma.$disconnect();
});
