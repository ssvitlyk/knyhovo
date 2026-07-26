import { describe, expect, it } from 'vitest';
import {
  ALERT_INTENTS,
  FAVOURABLE_MIN_POINTS,
  alertUiState,
  resolveFavourableTarget,
  resolveTargetAmount,
  getIntentDef,
} from '../alerts';
import type { AlertDto } from '../api/types';

/* ── alertUiState ───────────────────────────────────────────────────────────── */
describe('alertUiState()', () => {
  it('null → "saved"', () => {
    expect(alertUiState(null)).toBe('saved');
  });

  it('status active → "watch"', () => {
    const alert: AlertDto = {
      status: 'active',
      intent: 'any-drop',
      targetPrice: { amount: 24000, currency: 'UAH' },
      pausedAt: null,
    };
    expect(alertUiState(alert)).toBe('watch');
  });

  it('status paused → "paused"', () => {
    const alert: AlertDto = {
      status: 'paused',
      intent: 'below-current',
      targetPrice: { amount: 24000, currency: 'UAH' },
      pausedAt: '2026-06-01T08:00:00.000Z',
    };
    expect(alertUiState(alert)).toBe('paused');
  });

  it('status triggered → "triggered"', () => {
    const alert: AlertDto = {
      status: 'triggered',
      intent: 'below-current',
      targetPrice: { amount: 24000, currency: 'UAH' },
      pausedAt: null,
    };
    expect(alertUiState(alert)).toBe('triggered');
  });

  it('status unavailable → "unavailable"', () => {
    const alert: AlertDto = {
      status: 'unavailable',
      intent: 'any-drop',
      targetPrice: { amount: 24000, currency: 'UAH' },
      pausedAt: null,
    };
    expect(alertUiState(alert)).toBe('unavailable');
  });
});

/* ── resolveTargetAmount ────────────────────────────────────────────────────── */
describe('resolveTargetAmount()', () => {
  const ctx = {
    currentAmount: 24000,
    typicalRangeMin: 20000,
    customAmount: 18000,
  };

  it('any-drop → returns currentAmount - 1 kopiyka', () => {
    expect(resolveTargetAmount('any-drop', ctx)).toBe(23999);
  });

  it('below-current → returns currentAmount - 1 kopiyka', () => {
    expect(resolveTargetAmount('below-current', ctx)).toBe(23999);
  });

  it('favourable-price → returns typicalRangeMin', () => {
    expect(resolveTargetAmount('favourable-price', ctx)).toBe(20000);
  });

  it('custom-price → returns customAmount', () => {
    expect(resolveTargetAmount('custom-price', ctx)).toBe(18000);
  });

  it('any-drop + null currentAmount → null', () => {
    expect(resolveTargetAmount('any-drop', { ...ctx, currentAmount: null })).toBeNull();
  });

  it('below-current + null currentAmount → null', () => {
    expect(resolveTargetAmount('below-current', { ...ctx, currentAmount: null })).toBeNull();
  });

  it('favourable-price + null typicalRangeMin → null', () => {
    expect(resolveTargetAmount('favourable-price', { ...ctx, typicalRangeMin: null })).toBeNull();
  });

  it('custom-price + null customAmount → null', () => {
    expect(resolveTargetAmount('custom-price', { ...ctx, customAmount: null })).toBeNull();
  });

  it('any-drop + currentAmount at 1 kopiyka → floors at 1, not 0', () => {
    expect(resolveTargetAmount('any-drop', { ...ctx, currentAmount: 1 })).toBe(1);
  });

  it('below-current + currentAmount at 1 kopiyka → floors at 1, not 0', () => {
    expect(resolveTargetAmount('below-current', { ...ctx, currentAmount: 1 })).toBe(1);
  });
});

/* ── resolveFavourableTarget ────────────────────────────────────────────────── */
describe('resolveFavourableTarget()', () => {
  it('ready: enough points, range below current → {state: "ready", amount}', () => {
    expect(
      resolveFavourableTarget({ typicalRangeMin: 20000, pointCount: 6, currentAmount: 24000 }),
    ).toEqual({ state: 'ready', amount: 20000 });
  });

  it('null typicalRangeMin → collecting', () => {
    expect(
      resolveFavourableTarget({ typicalRangeMin: null, pointCount: 10, currentAmount: 24000 }),
    ).toEqual({ state: 'collecting', amount: null });
  });

  it('pointCount below FAVOURABLE_MIN_POINTS → collecting', () => {
    expect(
      resolveFavourableTarget({ typicalRangeMin: 20000, pointCount: 4, currentAmount: 24000 }),
    ).toEqual({ state: 'collecting', amount: null });
  });

  it('pointCount exactly FAVOURABLE_MIN_POINTS (5) → ready (boundary)', () => {
    expect(
      resolveFavourableTarget({
        typicalRangeMin: 20000,
        pointCount: FAVOURABLE_MIN_POINTS,
        currentAmount: 24000,
      }),
    ).toEqual({ state: 'ready', amount: 20000 });
  });

  it('typicalRangeMin equal to currentAmount → collecting (boundary, never restate current price)', () => {
    expect(
      resolveFavourableTarget({ typicalRangeMin: 24000, pointCount: 10, currentAmount: 24000 }),
    ).toEqual({ state: 'collecting', amount: null });
  });

  it('typicalRangeMin greater than currentAmount → collecting', () => {
    expect(
      resolveFavourableTarget({ typicalRangeMin: 25000, pointCount: 10, currentAmount: 24000 }),
    ).toEqual({ state: 'collecting', amount: null });
  });

  it('typicalRangeMin one kopiyka below currentAmount → ready', () => {
    expect(
      resolveFavourableTarget({ typicalRangeMin: 23999, pointCount: 10, currentAmount: 24000 }),
    ).toEqual({ state: 'ready', amount: 23999 });
  });

  it('null currentAmount → ready is still possible (no current price to compare against)', () => {
    expect(
      resolveFavourableTarget({ typicalRangeMin: 20000, pointCount: 10, currentAmount: null }),
    ).toEqual({ state: 'ready', amount: 20000 });
  });

  it('null currentAmount + insufficient points → collecting', () => {
    expect(
      resolveFavourableTarget({ typicalRangeMin: 20000, pointCount: 2, currentAmount: null }),
    ).toEqual({ state: 'collecting', amount: null });
  });

  it('FAVOURABLE_MIN_POINTS constant is 5', () => {
    expect(FAVOURABLE_MIN_POINTS).toBe(5);
  });
});

/* ── getIntentDef ───────────────────────────────────────────────────────────── */
describe('getIntentDef()', () => {
  it('any-drop → returns def with correct key', () => {
    const def = getIntentDef('any-drop');
    expect(def).toBeDefined();
    expect(def?.key).toBe('any-drop');
  });

  it('below-current → returns def with correct key', () => {
    const def = getIntentDef('below-current');
    expect(def?.key).toBe('below-current');
  });

  it('favourable-price → returns def with correct key', () => {
    const def = getIntentDef('favourable-price');
    expect(def?.key).toBe('favourable-price');
  });

  it('custom-price → returns def with correct key (first-class radio now)', () => {
    const def = getIntentDef('custom-price');
    expect(def?.key).toBe('custom-price');
  });
});

/* ── ALERT_INTENTS shape ────────────────────────────────────────────────────── */
describe('ALERT_INTENTS', () => {
  it('has exactly 4 entries', () => {
    expect(ALERT_INTENTS).toHaveLength(4);
  });

  it('entries are any-drop, below-current, favourable-price, custom-price in order', () => {
    expect(ALERT_INTENTS[0].key).toBe('any-drop');
    expect(ALERT_INTENTS[1].key).toBe('below-current');
    expect(ALERT_INTENTS[2].key).toBe('favourable-price');
    expect(ALERT_INTENTS[3].key).toBe('custom-price');
  });

  it('favourable-price.needsHistory is true', () => {
    const fav = ALERT_INTENTS.find((d) => d.key === 'favourable-price');
    expect(fav?.needsHistory).toBe(true);
  });

  it('any-drop.needsHistory is false', () => {
    const def = ALERT_INTENTS.find((d) => d.key === 'any-drop');
    expect(def?.needsHistory).toBe(false);
  });

  it('below-current.needsHistory is false', () => {
    const def = ALERT_INTENTS.find((d) => d.key === 'below-current');
    expect(def?.needsHistory).toBe(false);
  });

  it('custom-price.needsHistory is false', () => {
    const def = ALERT_INTENTS.find((d) => d.key === 'custom-price');
    expect(def?.needsHistory).toBe(false);
  });

  it('descriptions match the frozen copy', () => {
    expect(ALERT_INTENTS[0].desc).toBe('Повідомимо при першому падінні ціни.');
    expect(ALERT_INTENTS[1].desc).toBe('Коли стане дешевше, ніж зараз.');
    expect(ALERT_INTENTS[2].desc).toBe('Коли книга повернеться до історично вигідної ціни.');
    expect(ALERT_INTENTS[3].desc).toBe('Оберіть власний поріг.');
  });

  it('all entries have label, desc and needsHistory fields', () => {
    for (const def of ALERT_INTENTS) {
      expect(typeof def.label).toBe('string');
      expect(def.label.length).toBeGreaterThan(0);
      expect(typeof def.desc).toBe('string');
      expect(def.desc.length).toBeGreaterThan(0);
      expect(typeof def.needsHistory).toBe('boolean');
    }
  });
});
