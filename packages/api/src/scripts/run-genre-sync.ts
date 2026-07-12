import { prisma } from '../db.js';
import { createLogger } from '../pipeline/index.js';
import { syncGenres } from '../genres/sync.js';

/**
 * `genres:sync` CLI entrypoint (genres-taxonomy PRD §8.1).
 *
 * Mirrors the `run-scrape.ts` pattern: tsx entry, shared `prisma` singleton,
 * pino-backed logger, `process.exitCode` (never `process.exit()`), and a
 * `finally` that always disconnects Prisma.
 *
 * Supports `--dry-run` to compute and log what would change with zero writes.
 */
async function main(): Promise<void> {
  const logger = createLogger();
  const dryRun = process.argv.includes('--dry-run');
  const startedAt = Date.now();

  logger.info(`genres:sync starting at ${new Date(startedAt).toISOString()} (dryRun=${dryRun})`);

  try {
    const result = await syncGenres(prisma, { dryRun });
    logger.info(
      `genres:sync result: created=${result.created} updated=${result.updated} deactivated=${result.deactivated} mappingsCreated=${result.mappingsCreated} mappingsUpdated=${result.mappingsUpdated} dryRun=${result.dryRun}`,
    );
    process.exitCode = 0;
  } catch (err: unknown) {
    logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exitCode = 1;
  } finally {
    const durationMs = Date.now() - startedAt;
    logger.info(`genres:sync finished in ${durationMs}ms (exitCode=${process.exitCode ?? 0})`);
  }
}

void main().finally(async () => {
  await prisma.$disconnect();
});
