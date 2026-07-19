import { ScrapeRunKind, ScrapeRunStatus, ScrapeRunTrigger } from '@prisma/client';
import type { ProviderName } from '@knyhovo/shared';
import { prisma } from '../db.js';
import { deriveEnrichmentStatus, runEnrichment } from '../enrichment/engine.js';
import { ENRICHMENT_PROVIDERS } from '../enrichment/providers.js';
import { createLogger } from '../pipeline/index.js';
import { createMetrics } from '../pipeline/metrics.js';
import { mapProviderName } from '../pipeline/persist-listing.js';
import { finishScrapeRun, startScrapeRun } from '../refresh/scrape-run.repository.js';
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

  logger.info(
    `scrape:enrich starting at ${new Date(startedAtMs).toISOString()} ` +
      `(provider=${provider} batchSize=${batchSize} limit=${args.limit ?? '—'} ` +
      `delayMs=${delayMs ?? 'provider default'} triggeredBy=${triggeredBy})`,
  );

  const run = await startScrapeRun(prisma, {
    provider: mapProviderName(provider),
    kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
    triggeredBy,
    metadata: {
      batchSize,
      ...(args.limit !== null ? { limit: args.limit } : {}),
      ...(delayMs !== undefined ? { delayMs } : {}),
    },
  });
  logger.info(`scrape:enrich run ${run.id} opened (kind=DESCRIPTION_ENRICHMENT)`);

  try {
    const summary = await runEnrichment({
      prisma,
      provider,
      batchSize,
      logger,
      ...(args.limit !== null ? { limit: args.limit } : {}),
      ...(delayMs !== undefined ? { delayMs } : {}),
    });

    // Map the summary onto ScrapeMetrics-derived columns (PRD §4.2 mapping for
    // this kind): itemsFound = candidate total, itemsUpdated = listings
    // written, errorsCount = failed fetches. `metrics.errors` carries only the
    // failures beyond the stored samples so mapMetricsToRunCounts
    // (errors + scrapeErrors.length) lands on exactly `summary.failed`.
    const metrics = createMetrics();
    metrics.scraped = summary.totalCandidates;
    metrics.providerListingsUpdated = summary.enriched;
    metrics.errors = summary.failed - summary.errorSamples.length;

    const status = deriveEnrichmentStatus(summary);
    await finishScrapeRun(prisma, run.id, {
      startedAt: run.startedAt,
      status,
      metrics,
      scrapeErrors: summary.errorSamples,
      metadata: {
        batchSize,
        ...(args.limit !== null ? { limit: args.limit } : {}),
        ...(delayMs !== undefined ? { delayMs } : {}),
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
      await finishScrapeRun(prisma, run.id, {
        startedAt: run.startedAt,
        status: ScrapeRunStatus.FAILED,
        metrics: createMetrics(),
        scrapeErrors: [message],
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
