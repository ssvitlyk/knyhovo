import type { Provider, Prisma, PrismaClient } from '@prisma/client';
import { Prisma as PrismaNs } from '@prisma/client';
import { unmapProviderName } from './persist-listing.js';

/** Batch size for the sitemap-presence upsert, to keep each statement's parameter count bounded. */
const PRESENCE_UPSERT_CHUNK_SIZE = 2000;

/**
 * Load every known per-URL sitemap watermark for `provider`, as a map of
 * url → sourceLastmod (ISO 8601 string). Only rows with a non-null watermark
 * are included — new/never-fetched URLs simply aren't in the map.
 */
export async function loadKnownSourceLastmod(
  prisma: PrismaClient,
  provider: Provider,
): Promise<Map<string, string>> {
  const rows = await prisma.providerScrapeState.findMany({
    where: { provider, sourceLastmod: { not: null } },
    select: { url: true, sourceLastmod: true },
  });

  const result = new Map<string, string>();
  for (const row of rows) {
    // Guaranteed non-null by the `sourceLastmod: { not: null }` where clause above;
    // Prisma's generated type is still nullable because it can't express that.
    result.set(row.url, row.sourceLastmod!.toISOString());
  }
  return result;
}

/**
 * Batched (~2000/chunk) upsert of sitemap presence: every entry's URL gets
 * last_seen_in_sitemap_at bumped to `seenAt`. New rows get sourceLastmod NULL
 * (watermark only ever advances via the fetch path, never via presence alone).
 */
export async function recordSitemapPresence(
  prisma: PrismaClient,
  provider: Provider,
  entries: ReadonlyArray<{ url: string }>,
  seenAt: Date,
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  // Prisma's generated `Provider` enum values equal its keys (e.g. "BOOKCHEF"),
  // but `@@map`/`@map` only rewrite the Postgres label for the query builder —
  // a raw `::"provider"` cast still needs the actual lowercase DB label
  // (e.g. "bookchef"), so unmap before interpolating.
  const dbProviderLabel = unmapProviderName(provider);

  for (let i = 0; i < entries.length; i += PRESENCE_UPSERT_CHUNK_SIZE) {
    const chunk = entries.slice(i, i + PRESENCE_UPSERT_CHUNK_SIZE);
    const rows = PrismaNs.join(
      chunk.map((entry) => PrismaNs.sql`(${dbProviderLabel}::"provider", ${entry.url}, ${seenAt})`),
    );

    await prisma.$executeRaw`
      INSERT INTO provider_scrape_state (provider, url, last_seen_in_sitemap_at)
      VALUES ${rows}
      ON CONFLICT (provider, url)
      DO UPDATE SET last_seen_in_sitemap_at = EXCLUDED.last_seen_in_sitemap_at
    `;
  }
}

/**
 * Upsert the per-URL watermark: source_lastmod, last_fetched_at, and
 * last_seen_in_sitemap_at all set together. Callable with either a full
 * PrismaClient or a Prisma.TransactionClient so callers can advance the
 * watermark atomically inside a persist transaction.
 */
export async function advanceWatermark(
  tx: Prisma.TransactionClient | PrismaClient,
  provider: Provider,
  url: string,
  sourceLastmod: string | null,
  fetchedAt: Date,
): Promise<void> {
  await tx.providerScrapeState.upsert({
    where: { provider_url: { provider, url } },
    create: {
      provider,
      url,
      sourceLastmod: sourceLastmod !== null ? new Date(sourceLastmod) : null,
      lastFetchedAt: fetchedAt,
      lastSeenInSitemapAt: fetchedAt,
    },
    update: {
      sourceLastmod: sourceLastmod !== null ? new Date(sourceLastmod) : null,
      lastFetchedAt: fetchedAt,
      lastSeenInSitemapAt: fetchedAt,
    },
  });
}

/**
 * Count of state rows for `provider` whose last_seen_in_sitemap_at predates
 * `seenAt` — i.e. rows NOT touched by the presence-upsert for this run,
 * meaning their URL vanished from this run's sitemap. Call AFTER
 * recordSitemapPresence for the same run. `_sitemapUrls` is accepted for
 * interface clarity/future use but unused: every currently-present URL's row
 * was just bumped to `seenAt` by recordSitemapPresence, so anything strictly
 * older than `seenAt` was absent this run.
 */
export async function countVanished(
  prisma: PrismaClient,
  provider: Provider,
  _sitemapUrls: ReadonlySet<string>,
  seenAt: Date,
): Promise<number> {
  return prisma.providerScrapeState.count({
    where: { provider, lastSeenInSitemapAt: { lt: seenAt } },
  });
}

/** Delete state rows for `provider` whose last_seen_in_sitemap_at predates `cutoff`. Returns deleted count. */
export async function sweepStaleState(
  prisma: PrismaClient,
  provider: Provider,
  cutoff: Date,
): Promise<number> {
  const result = await prisma.providerScrapeState.deleteMany({
    where: { provider, lastSeenInSitemapAt: { lt: cutoff } },
  });
  return result.count;
}
