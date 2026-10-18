import type { PrismaClient } from '@prisma/client';

/**
 * Best-effort `SELECT 1` so a pooled connection dropped during a long idle
 * stretch (e.g. a tens-of-minutes scrape) can re-establish before the next
 * real query. Errors are swallowed on purpose: the caller's follow-up query
 * decides success or failure. This is one deliberate reconnect, not a retry.
 */
export async function touchConnection(prisma: Pick<PrismaClient, '$queryRaw'>): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    // Touch is best-effort only.
  }
}
