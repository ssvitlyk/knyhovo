import { ScrapeRunKind, ScrapeRunStatus, ScrapeRunTrigger } from '@prisma/client';
import type { ProviderName } from '@knyhovo/shared';
import { prisma } from '../db.js';
import {
  countEnrichmentCandidates,
  deriveEnrichmentStatus,
  metricsForRunClose,
  runEnrichment,
  type EnrichmentBatchProgress,
} from '../enrichment/engine.js';
import { ENRICHMENT_PROVIDERS } from '../enrichment/providers.js';
import { createLogger } from '../pipeline/index.js';
import { mapProviderName } from '../pipeline/persist-listing.js';
import {
  checkpointScrapeRunCounters,
  finishScrapeRun,
  startScrapeRun,
  summarizeScrapeErrors,
} from '../refresh/scrape-run.repository.js';
import { ENRICHMENT_USAGE, parseEnrichmentArgs } from './run-enrichment-args.js';
import { getEnrichBatchSize, getEnrichDelayMs } from './scrape-env.js';

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
 * Every batch commits in its own transaction, so a kill at any point loses at
 * most one batch; a re-run picks the remaining un-enriched listings via the
 * candidate predicate (persisted cursor/resume lands in PR3). Progress is
 * tracked as a `scrape_runs` row with kind DESCRIPTION_ENRICHMENT.
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
    // Report-only: queue size + last run state, zero fetches/writes/run rows.
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
            `errorsCount=${lastRun.errorsCount}`,
    );
    process.exitCode = 0;
    return;
  }

  logger.info(
    `scrape:enrich starting at ${new Date(startedAtMs).toISOString()} ` +
      `(provider=${provider} batchSize=${batchSize} limit=${args.limit ?? '—'} ` +
      `force=${args.force} delayMs=${delayMs ?? 'provider default'} triggeredBy=${triggeredBy})`,
  );

  const run = await startScrapeRun(prisma, {
    provider: mapProviderName(provider),
    kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
    triggeredBy,
    metadata: {
      batchSize,
      ...(args.limit !== null ? { limit: args.limit } : {}),
      ...(delayMs !== undefined ? { delayMs } : {}),
      ...(args.force ? { force: true } : {}),
    },
  });
  logger.info(`scrape:enrich run ${run.id} opened (kind=DESCRIPTION_ENRICHMENT)`);

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
      // Live progress after every committed batch (PRD §7 PR2): the run row
      // shows real counters during the run, not 0 until the very end.
      // checkpointScrapeRunCounters is best-effort and never throws.
      onBatch: async (progress) => {
        lastProgress.current = progress;
        await checkpointScrapeRunCounters(prisma, run.id, {
          itemsFound: progress.totalCandidates,
          itemsUpdated: progress.enriched,
          errorsCount: progress.failed,
          errorSummary: summarizeScrapeErrors(progress.errorSamples),
        });
      },
    });

    const status = deriveEnrichmentStatus(summary);
    await finishScrapeRun(prisma, run.id, {
      startedAt: run.startedAt,
      status,
      metrics: metricsForRunClose(summary),
      scrapeErrors: summary.errorSamples,
      metadata: {
        batchSize,
        ...(args.limit !== null ? { limit: args.limit } : {}),
        ...(delayMs !== undefined ? { delayMs } : {}),
        ...(args.force ? { force: true } : {}),
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
        `enriched=${summary.enriched} failed=${summary.failed}`,
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
      // the per-item samples gathered so far.
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
    const durationMs = Date.now() - startedAtMs;
    logger.info(`scrape:enrich finished in ${durationMs}ms (exitCode=${process.exitCode ?? 0})`);
  }
}

void main().finally(async () => {
  await prisma.$disconnect();
});
