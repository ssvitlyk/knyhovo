import { describe, expect, it } from 'vitest';
import type { Availability, ProviderName } from '@knyhovo/shared';
import type { BookProviderDto } from '../api/types';
import {
  getBestOffer,
  getCheapestAvailableOffer,
  getCheapestOffer,
  getOfferState,
  sortOffers,
} from '../offers';

/**
 * Build a `BookProviderDto`. `provider` is the deterministic tie-break key, so
 * tests pass explicit provider names. `ProviderName` only spans two stores; that
 * is enough for ordering assertions (`book-club` sorts before `yakaboo`), and
 * duplicate providers are type-valid for price-only cases.
 */
function offer(
  provider: ProviderName,
  amount: number,
  availability: Availability = 'in-stock',
): BookProviderDto {
  return {
    provider,
    price: { amount, currency: 'UAH' },
    availability,
    url: `https://example.com/${provider}/${amount}`,
    lastSeenAt: '2026-06-17T08:00:00.000Z',
  };
}

describe('getCheapestOffer', () => {
  it('returns the absolute lowest price regardless of availability', () => {
    const offers = [offer('yakaboo', 25900), offer('book-club', 22200, 'out-of-stock')];
    expect(getCheapestOffer(offers)?.price.amount).toBe(22200);
  });

  it('returns null for an empty list', () => {
    expect(getCheapestOffer([])).toBeNull();
  });
});

describe('getCheapestAvailableOffer', () => {
  it('ignores out-of-stock offers', () => {
    const offers = [offer('book-club', 22200, 'out-of-stock'), offer('yakaboo', 24900)];
    expect(getCheapestAvailableOffer(offers)?.price.amount).toBe(24900);
  });

  it('treats unknown availability as available', () => {
    const offers = [offer('yakaboo', 23000, 'unknown'), offer('book-club', 25000)];
    const cheapestAvailable = getCheapestAvailableOffer(offers);
    expect(cheapestAvailable?.price.amount).toBe(23000);
    expect(cheapestAvailable?.availability).toBe('unknown');
  });

  it('returns null when every offer is out-of-stock', () => {
    const offers = [offer('yakaboo', 24000, 'out-of-stock'), offer('book-club', 22000, 'out-of-stock')];
    expect(getCheapestAvailableOffer(offers)).toBeNull();
  });
});

describe('getBestOffer', () => {
  it('prefers the cheapest available offer over a cheaper out-of-stock one', () => {
    const offers = [offer('book-club', 22200, 'out-of-stock'), offer('yakaboo', 24900)];
    const best = getBestOffer(offers);
    expect(best?.price.amount).toBe(24900);
    expect(best?.availability).toBe('in-stock');
  });

  it('falls back to the cheapest out-of-stock offer when nothing is available', () => {
    const offers = [offer('yakaboo', 24000, 'out-of-stock'), offer('book-club', 22000, 'out-of-stock')];
    const best = getBestOffer(offers);
    expect(best?.price.amount).toBe(22000);
    // Must not fake availability — the fallback stays out-of-stock.
    expect(best?.availability).toBe('out-of-stock');
  });

  it('returns null for an empty list', () => {
    expect(getBestOffer([])).toBeNull();
  });
});

describe('getOfferState', () => {
  it('is empty for no offers', () => {
    expect(getOfferState([])).toBe('empty');
  });

  it('is cheapest-best when the cheapest available offer is also the cheapest overall', () => {
    const offers = [offer('yakaboo', 22800), offer('book-club', 24900), offer('yakaboo', 25500)];
    expect(getOfferState(offers)).toBe('cheapest-best');
  });

  it('is cheapest-but-oos when the cheapest listing is out-of-stock and a pricier one is available', () => {
    const offers = [
      offer('yakaboo', 22200, 'out-of-stock'),
      offer('book-club', 24900),
      offer('yakaboo', 27000),
    ];
    expect(getOfferState(offers)).toBe('cheapest-but-oos');
  });

  it('is same-price when multiple available offers share the lowest available price', () => {
    const offers = [offer('yakaboo', 24500), offer('book-club', 24500), offer('yakaboo', 26200)];
    expect(getOfferState(offers)).toBe('same-price');
  });

  it('prioritises cheapest-but-oos over same-price', () => {
    const offers = [
      offer('yakaboo', 22000, 'out-of-stock'),
      offer('book-club', 24500),
      offer('yakaboo', 24500),
    ];
    expect(getOfferState(offers)).toBe('cheapest-but-oos');
  });

  it('does not treat an out-of-stock cheapest at the same price as cheapest-but-oos', () => {
    // OOS and available share the lowest price → not "but-oos" (no cheaper-available gap).
    const offers = [offer('yakaboo', 24000, 'out-of-stock'), offer('book-club', 24000)];
    expect(getOfferState(offers)).not.toBe('cheapest-but-oos');
  });

  it('treats an all-out-of-stock set as cheapest-best (best === cheapest)', () => {
    const offers = [offer('yakaboo', 24000, 'out-of-stock'), offer('book-club', 22000, 'out-of-stock')];
    expect(getOfferState(offers)).toBe('cheapest-best');
  });
});

describe('sortOffers', () => {
  it('orders available offers (incl. unknown) before out-of-stock, each ascending by price', () => {
    const offers = [
      offer('yakaboo', 40000, 'out-of-stock'),
      offer('book-club', 30000),
      offer('yakaboo', 25000, 'unknown'),
      offer('book-club', 28000, 'out-of-stock'),
    ];
    const result = sortOffers(offers).map((o) => [o.price.amount, o.availability]);
    expect(result).toEqual([
      [25000, 'unknown'],
      [30000, 'in-stock'],
      [28000, 'out-of-stock'],
      [40000, 'out-of-stock'],
    ]);
  });

  it('breaks equal prices deterministically by provider name', () => {
    const offers = [offer('yakaboo', 24000), offer('book-club', 24000)];
    expect(sortOffers(offers).map((o) => o.provider)).toEqual(['book-club', 'yakaboo']);
    // Reversed input yields the same deterministic order.
    expect(sortOffers([...offers].reverse()).map((o) => o.provider)).toEqual([
      'book-club',
      'yakaboo',
    ]);
  });

  it('does not let an equal-priced unknown offer outrank an in-stock one beyond the provider tie-break', () => {
    // book-club (in-stock) sorts before yakaboo (unknown) purely on provider name.
    const offers = [offer('yakaboo', 24000, 'unknown'), offer('book-club', 24000)];
    expect(sortOffers(offers).map((o) => o.provider)).toEqual(['book-club', 'yakaboo']);
  });

  it('returns a new array and never mutates the input', () => {
    const offers = [offer('yakaboo', 30000), offer('book-club', 20000)];
    const sorted = sortOffers(offers);
    expect(sorted).not.toBe(offers);
    expect(offers.map((o) => o.price.amount)).toEqual([30000, 20000]);
  });
});

describe('purity', () => {
  it('does not mutate the input array across any helper', () => {
    const offers = Object.freeze([
      offer('yakaboo', 30000),
      offer('book-club', 22000, 'out-of-stock'),
      offer('yakaboo', 25000, 'unknown'),
    ]) as readonly BookProviderDto[];
    const snapshot = offers.slice();

    // Calling every helper on a frozen array would throw on mutation.
    getCheapestOffer(offers);
    getCheapestAvailableOffer(offers);
    getBestOffer(offers);
    getOfferState(offers);
    sortOffers(offers);

    expect(offers.slice()).toEqual(snapshot);
  });
});
