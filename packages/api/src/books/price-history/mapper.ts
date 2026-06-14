import type { Availability } from '@knyhovo/shared';
import type {
  PriceHistoryPeriod,
  PriceHistoryPointDto,
  PriceHistoryExtremeDto,
  TypicalRangeDto,
  PriceHistoryChangeDto,
  BookPriceHistoryDto,
} from './dto.js';

/** Reverse map from the persisted availability enum to its public slug. */
const AVAILABILITY_SLUG: Record<'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN', Availability> = {
  IN_STOCK: 'in-stock',
  OUT_OF_STOCK: 'out-of-stock',
  UNKNOWN: 'unknown',
};

/** Internal representation of a price point before DTO mapping. */
interface RawPoint {
  readonly priceAmount: number;
  readonly priceCurrency: 'UAH';
  readonly availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN';
  readonly recordedAt: Date;
}

/**
 * Map a single raw price-history point to its DTO representation.
 * Out-of-stock points keep their stored amount (never zeroed).
 */
function toPointDto(point: RawPoint): PriceHistoryPointDto {
  return {
    amount: point.priceAmount,
    currency: point.priceCurrency,
    availability: AVAILABILITY_SLUG[point.availability],
    recordedAt: point.recordedAt.toISOString(),
  };
}

/**
 * Build the empty-state `BookPriceHistoryDto` (no history points in period).
 */
export function toEmptyPriceHistory(
  bookId: string,
  period: PriceHistoryPeriod,
  currency: string,
): BookPriceHistoryDto {
  return {
    bookId,
    period,
    currency,
    current: null,
    lowest: null,
    highest: null,
    typicalRange: null,
    change: null,
    points: [],
  };
}

/**
 * Map a non-empty list of currency-filtered, ascending price-history points
 * to the full `BookPriceHistoryDto` with computed aggregates.
 *
 * Invariant: `points` is non-empty and all points share the same currency.
 */
export function toPriceHistory(
  bookId: string,
  period: PriceHistoryPeriod,
  currency: string,
  rawPoints: readonly RawPoint[],
): BookPriceHistoryDto {
  // Map to DTOs (ascending order is already guaranteed by the caller).
  const points: PriceHistoryPointDto[] = rawPoints.map(toPointDto);

  // current = last point (full DTO including availability).
  const current = points[points.length - 1];

  // lowest / highest = min / max by amount → extreme DTOs (no availability).
  const sortedByAmount = [...rawPoints].sort((a, b) => a.priceAmount - b.priceAmount);
  const lowestRaw = sortedByAmount[0];
  const highestRaw = sortedByAmount[sortedByAmount.length - 1];

  const lowest: PriceHistoryExtremeDto = {
    amount: lowestRaw.priceAmount,
    currency: lowestRaw.priceCurrency,
    recordedAt: lowestRaw.recordedAt.toISOString(),
  };
  const highest: PriceHistoryExtremeDto = {
    amount: highestRaw.priceAmount,
    currency: highestRaw.priceCurrency,
    recordedAt: highestRaw.recordedAt.toISOString(),
  };

  // typicalRange: if >=5 points, sort amounts asc, drop one min + one max,
  // then take min/max of the remainder. Else use lowest.amount/highest.amount.
  let typicalRange: TypicalRangeDto;
  if (rawPoints.length >= 5) {
    const amounts = sortedByAmount.map((p) => p.priceAmount);
    const trimmed = amounts.slice(1, amounts.length - 1);
    typicalRange = {
      min: trimmed[0],
      max: trimmed[trimmed.length - 1],
      currency,
    };
  } else {
    typicalRange = {
      min: lowest.amount,
      max: highest.amount,
      currency,
    };
  }

  // change: from first point to current.
  const firstRaw = rawPoints[0];
  const changeAmount = rawPoints[rawPoints.length - 1].priceAmount - firstRaw.priceAmount;
  const changePercent =
    firstRaw.priceAmount <= 0 ? 0 : Math.round((changeAmount / firstRaw.priceAmount) * 100);
  const change: PriceHistoryChangeDto = {
    amount: changeAmount,
    percent: changePercent,
  };

  return {
    bookId,
    period,
    currency,
    current: current ?? null,
    lowest,
    highest,
    typicalRange,
    change,
    points,
  };
}
