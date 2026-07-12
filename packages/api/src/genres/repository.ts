import type { PrismaClient } from '@prisma/client';
import type { ProviderName } from '@knyhovo/shared';

/**
 * Ad-hoc genre-signal SQL (genres-taxonomy PRD §8.1 step 6, §13).
 *
 * The backfill pass builds its unmapped report in-process (`report.ts`); this
 * module is the DB-side `unnest(...) GROUP BY` variant for ad-hoc curation
 * queries — "what raw categories exist per provider, how often" — without
 * running a full pass. Offline/CLI use only; nothing here is wired into any
 * API route or DTO.
 */

/** One `(provider, rawCategory)` occurrence row, ordered by count desc. */
export interface RawCategoryDistributionRow {
  readonly provider: ProviderName;
  /** Provider-native text exactly as stored in `raw_categories`. */
  readonly rawCategory: string;
  /** Number of listings carrying this category element. */
  readonly listingCount: number;
}

/**
 * Distribution of every `raw_categories` element across `provider_listings`
 * (full scan by design — the column is deliberately unindexed, PRD §5.2).
 * Deterministic order: count desc, provider asc, category asc.
 */
export async function listRawCategoryDistribution(
  prisma: PrismaClient,
  limit = 500,
): Promise<readonly RawCategoryDistributionRow[]> {
  const rows = await prisma.$queryRaw<
    { provider: string; raw_category: string; listing_count: number }[]
  >`
    SELECT pl.provider::text AS provider,
           cat.raw_category,
           count(*)::int AS listing_count
    FROM provider_listings pl
    CROSS JOIN LATERAL unnest(pl.raw_categories) AS cat(raw_category)
    GROUP BY 1, 2
    ORDER BY listing_count DESC, provider ASC, raw_category ASC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    // `provider::text` yields the @map-ped enum value ('book-club', …),
    // which is exactly the shared ProviderName slug.
    provider: row.provider as ProviderName,
    rawCategory: row.raw_category,
    listingCount: row.listing_count,
  }));
}
