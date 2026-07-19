import type { PrismaClient } from '@prisma/client';

/**
 * Internal row shapes returned by the books repository.
 *
 * These deliberately mirror only the fields the mapper needs. They are
 * structurally compatible with the Prisma payload (so the query result is
 * assignable without manual copying) while keeping `@prisma/client` types from
 * leaking into the mapper/service layers.
 */
export interface BookListingRow {
  readonly provider: 'YAKABOO' | 'BOOK_CLUB' | 'VIVAT' | 'BOOK_YE' | 'BOOKCHEF' | 'LABORATORY' | 'KNIGOLAND' | 'MEGAKNIGA';
  readonly priceAmount: number;
  readonly priceCurrency: 'UAH';
  readonly availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  readonly url: string;
  readonly lastSeenAt: Date;
  /** ISBN as shown on the provider page, or null when the page exposed none. */
  readonly isbn: string | null;
  /** Cover image URL from the provider's catalog card, or null when none scraped (W9a F1). */
  readonly coverUrl: string | null;
  /** Sanitized plain-text product-page description, or null when none enriched (W9a F2). */
  readonly description: string | null;
  /** Publisher as provider text, as-is (book-metadata PRD); null when not yet enriched. */
  readonly publisher: string | null;
  /** Language as provider text, as-is (book-metadata PRD); null when not yet enriched. */
  readonly language: string | null;
  /** Format/cover type as provider text, as-is (book-metadata PRD); null when not yet enriched. */
  readonly format: string | null;
  /** Series as provider text, as-is (book-metadata PRD); null when not yet enriched. */
  readonly series: string | null;
  /** Publication year (book-metadata PRD); null when not yet enriched. */
  readonly publicationYear: number | null;
}

export interface BookDetailsRow {
  readonly id: string;
  readonly title: string;
  readonly author: string;
  readonly isbn: string | null;
  readonly listings: readonly BookListingRow[];
}

/**
 * Fetch a single canonical book by its id with all provider listings eagerly
 * loaded in a single query. Returns null when no book with that id exists.
 *
 * This is the only place that issues a Prisma query for book details. All
 * filtering, aggregation and slug mapping happen in the mapper so they remain
 * unit-testable and no N+1 queries are possible.
 */
export async function findCanonicalBookById(
  prisma: PrismaClient,
  id: string,
): Promise<BookDetailsRow | null> {
  return prisma.canonicalBook.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      author: true,
      isbn: true,
      listings: {
        orderBy: { priceAmount: 'asc' },
        select: {
          provider: true,
          priceAmount: true,
          priceCurrency: true,
          availability: true,
          url: true,
          lastSeenAt: true,
          isbn: true,
          coverUrl: true,
          description: true,
          publisher: true,
          language: true,
          format: true,
          series: true,
          publicationYear: true,
        },
      },
    },
  });
}
