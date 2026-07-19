import type { PrismaClient } from '@prisma/client';

/**
 * Internal row shapes for the buying-opportunities source query.
 *
 * These deliberately mirror only the fields the engine needs. They are
 * structurally compatible with the Prisma payload (so the query result is
 * assignable without manual copying) while keeping `@prisma/client` types
 * from leaking into the engine/service layers. `BuyingOpportunityListingRow`
 * is intentionally shape-compatible with `PriceHistoryListingRow`
 * (`books/price-history/repository.ts`) so `selectListing` can be reused
 * without duplicating its logic.
 */
export interface BuyingOpportunityPointRow {
  readonly priceAmount: number;
  readonly priceCurrency: 'UAH';
  readonly availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  readonly recordedAt: Date;
}

export interface BuyingOpportunityListingRow {
  readonly id: string;
  readonly provider: 'YAKABOO' | 'BOOK_CLUB' | 'VIVAT' | 'BOOK_YE' | 'BOOKCHEF' | 'LABORATORY' | 'KNIGOLAND' | 'MEGAKNIGA';
  readonly priceAmount: number;
  readonly priceCurrency: 'UAH';
  readonly availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  /** Full all-time history, ordered ascending by recordedAt. */
  readonly priceHistory: readonly BuyingOpportunityPointRow[];
}

export interface BuyingOpportunityBookRow {
  readonly id: string;
  readonly title: string;
  readonly listings: readonly BuyingOpportunityListingRow[];
}

export interface BuyingOpportunityAlertRow {
  readonly status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED' | 'UNAVAILABLE';
  readonly targetPriceAmount: number;
  readonly targetPriceCurrency: 'UAH';
}

export interface BuyingOpportunityWishlistRow {
  readonly canonicalBook: BuyingOpportunityBookRow;
  readonly alert: BuyingOpportunityAlertRow | null;
}

/**
 * Fetch all wishlist items for a user with their canonical book, listings and
 * full price history, and alert eagerly loaded in a single batched query.
 *
 * This is the only place that issues a Prisma query for this endpoint. All
 * signal extraction, evaluation and sorting happen in the engine so they
 * remain unit-testable and no N+1 queries are possible.
 */
export async function findWishlistItemsForBuyingOpportunities(
  prisma: PrismaClient,
  userId: string,
): Promise<BuyingOpportunityWishlistRow[]> {
  return prisma.wishlistItem.findMany({
    where: { userId },
    select: {
      canonicalBook: {
        select: {
          id: true,
          title: true,
          listings: {
            select: {
              id: true,
              provider: true,
              priceAmount: true,
              priceCurrency: true,
              availability: true,
              priceHistory: {
                orderBy: { recordedAt: 'asc' },
                select: {
                  priceAmount: true,
                  priceCurrency: true,
                  availability: true,
                  recordedAt: true,
                },
              },
            },
          },
        },
      },
      alert: {
        select: {
          status: true,
          targetPriceAmount: true,
          targetPriceCurrency: true,
        },
      },
    },
  });
}
