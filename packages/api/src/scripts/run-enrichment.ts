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
import { ENRICHMENT_PROVIDERS } from '../enrichment/providers.js';
import { createLogger } from '../pipeline/index.js';
import { mapProviderName } from '../pipeline/persist-listing.js';
import type { StaleReapConfig } from '../refresh/concurrency-guard.js';
import { finishScrapeRun, startHeartbeat } from '../refresh/scrape-run.repository.js';
import { ENRICHMENT_USAGE, parseEnrichmentArgs } from './run-enrichment-args.js';
import {
  getEnrichBatchSize,
  getEnrichDelayMs,
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
 * cursor of the last stopped run (PRD §4.5; RUNNING-row reap and the
 * exclusive lock arrive in PR4). Progress is tracked as a `scrape_runs` row
 * with kind DESCRIPTION_ENRICHMENT.
 *
 * Mirrors the run-genre-backfill pattern: shared `prisma` singleton,
 * pino-backed logger, `process.exitCode` (never `process.exit()`), and a
 * `finally` that always disconnects Prisma.
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

  let args;
  try {
    args = parseEnrichmentArgs(process.argv.slice(2));
  } catch (err: unknown) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  const provider = asEnrichableProvider(args.provider);
  if (provider === null) {
    logger.error(
      `scrape:enrich: provider '${args.provider}' does not support background enrichment ` +
        `(supported: ${[...ENRICHMENT_PROVIDERS.keys()].join(', ')})\n${ENRICHMENT_USAGE}`,
    );
    process.exitCode = 1;
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

  // Same env-driven staleness thresholds as run-scrape.ts / run-wishlist-refresh.ts.
  const staleReap: StaleReapConfig = {
    heartbeatTimeoutMs: getHeartbeatTimeoutMinutes(process.env) * 60_000,
    legacyStartedAtTimeoutMs: getLegacyStaleTimeoutHours(process.env) * 3_600_000,
  };

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
      process.exitCode = 1;
      return;
    }
    throw err;
  }
  const { run, resume } = opened;

  logger.info(
    resume.startCursor === null
      ? 'scrape:enrich: no resumable previous run — starting a fresh campaign'
      : `scrape:enrich: resuming campaign of run ${resume.resumedFromRunId} ` +
          `from cursor=${resume.startCursor}`,
  );
  logger.info(`scrape:enrich run ${run.id} opened (kind=DESCRIPTION_ENRICHMENT)`);

  // finishScrapeRun rewrites metadata wholesale, so the close must carry the
  // resume marker openEnrichmentRun stamped onto the row at start.
  const runMetadata = {
    ...baseMetadata,
    ...(resume.resumedFromRunId !== null ? { resumedFromRunId: resume.resumedFromRunId } : {}),
  };

  // Liveness signal (stale-scrape-recovery reuse, PRD §4.4): without it a
  // SIGKILL'd job would look alive forever and could never be auto-reaped.
  const stopHeartbeat = startHeartbeat(prisma, run.id, {
    intervalMs: getHeartbeatIntervalSeconds(process.env) * 1000,
  });

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
      // Observational only: keeps the last committed progress at hand so a
      // crash can close the run with truthful counters.
      onBatch: (progress) => {
        lastProgress.current = progress;
      },
    });

    const status = deriveEnrichmentStatus(summary);
    await finishScrapeRun(prisma, run.id, {
      startedAt: run.startedAt,
      status,
      metrics: metricsForRunClose(summary),
      scrapeErrors: summary.errorSamples,
      // "cursor NULL ⇔ done" (PRD §4.2): null when the queue was exhausted,
      // the resume point when the run stopped early (--limit / rate limit).
      cursor: summary.finalCursor,
      itemsProcessed: summary.processed,
      metadata: {
        ...runMetadata,
        processed: summary.processed,
        enriched: summary.enriched,
        failed: summary.failed,
        totalCandidates: summary.totalCandidates,
        batches: summary.batches,
        ...(summary.stoppedEarly !== null ? { stoppedEarly: summary.stoppedEarly } : {}),
      },
    });

    logger.info(
      `scrape:enrich run ${run.id} closed as ${status} — ` +
        `processed=${summary.processed}/${summary.totalCandidates} ` +
        `enriched=${summary.enriched} failed=${summary.failed} ` +
        `cursor=${summary.finalCursor ?? 'NULL (campaign done)'}`,
    );
    process.exitCode = status === ScrapeRunStatus.FAILED ? 1 : 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(err instanceof Error ? err.stack ?? message : message);
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
      });
    } catch (finishErr: unknown) {
      logger.error(
        `scrape:enrich: could not close run ${run.id}: ` +
          `${finishErr instanceof Error ? finishErr.message : String(finishErr)}`,
      );
    }
    process.exitCode = 1;
  } finally {
    // Always clear the heartbeat timer — on success, crash and early return
    // alike. (A tick that already fired against a closed run is a no-op:
    // heartbeatScrapeRun is gated on status=RUNNING.)
    stopHeartbeat();
    const durationMs = Date.now() - startedAtMs;
    logger.info(`scrape:enrich finished in ${durationMs}ms (exitCode=${process.exitCode ?? 0})`);
  }
}

void main().finally(async () => {
  await prisma.$disconnect();
});
