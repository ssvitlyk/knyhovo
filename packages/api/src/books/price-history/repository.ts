import type { PrismaClient } from '@prisma/client';

/**
 * Internal row shapes for the price-history source query.
 *
 * These deliberately mirror only the fields the service and mapper need. They
 * are structurally compatible with the Prisma payload (so the query result is
 * assignable without manual copying) while keeping `@prisma/client` types from
 * leaking into the service/mapper layers.
 */
export interface PriceHistoryPointRow {
  readonly priceAmount: number;
  readonly priceCurrency: 'UAH';
  readonly availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  readonly recordedAt: Date;
}

export interface PriceHistoryListingRow {
  readonly id: string;
  readonly priceAmount: number;
  readonly priceCurrency: 'UAH';
  readonly availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  /** Full all-time history, ordered ascending by recordedAt. */
  readonly priceHistory: readonly PriceHistoryPointRow[];
}

export interface PriceHistorySourceRow {
  readonly id: string;
  readonly listings: readonly PriceHistoryListingRow[];
}

/**
 * Fetch a canonical book with all its provider listings and their full
 * all-time price history, ordered ascending by `recordedAt`.
 *
 * Single query — no N+1. Period filtering and listing selection are applied
 * in-memory in the service layer (see rationale in the plan).
 *
 * Returns `null` when no book with the given id exists.
 */
export async function findBookPriceHistorySource(
  prisma: PrismaClient,
  bookId: string,
): Promise<PriceHistorySourceRow | null> {
  return prisma.canonicalBook.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      listings: {
        select: {
          id: true,
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
  });
}
