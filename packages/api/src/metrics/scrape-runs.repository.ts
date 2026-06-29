import type { PrismaClient } from '@prisma/client';
import type { ProviderName } from '@knyhovo/shared';
import type { ScrapeRunMetricsRow } from './scrape-runs-source.js';

const PROVIDER_SLUG: Record<string, ProviderName> = {
  YAKABOO: 'yakaboo',
  BOOK_CLUB: 'book-club',
  VIVAT: 'vivat',
  BOOK_YE: 'book-ye',
  BOOKCHEF: 'bookchef',
  LABORATORY: 'laboratory',
  KNIGOLAND: 'knigoland',
};

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
    provider: PROVIDER_SLUG[String(row.provider)] ?? String(row.provider),
    status: String(row.status),
    durationMs: row.durationMs,
    itemsFound: row.itemsFound,
    itemsUpdated: row.itemsUpdated,
    priceChanges: row.priceChanges,
    availabilityChanges: row.availabilityChanges,
    errorsCount: row.errorsCount,
  }));
}
