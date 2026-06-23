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

/** Optional injectable clock for deterministic testing. */
export interface GuardDeps {
  readonly now?: () => Date;
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
 * W10.6: Check-and-throw guard. Does NOT insert any row — the orchestration's own
 * per-provider scrape_runs are the running marker. Throws `RefreshAlreadyRunningError`
 * when a GUARDED_KIND run is already RUNNING. Returns a lock handle on success;
 * pass it to `releaseRefreshLock` in a finally block.
 */
export async function acquireRefreshLock(
  prisma: PrismaClient,
  kind: ScrapeRunKind,
  deps?: GuardDeps,
): Promise<RefreshLock> {
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
