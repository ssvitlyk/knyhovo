import { describe, it, expect } from 'vitest';
import { toOfferDtos, eligibleListings } from '../offers.js';
import type { OfferListing } from '../offers.js';
import {
  AVAILABILITY_SLUG,
  PROVIDER_DB_ENUM,
  PROVIDER_SLUG,
  hasPrice,
} from '../provider-maps.js';

const SEEN = new Date('2026-01-02T03:04:05.000Z');

function listing(over: Partial<OfferListing>): OfferListing {
  return {
    provider: 'YAKABOO',
    priceAmount: 10000,
    priceCurrency: 'UAH',
    availability: 'IN_STOCK',
    url: 'https://x/y',
    lastSeenAt: SEEN,
    ...over,
  };
}

describe('provider-maps', () => {
  it('PROVIDER_SLUG is the exact inverse of PROVIDER_DB_ENUM', () => {
    for (const [slug, db] of Object.entries(PROVIDER_DB_ENUM)) {
      expect(PROVIDER_SLUG[db as keyof typeof PROVIDER_SLUG]).toBe(slug);
    }
    expect(Object.keys(PROVIDER_SLUG)).toHaveLength(Object.keys(PROVIDER_DB_ENUM).length);
  });

  it('maps availability enum to slugs', () => {
    expect(AVAILABILITY_SLUG).toEqual({
      IN_STOCK: 'in-stock',
      OUT_OF_STOCK: 'out-of-stock',
      UNKNOWN: 'unknown',
    });
  });

  it('hasPrice rejects non-finite / nullish amounts', () => {
    expect(hasPrice({ priceAmount: 0 })).toBe(true);
    expect(hasPrice({ priceAmount: 5 })).toBe(true);
    expect(hasPrice({ priceAmount: Number.NaN })).toBe(false);
    expect(hasPrice({ priceAmount: Number.POSITIVE_INFINITY })).toBe(false);
    expect(hasPrice({ priceAmount: null as unknown as number })).toBe(false);
  });
});

describe('eligibleListings / toOfferDtos', () => {
  const rows = [
    listing({ provider: 'VIVAT', priceAmount: 30000, availability: 'UNKNOWN' }),
    listing({ provider: 'BOOK_CLUB', priceAmount: 20000, availability: 'OUT_OF_STOCK' }),
    listing({ provider: 'YAKABOO', priceAmount: 10000 }),
    listing({ provider: 'KNIGOLAND', priceAmount: Number.NaN }),
  ];

  it('drops out-of-stock and unpriced, keeps input order', () => {
    expect(eligibleListings(rows).map((r) => r.provider)).toEqual(['VIVAT', 'YAKABOO']);
  });

  it('maps to DTOs sorted by ascending price (UNKNOWN is shown)', () => {
    expect(toOfferDtos(rows)).toEqual([
      {
        provider: 'yakaboo',
        price: { amount: 10000, currency: 'UAH' },
        availability: 'in-stock',
        url: 'https://x/y',
        lastSeenAt: '2026-01-02T03:04:05.000Z',
      },
      {
        provider: 'vivat',
        price: { amount: 30000, currency: 'UAH' },
        availability: 'unknown',
        url: 'https://x/y',
        lastSeenAt: '2026-01-02T03:04:05.000Z',
      },
    ]);
  });

  it('returns [] when nothing is eligible', () => {
    expect(toOfferDtos([])).toEqual([]);
  });
});
