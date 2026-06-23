import type { PrismaClient, ScrapeRun } from '@prisma/client';
import type { ProviderListingFreshness } from './refresh-health.js';

/**
 * Fetch all scrape runs, optionally filtered to those started at or after
 * `since`, ordered newest-first.
 */
export async function fetchRecentRuns(
  prisma: PrismaClient,
  params?: { since?: Date },
): Promise<ScrapeRun[]> {
  return prisma.scrapeRun.findMany({
    where: params?.since ? { startedAt: { gte: params.since } } : {},
    orderBy: { startedAt: 'desc' },
  });
}

/**
 * Return per-provider listing freshness: total count, stale count (not seen
 * since `staleBefore`), and the most recent `lastSeenAt` timestamp.
 */
export async function fetchListingFreshness(
  prisma: PrismaClient,
  staleBefore: Date,
): Promise<ProviderListingFreshness[]> {
  const [totals, stale] = await Promise.all([
    prisma.providerListing.groupBy({
      by: ['provider'],
      _count: { _all: true },
      _max: { lastSeenAt: true },
    }),
    prisma.providerListing.groupBy({
      by: ['provider'],
      where: { lastSeenAt: { lt: staleBefore } },
      _count: { _all: true },
    }),
  ]);

  const staleMap = new Map<string, number>(
    stale.map((row) => [row.provider, row._count._all]),
  );

  return totals.map((row) => ({
    provider: row.provider,
    totalListings: row._count._all,
    staleListings: staleMap.get(row.provider) ?? 0,
    lastSeenAt: row._max.lastSeenAt ?? null,
  }));
}
