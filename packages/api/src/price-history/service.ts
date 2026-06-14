import type { Prisma, PrismaClient } from '@prisma/client';
import type { ListingPriceState } from './dto.js';
import { appendSnapshot } from './repository.js';

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Decide whether a new price-history snapshot must be recorded.
 *
 * Returns true when there is no previous state (the first observation of a
 * listing) or when price amount, currency, or availability differs from the
 * previous state. Pure and deterministic — the single source of truth for the
 * W3 "price OR availability changed" rule.
 */
export function shouldCreateSnapshot(
  previous: ListingPriceState | null,
  next: ListingPriceState,
): boolean {
  if (previous === null) return true;
  return (
    previous.priceAmount !== next.priceAmount ||
    previous.priceCurrency !== next.priceCurrency ||
    previous.availability !== next.availability
  );
}

export interface RecordPriceChangeInput {
  readonly providerListingId: string;
  readonly previous: ListingPriceState | null;
  readonly next: ListingPriceState;
  readonly recordedAt: Date;
}

/**
 * Append a price-history snapshot when — and only when — price or availability
 * changed. Returns whether a snapshot was created. Safe to call inside a
 * transaction: pass the transaction client as `db`.
 */
export async function recordPriceChange(
  db: Db,
  input: RecordPriceChangeInput,
): Promise<{ created: boolean }> {
  if (!shouldCreateSnapshot(input.previous, input.next)) {
    return { created: false };
  }
  await appendSnapshot(db, {
    providerListingId: input.providerListingId,
    priceAmount: input.next.priceAmount,
    priceCurrency: input.next.priceCurrency,
    availability: input.next.availability,
    recordedAt: input.recordedAt,
  });
  return { created: true };
}
