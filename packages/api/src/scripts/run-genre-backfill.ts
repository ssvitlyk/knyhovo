import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../db.js';
import { createLogger } from '../pipeline/index.js';
import {
  formatBackfillSummary,
  formatBatchProgress,
  runGenreBackfill,
} from '../genres/backfill.js';
import { GENRE_BACKFILL_USAGE, parseGenreBackfillArgs } from './genre-backfill-args.js';

/**
 * `genres:backfill` CLI entrypoint (genres-taxonomy PRD §8.1).
 *
 * Mirrors the `run-genre-sync.ts` pattern: tsx entry, shared `prisma`
 * singleton, pino-backed logger, `process.exitCode` (never `process.exit()`),
 * and a `finally` that always disconnects Prisma.
 *
 *   pnpm --filter @knyhovo/api genres:backfill --dry-run --report
 *   pnpm --filter @knyhovo/api genres:backfill --only-unassigned
 *   pnpm --filter @knyhovo/api genres:backfill --cursor=<bookId>   # resume
 *
 * The pass is idempotent — a full restart without `--cursor` is always safe;
 * the per-batch `cursor=<id>` log line is the resume point after an
 * interruption. MANUAL assignments are never touched (§4.5).
 *
 * Rollback (PRD §8.2) — removes every engine-made assignment, leaves
 * MANUAL/SEED intact:
 *
 *   UPDATE canonical_books
 *   SET genre_id = NULL, genre_source = NULL,
 *       genre_confidence = NULL, genre_updated_at = NULL
 *   WHERE genre_source = 'provider-mapping';
 */
async function main(): Promise<void> {
  const logger = createLogger();
  const startedAt = Date.now();

  let args;
  try {
    args = parseGenreBackfillArgs(process.argv.slice(2));
  } catch (err: unknown) {
    logger.error(err instanceof Error ? err.message : String(err));
    logger.error(GENRE_BACKFILL_USAGE);
    process.exitCode = 1;
    return;
  }

  logger.info(
    `genres:backfill starting at ${new Date(startedAt).toISOString()} ` +
      `(dryRun=${args.dryRun} batchSize=${args.batchSize} cursor=${args.cursor ?? '—'} ` +
      `onlyUnassigned=${args.onlyUnassigned} clearStale=${args.clearStale} ` +
      `report=${args.report === null ? 'off' : (args.report.path ?? 'stdout')})`,
  );

  try {
    const result = await runGenreBackfill(prisma, {
      dryRun: args.dryRun,
      batchSize: args.batchSize,
      cursor: args.cursor,
      onlyUnassigned: args.onlyUnassigned,
      clearStale: args.clearStale,
      collectReports: args.report !== null,
      onBatch: (progress) => logger.info(formatBatchProgress(progress)),
    });

    logger.info(`genres:backfill summary: ${formatBackfillSummary(result)}`);

    if (args.report !== null && result.unmappedReport !== null && result.ambiguousReport !== null) {
      const content =
        `# genres:backfill report — ${new Date().toISOString()} (dryRun=${result.dryRun})\n\n` +
        `## Unmapped categories (PRD §8.3)\n\n${result.unmappedReport.format()}\n\n` +
        `## Ambiguous books (PRD §8.4)\n\n${result.ambiguousReport.format()}\n`;
      if (args.report.path === null) {
        process.stdout.write(`\n${content}\n`);
      } else {
        const target = resolve(args.report.path);
        writeFileSync(target, content, 'utf8');
        logger.info(`genres:backfill report written to ${target}`);
      }
    }

    process.exitCode = 0;
  } catch (err: unknown) {
    logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exitCode = 1;
  } finally {
    const durationMs = Date.now() - startedAt;
    logger.info(`genres:backfill finished in ${durationMs}ms (exitCode=${process.exitCode ?? 0})`);
  }
}

void main().finally(async () => {
  await prisma.$disconnect();
});
