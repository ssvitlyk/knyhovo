import type {
  Provider,
  ScrapeRunKind,
  ScrapeRunStatus,
  ScrapeRunTrigger,
  ScrapeRun,
  PrismaClient,
  Prisma,
} from '@prisma/client';
import { ScrapeRunStatus as ScrapeRunStatusEnum } from '@prisma/client';
import type { ScrapeMetrics } from '../pipeline/types.js';

// ---------------------------------------------------------------------------
// Pure helpers — ScrapeMetrics → DB counts
// ---------------------------------------------------------------------------

/**
 * Derive the terminal status of a scrape run from its metrics and error list.
 *
 * - SUCCESS  — no errors at all
 * - FAILED   — errors occurred but nothing was scraped or written (total failure)
 * - PARTIAL  — errors occurred but at least some data was processed or written
 */
export function deriveRunStatus(
  metrics: ScrapeMetrics,
  scrapeErrors: string[],
): ScrapeRunStatus {
  const hasErrors = scrapeErrors.length > 0 || metrics.errors > 0;
  if (!hasErrors) {
    return ScrapeRunStatusEnum.SUCCESS;
  }
  const writtenCount =
    metrics.providerListingsCreated +
    metrics.providerListingsUpdated +
    metrics.availabilityUpdated;
  if (metrics.scraped === 0 && writtenCount === 0) {
    return ScrapeRunStatusEnum.FAILED;
  }
  return ScrapeRunStatusEnum.PARTIAL;
}

export interface RunCounts {
  itemsFound: number;
  itemsUpdated: number;
  /** Currently counts price-OR-availability snapshots; will be refined in a later phase. */
  priceChanges: number;
  availabilityChanges: number;
  errorsCount: number;
  errorSummary: string | null;
}

/**
 * Map a ScrapeMetrics object and its error list to the flat count columns
 * that live on the `scrape_runs` row.
 */
export function mapMetricsToRunCounts(
  metrics: ScrapeMetrics,
  scrapeErrors: string[],
): RunCounts {
  const errorsCount = metrics.errors + scrapeErrors.length;
  const errorSummary =
    scrapeErrors.length === 0
      ? null
      : scrapeErrors
          .slice(0, 5)
          .join('; ')
          .slice(0, 1000);

  return {
    itemsFound: metrics.scraped,
    itemsUpdated:
      metrics.providerListingsCreated +
      metrics.providerListingsUpdated +
      metrics.availabilityUpdated,
    priceChanges: metrics.priceHistoryCreated,
    availabilityChanges: metrics.availabilityUpdated,
    errorsCount,
    errorSummary,
  };
}

// ---------------------------------------------------------------------------
// Repository functions
// ---------------------------------------------------------------------------

/**
 * Open a scrape run record with status RUNNING. Call `finishScrapeRun` when
 * the run completes (success or failure).
 */
export async function startScrapeRun(
  prisma: PrismaClient,
  params: {
    provider: Provider;
    kind: ScrapeRunKind;
    triggeredBy: ScrapeRunTrigger;
    startedAt?: Date;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<{ id: string; startedAt: Date }> {
  const startedAt = params.startedAt ?? new Date();
  const run = await prisma.scrapeRun.create({
    data: {
      provider: params.provider,
      kind: params.kind,
      status: ScrapeRunStatusEnum.RUNNING,
      triggeredBy: params.triggeredBy,
      startedAt,
      lastHeartbeatAt: startedAt,
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
    },
    select: { id: true, startedAt: true },
  });
  return { id: run.id, startedAt: run.startedAt };
}

/**
 * Best-effort liveness signal for a RUNNING scrape run (stale-scrape-recovery
 * PRD). Gated on `status: RUNNING` so a run already closed (FAILED/SUCCESS/
 * PARTIAL) — including one just reaped by a concurrent process — is never
 * resurrected by a late-arriving heartbeat. MUST NOT throw: a failed
 * heartbeat write is swallowed and reported as `false`, never allowed to
 * kill the run it is monitoring.
 */
export async function heartbeatScrapeRun(
  prisma: PrismaClient,
  runId: string,
  now: () => Date = () => new Date(),
): Promise<boolean> {
  try {
    const result = await prisma.scrapeRun.updateMany({
      where: { id: runId, status: ScrapeRunStatusEnum.RUNNING },
      data: { lastHeartbeatAt: now() },
    });
    return result.count > 0;
  } catch {
    return false;
  }
}

/**
 * Start an interval timer that calls `heartbeatScrapeRun` every
 * `opts.intervalMs` (default 60s) for the lifetime of a scrape run. The timer
 * is `unref()`-ed so it never keeps the process alive on its own, and errors
 * from each heartbeat tick are swallowed by `heartbeatScrapeRun` itself.
 *
 * Returns an idempotent stop function; call it in a `finally` block around
 * the run so the timer is always cleared, on both success and failure.
 */
export function startHeartbeat(
  prisma: PrismaClient,
  runId: string,
  opts?: { intervalMs?: number; now?: () => Date },
): () => void {
  const intervalMs = opts?.intervalMs ?? 60_000;
  const now = opts?.now ?? (() => new Date());

  const timer = setInterval(() => {
    void heartbeatScrapeRun(prisma, runId, now);
  }, intervalMs);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  let stopped = false;
  return (): void => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
  };
}

/**
 * Close a scrape run record by writing the final status, duration, and all
 * metrics-derived counts.
 */
export async function finishScrapeRun(
  prisma: PrismaClient,
  runId: string,
  params: {
    startedAt: Date;
    status: ScrapeRunStatus;
    metrics: ScrapeMetrics;
    scrapeErrors: string[];
    finishedAt?: Date;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  const finishedAt = params.finishedAt ?? new Date();
  const durationMs = finishedAt.getTime() - params.startedAt.getTime();
  const counts = mapMetricsToRunCounts(params.metrics, params.scrapeErrors);

  await prisma.scrapeRun.update({
    where: { id: runId },
    data: {
      status: params.status,
      finishedAt,
      durationMs,
      itemsFound: counts.itemsFound,
      itemsUpdated: counts.itemsUpdated,
      priceChanges: counts.priceChanges,
      availabilityChanges: counts.availabilityChanges,
      errorsCount: counts.errorsCount,
      errorSummary: counts.errorSummary,
      ...(params.metadata !== undefined ? { metadata: params.metadata } : {}),
    },
  });
}

/**
 * Return the latest run per provider (distinct on provider, ordered by
 * startedAt desc). Optionally filter to a specific kind.
 */
export async function latestHealthByProvider(
  prisma: PrismaClient,
  params?: { kind?: ScrapeRunKind },
): Promise<ScrapeRun[]> {
  return prisma.scrapeRun.findMany({
    where: params?.kind != null ? { kind: params.kind } : {},
    orderBy: [{ provider: 'asc' }, { startedAt: 'desc' }],
    distinct: ['provider'],
  });
}
