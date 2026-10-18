import type { PrismaClient } from '@prisma/client';
import type { ScrapeRunMetricsRow } from './scrape-runs-source.js';
import { PROVIDER_SLUG } from '../pricing/provider-maps.js';

const PROVIDER_SLUG_BY_ENUM: Readonly<Record<string, string>> = PROVIDER_SLUG;

/**
 * Fetch all scrape_runs rows and map them to the plain {@link ScrapeRunMetricsRow}
 * shape (provider slug, string status) that {@link ScrapeRunsMetricsSource} consumes.
 */
export async function fetchScrapeRunMetricRows(prisma: PrismaClient): Promise<ScrapeRunMetricsRow[]> {
  const rows = await prisma.scrapeRun.findMany({
    select: {
      provider: true,
      status: true,
      durationMs: true,
      itemsFound: true,
      itemsUpdated: true,
      priceChanges: true,
      availabilityChanges: true,
      errorsCount: true,
    },
  });

  return rows.map((row) => ({
    provider: PROVIDER_SLUG_BY_ENUM[String(row.provider)] ?? String(row.provider),
    status: String(row.status),
    durationMs: row.durationMs,
    itemsFound: row.itemsFound,
    itemsUpdated: row.itemsUpdated,
    priceChanges: row.priceChanges,
    availabilityChanges: row.availabilityChanges,
    errorsCount: row.errorsCount,
  }));
}
