import type { Provider, Availability } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertEventType =
  | 'PRICE_DROP'
  | 'BACK_IN_STOCK'
  | 'OUT_OF_STOCK'
  | 'LISTING_GONE'
  | 'LISTING_STALE'; // reserved for time-based staleness signal (W10.4); not emitted by detectAlertEvents

export interface AlertEvent {
  readonly type: AlertEventType;
  readonly provider: Provider;
  readonly providerListingId: string;
  readonly canonicalBookId: string;
  readonly previousPriceAmount: number | null;
  readonly currentPriceAmount: number | null;
  readonly previousAvailability: Availability;
  readonly currentAvailability: Availability;
  readonly detectedAt: Date;
}

/** Previous (stored) state of a refresh target. */
export interface TargetPreviousState {
  readonly provider: Provider;
  readonly providerListingId: string;
  readonly canonicalBookId: string;
  readonly priceAmount: number;
  readonly availability: Availability;
}

/** Result of re-fetching a single product page. */
export type RefreshedListingState =
  | { readonly kind: 'fetched'; readonly priceAmount: number | null; readonly availability: Availability }
  | { readonly kind: 'gone' }; // 404 / fetch failure — graceful, non-destructive

// ---------------------------------------------------------------------------
// Pure transition detector — W10 PRD section 5 transition matrix
// ---------------------------------------------------------------------------

/**
 * Detect alert-worthy events by comparing a target's stored state against the
 * freshly fetched page state.
 *
 * Transition matrix (W10 PRD §5):
 * - gone                              → LISTING_GONE (non-destructive: preserves prior state)
 * - IN_STOCK  → OUT_OF_STOCK          → OUT_OF_STOCK
 * - !IN_STOCK → IN_STOCK              → BACK_IN_STOCK
 * - priceAmount drops, IN_STOCK both  → PRICE_DROP
 * - null current price               → never PRICE_DROP; no overwrite
 * - same price + same availability   → [] (no event)
 *
 * This function is pure: no I/O, no side effects.
 */
export function detectAlertEvents(
  previous: TargetPreviousState,
  refreshed: RefreshedListingState,
  detectedAt: Date,
): AlertEvent[] {
  const base = {
    provider: previous.provider,
    providerListingId: previous.providerListingId,
    canonicalBookId: previous.canonicalBookId,
    detectedAt,
  };

  if (refreshed.kind === 'gone') {
    // Non-destructive: report prior state rather than nulling it.
    return [
      {
        ...base,
        type: 'LISTING_GONE',
        previousPriceAmount: previous.priceAmount,
        currentPriceAmount: previous.priceAmount,
        previousAvailability: previous.availability,
        currentAvailability: previous.availability,
      },
    ];
  }

  // refreshed.kind === 'fetched'
  const { availability: currentAvailability, priceAmount: currentPriceAmount } = refreshed;

  const events: AlertEvent[] = [];

  // Availability transition.
  if (previous.availability === 'IN_STOCK' && currentAvailability === 'OUT_OF_STOCK') {
    events.push({
      ...base,
      type: 'OUT_OF_STOCK',
      previousPriceAmount: previous.priceAmount,
      currentPriceAmount,
      previousAvailability: previous.availability,
      currentAvailability,
    });
  } else if (previous.availability !== 'IN_STOCK' && currentAvailability === 'IN_STOCK') {
    events.push({
      ...base,
      type: 'BACK_IN_STOCK',
      previousPriceAmount: previous.priceAmount,
      currentPriceAmount,
      previousAvailability: previous.availability,
      currentAvailability,
    });
  }

  // Price drop: only when in stock and current price is known and lower.
  // Null current price must NOT be treated as a drop and must NOT overwrite
  // the old price — out-of-stock is conveyed via availability transition only.
  if (
    currentPriceAmount != null &&
    currentPriceAmount < previous.priceAmount &&
    currentAvailability === 'IN_STOCK'
  ) {
    events.push({
      ...base,
      type: 'PRICE_DROP',
      previousPriceAmount: previous.priceAmount,
      currentPriceAmount,
      previousAvailability: previous.availability,
      currentAvailability,
    });
  }

  return events;
}
