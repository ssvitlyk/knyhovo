import { describe, it, expect } from 'vitest';
import {
  evaluateAlertNotification,
  evaluateBackInStockNotification,
  priceDropDedupKey,
  backInStockDedupKey,
  type AlertNotificationState,
  type AlertNotificationDecision,
} from '../alert-dedup.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-22T10:00:00.000Z');
const TARGET = 10000; // 100 UAH in копійки

function makeState(
  overrides: Partial<AlertNotificationState> = {},
): AlertNotificationState {
  return {
    targetPriceAmount: TARGET,
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
    const decision = evaluateAlertNotification(state, TARGET, NOW);
    expect(decision.action).toBe('notify');
    if (decision.action === 'notify') {
      expect(decision.lastNotifiedAt).toEqual(NOW);
      expect(decision.lastNotifiedPriceAmount).toBe(TARGET);
    }
  });

  it('first drop below target => notify', () => {
    const state = makeState();
    const decision = evaluateAlertNotification(state, TARGET - 500, NOW);
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
    const decision = evaluateAlertNotification(state, newLow, NOW);
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
    const decision = evaluateAlertNotification(state, TARGET - 100, NOW);
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
    const decision = evaluateAlertNotification(state, TARGET - 200, NOW);
    expect(decision.action).toBe('none');
  });

  it('price drops but still > lastNotifiedPriceAmount and <= target => none', () => {
    // Was notified at 8000; now at 9000 which is still <= 10000 target
    // but NOT strictly lower than 8000.
    const state = makeState({
      lastNotifiedAt: new Date('2026-06-20T00:00:00.000Z'),
      lastNotifiedPriceAmount: 8000,
    });
    const decision = evaluateAlertNotification(state, 9000, NOW);
    // 9000 <= 10000 (target) but 9000 > 8000 (lastNotified) => none
    expect(decision.action).toBe('none');
  });

  it('no in-stock offer and no marker => none', () => {
    const state = makeState();
    const decision = evaluateAlertNotification(state, null, NOW);
    expect(decision.action).toBe('none');
  });

  it('lowest exactly == lastNotifiedPriceAmount => none (strict < boundary)', () => {
    const state = makeState({
      lastNotifiedAt: NOW,
      lastNotifiedPriceAmount: TARGET,
    });
    const decision = evaluateAlertNotification(state, TARGET, NOW);
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
    const decision = evaluateAlertNotification(state, TARGET + 1000, NOW);
    expect(decision.action).toBe('reset');
  });

  it('no in-stock offer with marker set => reset', () => {
    const state = makeState({
      lastNotifiedAt: new Date('2026-06-21T00:00:00.000Z'),
      lastNotifiedPriceAmount: TARGET - 200,
    });
    const decision = evaluateAlertNotification(state, null, NOW);
    expect(decision.action).toBe('reset');
  });

  it('price > target with only lastNotifiedAt set (no price) => reset', () => {
    const state = makeState({
      lastNotifiedAt: new Date('2026-06-21T00:00:00.000Z'),
      lastNotifiedPriceAmount: null,
    });
    const decision = evaluateAlertNotification(state, TARGET + 500, NOW);
    expect(decision.action).toBe('reset');
  });

  it('price > target with only lastNotifiedPriceAmount set (no date) => reset', () => {
    const state = makeState({
      lastNotifiedAt: null,
      lastNotifiedPriceAmount: TARGET - 100,
    });
    const decision = evaluateAlertNotification(state, TARGET + 1, NOW);
    expect(decision.action).toBe('reset');
  });

  // ------------------------------------------------------------------
  // Boundary: lowest exactly == target
  // ------------------------------------------------------------------

  it('lowest exactly == target and no marker => notify (<= boundary)', () => {
    const state = makeState();
    const decision = evaluateAlertNotification(state, TARGET, NOW);
    expect(decision.action).toBe('notify');
  });

  // ------------------------------------------------------------------
  // notify shape
  // ------------------------------------------------------------------

  it('notify decision carries correct lastNotifiedAt and lastNotifiedPriceAmount', () => {
    const state = makeState();
    const low = TARGET - 300;
    const decision = evaluateAlertNotification(state, low, NOW) as Extract<
      AlertNotificationDecision,
      { action: 'notify' }
    >;
    expect(decision.action).toBe('notify');
    expect(decision.lastNotifiedAt).toBe(NOW);
    expect(decision.lastNotifiedPriceAmount).toBe(low);
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
