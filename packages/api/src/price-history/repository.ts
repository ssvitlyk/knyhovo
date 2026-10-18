import type { Prisma, PrismaClient } from '@prisma/client';
import type { PriceSnapshotInput } from './dto.js';

/**
 * Accepts either the root Prisma client or an active transaction client, so
 * the write can join the pipeline's existing `$transaction`.
 */
type Db = PrismaClient | Prisma.TransactionClient;

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
