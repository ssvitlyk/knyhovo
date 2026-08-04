import { describe, it, expect } from 'vitest';
import { buildAlertPolicyPreview } from '../alert-preview.js';
import type { PriceHistoryListingRow } from '../repository.js';

const NOW = new Date('2026-04-01T00:00:00.000Z');
const CURRENCY = 'UAH';

function makeListing(overrides: Partial<PriceHistoryListingRow> = {}): PriceHistoryListingRow {
  return {
    id: 'listing-a',
    priceAmount: 34900,
    priceCurrency: 'UAH',
    availability: 'IN_STOCK',
    priceHistory: [],
    ...overrides,
  };
}

describe('buildAlertPolicyPreview', () => {
  it('always returns exactly 3 entries, in order any-drop, good-price, my-price', () => {
    const preview = buildAlertPolicyPreview([makeListing()], CURRENCY, NOW);
    expect(preview.map((e) => e.mode)).toEqual(['any-drop', 'good-price', 'my-price']);
    expect(preview).toHaveLength(3);
  });

  describe('with an IN_STOCK listing at price P', () => {
    const P = 34900;
    const preview = buildAlertPolicyPreview(
      [makeListing({ priceAmount: P, availability: 'IN_STOCK' })],
      CURRENCY,
      NOW,
    );

    it('any-drop is available with threshold = P and the fixed proof', () => {
      expect(preview[0]).toEqual({
        mode: 'any-drop',
        available: true,
        threshold: { amount: P, currency: CURRENCY },
        proof: 'Щойно ціна впаде',
        reason: null,
      });
    });

    it('good-price is unavailable and NEVER restates the current price as a threshold', () => {
      const goodPrice = preview[1]!;
      expect(goodPrice.mode).toBe('good-price');
      expect(goodPrice.available).toBe(false);
      // The core defect-prevention assertion: threshold must be null, never {amount:P,...}.
      expect(goodPrice.threshold).toBeNull();
      expect(goodPrice.threshold).not.toEqual({ amount: P, currency: CURRENCY });
      expect(goodPrice.proof).toBeNull();
      expect(goodPrice.reason).toBe('Збираємо історію цін');
    });

    it('good-price stays unavailable/threshold-null regardless of price-history fixture content', () => {
      const withHistory = buildAlertPolicyPreview(
        [
          makeListing({
            priceAmount: P,
            availability: 'IN_STOCK',
            priceHistory: [
              { priceAmount: 50000, priceCurrency: 'UAH', availability: 'IN_STOCK', recordedAt: new Date('2026-01-01') },
              { priceAmount: 10000, priceCurrency: 'UAH', availability: 'IN_STOCK', recordedAt: new Date('2026-03-01') },
            ],
          }),
        ],
        CURRENCY,
        NOW,
      );
      expect(withHistory[1]).toEqual({
        mode: 'good-price',
        available: false,
        threshold: null,
        proof: null,
        reason: 'Збираємо історію цін',
      });
    });

    it('my-price is available with no threshold/proof surfaced', () => {
      expect(preview[2]).toEqual({
        mode: 'my-price',
        available: true,
        threshold: null,
        proof: null,
        reason: null,
      });
    });
  });

  describe('no in-stock listing at all', () => {
    it('all OUT_OF_STOCK: any-drop unavailable, good-price unavailable, my-price still available', () => {
      const preview = buildAlertPolicyPreview(
        [makeListing({ priceAmount: 34900, availability: 'OUT_OF_STOCK' })],
        CURRENCY,
        NOW,
      );
      expect(preview[0]).toEqual({
        mode: 'any-drop',
        available: false,
        threshold: null,
        proof: null,
        reason: 'Немає в наявності',
      });
      expect(preview[1]).toEqual({
        mode: 'good-price',
        available: false,
        threshold: null,
        proof: null,
        reason: 'Збираємо історію цін',
      });
      // Surprising but correct: a null canonical price does not block my-price
      // (the resolver's `>=` current-price guard only fires when canonicalPrice
      // is non-null — see resolver.ts `my-price` branch).
      expect(preview[2]).toEqual({
        mode: 'my-price',
        available: true,
        threshold: null,
        proof: null,
        reason: null,
      });
    });

    it('empty listings array: same shape as all-OUT_OF_STOCK', () => {
      const preview = buildAlertPolicyPreview([], CURRENCY, NOW);
      expect(preview[0]!.available).toBe(false);
      expect(preview[0]!.reason).toBe('Немає в наявності');
      expect(preview[1]!.available).toBe(false);
      expect(preview[2]!.available).toBe(true);
      expect(preview[2]!.threshold).toBeNull();
    });
  });

  // Period-independence: `buildAlertPolicyPreview` has no `period` parameter at
  // all — its signature is fixed to (listings, currency, now), so there is no
  // way for a caller to make it branch on a chart period. That is a structural
  // guarantee rather than something provable by calling it twice with the same
  // arguments (which would be a tautology). The real cross-period proof — that
  // the SERVICE layer's `?period=30d` vs `?period=all` never changes the
  // resulting alertPolicyPreview even though `points` legitimately differs — is
  // covered in `../__tests__/service.test.ts`
  // ("alertPolicyPreview is identical across ?period=30d and ?period=all").
  it('documents period-independence as structural: the window is fixed, not derived from a period arg', () => {
    // Points both inside and outside the fixed 180-day window are gathered the
    // same way regardless of any external "period" concept — there simply is no
    // period concept at this layer.
    const withOldAndRecentHistory = buildAlertPolicyPreview(
      [
        makeListing({
          priceHistory: [
            { priceAmount: 60000, priceCurrency: 'UAH', availability: 'IN_STOCK', recordedAt: new Date('2020-01-01') }, // outside 180d
            { priceAmount: 30000, priceCurrency: 'UAH', availability: 'IN_STOCK', recordedAt: new Date('2026-03-20') }, // inside 180d
          ],
        }),
      ],
      CURRENCY,
      NOW,
    );
    // good-price is still unavailable regardless — no formula reads the sample yet.
    expect(withOldAndRecentHistory[1]!.available).toBe(false);
  });
});
