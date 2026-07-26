import { describe, it, expect } from 'vitest';
import { resolveAlertPolicy, type ResolverContext } from '../resolver.js';
import type { GoodPriceResult } from '../good-price.js';
import { formatUah } from '../../../alerts/templates.js';

const UNAVAILABLE_GOOD_PRICE: GoodPriceResult = {
  available: false,
  reason: 'PENDING_CALIBRATION',
};

function ctx(overrides: Partial<ResolverContext>): ResolverContext {
  return {
    canonicalPrice: 34900,
    currency: 'UAH',
    goodPrice: UNAVAILABLE_GOOD_PRICE,
    requestedThreshold: null,
    ...overrides,
  };
}

describe('resolveAlertPolicy — any-drop', () => {
  it('happy path: freezes the canonical price as threshold + baseline', () => {
    const result = resolveAlertPolicy('any-drop', ctx({ canonicalPrice: 20000 }));
    expect(result).toEqual({
      ok: true,
      policy: {
        threshold: 20000,
        baseline: 20000,
        rearmPolicy: 'follow-down',
        thresholdBasis: 'current-price',
        thresholdProof: 'Щойно ціна впаде',
      },
    });
  });

  it('a requested threshold is rejected — the server owns the number', () => {
    const result = resolveAlertPolicy('any-drop', ctx({ requestedThreshold: 100 }));
    expect(result).toEqual({ ok: false, reason: 'THRESHOLD_NOT_ALLOWED' });
  });

  it('no canonical price (nothing in stock) → NO_CANONICAL_PRICE', () => {
    const result = resolveAlertPolicy('any-drop', ctx({ canonicalPrice: null }));
    expect(result).toEqual({ ok: false, reason: 'NO_CANONICAL_PRICE' });
  });
});

describe('resolveAlertPolicy — good-price', () => {
  it('unavailable (any reason) → INSUFFICIENT_HISTORY', () => {
    const result = resolveAlertPolicy(
      'good-price',
      ctx({ goodPrice: { available: false, reason: 'PENDING_CALIBRATION' } }),
    );
    expect(result).toEqual({ ok: false, reason: 'INSUFFICIENT_HISTORY' });
  });

  it('unavailable with the other reason also → INSUFFICIENT_HISTORY', () => {
    const result = resolveAlertPolicy(
      'good-price',
      ctx({ goodPrice: { available: false, reason: 'INSUFFICIENT_HISTORY' } }),
    );
    expect(result).toEqual({ ok: false, reason: 'INSUFFICIENT_HISTORY' });
  });

  it('a requested threshold is rejected — the server owns the number', () => {
    const result = resolveAlertPolicy('good-price', ctx({ requestedThreshold: 100 }));
    expect(result).toEqual({ ok: false, reason: 'THRESHOLD_NOT_ALLOWED' });
  });

  it('happy path (fabricated available result): mirrors the suggestion exactly', () => {
    // resolveGoodPrice() never actually returns `available: true` today (the
    // formula is not calibrated yet — good-price.ts), but the resolver itself
    // doesn't know or care where its ctx.goodPrice came from, so we can still
    // exercise this branch by constructing the result by hand.
    const goodPrice: GoodPriceResult = {
      available: true,
      suggestion: { amount: 18000, basis: 'p25-90d', proof: 'Нижче за 90% історичних цін' },
    };
    const result = resolveAlertPolicy('good-price', ctx({ goodPrice }));
    expect(result).toEqual({
      ok: true,
      policy: {
        threshold: 18000,
        baseline: null,
        rearmPolicy: 'static',
        thresholdBasis: 'p25-90d',
        thresholdProof: 'Нижче за 90% історичних цін',
      },
    });
  });
});

describe('resolveAlertPolicy — my-price', () => {
  it('no requested threshold → THRESHOLD_REQUIRED', () => {
    const result = resolveAlertPolicy('my-price', ctx({ requestedThreshold: null }));
    expect(result).toEqual({ ok: false, reason: 'THRESHOLD_REQUIRED' });
  });

  it('threshold at the current price → THRESHOLD_NOT_BELOW_CURRENT', () => {
    const result = resolveAlertPolicy(
      'my-price',
      ctx({ canonicalPrice: 20000, requestedThreshold: 20000 }),
    );
    expect(result).toEqual({ ok: false, reason: 'THRESHOLD_NOT_BELOW_CURRENT' });
  });

  it('threshold above the current price → THRESHOLD_NOT_BELOW_CURRENT', () => {
    const result = resolveAlertPolicy(
      'my-price',
      ctx({ canonicalPrice: 20000, requestedThreshold: 25000 }),
    );
    expect(result).toEqual({ ok: false, reason: 'THRESHOLD_NOT_BELOW_CURRENT' });
  });

  it('threshold below the current price → happy path with real formatUah proof', () => {
    const threshold = 19999;
    const result = resolveAlertPolicy(
      'my-price',
      ctx({ canonicalPrice: 20000, requestedThreshold: threshold }),
    );
    expect(result).toEqual({
      ok: true,
      policy: {
        threshold,
        baseline: null,
        rearmPolicy: 'static',
        thresholdBasis: 'user-supplied',
        thresholdProof: `Поріг — нижче ${formatUah(threshold)}`,
      },
    });
  });

  // Easy to misread as a missing case: a null canonical price (nothing in
  // stock) does NOT block my-price. The `>=` current-price guard in the
  // resolver is itself guarded by `ctx.canonicalPrice != null`, so out-of-stock
  // books can still get a my-price alert armed for whenever they return.
  it('canonical price null with a requested threshold → still happy path (no current-price gate)', () => {
    const result = resolveAlertPolicy(
      'my-price',
      ctx({ canonicalPrice: null, requestedThreshold: 15000 }),
    );
    expect(result).toEqual({
      ok: true,
      policy: {
        threshold: 15000,
        baseline: null,
        rearmPolicy: 'static',
        thresholdBasis: 'user-supplied',
        thresholdProof: `Поріг — нижче ${formatUah(15000)}`,
      },
    });
  });
});
