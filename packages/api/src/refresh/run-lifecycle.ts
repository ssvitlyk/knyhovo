import type { PrismaClient } from '@prisma/client';
import { ScrapeRunStatus } from '@prisma/client';
import { touchConnection } from '../db-connection.js';
import type { Logger, ScrapeMetrics } from '../pipeline/types.js';
import { finishScrapeRun } from './scrape-run.repository.js';

export interface CloseRunAsFailedInput {
  readonly runId: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  /** Provider label used in the "Failed to finalize run" log line. */
  readonly provider: string;
  readonly metrics: ScrapeMetrics;
  readonly message: string;
  /**
   * Touch the connection first so a dropped pooled connection (e.g. after a
   * long enrichment pass) can re-establish and the run row still gets closed.
   */
  readonly touchConnectionFirst?: boolean;
}

/**
 * Best-effort close of an already-opened scrape run as FAILED so it never
 * dangles RUNNING. Never throws: a failed close is logged and swallowed.
 */
export async function closeRunAsFailed(
  prisma: PrismaClient,
  logger: Logger,
  input: CloseRunAsFailedInput,
): Promise<void> {
  try {
    if (input.touchConnectionFirst === true) {
      await touchConnection(prisma);
    }
    await finishScrapeRun(prisma, input.runId, {
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      status: ScrapeRunStatus.FAILED,
      metrics: input.metrics,
      scrapeErrors: [input.message],
    });
  } catch (finishErr) {
    const finishMsg = finishErr instanceof Error ? finishErr.message : String(finishErr);
    logger.error(`Failed to finalize run ${input.runId} for ${input.provider}: ${finishMsg}`);
  }
}
