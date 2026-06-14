import type { Prisma, PrismaClient } from '@prisma/client';
import type { PriceSnapshotInput, PricePoint, HistoryRange } from './dto.js';

/**
 * Accepts either the root Prisma client or an active transaction client, so
 * writes can join the pipeline's existing `$transaction` while reads can run
 * standalone.
 */
type Db = PrismaClient | Prisma.TransactionClient;

const POINT_SELECT = {
  priceAmount: true,
  priceCurrency: true,
  availability: true,
  recordedAt: true,
} as const;

/**
 * Append one immutable price-history snapshot (INSERT only — the table is
 * append-only; rows are never updated or deleted).
 */
export async function appendSnapshot(db: Db, input: PriceSnapshotInput): Promise<void> {
  await db.priceHistoryPoint.create({
    data: {
      providerListingId: input.providerListingId,
      priceAmount: input.priceAmount,
      priceCurrency: input.priceCurrency,
      availability: input.availability,
      recordedAt: input.recordedAt,
    },
  });
}

/** Most recently recorded snapshot for a listing, or null when none exist. */
export async function findLatest(db: Db, providerListingId: string): Promise<PricePoint | null> {
  return db.priceHistoryPoint.findFirst({
    where: { providerListingId },
    orderBy: { recordedAt: 'desc' },
    select: POINT_SELECT,
  });
}

/**
 * Full snapshot timeline for a listing, oldest-first (for charts). An optional
 * `[since, until]` window narrows the range.
 */
export async function findHistory(
  db: Db,
  providerListingId: string,
  range: HistoryRange = {},
): Promise<PricePoint[]> {
  const { since, until } = range;
  const recordedAt =
    since || until ? { ...(since ? { gte: since } : {}), ...(until ? { lte: until } : {}) } : undefined;
  return db.priceHistoryPoint.findMany({
    where: { providerListingId, ...(recordedAt ? { recordedAt } : {}) },
    orderBy: { recordedAt: 'asc' },
    select: POINT_SELECT,
  });
}

/**
 * Lowest price ever recorded for a listing, or null when none exist. Ties are
 * broken by earliest `recordedAt` so the result is deterministic.
 */
export async function findLowestPrice(
  db: Db,
  providerListingId: string,
): Promise<PricePoint | null> {
  return db.priceHistoryPoint.findFirst({
    where: { providerListingId },
    orderBy: [{ priceAmount: 'asc' }, { recordedAt: 'asc' }],
    select: POINT_SELECT,
  });
}
