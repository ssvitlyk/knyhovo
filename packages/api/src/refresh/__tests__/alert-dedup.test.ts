import { describe, it, expect } from 'vitest';
import {
  evaluateAlertNotification,
  evaluateBackInStockNotification,
  priceDropDedupKey,
  backInStockDedupKey,
  type AlertNotificationState,
  type AlertNotificationDecision,
} from '../alert-dedup.js';
import { isSignificantDrop, applyRearm, type SignificanceConfig } from '../../wishlist/alert/policy.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-22T10:00:00.000Z');
const TARGET = 10000; // 100 UAH in копійки

/** Significance config that never interferes — used for the pre-existing (static-policy) cases. */
const NO_SIGNIFICANCE: SignificanceConfig = { minDropAbs: 0, minDropPct: 0 };

function makeState(
  overrides: Partial<AlertNotificationState> = {},
): AlertNotificationState {
  return {
    policy: { threshold: TARGET, baseline: null, rearmPolicy: 'static' },
    lastNotifiedAt: null,
    lastNotifiedPriceAmount: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Table-driven tests
// ---------------------------------------------------------------------------

describe('evaluateAlertNotification', () => {
  // ------------------------------------------------------------------
  // Notify cases
  // ------------------------------------------------------------------

  it('first drop to exactly target => notify', () => {
    const state = makeState();
    const decision = evaluateAlertNotification(state, TARGET, NOW, NO_SIGNIFICANCE);
    expect(decision.action).toBe('notify');
    if (decision.action === 'notify') {
      expect(decision.lastNotifiedAt).toEqual(NOW);
      expect(decision.lastNotifiedPriceAmount).toBe(TARGET);
    }
  });

  it('first drop below target => notify', () => {
    const state = makeState();
    const decision = evaluateAlertNotification(state, TARGET - 500, NOW, NO_SIGNIFICANCE);
    expect(decision.action).toBe('notify');
    if (decision.action === 'notify') {
      expect(decision.lastNotifiedPriceAmount).toBe(TARGET - 500);
    }
  });

  it('strictly lower price on second run => notify again', () => {
    const state = makeState({
      lastNotifiedAt: new Date('2026-06-21T00:00:00.000Z'),
      lastNotifiedPriceAmount: TARGET - 200,
    });
    const newLow = TARGET - 500; // strictly lower than last notified
    const decision = evaluateAlertNotification(state, newLow, NOW, NO_SIGNIFICANCE);
    expect(decision.action).toBe('notify');
    if (decision.action === 'notify') {
      expect(decision.lastNotifiedPriceAmount).toBe(newLow);
    }
  });

  it('lastNotifiedPriceAmount null but lastNotifiedAt set => treats as "no prior price" => notify', () => {
    // Partial marker: only date was set (edge case)
    const state = makeState({
      lastNotifiedAt: new Date('2026-06-21T00:00:00.000Z'),
      lastNotifiedPriceAmount: null,
    });
    const decision = evaluateAlertNotification(state, TARGET - 100, NOW, NO_SIGNIFICANCE);
    expect(decision.action).toBe('notify');
  });

  // ------------------------------------------------------------------
  // None cases
  // ------------------------------------------------------------------

  it('same low price next run => none (dedup suppresses)', () => {
    const state = makeState({
      lastNotifiedAt: NOW,
      lastNotifiedPriceAmount: TARGET - 200,
    });
    const decision = evaluateAlertNotification(state, TARGET - 200, NOW, NO_SIGNIFICANCE);
    expect(decision.action).toBe('none');
  });

  it('price drops but still > lastNotifiedPriceAmount and <= target => none', () => {
    // Was notified at 8000; now at 9000 which is still <= 10000 target
    // but NOT strictly lower than 8000.
    const state = makeState({
      lastNotifiedAt: new Date('2026-06-20T00:00:00.000Z'),
      lastNotifiedPriceAmount: 8000,
    });
    const decision = evaluateAlertNotification(state, 9000, NOW, NO_SIGNIFICANCE);
    // 9000 <= 10000 (target) but 9000 > 8000 (lastNotified) => none
    expect(decision.action).toBe('none');
  });

  it('no in-stock offer and no marker => none', () => {
    const state = makeState();
    const decision = evaluateAlertNotification(state, null, NOW, NO_SIGNIFICANCE);
    expect(decision.action).toBe('none');
  });

  it('lowest exactly == lastNotifiedPriceAmount => none (strict < boundary)', () => {
    const state = makeState({
      lastNotifiedAt: NOW,
      lastNotifiedPriceAmount: TARGET,
    });
    const decision = evaluateAlertNotification(state, TARGET, NOW, NO_SIGNIFICANCE);
    expect(decision.action).toBe('none');
  });

  // ------------------------------------------------------------------
  // Reset cases
  // ------------------------------------------------------------------

  it('price rises above target with marker set => reset', () => {
    const state = makeState({
      lastNotifiedAt: new Date('2026-06-21T00:00:00.000Z'),
      lastNotifiedPriceAmount: TARGET - 500,
    });
    const decision = evaluateAlertNotification(state, TARGET + 1000, NOW, NO_SIGNIFICANCE);
    expect(decision.action).toBe('reset');
  });

  it('no in-stock offer with marker set => reset', () => {
    const state = makeState({
      lastNotifiedAt: new Date('2026-06-21T00:00:00.000Z'),
      lastNotifiedPriceAmount: TARGET - 200,
    });
    const decision = evaluateAlertNotification(state, null, NOW, NO_SIGNIFICANCE);
    expect(decision.action).toBe('reset');
  });

  it('price > target with only lastNotifiedAt set (no price) => reset', () => {
    const state = makeState({
      lastNotifiedAt: new Date('2026-06-21T00:00:00.000Z'),
      lastNotifiedPriceAmount: null,
    });
    const decision = evaluateAlertNotification(state, TARGET + 500, NOW, NO_SIGNIFICANCE);
    expect(decision.action).toBe('reset');
  });

  it('price > target with only lastNotifiedPriceAmount set (no date) => reset', () => {
    const state = makeState({
      lastNotifiedAt: null,
      lastNotifiedPriceAmount: TARGET - 100,
    });
    const decision = evaluateAlertNotification(state, TARGET + 1, NOW, NO_SIGNIFICANCE);
    expect(decision.action).toBe('reset');
  });

  // ------------------------------------------------------------------
  // Boundary: lowest exactly == target
  // ------------------------------------------------------------------

  it('lowest exactly == target and no marker => notify (<= boundary)', () => {
    const state = makeState();
    const decision = evaluateAlertNotification(state, TARGET, NOW, NO_SIGNIFICANCE);
    expect(decision.action).toBe('notify');
  });

  // ------------------------------------------------------------------
  // notify shape
  // ------------------------------------------------------------------

  it('notify decision carries correct lastNotifiedAt and lastNotifiedPriceAmount', () => {
    const state = makeState();
    const low = TARGET - 300;
    const decision = evaluateAlertNotification(state, low, NOW, NO_SIGNIFICANCE) as Extract<
      AlertNotificationDecision,
      { action: 'notify' }
    >;
    expect(decision.action).toBe('notify');
    expect(decision.lastNotifiedAt).toBe(NOW);
    expect(decision.lastNotifiedPriceAmount).toBe(low);
  });
});

// ---------------------------------------------------------------------------
// evaluateAlertNotification — significance gating for follow-down policies
// (notifications-model-v2 §9.2)
// ---------------------------------------------------------------------------

describe('evaluateAlertNotification (follow-down significance)', () => {
  it('suppresses an insignificant drop (below minDropAbs) — threshold reached but no notify', () => {
    const state = makeState({
      policy: { threshold: TARGET, baseline: TARGET, rearmPolicy: 'follow-down' },
    });
    // Drop of 500 kopiyky, below the 1000 minDropAbs gate.
    const decision = evaluateAlertNotification(state, TARGET - 500, NOW, {
      minDropAbs: 1000,
      minDropPct: 0,
    });
    expect(decision.action).toBe('none');
  });

  it('fires once the drop clears both minDropAbs and minDropPct', () => {
    const state = makeState({
      policy: { threshold: TARGET, baseline: TARGET, rearmPolicy: 'follow-down' },
    });
    // Drop of 1500 kopiyky (15% of baseline) clears minDropAbs=1000 and minDropPct=2.
    const decision = evaluateAlertNotification(state, TARGET - 1500, NOW, {
      minDropAbs: 1000,
      minDropPct: 2,
    });
    expect(decision.action).toBe('notify');
    if (decision.action === 'notify') {
      expect(decision.lastNotifiedPriceAmount).toBe(TARGET - 1500);
    }
  });

  it('minDropPct gates independently: a large absolute drop on an expensive book can still be insignificant', () => {
    const baseline = 1_000_000; // 10 000 UAH
    const state = makeState({
      policy: { threshold: baseline, baseline, rearmPolicy: 'follow-down' },
    });
    // Absolute drop of 10 000 kopiyky is large in isolation, but only 1% of baseline.
    const decision = evaluateAlertNotification(state, baseline - 10_000, NOW, {
      minDropAbs: 0,
      minDropPct: 5,
    });
    expect(decision.action).toBe('none');
  });

  it('minDropPct gates independently: a small absolute drop on a cheap book can still be significant', () => {
    const baseline = 1000; // 10 UAH
    const state = makeState({
      policy: { threshold: baseline, baseline, rearmPolicy: 'follow-down' },
    });
    // Absolute drop of only 100 kopiyky, but 10% of baseline clears minDropPct=5.
    const decision = evaluateAlertNotification(state, baseline - 100, NOW, {
      minDropAbs: 0,
      minDropPct: 5,
    });
    expect(decision.action).toBe('notify');
  });

  it('a follow-down policy with baseline=null treats any threshold-reaching price as significant', () => {
    // A book that was out of stock when the alert was created (baseline never observed)
    // must not be stranded by the significance gate.
    const state = makeState({
      policy: { threshold: TARGET, baseline: null, rearmPolicy: 'follow-down' },
    });
    const decision = evaluateAlertNotification(state, TARGET - 1, NOW, {
      minDropAbs: 5000,
      minDropPct: 50,
    });
    expect(decision.action).toBe('notify');
  });

  it('a significant-but-already-notified same price still returns none (marker wins)', () => {
    const state = makeState({
      policy: { threshold: TARGET, baseline: TARGET, rearmPolicy: 'follow-down' },
      lastNotifiedAt: new Date('2026-06-21T00:00:00.000Z'),
      lastNotifiedPriceAmount: TARGET - 2000,
    });
    // Same price as last notified: the drop from baseline is significant, but the
    // marker already covers this exact price, so no new email is due.
    const decision = evaluateAlertNotification(state, TARGET - 2000, NOW, {
      minDropAbs: 1000,
      minDropPct: 2,
    });
    expect(decision.action).toBe('none');
  });
});

// ---------------------------------------------------------------------------
// isSignificantDrop / applyRearm — direct unit tests
// ---------------------------------------------------------------------------

describe('isSignificantDrop', () => {
  it('null baseline is always significant (nothing to compare against yet)', () => {
    expect(isSignificantDrop(9999, null, { minDropAbs: 5000, minDropPct: 50 })).toBe(true);
  });

  it('a non-positive drop (price >= baseline) is never significant', () => {
    expect(isSignificantDrop(10000, 10000, NO_SIGNIFICANCE)).toBe(false);
    expect(isSignificantDrop(10500, 10000, NO_SIGNIFICANCE)).toBe(false);
  });

  it('minDropAbs=0 disables the absolute-drop check', () => {
    expect(isSignificantDrop(9999, 10000, { minDropAbs: 0, minDropPct: 0 })).toBe(true);
  });

  it('minDropPct=0 disables the percentage-drop check', () => {
    expect(isSignificantDrop(9999, 10000, { minDropAbs: 0, minDropPct: 0 })).toBe(true);
    // Large baseline, tiny drop: passes only because minDropPct is disabled.
    expect(isSignificantDrop(999_999, 1_000_000, { minDropAbs: 0, minDropPct: 0 })).toBe(true);
  });

  it('both thresholds must be exceeded when both are enabled', () => {
    // Clears minDropAbs but not minDropPct.
    expect(isSignificantDrop(989_000, 1_000_000, { minDropAbs: 1000, minDropPct: 5 })).toBe(false);
    // Clears both.
    expect(isSignificantDrop(940_000, 1_000_000, { minDropAbs: 1000, minDropPct: 5 })).toBe(true);
  });
});

describe('applyRearm', () => {
  it('returns null for a static policy (nothing to persist)', () => {
    expect(applyRearm({ rearmPolicy: 'static' }, 7000)).toBeNull();
  });

  it('returns {threshold, baseline} both equal to the notified price for a follow-down policy', () => {
    expect(applyRearm({ rearmPolicy: 'follow-down' }, 7000)).toEqual({
      threshold: 7000,
      baseline: 7000,
    });
  });
});

// ---------------------------------------------------------------------------
// Back-in-stock (W4b)
// ---------------------------------------------------------------------------

describe('evaluateBackInStockNotification', () => {
  it('first observation while in stock records baseline, never notifies', () => {
    expect(evaluateBackInStockNotification({ lastObservedAvailability: null }, true)).toEqual({
      action: 'observe',
      observed: 'IN_STOCK',
    });
  });

  it('first observation while out of stock records baseline', () => {
    expect(evaluateBackInStockNotification({ lastObservedAvailability: null }, false)).toEqual({
      action: 'observe',
      observed: 'OUT_OF_STOCK',
    });
  });

  it('notifies on a genuine OUT→IN transition and advances marker to IN_STOCK', () => {
    expect(
      evaluateBackInStockNotification({ lastObservedAvailability: 'OUT_OF_STOCK' }, true),
    ).toEqual({ action: 'notify', observed: 'IN_STOCK' });
  });

  it('does not re-notify while the book stays in stock', () => {
    expect(
      evaluateBackInStockNotification({ lastObservedAvailability: 'IN_STOCK' }, true),
    ).toEqual({ action: 'none' });
  });

  it('records OUT_OF_STOCK (re-arm) when an in-stock book goes out of stock', () => {
    expect(
      evaluateBackInStockNotification({ lastObservedAvailability: 'IN_STOCK' }, false),
    ).toEqual({ action: 'observe', observed: 'OUT_OF_STOCK' });
  });

  it('treats UNKNOWN baseline as not-in-stock → notifies on transition into stock', () => {
    expect(
      evaluateBackInStockNotification({ lastObservedAvailability: 'UNKNOWN' }, true),
    ).toEqual({ action: 'notify', observed: 'IN_STOCK' });
  });

  it('no-op when out of stock and already observed out of stock', () => {
    expect(
      evaluateBackInStockNotification({ lastObservedAvailability: 'OUT_OF_STOCK' }, false),
    ).toEqual({ action: 'none' });
  });
});

// ---------------------------------------------------------------------------
// Dedup keys
// ---------------------------------------------------------------------------

describe('dedup keys', () => {
  it('priceDropDedupKey embeds alertId and price; differs per price', () => {
    expect(priceDropDedupKey('a1', 7000)).toBe('a1:price:7000');
    expect(priceDropDedupKey('a1', 6500)).toBe('a1:price:6500');
    expect(priceDropDedupKey('a1', 7000)).toBe(priceDropDedupKey('a1', 7000));
  });

  it('backInStockDedupKey embeds alertId and run timestamp; differs per run', () => {
    const t1 = new Date('2026-06-29T14:00:00.000Z');
    const t2 = new Date('2026-06-30T14:00:00.000Z');
    expect(backInStockDedupKey('a1', t1)).toBe('a1:stock:2026-06-29T14:00:00.000Z');
    expect(backInStockDedupKey('a1', t1)).toBe(backInStockDedupKey('a1', t1));
    expect(backInStockDedupKey('a1', t2)).not.toBe(backInStockDedupKey('a1', t1));
  });
});
