import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ScrapeRunKind, ScrapeRunStatus, Provider, ScrapeRunTrigger } from '@prisma/client';
import {
  isRefreshRunning,
  acquireRefreshLock,
  releaseRefreshLock,
  reapStaleRuns,
  RefreshAlreadyRunningError,
  GUARDED_KINDS,
  DEFAULT_STALE_REAP_CONFIG,
} from '../concurrency-guard.js';

// ---------------------------------------------------------------------------
// Fixed clock
// ---------------------------------------------------------------------------

const NOW = new Date('2026-01-01T00:00:00.000Z');
const clockNow = (): Date => NOW;

// ---------------------------------------------------------------------------
// Fake PrismaClient
// ---------------------------------------------------------------------------

function makeFakePrisma(overrides?: {
  findFirst?: () => Promise<unknown>;
  updateMany?: () => Promise<{ count: number }>;
  findMany?: () => Promise<unknown[]>;
}) {
  return {
    scrapeRun: {
      findFirst: vi.fn(overrides?.findFirst ?? (async () => null)),
      updateMany: vi.fn(overrides?.updateMany ?? (async () => ({ count: 0 }))),
      findMany: vi.fn(overrides?.findMany ?? (async () => [])),
    },
  } as unknown as PrismaClient;
}

// A minimal RUNNING row fixture
function makeRunningRow(overrides?: {
  id?: string;
  kind?: ScrapeRunKind;
  provider?: Provider;
  startedAt?: Date;
  lastHeartbeatAt?: Date | null;
}) {
  return {
    id: overrides?.id ?? 'run-abc',
    provider: overrides?.provider ?? Provider.YAKABOO,
    kind: overrides?.kind ?? ScrapeRunKind.FULL_CATALOG,
    startedAt: overrides?.startedAt ?? new Date('2025-12-31T20:00:00.000Z'),
    lastHeartbeatAt: overrides?.lastHeartbeatAt ?? overrides?.startedAt ?? new Date('2025-12-31T20:00:00.000Z'),
    status: ScrapeRunStatus.RUNNING,
    triggeredBy: ScrapeRunTrigger.CRON,
    finishedAt: null,
    durationMs: null,
    itemsFound: 0,
    itemsUpdated: 0,
    priceChanges: 0,
    availabilityChanges: 0,
    errorsCount: 0,
    errorSummary: null,
    metadata: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// isRefreshRunning
// ---------------------------------------------------------------------------

describe('isRefreshRunning', () => {
  it('returns mapped RunningRunInfo when findFirst resolves a row', async () => {
    const row = makeRunningRow({ kind: ScrapeRunKind.FULL_CATALOG, provider: Provider.YAKABOO });
    const prisma = makeFakePrisma({ findFirst: async () => row });

    const result = await isRefreshRunning(prisma);

    expect(result).not.toBeNull();
    expect(result?.id).toBe('run-abc');
    expect(result?.provider).toBe(Provider.YAKABOO);
    expect(result?.kind).toBe(ScrapeRunKind.FULL_CATALOG);
    expect(result?.startedAt).toEqual(row.startedAt);
  });

  it('returns null when findFirst resolves null', async () => {
    const prisma = makeFakePrisma({ findFirst: async () => null });

    const result = await isRefreshRunning(prisma);

    expect(result).toBeNull();
  });

  it('passes correct where clause to findFirst (status RUNNING, kind in GUARDED_KINDS)', async () => {
    const prisma = makeFakePrisma({ findFirst: async () => null });

    await isRefreshRunning(prisma);

    const call = vi.mocked(prisma.scrapeRun.findFirst).mock.calls[0]![0]!;
    expect(call.where?.status).toBe(ScrapeRunStatus.RUNNING);
    // kind.in must contain all GUARDED_KINDS
    const kinds = (call.where?.kind as { in: ScrapeRunKind[] }).in;
    expect(kinds).toContain(ScrapeRunKind.FULL_CATALOG);
    expect(kinds).toContain(ScrapeRunKind.WISHLIST_REFRESH);
  });

  it('passes orderBy startedAt asc to findFirst', async () => {
    const prisma = makeFakePrisma({ findFirst: async () => null });

    await isRefreshRunning(prisma);

    const call = vi.mocked(prisma.scrapeRun.findFirst).mock.calls[0]![0]!;
    expect(call.orderBy).toEqual({ startedAt: 'asc' });
  });
});

// ---------------------------------------------------------------------------
// acquireRefreshLock — happy path (no running row)
// ---------------------------------------------------------------------------

describe('acquireRefreshLock — happy path', () => {
  it('returns RefreshLock with acquiredAt=NOW and the requested kind', async () => {
    const prisma = makeFakePrisma({ findFirst: async () => null });

    const lock = await acquireRefreshLock(prisma, ScrapeRunKind.FULL_CATALOG, { now: clockNow });

    expect(lock.acquiredAt).toEqual(NOW);
    expect(lock.kind).toBe(ScrapeRunKind.FULL_CATALOG);
  });

  it('does NOT call updateMany on successful acquire', async () => {
    const prisma = makeFakePrisma({ findFirst: async () => null });

    await acquireRefreshLock(prisma, ScrapeRunKind.FULL_CATALOG, { now: clockNow });

    expect(prisma.scrapeRun.updateMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// acquireRefreshLock — lock collision
// ---------------------------------------------------------------------------

describe('acquireRefreshLock — lock collision', () => {
  it('RUNNING FULL_CATALOG present, acquire WISHLIST_REFRESH → throws RefreshAlreadyRunningError', async () => {
    const row = makeRunningRow({ kind: ScrapeRunKind.FULL_CATALOG, provider: Provider.YAKABOO });
    const prisma = makeFakePrisma({ findFirst: async () => row });

    await expect(
      acquireRefreshLock(prisma, ScrapeRunKind.WISHLIST_REFRESH, { now: clockNow }),
    ).rejects.toThrow(RefreshAlreadyRunningError);
  });

  it('RUNNING FULL_CATALOG present, acquire WISHLIST_REFRESH → error.running carries the row', async () => {
    const row = makeRunningRow({ kind: ScrapeRunKind.FULL_CATALOG, provider: Provider.YAKABOO });
    const prisma = makeFakePrisma({ findFirst: async () => row });

    let thrown: RefreshAlreadyRunningError | null = null;
    try {
      await acquireRefreshLock(prisma, ScrapeRunKind.WISHLIST_REFRESH, { now: clockNow });
    } catch (err) {
      if (err instanceof RefreshAlreadyRunningError) thrown = err;
    }

    expect(thrown).not.toBeNull();
    expect(thrown?.running.id).toBe('run-abc');
    expect(thrown?.running.kind).toBe(ScrapeRunKind.FULL_CATALOG);
    expect(thrown?.running.provider).toBe(Provider.YAKABOO);
  });

  it('RUNNING WISHLIST_REFRESH present, acquire FULL_CATALOG → throws RefreshAlreadyRunningError', async () => {
    const row = makeRunningRow({ kind: ScrapeRunKind.WISHLIST_REFRESH, provider: Provider.VIVAT });
    const prisma = makeFakePrisma({ findFirst: async () => row });

    await expect(
      acquireRefreshLock(prisma, ScrapeRunKind.FULL_CATALOG, { now: clockNow }),
    ).rejects.toThrow(RefreshAlreadyRunningError);
  });

  it('RUNNING WISHLIST_REFRESH present, acquire WISHLIST_REFRESH → throws RefreshAlreadyRunningError', async () => {
    const row = makeRunningRow({ kind: ScrapeRunKind.WISHLIST_REFRESH, provider: Provider.YAKABOO });
    const prisma = makeFakePrisma({ findFirst: async () => row });

    await expect(
      acquireRefreshLock(prisma, ScrapeRunKind.WISHLIST_REFRESH, { now: clockNow }),
    ).rejects.toThrow(RefreshAlreadyRunningError);
  });
});

// ---------------------------------------------------------------------------
// reapStaleRuns
// ---------------------------------------------------------------------------

describe('reapStaleRuns', () => {
  it('reaps a candidate whose heartbeat is older than heartbeatTimeoutMs', async () => {
    const staleHeartbeat = new Date(NOW.getTime() - 20 * 60_000); // 20 min ago (> 15 min default)
    const candidate = makeRunningRow({
      startedAt: new Date(NOW.getTime() - 30 * 60_000),
      lastHeartbeatAt: staleHeartbeat,
    });
    const prisma = makeFakePrisma({
      findMany: async () => [candidate],
      updateMany: async () => ({ count: 1 }),
    });

    const result = await reapStaleRuns(prisma, DEFAULT_STALE_REAP_CONFIG, GUARDED_KINDS, { now: clockNow });

    expect(result).toEqual({ candidates: 1, reaped: 1, staleRows: [expect.objectContaining({ id: 'run-abc' })] });

    expect(prisma.scrapeRun.updateMany).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.scrapeRun.updateMany).mock.calls[0]![0];
    expect(call.where?.id).toBe('run-abc');
    expect(call.where?.status).toBe(ScrapeRunStatus.RUNNING);
    // staleness condition repeated in the where clause
    expect(call.where?.OR).toBeDefined();
    expect(call.data?.status).toBe(ScrapeRunStatus.FAILED);
    expect(call.data?.errorSummary).toBe('Reaped stale heartbeat');
    expect(call.data?.finishedAt).toEqual(NOW);
  });

  it('reaps a legacy candidate (lastHeartbeatAt=null) only when startedAt is older than legacyStartedAtTimeoutMs', async () => {
    const oldStartedAt = new Date(NOW.getTime() - 25 * 3_600_000); // 25h ago (> 24h default)
    const candidate = makeRunningRow({ startedAt: oldStartedAt, lastHeartbeatAt: null });
    const prisma = makeFakePrisma({
      findMany: async () => [candidate],
      updateMany: async () => ({ count: 1 }),
    });

    const result = await reapStaleRuns(prisma, DEFAULT_STALE_REAP_CONFIG, GUARDED_KINDS, { now: clockNow });

    expect(result.candidates).toBe(1);
    expect(result.reaped).toBe(1);
  });

  it('does not reap when updateMany reports count=0 (concurrent reap or live heartbeat)', async () => {
    const staleHeartbeat = new Date(NOW.getTime() - 20 * 60_000);
    const candidate = makeRunningRow({
      startedAt: new Date(NOW.getTime() - 30 * 60_000),
      lastHeartbeatAt: staleHeartbeat,
    });
    const prisma = makeFakePrisma({
      findMany: async () => [candidate],
      updateMany: async () => ({ count: 0 }),
    });

    const result = await reapStaleRuns(prisma, DEFAULT_STALE_REAP_CONFIG, GUARDED_KINDS, { now: clockNow });

    expect(result).toEqual({ candidates: 1, reaped: 0, staleRows: [expect.objectContaining({ id: 'run-abc' })] });
  });

  it('returns zero candidates when findMany finds nothing stale', async () => {
    const prisma = makeFakePrisma({ findMany: async () => [] });

    const result = await reapStaleRuns(prisma, DEFAULT_STALE_REAP_CONFIG, GUARDED_KINDS, { now: clockNow });

    expect(result).toEqual({ candidates: 0, reaped: 0, staleRows: [] });
    expect(prisma.scrapeRun.updateMany).not.toHaveBeenCalled();
  });

  it('passes the correct heartbeat and legacy cutoffs in the findMany where clause', async () => {
    const prisma = makeFakePrisma({ findMany: async () => [] });

    await reapStaleRuns(prisma, DEFAULT_STALE_REAP_CONFIG, GUARDED_KINDS, { now: clockNow });

    const call = vi.mocked(prisma.scrapeRun.findMany).mock.calls[0]![0]!;
    const or = call.where?.OR as Array<Record<string, unknown>>;
    const heartbeatBranch = or[0] as { lastHeartbeatAt: { lt: Date } };
    const legacyBranch = or[1] as { startedAt: { lt: Date } };

    expect(heartbeatBranch.lastHeartbeatAt.lt).toEqual(new Date(NOW.getTime() - 15 * 60_000));
    expect(legacyBranch.startedAt.lt).toEqual(new Date(NOW.getTime() - 24 * 3_600_000));
  });

  it('scopes the sweep to the given kinds (PR4): an enrichment caller never touches GUARDED_KINDS rows', async () => {
    const prisma = makeFakePrisma({ findMany: async () => [] });

    await reapStaleRuns(
      prisma,
      DEFAULT_STALE_REAP_CONFIG,
      [ScrapeRunKind.DESCRIPTION_ENRICHMENT],
      { now: clockNow },
    );

    const call = vi.mocked(prisma.scrapeRun.findMany).mock.calls[0]![0]!;
    expect(call.where?.kind).toEqual({ in: [ScrapeRunKind.DESCRIPTION_ENRICHMENT] });
  });

  it('acquireRefreshLock still sweeps exactly GUARDED_KINDS — the kinds parameter changed nothing for the refresh guard', async () => {
    const prisma = makeFakePrisma({ findMany: async () => [] });

    await acquireRefreshLock(prisma, ScrapeRunKind.FULL_CATALOG, { now: clockNow });

    const call = vi.mocked(prisma.scrapeRun.findMany).mock.calls[0]![0]!;
    expect(call.where?.kind).toEqual({ in: [...GUARDED_KINDS] });
    expect(GUARDED_KINDS).toEqual([ScrapeRunKind.FULL_CATALOG, ScrapeRunKind.WISHLIST_REFRESH]);
  });
});

// ---------------------------------------------------------------------------
// acquireRefreshLock — stale-run recovery (stale-scrape-recovery PRD §3)
// ---------------------------------------------------------------------------

describe('acquireRefreshLock — stale-run recovery', () => {
  it('reaps a stale RUNNING row and acquires the lock', async () => {
    const staleHeartbeat = new Date(NOW.getTime() - 20 * 60_000);
    const candidate = makeRunningRow({
      startedAt: new Date(NOW.getTime() - 30 * 60_000),
      lastHeartbeatAt: staleHeartbeat,
    });
    const prisma = makeFakePrisma({
      findMany: async () => [candidate],
      updateMany: async () => ({ count: 1 }),
      findFirst: async () => null, // no longer RUNNING after reap
    });

    const lock = await acquireRefreshLock(prisma, ScrapeRunKind.FULL_CATALOG, { now: clockNow });

    expect(lock.kind).toBe(ScrapeRunKind.FULL_CATALOG);
    const call = vi.mocked(prisma.scrapeRun.updateMany).mock.calls[0]![0];
    expect(call.data?.status).toBe(ScrapeRunStatus.FAILED);
    expect(call.data?.errorSummary).toBe('Reaped stale heartbeat');
  });

  it('does not reclaim a live run: fresh heartbeat + old startedAt, RUNNING still present → throws', async () => {
    // findMany finds nothing stale (fresh heartbeat), but a RUNNING row still exists.
    const liveRow = makeRunningRow({
      startedAt: new Date(NOW.getTime() - 5 * 3_600_000), // 5h ago — would exceed a naive age threshold
      lastHeartbeatAt: new Date(NOW.getTime() - 30_000), // 30s ago — very fresh
    });
    const prisma = makeFakePrisma({
      findMany: async () => [], // nothing stale
      findFirst: async () => liveRow,
    });

    await expect(
      acquireRefreshLock(prisma, ScrapeRunKind.FULL_CATALOG, { now: clockNow }),
    ).rejects.toThrow(RefreshAlreadyRunningError);
  });

  it('legacy fallback: lastHeartbeatAt=null, startedAt within 24h → NOT stale, still RUNNING → throws', async () => {
    const liveRow = makeRunningRow({
      startedAt: new Date(NOW.getTime() - 1 * 3_600_000), // 1h ago, within 24h legacy window
      lastHeartbeatAt: null,
    });
    const prisma = makeFakePrisma({
      findMany: async () => [], // 1h old legacy row is not stale (< 24h)
      findFirst: async () => liveRow,
    });

    await expect(
      acquireRefreshLock(prisma, ScrapeRunKind.FULL_CATALOG, { now: clockNow }),
    ).rejects.toThrow(RefreshAlreadyRunningError);
  });

  it('legacy fallback: lastHeartbeatAt=null, startedAt older than 24h → reaped, lock acquired', async () => {
    const candidate = makeRunningRow({
      startedAt: new Date(NOW.getTime() - 25 * 3_600_000),
      lastHeartbeatAt: null,
    });
    const prisma = makeFakePrisma({
      findMany: async () => [candidate],
      updateMany: async () => ({ count: 1 }),
      findFirst: async () => null,
    });

    const lock = await acquireRefreshLock(prisma, ScrapeRunKind.FULL_CATALOG, { now: clockNow });
    expect(lock.kind).toBe(ScrapeRunKind.FULL_CATALOG);
  });

  it('concurrent start: reap-updateMany count=0, a subsequent findFirst still sees RUNNING → throws with that row', async () => {
    const staleHeartbeat = new Date(NOW.getTime() - 20 * 60_000);
    const candidate = makeRunningRow({
      startedAt: new Date(NOW.getTime() - 30 * 60_000),
      lastHeartbeatAt: staleHeartbeat,
    });
    const winnerRow = makeRunningRow({
      id: 'run-winner',
      startedAt: new Date(NOW.getTime() - 5_000),
      lastHeartbeatAt: new Date(NOW.getTime() - 1_000),
    });
    const prisma = makeFakePrisma({
      findMany: async () => [candidate],
      updateMany: async () => ({ count: 0 }), // lost the race
      findFirst: async () => winnerRow,
    });

    let thrown: RefreshAlreadyRunningError | null = null;
    try {
      await acquireRefreshLock(prisma, ScrapeRunKind.FULL_CATALOG, { now: clockNow });
    } catch (err) {
      if (err instanceof RefreshAlreadyRunningError) thrown = err;
    }
    expect(thrown).not.toBeNull();
  });

  it('concurrent start: reap-updateMany count=0, subsequent findFirst sees null (already reaped by winner) → throws from stale candidate', async () => {
    const staleHeartbeat = new Date(NOW.getTime() - 20 * 60_000);
    const candidate = makeRunningRow({
      startedAt: new Date(NOW.getTime() - 30 * 60_000),
      lastHeartbeatAt: staleHeartbeat,
    });
    const prisma = makeFakePrisma({
      findMany: async () => [candidate],
      updateMany: async () => ({ count: 0 }), // the winning concurrent acquirer got it first
      findFirst: async () => null, // already reaped to FAILED by the winner
    });

    let thrown: RefreshAlreadyRunningError | null = null;
    try {
      await acquireRefreshLock(prisma, ScrapeRunKind.FULL_CATALOG, { now: clockNow });
    } catch (err) {
      if (err instanceof RefreshAlreadyRunningError) thrown = err;
    }
    expect(thrown).not.toBeNull();
    expect(thrown?.running.id).toBe('run-abc'); // built from the stale candidate, not fabricated
  });
});

// ---------------------------------------------------------------------------
// releaseRefreshLock
// ---------------------------------------------------------------------------

describe('releaseRefreshLock', () => {
  it('calls updateMany with correct where and data', async () => {
    const prisma = makeFakePrisma({ findFirst: async () => null });
    const lock = { acquiredAt: NOW, kind: ScrapeRunKind.FULL_CATALOG };

    await releaseRefreshLock(prisma, lock, { now: clockNow });

    expect(prisma.scrapeRun.updateMany).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.scrapeRun.updateMany).mock.calls[0]![0];

    // where: status RUNNING, kind in GUARDED_KINDS, startedAt gte lock.acquiredAt
    expect(call.where?.status).toBe(ScrapeRunStatus.RUNNING);
    const kinds = (call.where?.kind as { in: ScrapeRunKind[] }).in;
    expect(kinds).toContain(ScrapeRunKind.FULL_CATALOG);
    expect(kinds).toContain(ScrapeRunKind.WISHLIST_REFRESH);
    expect((call.where?.startedAt as { gte: Date }).gte).toEqual(NOW);

    // data: status FAILED, finishedAt NOW, errorSummary 'released by concurrency guard'
    expect(call.data?.status).toBe(ScrapeRunStatus.FAILED);
    expect(call.data?.finishedAt).toEqual(NOW);
    expect(call.data?.errorSummary).toBe('released by concurrency guard');
  });

  it('resolves without throwing when updateMany returns count=0 (no-op)', async () => {
    const prisma = makeFakePrisma({ updateMany: async () => ({ count: 0 }) });
    const lock = { acquiredAt: NOW, kind: ScrapeRunKind.FULL_CATALOG };

    await expect(releaseRefreshLock(prisma, lock, { now: clockNow })).resolves.toBeUndefined();
  });

  it('swallows updateMany errors (must not throw — runs in finally)', async () => {
    const prisma = makeFakePrisma({
      updateMany: async () => { throw new Error('db connection lost'); },
    });
    const lock = { acquiredAt: NOW, kind: ScrapeRunKind.FULL_CATALOG };

    // Must resolve, NOT reject
    await expect(releaseRefreshLock(prisma, lock, { now: clockNow })).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GUARDED_KINDS constant
// ---------------------------------------------------------------------------

describe('GUARDED_KINDS', () => {
  it('contains FULL_CATALOG and WISHLIST_REFRESH', () => {
    expect(GUARDED_KINDS).toContain(ScrapeRunKind.FULL_CATALOG);
    expect(GUARDED_KINDS).toContain(ScrapeRunKind.WISHLIST_REFRESH);
  });
});
