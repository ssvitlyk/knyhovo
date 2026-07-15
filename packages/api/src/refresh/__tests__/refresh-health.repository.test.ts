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
  lastHeartbeatAt: STARTED_AT,
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

  // ── bookchef-incremental-scraping PRD §3: incremental-providers stale override ──

  describe('incremental-capable providers (bookchef-incremental-scraping PRD §3)', () => {
    it('does not run the raw-SQL join query when no incremental providers are given', async () => {
      const groupBy = vi.fn(async () => []);
      const queryRaw = vi.fn(async () => []);
      const prisma = { providerListing: { groupBy }, $queryRaw: queryRaw } as unknown as PrismaClient;

      await fetchListingFreshness(prisma, STALE_BEFORE);
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('overrides the plain-groupBy stale count with the join-based count for an incremental provider', async () => {
      const totalsRow = {
        provider: Provider.BOOKCHEF,
        _count: { _all: 500 },
        _max: { lastSeenAt: LAST_SEEN },
      };
      // Plain groupBy says 400 stale (would false-positive under incremental scraping).
      const staleRow = { provider: Provider.BOOKCHEF, _count: { _all: 400 } };
      const groupBy = vi.fn().mockResolvedValueOnce([totalsRow]).mockResolvedValueOnce([staleRow]);
      // The join query (only counting rows with no fresh sitemap-presence either) says 20.
      // Raw SQL returns the lowercase DB label ('bookchef'), not the Prisma enum
      // key — see genres/repository.ts's `listRawCategoryDistribution`, confirmed
      // against real Postgres in backfill.pg.test.ts.
      const queryRaw = vi.fn(async () => [{ provider: 'bookchef', stale_count: 20n }]);
      const prisma = { providerListing: { groupBy }, $queryRaw: queryRaw } as unknown as PrismaClient;

      const result = await fetchListingFreshness(
        prisma,
        STALE_BEFORE,
        new Set([Provider.BOOKCHEF]),
      );

      expect(queryRaw).toHaveBeenCalledOnce();
      expect(result).toHaveLength(1);
      expect(result[0]!.provider).toBe(Provider.BOOKCHEF);
      expect(result[0]!.totalListings).toBe(500);
      expect(result[0]!.staleListings).toBe(20);
    });

    it('resets an incremental provider to 0 stale when the join query returns no row for it', async () => {
      const totalsRow = { provider: Provider.BOOKCHEF, _count: { _all: 100 }, _max: { lastSeenAt: LAST_SEEN } };
      const staleRow = { provider: Provider.BOOKCHEF, _count: { _all: 90 } }; // plain groupBy: mostly stale
      const groupBy = vi.fn().mockResolvedValueOnce([totalsRow]).mockResolvedValueOnce([staleRow]);
      const queryRaw = vi.fn(async () => []); // join query: nothing is actually stale
      const prisma = { providerListing: { groupBy }, $queryRaw: queryRaw } as unknown as PrismaClient;

      const result = await fetchListingFreshness(prisma, STALE_BEFORE, new Set([Provider.BOOKCHEF]));
      expect(result[0]!.staleListings).toBe(0);
    });

    // Regression: `Provider.BOOKCHEF` (the Prisma JS enum key) is the uppercase
    // string "BOOKCHEF", but the Postgres `provider` enum's actual label is
    // lowercase "bookchef" (see @map in schema.prisma). Interpolating the raw
    // enum key into the `::"provider"` cast in the WHERE clause previously
    // would have produced `invalid input value for enum provider: "BOOKCHEF"`,
    // same as the scrape-state.repository.ts bug.
    it('casts to the lowercase DB label ("bookchef"), never the uppercase enum key', async () => {
      const totalsRow = { provider: Provider.BOOKCHEF, _count: { _all: 1 }, _max: { lastSeenAt: LAST_SEEN } };
      const groupBy = vi.fn().mockResolvedValueOnce([totalsRow]).mockResolvedValueOnce([]);
      const queryRaw = vi.fn(async () => []);
      const prisma = { providerListing: { groupBy }, $queryRaw: queryRaw } as unknown as PrismaClient;

      await fetchListingFreshness(prisma, STALE_BEFORE, new Set([Provider.BOOKCHEF]));

      const callArgs = vi.mocked(queryRaw).mock.calls[0]!;
      const interpolatedValues = callArgs.flatMap((arg) =>
        arg !== null && typeof arg === 'object' && 'values' in arg
          ? (arg as { values: unknown[] }).values
          : [arg],
      );

      expect(interpolatedValues).toContain('bookchef');
      expect(interpolatedValues).not.toContain('BOOKCHEF');
    });

    it('leaves a non-incremental provider\'s plain-groupBy stale count untouched', async () => {
      const totalsRow = { provider: Provider.YAKABOO, _count: { _all: 100 }, _max: { lastSeenAt: LAST_SEEN } };
      const staleRow = { provider: Provider.YAKABOO, _count: { _all: 60 } };
      const groupBy = vi.fn().mockResolvedValueOnce([totalsRow]).mockResolvedValueOnce([staleRow]);
      const queryRaw = vi.fn(async () => []); // only queried for incremental providers; irrelevant here
      const prisma = { providerListing: { groupBy }, $queryRaw: queryRaw } as unknown as PrismaClient;

      const result = await fetchListingFreshness(prisma, STALE_BEFORE, new Set([Provider.BOOKCHEF]));
      expect(result[0]!.provider).toBe(Provider.YAKABOO);
      expect(result[0]!.staleListings).toBe(60);
    });
  });
});
