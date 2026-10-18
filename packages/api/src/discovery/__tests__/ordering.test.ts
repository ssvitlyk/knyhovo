import { describe, it, expect } from 'vitest';
import type { ProviderName } from '@knyhovo/shared';
import { PROVIDER_PRIORITY, orderByProviderThenPrice } from '../ordering.js';

type C = { provider: ProviderName; priceAmount?: number | null; tag: string };

describe('orderByProviderThenPrice', () => {
  it('orders by provider priority first, unknown providers last', () => {
    expect(PROVIDER_PRIORITY).toEqual(['yakaboo', 'vivat', 'book-ye']);
    const input: C[] = [
      { provider: 'bookchef', priceAmount: 1, tag: 'x' },
      { provider: 'book-ye', priceAmount: 1, tag: 'c' },
      { provider: 'yakaboo', priceAmount: 9, tag: 'a' },
      { provider: 'vivat', priceAmount: 1, tag: 'b' },
    ];
    expect(orderByProviderThenPrice(input).map((c) => c.tag)).toEqual(['a', 'b', 'c', 'x']);
  });

  it('breaks ties by ascending price; missing/non-finite price sorts last; input is not mutated', () => {
    const input: C[] = [
      { provider: 'vivat', priceAmount: null, tag: 'none' },
      { provider: 'vivat', priceAmount: 500, tag: 'high' },
      { provider: 'vivat', priceAmount: Number.NaN, tag: 'nan' },
      { provider: 'vivat', priceAmount: 100, tag: 'low' },
    ];
    const snapshot = input.map((c) => c.tag);
    expect(orderByProviderThenPrice(input).map((c) => c.tag)).toEqual(['low', 'high', 'none', 'nan']);
    expect(input.map((c) => c.tag)).toEqual(snapshot);
  });
});
