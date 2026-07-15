import type { Provider, PrismaClient, ScrapeRun } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { ProviderName } from '@knyhovo/shared';
import type { ProviderListingFreshness } from './refresh-health.js';
import { mapProviderName, unmapProviderName } from '../pipeline/persist-listing.js';

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
 *
 * `incrementalProviders` (bookchef-incremental-scraping PRD §3): for these
 * providers, a listing counts as fresh if EITHER `lastSeenAt >= staleBefore`
 * OR its `provider_scrape_state` row (matched by provider+url) has
 * `last_seen_in_sitemap_at >= staleBefore` — under sitemap-incremental
 * scraping, a listing can go untouched by a business-data fetch for weeks
 * while still being confirmed present in every sitemap. The plain `groupBy`
 * stale count (computed for every provider, same as before) is overridden
 * for these providers by a raw-SQL join query; every other provider's count
 * is untouched.
 */
export async function fetchListingFreshness(
  prisma: PrismaClient,
  staleBefore: Date,
  incrementalProviders: ReadonlySet<Provider> = new Set(),
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

  if (incrementalProviders.size > 0) {
    const providerList = [...incrementalProviders];
    // Prisma's generated `Provider` enum values equal its keys (e.g.
    // "BOOKCHEF"), but a raw `::"provider"` cast needs the actual lowercase
    // DB label (e.g. "bookchef") — @map only applies inside the typed query
    // builder, never in raw SQL. Same bug class as scrape-state.repository.ts.
    const providerValues = Prisma.join(
      providerList.map((p) => Prisma.sql`${unmapProviderName(p)}::"provider"`),
    );

    const rows = await prisma.$queryRaw<Array<{ provider: string; stale_count: bigint }>>`
      SELECT pl.provider::text AS provider, COUNT(*)::bigint AS stale_count
      FROM provider_listings pl
      LEFT JOIN provider_scrape_state pss
        ON pss.provider = pl.provider AND pss.url = pl.url
      WHERE pl.provider IN (${providerValues})
        AND pl.last_seen_at < ${staleBefore}
        AND (pss.last_seen_in_sitemap_at IS NULL OR pss.last_seen_in_sitemap_at < ${staleBefore})
      GROUP BY pl.provider
    `;

    // A provider with zero stale rows under the join won't appear in `rows` at
    // all — reset it to 0 explicitly rather than leaving the (wrong, plain)
    // groupBy count in place.
    for (const provider of providerList) {
      staleMap.set(provider, 0);
    }
    for (const row of rows) {
      // Raw SQL returns the lowercase DB label ('bookchef'), not the Prisma
      // enum key ('BOOKCHEF') — map back before using it as a staleMap key,
      // which is keyed by the Prisma enum (as returned by groupBy above).
      const providerKey = mapProviderName(row.provider as ProviderName);
      staleMap.set(providerKey, Number(row.stale_count));
    }
  }

  return totals.map((row) => ({
    provider: row.provider,
    totalListings: row._count._all,
    staleListings: staleMap.get(row.provider) ?? 0,
    lastSeenAt: row._max.lastSeenAt ?? null,
  }));
}
