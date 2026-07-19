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
 * Compress an error list into the `error_summary` column format: first 5
 * messages joined, truncated to 1000 chars; null when there are none.
 */
export function summarizeScrapeErrors(errors: readonly string[]): string | null {
  if (errors.length === 0) return null;
  return errors.slice(0, 5).join('; ').slice(0, 1000);
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
  const errorSummary = summarizeScrapeErrors(scrapeErrors);

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
    /**
     * Inherited enrichment checkpoint (megakniga-resumable-enrichment PRD
     * §4.5): a resume run is born with its predecessor's cursor, so even a
     * run that dies before its first committed batch keeps the campaign's
     * checkpoint chain intact.
     */
    cursor?: string;
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
      ...(params.cursor !== undefined ? { cursor: params.cursor } : {}),
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
 * Batch checkpoint for a RUNNING enrichment run (megakniga-resumable-
 * enrichment PRD §4.2/§4.4): cumulative counters, the live `itemsProcessed`,
 * the keyset `cursor`, and a heartbeat touch. Since PR3 this runs INSIDE the
 * batch transaction (pass the `tx` client) so listing updates and the cursor
 * advance atomically — a torn batch is impossible. Consequently it now
 * PROPAGATES database errors (a failed checkpoint must abort the whole batch
 * transaction, which the engine then retries). Still gated on `status:
 * RUNNING`: a run closed or reaped by another process is never modified by a
 * late checkpoint — reported as `false`, not an error.
 */
export async function checkpointScrapeRunCounters(
  db: PrismaClient | Prisma.TransactionClient,
  runId: string,
  counters: {
    itemsFound: number;
    itemsUpdated: number;
    errorsCount: number;
    errorSummary: string | null;
    /** Processed listings including failures and no-data pages (PRD §4.2). */
    itemsProcessed?: number;
    /** Last fully processed provider_listings.id — the resume point. */
    cursor?: string;
  },
  now: () => Date = () => new Date(),
): Promise<boolean> {
  const result = await db.scrapeRun.updateMany({
    where: { id: runId, status: ScrapeRunStatusEnum.RUNNING },
    data: { ...counters, lastHeartbeatAt: now() },
  });
  return result.count > 0;
}

/**
 * The latest run of a given kind for a provider — the row the resume logic
 * (PRD §4.5 step 1) inspects on CLI start. Returns just what that decision
 * needs; null when the provider has never run this kind.
 */
export async function findLatestScrapeRun(
  prisma: PrismaClient,
  params: { provider: Provider; kind: ScrapeRunKind },
): Promise<{ id: string; status: ScrapeRunStatus; cursor: string | null; startedAt: Date } | null> {
  return prisma.scrapeRun.findFirst({
    where: { provider: params.provider, kind: params.kind },
    orderBy: { startedAt: 'desc' },
    select: { id: true, status: true, cursor: true, startedAt: true },
  });
}

/**
 * The current RUNNING run of a given kind for a provider, with its heartbeat
 * — what the enrichment lock (PRD §4.5 step 2 / §4.6) reports in its
 * "already running" error. Null when nothing is RUNNING.
 */
export async function findRunningScrapeRun(
  prisma: PrismaClient,
  params: { provider: Provider; kind: ScrapeRunKind },
): Promise<{ id: string; startedAt: Date; lastHeartbeatAt: Date | null } | null> {
  return prisma.scrapeRun.findFirst({
    where: {
      provider: params.provider,
      kind: params.kind,
      status: ScrapeRunStatusEnum.RUNNING,
    },
    orderBy: { startedAt: 'desc' },
    select: { id: true, startedAt: true, lastHeartbeatAt: true },
  });
}

/**
 * Close a scrape run record by writing the final status, duration, and all
 * metrics-derived counts.
 *
 * Enrichment runs (PRD §4.2) additionally close their checkpoint state:
 * `cursor` — pass a string to persist the resume point, explicit `null` to
 * clear it (queue exhausted, "cursor NULL ⇔ done"), or omit to leave whatever
 * the last in-transaction checkpoint wrote (the crash path relies on this).
 * `itemsProcessed` follows the same omit-to-preserve rule.
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
    cursor?: string | null;
    itemsProcessed?: number;
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
      ...(params.cursor !== undefined ? { cursor: params.cursor } : {}),
      ...(params.itemsProcessed !== undefined ? { itemsProcessed: params.itemsProcessed } : {}),
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
