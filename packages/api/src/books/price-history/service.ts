import type { PrismaClient } from '@prisma/client';
import type { PriceHistoryPeriod, BookPriceHistoryDto } from './dto.js';
import { findBookPriceHistorySource } from './repository.js';
import type { PriceHistoryListingRow, PriceHistoryPointRow } from './repository.js';
import { toEmptyPriceHistory, toPriceHistory } from './mapper.js';
import { BookNotFoundError } from '../../errors.js';

/** Dependency injection interface for clock-dependent operations. */
export interface PriceHistoryDeps {
  now(): Date;
}

/**
 * Compute the `since` date for a given period.
 * Returns `null` for `'all'` (no lower bound).
 */
function computeSince(period: PriceHistoryPeriod, now: Date): Date | null {
  if (period === 'all') return null;

  const days = {
    '30d': 30,
    '90d': 90,
    '1y': 365,
  }[period];

  return new Date(now.getTime() - days * 86_400_000);
}

/**
 * Select the most relevant provider listing for the price-history chart.
 *
 * Selection logic:
 * 1. Only listings with ≥1 history point are candidates.
 * 2. Prefer listings where current `availability !== OUT_OF_STOCK` AND
 *    `Number.isFinite(priceAmount)`. Among those, pick lowest `priceAmount`;
 *    tie-break by listing `id` ascending.
 * 3. Else fall back to the listing whose latest history point has the latest
 *    `recordedAt`.
 *
 * Returns `null` when no listing has any history.
 */
function selectListing(
  listings: readonly PriceHistoryListingRow[],
): PriceHistoryListingRow | null {
  const candidates = listings.filter((l) => l.priceHistory.length > 0);
  if (candidates.length === 0) return null;

  // Preferred: available with finite price.
  const preferred = candidates.filter(
    (l) => l.availability !== 'OUT_OF_STOCK' && Number.isFinite(l.priceAmount),
  );

  if (preferred.length > 0) {
    return preferred.reduce((best, l) => {
      if (l.priceAmount < best.priceAmount) return l;
      if (l.priceAmount === best.priceAmount && l.id < best.id) return l;
      return best;
    });
  }

  // Fallback: listing with latest history point.
  return candidates.reduce((best, l) => {
    const bestLatest = best.priceHistory[best.priceHistory.length - 1];
    const lLatest = l.priceHistory[l.priceHistory.length - 1];
    if (lLatest.recordedAt > bestLatest.recordedAt) return l;
    return best;
  });
}

/**
 * Fetch and compute the price-history DTO for a single canonical book.
 *
 * Throws {@link BookNotFoundError} (→ HTTP 404) when no book with the given
 * id exists.
 *
 * Returns an empty-state DTO (all aggregates `null`, `points: []`) when the
 * book exists but has no relevant history in the requested period.
 */
export async function getBookPriceHistory(
  prisma: PrismaClient,
  bookId: string,
  period: PriceHistoryPeriod,
  deps: PriceHistoryDeps,
): Promise<BookPriceHistoryDto> {
  const source = await findBookPriceHistorySource(prisma, bookId);
  if (source === null) {
    throw new BookNotFoundError();
  }

  const now = deps.now();
  const since = computeSince(period, now);

  // Select the most relevant listing.
  const selected = selectListing(source.listings);
  if (selected === null) {
    // Book exists but no listing has any history.
    return toEmptyPriceHistory(bookId, period, 'UAH');
  }

  // Filter points by period window then by listing currency (no mixed currencies).
  const filteredPoints: PriceHistoryPointRow[] = selected.priceHistory.filter((p) => {
    if (since !== null && p.recordedAt < since) return false;
    if (p.priceCurrency !== selected.priceCurrency) return false;
    return true;
  });

  if (filteredPoints.length === 0) {
    // Book and listing exist, but zero points in the requested period window.
    return toEmptyPriceHistory(bookId, period, selected.priceCurrency);
  }

  return toPriceHistory(bookId, period, selected.priceCurrency, filteredPoints);
}
