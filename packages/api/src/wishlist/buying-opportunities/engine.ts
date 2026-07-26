import type { BuyingReason, ProviderName } from '@knyhovo/shared';
import { selectListing } from '../../books/price-history/service.js';
import { PROVIDER_SLUG } from '../mapper.js';
import type { BuyingOpportunityWishlistRow } from './repository.js';
import type { BuyingOpportunityItemDto } from './dto.js';
import { isCanonicalCandidate } from '../../pricing/canonical-price.js';

/**
 * Pure buying-reason recommendation engine — faithful port of the frozen
 * reference algorithm (`design-import/incoming/wl-buying-reasons.js`, revised
 * 2026-07-08) onto Knyhovo's own tracked `price_history`.
 *
 * Trust rule (frozen): every signal must be proven by Knyhovo's own price
 * tracking over time — never a store-side "was" price or a bare discount %.
 * Only 3 reasons exist, in priority order: TARGET_REACHED → LOWEST_90_DAYS →
 * PRICE_DROPPED. No fallback reason — a book with none of the 3 signals
 * simply doesn't qualify.
 */

const NINETY_DAYS_MS = 90 * 86_400_000;

/** Priority — from strongest reason to weakest. Index = sort rank (asc). */
export const REASON_RANK: Record<BuyingReason, number> = {
  TARGET_REACHED: 0,
  LOWEST_90_DAYS: 1,
  PRICE_DROPPED: 2,
};

/** Signals extracted for a single wishlist book, ready for `evaluateSignals`. */
export interface BuyingSignals {
  readonly bookId: string;
  readonly title: string;
  /** Cheapest strictly IN_STOCK, finite-price listing's price. Kopiyky. */
  readonly price: number;
  readonly currency: string;
  readonly store: ProviderName;
  /** Second-to-last point of the full history of the listing `selectListing` picked. */
  readonly prevPrice: number | null;
  /** Minimum of the 90-day window, excluding the last point of the full history. */
  readonly min90: number | null;
  /** From an ACTIVE alert with a matching currency; otherwise null. */
  readonly targetPrice: number | null;
}

/**
 * Extract the pure signals `evaluateSignals` needs from one wishlist row.
 *
 * Returns `null` when the book doesn't qualify at all — no listing is
 * strictly IN_STOCK with a finite price (OUT_OF_STOCK/UNKNOWN are excluded
 * even when an alert target would otherwise be met — this is a "buy now"
 * recommendation).
 */
export function extractSignals(row: BuyingOpportunityWishlistRow, now: Date): BuyingSignals | null {
  const book = row.canonicalBook;
  const listings = book.listings;

  // Same canonical-price predicate the read models and the alert engine use —
  // one definition of "buyable right now" across the whole product (§4).
  const inStock = listings.filter(isCanonicalCandidate);
  if (inStock.length === 0) return null;

  // Cheapest in-stock listing; tie-break by id ascending.
  const cheapest = inStock.reduce((best, l) => {
    if (l.priceAmount < best.priceAmount) return l;
    if (l.priceAmount === best.priceAmount && l.id < best.id) return l;
    return best;
  });

  const price = cheapest.priceAmount;
  const currency = cheapest.priceCurrency;
  const store = PROVIDER_SLUG[cheapest.provider];

  // Most relevant listing for history — reused from the price-history service,
  // NOT necessarily the cheapest in-stock listing above.
  const selected = selectListing(listings);

  let prevPrice: number | null = null;
  let min90: number | null = null;

  if (selected !== null && selected.priceCurrency === currency) {
    const filteredPoints = selected.priceHistory.filter((p) => p.priceCurrency === selected.priceCurrency);

    if (filteredPoints.length >= 2) {
      prevPrice = filteredPoints[filteredPoints.length - 2]!.priceAmount;
    }

    // 90-day window EXCLUDES the last point of the full history — otherwise
    // every book would tautologically qualify as LOWEST_90_DAYS, since points
    // are only written on price change.
    const pointsExcludingLast = filteredPoints.slice(0, -1);
    const ninetyDaysAgo = new Date(now.getTime() - NINETY_DAYS_MS);
    const windowPoints = pointsExcludingLast.filter((p) => p.recordedAt >= ninetyDaysAgo);
    if (windowPoints.length > 0) {
      min90 = Math.min(...windowPoints.map((p) => p.priceAmount));
    }
  }

  let targetPrice: number | null = null;
  if (row.alert !== null && row.alert.status === 'ACTIVE' && row.alert.targetPriceCurrency === currency) {
    targetPrice = row.alert.targetPriceAmount;
  }

  return { bookId: book.id, title: book.title, price, currency, store, prevPrice, min90, targetPrice };
}

/** The verdict for a book that qualifies for the section. */
export interface BuyingVerdict {
  readonly reason: BuyingReason;
  readonly savingsAmount: number;
}

/**
 * Decide the single buying reason for one book's signals, or `null` when none
 * of the 3 signals fire (book stays in the ordinary wishlist).
 *
 * Order (exact): TARGET_REACHED (`price <= targetPrice`) → LOWEST_90_DAYS
 * (`price <= min90`) → PRICE_DROPPED (`price < prevPrice`, strict). No
 * fallback reason.
 */
export function evaluateSignals(signals: BuyingSignals): BuyingVerdict | null {
  const { price, prevPrice, targetPrice, min90 } = signals;

  if (targetPrice != null && price <= targetPrice) {
    return { reason: 'TARGET_REACHED', savingsAmount: Math.max(0, (prevPrice ?? targetPrice) - price) };
  }
  if (min90 != null && price <= min90) {
    return { reason: 'LOWEST_90_DAYS', savingsAmount: Math.max(0, (prevPrice ?? min90) - price) };
  }
  if (prevPrice != null && price < prevPrice) {
    return { reason: 'PRICE_DROPPED', savingsAmount: Math.max(0, prevPrice - price) };
  }
  return null;
}

/**
 * Evaluate the whole wishlist and return ONLY qualifying books, each with
 * exactly one reason + savingsAmount, sorted by reason priority (asc), then
 * savingsAmount (desc), then title (`localeCompare('uk')`) — title is
 * discarded from the returned DTOs after sorting.
 *
 * No limit, no padding — length may be 0.
 */
export function evaluateBuyingOpportunities(
  rows: readonly BuyingOpportunityWishlistRow[],
  now: Date,
): BuyingOpportunityItemDto[] {
  const evaluated: Array<BuyingOpportunityItemDto & { readonly title: string }> = [];

  for (const row of rows) {
    const signals = extractSignals(row, now);
    if (signals === null) continue;

    const verdict = evaluateSignals(signals);
    if (verdict === null) continue;

    evaluated.push({
      bookId: signals.bookId,
      title: signals.title,
      reason: verdict.reason,
      savingsAmount: verdict.savingsAmount,
      price: signals.price,
      prevPrice: signals.prevPrice,
      currency: signals.currency,
      store: signals.store,
    });
  }

  evaluated.sort((a, b) => {
    const rankDiff = REASON_RANK[a.reason] - REASON_RANK[b.reason];
    if (rankDiff !== 0) return rankDiff;
    if (b.savingsAmount !== a.savingsAmount) return b.savingsAmount - a.savingsAmount;
    return a.title.localeCompare(b.title, 'uk');
  });

  return evaluated.map((evaluatedItem): BuyingOpportunityItemDto => ({
    bookId: evaluatedItem.bookId,
    reason: evaluatedItem.reason,
    savingsAmount: evaluatedItem.savingsAmount,
    price: evaluatedItem.price,
    prevPrice: evaluatedItem.prevPrice,
    currency: evaluatedItem.currency,
    store: evaluatedItem.store,
  }));
}
