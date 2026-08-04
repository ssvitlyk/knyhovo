import type { AlertMode } from '@knyhovo/shared';
import { resolveAlertPolicy } from '../../wishlist/alert/resolver.js';
import { resolveGoodPrice } from '../../wishlist/alert/good-price.js';
import { canonicalPriceAmount, type PricedListing } from '../../pricing/canonical-price.js';
import type { AlertModePreviewDto } from './dto.js';
import type { PriceHistoryListingRow } from './repository.js';

/**
 * Build the per-mode alert preview for a book (notifications-model-v2 §10).
 *
 * The preview runs the REAL resolver over the REAL canonical price, so what the
 * configurator shows and what `PUT .../alert` stores can only differ if the price
 * itself moved in between — never because two code paths disagree.
 *
 * Deliberately independent of the chart's `?period`: the window below is fixed, so
 * switching the chart to 30 days cannot change the advice.
 */

/** Fixed evaluation window for the good-price sample, in days. */
export const ALERT_PREVIEW_WINDOW_DAYS = 180;

/** Human explanation for each unavailable mode, shown verbatim by the UI. */
const UNAVAILABLE_REASON: Record<string, string> = {
  NO_CANONICAL_PRICE: 'Немає в наявності',
  INSUFFICIENT_HISTORY: 'Збираємо історію цін',
  THRESHOLD_REQUIRED: 'Вкажіть свою ціну',
  THRESHOLD_NOT_ALLOWED: 'Поріг визначає Knyhovo',
  THRESHOLD_NOT_BELOW_CURRENT: 'Ціна має бути нижчою за поточну',
};

const MODES: readonly AlertMode[] = ['any-drop', 'good-price', 'my-price'];

export function buildAlertPolicyPreview(
  listings: readonly PriceHistoryListingRow[],
  currency: string,
  now: Date,
): AlertModePreviewDto[] {
  const canonicalPrice = canonicalPriceAmount(listings as readonly PricedListing[]);

  const since = new Date(now.getTime() - ALERT_PREVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const amounts = listings.flatMap((listing) =>
    listing.priceHistory.filter((p) => p.recordedAt >= since).map((p) => p.priceAmount),
  );

  const goodPrice = resolveGoodPrice({ amounts, canonicalPrice });

  return MODES.map((mode): AlertModePreviewDto => {
    // `my-price` is previewed without a number: the user supplies it, and only
    // then can it be validated. It is available whenever there is a price to be
    // below at all.
    const resolved = resolveAlertPolicy(mode, {
      canonicalPrice,
      currency: 'UAH',
      goodPrice,
      requestedThreshold: mode === 'my-price' ? (canonicalPrice ?? 1) - 1 : null,
    });

    if (!resolved.ok) {
      return {
        mode,
        available: false,
        threshold: null,
        proof: null,
        reason: UNAVAILABLE_REASON[resolved.reason] ?? 'Недоступно',
      };
    }

    // The probe threshold above is never shown for my-price — the user's own
    // number replaces it — so the preview reports availability only.
    if (mode === 'my-price') {
      return { mode, available: true, threshold: null, proof: null, reason: null };
    }

    return {
      mode,
      available: true,
      threshold: { amount: resolved.policy.threshold, currency },
      proof: resolved.policy.thresholdProof,
      reason: null,
    };
  });
}
