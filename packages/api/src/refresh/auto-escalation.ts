import type { Provider, PrismaClient, ScrapeRun } from '@prisma/client';
import { ScrapeRunKind, ScrapeRunStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

/** How far back a "no successful full run" self-heal reaches before forcing full mode (PRD §5). */
const AUTO_FULL_STALE_DAYS = 10;

/** Lookback window: enough runs to reliably find the last full-mode attempt without a clever query. */
const LOOKBACK_TAKE = 20;

/** Narrow, `any`-free read of the bits of `ScrapeRun.metadata` this module cares about. */
function readRunMetadata(metadata: Prisma.JsonValue | null): { mode?: string; sitemapTotal?: number } | null {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const obj = metadata as Record<string, unknown>;
  const result: { mode?: string; sitemapTotal?: number } = {};
  if (typeof obj['mode'] === 'string') {
    result.mode = obj['mode'];
  }
  if (typeof obj['sitemapTotal'] === 'number') {
    result.sitemapTotal = obj['sitemapTotal'];
  }
  return result;
}

/**
 * A run "reflects real full-mode work" when its metadata is absent (legacy,
 * pre-this-feature runs are implicitly full) or explicitly `mode: 'full'`.
 */
function isFullModeRun(run: ScrapeRun): boolean {
  const meta = readRunMetadata(run.metadata);
  return meta === null || meta.mode === undefined || meta.mode === 'full';
}

const TERMINAL_STATUSES: ReadonlySet<ScrapeRunStatus> = new Set([
  ScrapeRunStatus.SUCCESS,
  ScrapeRunStatus.PARTIAL,
  ScrapeRunStatus.FAILED,
]);

/**
 * Self-heal auto-full (PRD §5): decide whether an incremental-mode request
 * should be escalated to a full run instead.
 *
 * Escalates when:
 *   - the per-URL state is empty for this provider (first run / force-reset), or
 *   - the most recent terminal FULL_CATALOG run that reflects full-mode work
 *     (metadata null/missing, or `mode === 'full'`) is more than
 *     `AUTO_FULL_STALE_DAYS` old, or there is no such run at all.
 *
 * FAILED full-mode attempts still count as "the last full attempt" for this
 * check — the intent is "did a full pass happen recently at all", not
 * "did one succeed"; a FAILED attempt from yesterday means the cron isn't
 * silently broken, even if the run itself errored.
 */
export async function shouldAutoEscalateToFull(
  prisma: PrismaClient,
  provider: Provider,
  knownSnapshot: ReadonlyMap<string, string>,
  now: Date,
): Promise<boolean> {
  if (knownSnapshot.size === 0) {
    return true;
  }

  const runs = await prisma.scrapeRun.findMany({
    where: { provider, kind: ScrapeRunKind.FULL_CATALOG },
    orderBy: { startedAt: 'desc' },
    take: LOOKBACK_TAKE,
  });

  const lastFullRun = runs.find((r) => TERMINAL_STATUSES.has(r.status) && isFullModeRun(r)) ?? null;
  if (lastFullRun === null) {
    return true;
  }

  const staleMs = AUTO_FULL_STALE_DAYS * 24 * 3_600_000;
  return now.getTime() - lastFullRun.startedAt.getTime() > staleMs;
}

/**
 * Find the `sitemapTotal` recorded in metadata of the most recent previous
 * FULL_CATALOG run (mode === 'full') for `provider`, excluding `currentRunId`.
 * Returns null when there is no such run (e.g. this is the first full run).
 */
export async function findPreviousFullSitemapTotal(
  prisma: PrismaClient,
  provider: Provider,
  currentRunId: string,
): Promise<number | null> {
  const runs = await prisma.scrapeRun.findMany({
    where: { provider, kind: ScrapeRunKind.FULL_CATALOG, id: { not: currentRunId } },
    orderBy: { startedAt: 'desc' },
    take: LOOKBACK_TAKE,
  });

  for (const run of runs) {
    const meta = readRunMetadata(run.metadata);
    if (meta?.mode === 'full' && typeof meta.sitemapTotal === 'number') {
      return meta.sitemapTotal;
    }
  }
  return null;
}
