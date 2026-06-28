import type { PrismaClient } from '@prisma/client';

/**
 * Internal row shapes returned by the search repository.
 *
 * These deliberately mirror only the fields the mapper needs. They are
 * structurally compatible with the Prisma payload (so the query result is
 * assignable without manual copying) while keeping `@prisma/client` types from
 * leaking into the mapper/service layers.
 */
export interface ListingRow {
  readonly provider: 'YAKABOO' | 'BOOK_CLUB' | 'VIVAT' | 'BOOK_YE' | 'BOOKCHEF' | 'LABORATORY' | 'KNIGOLAND';
  readonly priceAmount: number;
  readonly priceCurrency: 'UAH';
  readonly availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  readonly coverUrl?: string | null;
}

export interface CanonicalBookRow {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly listings: readonly ListingRow[];
}

/**
 * Fetch canonical books whose title OR author matches `q` (case-insensitive
 * substring), with their provider listings eagerly loaded.
 *
 * This is the only place that issues a Prisma query for search. Filtering of
 * null-price listings, lowest-price computation, sorting and pagination all
 * happen in the mapper/service so they remain unit-testable and the query stays
 * provider-agnostic.
 */
export async function searchCanonicalBooks(
  prisma: PrismaClient,
  q: string,
): Promise<CanonicalBookRow[]> {
  return prisma.canonicalBook.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { author: { contains: q, mode: 'insensitive' } },
      ],
    },
    include: { listings: true },
  });
}
