import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ScrapeRunKind, ScrapeRunStatus, Provider, ScrapeRunTrigger } from '@prisma/client';
import {
  isRefreshRunning,
  acquireRefreshLock,
  releaseRefreshLock,
  RefreshAlreadyRunningError,
  GUARDED_KINDS,
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
}) {
  return {
    scrapeRun: {
      findFirst: vi.fn(overrides?.findFirst ?? (async () => null)),
      updateMany: vi.fn(overrides?.updateMany ?? (async () => ({ count: 0 }))),
    },
  } as unknown as PrismaClient;
}

// A minimal RUNNING row fixture
function makeRunningRow(overrides?: {
  kind?: ScrapeRunKind;
  provider?: Provider;
}) {
  return {
    id: 'run-abc',
    provider: overrides?.provider ?? Provider.YAKABOO,
    kind: overrides?.kind ?? ScrapeRunKind.FULL_CATALOG,
    startedAt: new Date('2025-12-31T20:00:00.000Z'),
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
