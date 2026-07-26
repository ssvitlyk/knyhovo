import type { PrismaClient } from '@prisma/client';

/**
 * Canonical price — the single definition of "what a book costs right now".
 *
 * notifications-model-v2 PRD §4: the canonical price is the cheapest offer that
 * is **strictly IN_STOCK** across all of a book's provider listings. `UNKNOWN`
 * and `OUT_OF_STOCK` never take part: we must not promise a price that cannot be
 * bought, and every layer (read model, alert state, notification engine,
 * scheduler, email) has to look at the same number.
 *
 * Before this module there were three competing definitions — the wishlist/book
 * mappers included `UNKNOWN`, the notification path used a strictly-IN_STOCK
 * groupBy, and the buying-opportunities engine had its own filter. This file is
 * now the only place either rule lives: one pure function over listing rows and
 * one SQL aggregate over the DB.
 */

/** The minimum listing shape needed to compute a canonical price. */
export interface PricedListing {
  readonly priceAmount: number;
  readonly availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
}

/** True when a listing carries a usable numeric price. */
function hasUsablePrice(listing: PricedListing): boolean {
  return listing.priceAmount != null && Number.isFinite(listing.priceAmount);
}

/**
 * True when a listing may define the canonical price: priced AND strictly in stock.
 * Exported so read models can filter with the same predicate instead of copying it.
 */
export function isCanonicalCandidate(listing: PricedListing): boolean {
  return hasUsablePrice(listing) && listing.availability === 'IN_STOCK';
}

/**
 * The canonical price amount (kopiyky) across a book's listings, or null when the
 * book has no strictly in-stock priced offer.
 *
 * Pure — the read models and the resolver share it, so a book's canonical price
 * can never differ between "what the API returned" and "what the engine compared".
 */
export function canonicalPriceAmount(listings: readonly PricedListing[]): number | null {
  let lowest: number | null = null;
  for (const listing of listings) {
    if (!isCanonicalCandidate(listing)) continue;
    if (lowest === null || listing.priceAmount < lowest) lowest = listing.priceAmount;
  }
  return lowest;
}

/**
 * Canonical price per book, straight from the DB — the only SQL definition.
 *
 * Returns a map of canonicalBookId → canonical price amount (kopiyky). Books with
 * no strictly in-stock listing are absent from the map (absence means
 * "unavailable", never "price 0"). Returns an empty map for empty input so callers
 * never issue an `IN ()` query.
 */
export async function findCanonicalPriceByBook(
  prisma: PrismaClient,
  canonicalBookIds: string[],
): Promise<Map<string, number>> {
  if (canonicalBookIds.length === 0) return new Map();

  const rows = await prisma.providerListing.groupBy({
    by: ['canonicalBookId'],
    where: {
      canonicalBookId: { in: canonicalBookIds },
      availability: 'IN_STOCK',
    },
    _min: { priceAmount: true },
  });

  const result = new Map<string, number>();
  for (const row of rows) {
    const min = row._min.priceAmount;
    if (min != null) result.set(row.canonicalBookId, min);
  }
  return result;
}
