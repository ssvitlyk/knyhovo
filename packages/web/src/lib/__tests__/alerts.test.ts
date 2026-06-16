import { describe, expect, it } from 'vitest';
import {
  ALERT_INTENTS,
  alertUiState,
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

  it('any-drop → returns currentAmount', () => {
    expect(resolveTargetAmount('any-drop', ctx)).toBe(24000);
  });

  it('below-current → returns currentAmount', () => {
    expect(resolveTargetAmount('below-current', ctx)).toBe(24000);
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

  it('custom-price → returns undefined (not in ALERT_INTENTS)', () => {
    expect(getIntentDef('custom-price')).toBeUndefined();
  });
});

/* ── ALERT_INTENTS shape ────────────────────────────────────────────────────── */
describe('ALERT_INTENTS', () => {
  it('has exactly 3 entries', () => {
    expect(ALERT_INTENTS).toHaveLength(3);
  });

  it('entries are any-drop, below-current, favourable-price in order', () => {
    expect(ALERT_INTENTS[0].key).toBe('any-drop');
    expect(ALERT_INTENTS[1].key).toBe('below-current');
    expect(ALERT_INTENTS[2].key).toBe('favourable-price');
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
