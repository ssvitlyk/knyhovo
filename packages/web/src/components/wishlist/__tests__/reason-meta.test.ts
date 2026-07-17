import { describe, expect, it } from 'vitest';
import { reasonMeta, WL21_REASON_META } from '../reason-meta';

describe('reasonMeta', () => {
  it('maps TARGET_REACHED to target/Досягнуто вашої цілі', () => {
    expect(reasonMeta('TARGET_REACHED')).toEqual({ icon: 'target', label: 'Досягнуто вашої цілі' });
  });

  it('maps LOWEST_90_DAYS to trending-down/Найнижча за 90 днів', () => {
    expect(reasonMeta('LOWEST_90_DAYS')).toEqual({ icon: 'trending-down', label: 'Найнижча за 90 днів' });
  });

  it('maps PRICE_DROPPED to arrow-down/Подешевшала', () => {
    expect(reasonMeta('PRICE_DROPPED')).toEqual({ icon: 'arrow-down', label: 'Подешевшала' });
  });

  it('exposes the full map keyed by BuyingReason', () => {
    expect(Object.keys(WL21_REASON_META).sort()).toEqual(
      ['LOWEST_90_DAYS', 'PRICE_DROPPED', 'TARGET_REACHED'].sort(),
    );
  });
});
