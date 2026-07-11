import { describe, it, expect } from 'vitest';
import { planNovynkyPool, NOVYNKY_MIN_POOL, NOVYNKY_MAX_SHARE } from '../feed-constants.js';

describe('planNovynkyPool', () => {
  it('caps the window pool to a share of the catalog when the window already has >= MIN_POOL', () => {
    // 100 priced, 40 in-window -> cap = max(24, floor(100*0.25)) = 25, capped to min(25, 40) = 25.
    const plan = planNovynkyPool(40, 100);
    expect(plan).toEqual({ windowLimit: 25, fallbackLimit: 0 });
  });

  it('never drops the cap below NOVYNKY_MIN_POOL on a small catalog', () => {
    // 30 priced, 30 in-window -> 25% share is 7 (< MIN_POOL) -> MIN_POOL floor wins.
    const plan = planNovynkyPool(30, 30);
    expect(plan.windowLimit).toBe(NOVYNKY_MIN_POOL);
    expect(plan.fallbackLimit).toBe(0);
  });

  it('never caps the window pool below its own size when the window is smaller than the share cap', () => {
    // 1000 priced but only 26 in-window -> share cap (250) exceeds the window itself; take the whole window.
    const plan = planNovynkyPool(26, 1000);
    expect(plan.windowLimit).toBe(26);
    expect(plan.fallbackLimit).toBe(0);
  });

  it('falls back to older priced books when the window is thinner than MIN_POOL', () => {
    const plan = planNovynkyPool(10, 50);
    expect(plan).toEqual({ windowLimit: 10, fallbackLimit: NOVYNKY_MIN_POOL - 10 });
  });

  it('returns an empty plan (all fallback) when there are no priced books at all', () => {
    const plan = planNovynkyPool(0, 0);
    expect(plan).toEqual({ windowLimit: 0, fallbackLimit: NOVYNKY_MIN_POOL });
  });

  it('NOVYNKY_MAX_SHARE is the documented 25%', () => {
    expect(NOVYNKY_MAX_SHARE).toBe(0.25);
  });
});
