import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient, ScrapeRun } from '@prisma/client';
import { Provider, ScrapeRunKind, ScrapeRunStatus, ScrapeRunTrigger } from '@prisma/client';
import {
  fetchRecentRuns,
  fetchListingFreshness,
} from '../refresh-health.repository.js';

// ── Fixed test dates ──────────────────────────────────────────────────────────
const STARTED_AT = new Date('2026-06-22T10:00:00.000Z');
const STALE_BEFORE = new Date('2026-06-21T00:00:00.000Z');
const LAST_SEEN = new Date('2026-06-22T08:00:00.000Z');

// ── ScrapeRun fixture ─────────────────────────────────────────────────────────
const FAKE_RUN: ScrapeRun = {
  id: 'run-1',
  provider: Provider.YAKABOO,
  kind: ScrapeRunKind.FULL_CATALOG,
  status: ScrapeRunStatus.SUCCESS,
  triggeredBy: ScrapeRunTrigger.CRON,
  startedAt: STARTED_AT,
  finishedAt: null,
  durationMs: null,
  itemsFound: 500,
  itemsUpdated: 100,
  priceChanges: 10,
  availabilityChanges: 5,
  errorsCount: 0,
  errorSummary: null,
  metadata: null,
};

// ── fetchRecentRuns ───────────────────────────────────────────────────────────

describe('fetchRecentRuns', () => {
  it('calls findMany with orderBy startedAt desc and no where clause when no since given', async () => {
    const prisma = {
      scrapeRun: { findMany: vi.fn(async () => [FAKE_RUN]) },
    } as unknown as PrismaClient;

    const result = await fetchRecentRuns(prisma);

    expect(prisma.scrapeRun.findMany).toHaveBeenCalledOnce();
    const args = vi.mocked(prisma.scrapeRun.findMany).mock.calls[0]![0];
    expect(args?.orderBy).toEqual({ startedAt: 'desc' });
    expect(args?.where).toEqual({});
    expect(result).toEqual([FAKE_RUN]);
  });

  it('passes where: { startedAt: { gte: since } } when since is given', async () => {
    const since = new Date('2026-06-20T00:00:00.000Z');
    const prisma = {
      scrapeRun: { findMany: vi.fn(async () => []) },
    } as unknown as PrismaClient;

    await fetchRecentRuns(prisma, { since });

    const args = vi.mocked(prisma.scrapeRun.findMany).mock.calls[0]![0];
    expect(args?.where).toEqual({ startedAt: { gte: since } });
  });

  it('returns the rows from findMany', async () => {
    const prisma = {
      scrapeRun: { findMany: vi.fn(async () => [FAKE_RUN]) },
    } as unknown as PrismaClient;

    const rows = await fetchRecentRuns(prisma);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('run-1');
  });
});

// ── fetchListingFreshness ─────────────────────────────────────────────────────

describe('fetchListingFreshness', () => {
  it('issues two groupBy calls (totals + stale)', async () => {
    const groupBy = vi.fn(async () => []);
    const prisma = {
      providerListing: { groupBy },
    } as unknown as PrismaClient;

    await fetchListingFreshness(prisma, STALE_BEFORE);
    expect(groupBy).toHaveBeenCalledTimes(2);
  });

  it('totals groupBy has no where clause; stale groupBy filters by lastSeenAt lt staleBefore', async () => {
    const groupBy = vi.fn(async () => []);
    const prisma = {
      providerListing: { groupBy },
    } as unknown as PrismaClient;

    await fetchListingFreshness(prisma, STALE_BEFORE);

    const calls = vi.mocked(groupBy).mock.calls as unknown as Array<[{ where?: unknown }]>;
    // First call — totals (no where)
    const totalsArgs = calls[0]![0];
    expect(totalsArgs.where).toBeUndefined();

    // Second call — stale (with where)
    const staleArgs = calls[1]![0] as { where: unknown };
    expect(staleArgs.where).toEqual({ lastSeenAt: { lt: STALE_BEFORE } });
  });

  it('merges totals with stale counts correctly', async () => {
    const totalsRow = {
      provider: Provider.YAKABOO,
      _count: { _all: 200 },
      _max: { lastSeenAt: LAST_SEEN },
    };
    const staleRow = {
      provider: Provider.YAKABOO,
      _count: { _all: 50 },
    };

    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([totalsRow])
      .mockResolvedValueOnce([staleRow]);

    const prisma = {
      providerListing: { groupBy },
    } as unknown as PrismaClient;

    const result = await fetchListingFreshness(prisma, STALE_BEFORE);

    expect(result).toHaveLength(1);
    expect(result[0]!.provider).toBe(Provider.YAKABOO);
    expect(result[0]!.totalListings).toBe(200);
    expect(result[0]!.staleListings).toBe(50);
    expect(result[0]!.lastSeenAt).toEqual(LAST_SEEN);
  });

  it('sets staleListings to 0 when provider is absent from stale groupBy result', async () => {
    const totalsRow = {
      provider: Provider.BOOK_CLUB,
      _count: { _all: 300 },
      _max: { lastSeenAt: LAST_SEEN },
    };

    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([totalsRow])
      .mockResolvedValueOnce([]); // no stale rows

    const prisma = {
      providerListing: { groupBy },
    } as unknown as PrismaClient;

    const result = await fetchListingFreshness(prisma, STALE_BEFORE);

    expect(result[0]!.staleListings).toBe(0);
    expect(result[0]!.totalListings).toBe(300);
  });

  it('sets lastSeenAt to null when _max.lastSeenAt is null', async () => {
    const totalsRow = {
      provider: Provider.VIVAT,
      _count: { _all: 10 },
      _max: { lastSeenAt: null },
    };

    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([totalsRow])
      .mockResolvedValueOnce([]);

    const prisma = {
      providerListing: { groupBy },
    } as unknown as PrismaClient;

    const result = await fetchListingFreshness(prisma, STALE_BEFORE);
    expect(result[0]!.lastSeenAt).toBeNull();
  });

  it('returns empty array when there are no provider listings', async () => {
    const groupBy = vi.fn(async () => []);
    const prisma = {
      providerListing: { groupBy },
    } as unknown as PrismaClient;

    const result = await fetchListingFreshness(prisma, STALE_BEFORE);
    expect(result).toEqual([]);
  });
});
