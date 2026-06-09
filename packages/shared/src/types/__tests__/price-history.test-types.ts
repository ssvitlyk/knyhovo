/**
 * Compile-time checks for PriceHistoryPoint append-only semantics.
 */
import type { PriceHistoryPoint } from '../price-history.js';
import type { PriceHistoryPointId, ProviderListingId } from '../ids.js';

const _point: PriceHistoryPoint = {
  id: 'ph-1' as PriceHistoryPointId,
  providerListingId: 'pl-1' as ProviderListingId,
  price: { amount: 34999, currency: 'UAH' },
  recordedAt: '2026-06-08T12:00:00.000Z',
};

// All fields are readonly — mutation attempts must fail
// @ts-expect-error cannot assign to readonly property
_point.id = 'ph-2' as PriceHistoryPointId;
// @ts-expect-error cannot assign to readonly property
_point.price = { amount: 0, currency: 'UAH' };
// @ts-expect-error cannot assign to readonly property
_point.recordedAt = '2026-01-01T00:00:00.000Z';

export {};
