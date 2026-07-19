import type { PrismaClient, Provider } from '@prisma/client';
import { ScrapeRunKind, ScrapeRunStatus } from '@prisma/client';

/**
 * W10.6 concurrency guard model: check-and-throw on acquire, sweep-release on finish.
 * No sentinel row is inserted — the orchestration's own per-provider scrape_runs rows
 * are the running marker. GUARDED_KINDS are the two kinds that compete for the global
 * refresh lock; other kinds (MANUAL, DESCRIPTION_ENRICHMENT) are not guarded.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The two ScrapeRunKinds that compete for the global refresh lock. */
export const GUARDED_KINDS: readonly ScrapeRunKind[] = [
  ScrapeRunKind.FULL_CATALOG,
  ScrapeRunKind.WISHLIST_REFRESH,
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal projection of a running ScrapeRun row, used to surface conflicts. */
export interface RunningRunInfo {
  readonly id: string;
  readonly provider: Provider;
  readonly kind: ScrapeRunKind;
  readonly startedAt: Date;
}

/**
 * Handle returned by `acquireRefreshLock`. Pass it to `releaseRefreshLock`
 * in a finally block so dangling RUNNING rows are swept to FAILED.
 */
export interface RefreshLock {
  readonly acquiredAt: Date;
  readonly kind: ScrapeRunKind;
}

/**
 * Staleness thresholds for `reapStaleRuns` (stale-scrape-recovery PRD).
 */
export interface StaleReapConfig {
  /** RUNNING row with lastHeartbeatAt older than this is considered dead. */
  readonly heartbeatTimeoutMs: number;
  /** Fallback for legacy rows with lastHeartbeatAt=NULL: reap only when startedAt is older than this. */
  readonly legacyStartedAtTimeoutMs: number;
}

/** Defaults: 15 minutes of heartbeat silence, or 24 hours of age for legacy (pre-heartbeat) rows. */
export const DEFAULT_STALE_REAP_CONFIG: StaleReapConfig = {
  heartbeatTimeoutMs: 15 * 60_000,
  legacyStartedAtTimeoutMs: 24 * 3_600_000,
};

/** Optional injectable clock for deterministic testing. */
export interface GuardDeps {
  readonly now?: () => Date;
  /** Override the stale-reap thresholds used by `acquireRefreshLock`. */
  readonly staleReap?: StaleReapConfig;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

/**
 * Thrown by `acquireRefreshLock` when a GUARDED_KIND run is already RUNNING.
 * The `running` field carries the oldest conflicting row for diagnostics.
 */
export class RefreshAlreadyRunningError extends Error {
  constructor(public readonly running: RunningRunInfo) {
    super(
      `A refresh is already running: ${running.kind} provider=${running.provider} since ${running.startedAt.toISOString()} (id=${running.id})`,
    );
    this.name = 'RefreshAlreadyRunningError';
  }
}

// ---------------------------------------------------------------------------
// Guard functions
// ---------------------------------------------------------------------------

/**
 * W10.6: Returns the OLDEST RUNNING run among GUARDED_KINDS, or null if none.
 * Used by `acquireRefreshLock` and can be called independently for health checks.
 */
export async function isRefreshRunning(
  prisma: PrismaClient,
): Promise<RunningRunInfo | null> {
  const row = await prisma.scrapeRun.findFirst({
    where: {
      status: ScrapeRunStatus.RUNNING,
      kind: { in: [...GUARDED_KINDS] },
    },
    orderBy: { startedAt: 'asc' },
    select: { id: true, provider: true, kind: true, startedAt: true },
  });

  if (row === null) {
    return null;
  }

  return {
    id: row.id,
    provider: row.provider,
    kind: row.kind,
    startedAt: row.startedAt,
  };
}

/**
 * stale-scrape-recovery PRD: reap RUNNING rows of the given kinds whose
 * heartbeat has gone silent — a SIGKILL'd/OOM'd/redeployed process leaves the
 * row RUNNING forever, since its `finally` never runs. A plain `startedAt`
 * threshold was rejected: a legitimately long-running provider (e.g. the
 * uncapped knigoland, hours-long) would be reaped mid-flight, letting a
 * second refresh acquire the lock concurrently (broken mutual exclusion →
 * double writes). Heartbeat silence, not age, is what tells a dead process
 * apart from a slow-but-alive one.
 *
 * Each candidate is reaped via an ATOMIC conditional `updateMany` that
 * repeats the staleness condition in its `where`, so a heartbeat landing
 * between the `findMany` and the `updateMany` cancels that row's reap —
 * the row's own process is still alive and wins the race.
 *
 * `kinds` scopes the sweep (megakniga-resumable-enrichment PRD §4.6): the
 * refresh guard passes GUARDED_KINDS as before, the enrichment CLI passes
 * [DESCRIPTION_ENRICHMENT] only — neither ever touches the other's rows.
 */
export interface ReapStaleRunsResult {
  readonly candidates: number;
  readonly reaped: number;
  /**
   * The full candidate rows found by the initial SELECT (before the
   * conditional UPDATE), in `RunningRunInfo` shape. Used by `acquireRefreshLock`
   * to build a `RefreshAlreadyRunningError` when this process loses the reap
   * race and the candidate is no longer RUNNING (so `isRefreshRunning` alone
   * can't recover its identity). Not part of the PRD's headline counters, but
   * exposed on the same result object so callers get it from the one query.
   */
  readonly staleRows: readonly RunningRunInfo[];
}

export async function reapStaleRuns(
  prisma: PrismaClient,
  config: StaleReapConfig,
  kinds: readonly ScrapeRunKind[],
  deps?: GuardDeps,
): Promise<ReapStaleRunsResult> {
  const now = deps?.now?.() ?? new Date();
  const heartbeatCutoff = new Date(now.getTime() - config.heartbeatTimeoutMs);
  const legacyCutoff = new Date(now.getTime() - config.legacyStartedAtTimeoutMs);

  const staleCondition = {
    OR: [
      { lastHeartbeatAt: { not: null, lt: heartbeatCutoff } },
      { lastHeartbeatAt: null, startedAt: { lt: legacyCutoff } },
    ],
  };

  const candidates = await prisma.scrapeRun.findMany({
    where: {
      status: ScrapeRunStatus.RUNNING,
      kind: { in: [...kinds] },
      ...staleCondition,
    },
    select: { id: true, provider: true, kind: true, startedAt: true },
  });

  let reaped = 0;
  for (const candidate of candidates) {
    const finishedAt = now;
    const result = await prisma.scrapeRun.updateMany({
      where: {
        id: candidate.id,
        status: ScrapeRunStatus.RUNNING,
        ...staleCondition,
      },
      data: {
        status: ScrapeRunStatus.FAILED,
        finishedAt,
        durationMs: finishedAt.getTime() - candidate.startedAt.getTime(),
        errorSummary: 'Reaped stale heartbeat',
      },
    });
    reaped += result.count;
  }

  return {
    candidates: candidates.length,
    reaped,
    staleRows: candidates.map((c) => ({
      id: c.id,
      provider: c.provider,
      kind: c.kind,
      startedAt: c.startedAt,
    })),
  };
}

/**
 * W10.6: Check-and-throw guard. Does NOT insert any row — the orchestration's own
 * per-provider scrape_runs are the running marker. Throws `RefreshAlreadyRunningError`
 * when a GUARDED_KIND run is already RUNNING. Returns a lock handle on success;
 * pass it to `releaseRefreshLock` in a finally block.
 *
 * Before checking, reaps any stale RUNNING rows (see `reapStaleRuns`). The
 * reap is a mutex: only the process whose `updateMany` actually changed a row
 * may treat the lock as free. If `candidates > reaped`, this process lost the
 * race — either a concurrent acquirer reaped the row first, or the row's own
 * process refreshed its heartbeat between the SELECT and the UPDATE — so it
 * must NOT proceed. It re-checks `isRefreshRunning`: if that still finds a
 * RUNNING row, the conflict is reported from it; if the row was already
 * reaped to FAILED by the winning concurrent acquirer (which is about to
 * start its own run), a `RefreshAlreadyRunningError` is still thrown, built
 * from the stale candidate, so this process never starts alongside it.
 */
export async function acquireRefreshLock(
  prisma: PrismaClient,
  kind: ScrapeRunKind,
  deps?: GuardDeps,
): Promise<RefreshLock> {
  const reapConfig = deps?.staleReap ?? DEFAULT_STALE_REAP_CONFIG;
  const { candidates, reaped, staleRows } = await reapStaleRuns(
    prisma,
    reapConfig,
    GUARDED_KINDS,
    deps,
  );

  if (candidates > reaped) {
    const stillRunning = await isRefreshRunning(prisma);
    if (stillRunning !== null) {
      throw new RefreshAlreadyRunningError(stillRunning);
    }
    // The row was reaped to FAILED by a concurrent acquirer between our
    // findMany and updateMany — that process is about to start its own run.
    // We must not proceed as if the lock were free. Build the conflict from
    // the stale candidate captured by the initial SELECT.
    throw new RefreshAlreadyRunningError(staleRows[0]!);
  }

  const running = await isRefreshRunning(prisma);
  if (running !== null) {
    throw new RefreshAlreadyRunningError(running);
  }

  const now = deps?.now ?? (() => new Date());
  return { acquiredAt: now(), kind };
}

/**
 * W10.6: Sweep-release. Closes any dangling RUNNING rows of GUARDED_KINDS whose
 * startedAt >= lock.acquiredAt as FAILED with errorSummary 'released by concurrency guard'.
 * Idempotent. MUST NOT throw — all errors are swallowed because this runs in a finally block.
 */
export async function releaseRefreshLock(
  prisma: PrismaClient,
  lock: RefreshLock,
  deps?: GuardDeps,
): Promise<void> {
  try {
    const now = deps?.now ?? (() => new Date());
    const finishedAt = now();

    await prisma.scrapeRun.updateMany({
      where: {
        status: ScrapeRunStatus.RUNNING,
        kind: { in: [...GUARDED_KINDS] },
        startedAt: { gte: lock.acquiredAt },
      },
      data: {
        status: ScrapeRunStatus.FAILED,
        finishedAt,
        errorSummary: 'released by concurrency guard',
      },
    });
  } catch {
    // Intentionally swallowed: releaseRefreshLock always runs inside a finally
    // block and must never mask the original error from the caller.
  }
}
