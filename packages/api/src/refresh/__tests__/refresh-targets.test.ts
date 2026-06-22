import { describe, it, expect, vi } from 'vitest';
import { Provider, Availability } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import {
  selectRefreshTargets,
  findRefreshTargetCandidates,
} from '../refresh-targets.js';
import type { ScopedCandidateListing } from '../refresh-targets.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

function makeCandidate(
  overrides: Partial<ScopedCandidateListing> & {
    providerListingId: string;
    origin: 'wishlist' | 'alert';
  },
): ScopedCandidateListing {
  return {
    provider: Provider.YAKABOO,
    canonicalBookId: 'book-1',
    url: 'https://example.com/book-1',
    priceAmount: 10000,
    priceCurrency: 'UAH',
    availability: Availability.IN_STOCK,
    lastSeenAt: FIXED_DATE,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// selectRefreshTargets — pure function tests
// ---------------------------------------------------------------------------

describe('selectRefreshTargets', () => {
  it('returns [] for empty input', () => {
    expect(selectRefreshTargets([])).toEqual([]);
  });

  it('wishlist-origin candidate produces a target with inWishlist=true, hasActiveAlert=false', () => {
    const candidates = [makeCandidate({ providerListingId: 'listing-1', origin: 'wishlist' })];
    const [target] = selectRefreshTargets(candidates);
    expect(target?.scope.inWishlist).toBe(true);
    expect(target?.scope.hasActiveAlert).toBe(false);
  });

  it('alert-origin candidate produces a target with hasActiveAlert=true', () => {
    const candidates = [makeCandidate({ providerListingId: 'listing-1', origin: 'alert' })];
    const [target] = selectRefreshTargets(candidates);
    expect(target?.scope.hasActiveAlert).toBe(true);
    expect(target?.scope.inWishlist).toBe(false);
  });

  it('same providerListingId from BOTH wishlist + alert => ONE target with both flags true', () => {
    const candidates = [
      makeCandidate({ providerListingId: 'listing-1', origin: 'wishlist' }),
      makeCandidate({ providerListingId: 'listing-1', origin: 'alert' }),
    ];
    const targets = selectRefreshTargets(candidates);
    expect(targets).toHaveLength(1);
    expect(targets[0]!.scope.inWishlist).toBe(true);
    expect(targets[0]!.scope.hasActiveAlert).toBe(true);
  });

  it('excludes candidates with url=null', () => {
    const candidates = [makeCandidate({ providerListingId: 'listing-1', origin: 'wishlist', url: null })];
    expect(selectRefreshTargets(candidates)).toHaveLength(0);
  });

  it('excludes candidates with url=""', () => {
    const candidates = [makeCandidate({ providerListingId: 'listing-1', origin: 'wishlist', url: '' })];
    expect(selectRefreshTargets(candidates)).toHaveLength(0);
  });

  it('excludes candidates with url that is only whitespace', () => {
    const candidates = [makeCandidate({ providerListingId: 'listing-1', origin: 'wishlist', url: '   ' })];
    expect(selectRefreshTargets(candidates)).toHaveLength(0);
  });

  it('maps price/availability/lastSeenAt fields correctly', () => {
    const seenAt = new Date('2026-03-15T12:00:00.000Z');
    const candidates = [
      makeCandidate({
        providerListingId: 'listing-1',
        origin: 'wishlist',
        priceAmount: 25000,
        priceCurrency: 'UAH',
        availability: Availability.OUT_OF_STOCK,
        lastSeenAt: seenAt,
      }),
    ];
    const [target] = selectRefreshTargets(candidates);
    expect(target?.currentPriceAmount).toBe(25000);
    expect(target?.currentPriceCurrency).toBe('UAH');
    expect(target?.currentAvailability).toBe(Availability.OUT_OF_STOCK);
    expect(target?.lastSeenAt).toEqual(seenAt);
  });

  it('uses first-seen price/availability/lastSeenAt when deduplicating', () => {
    const firstDate = new Date('2026-01-01T00:00:00.000Z');
    const secondDate = new Date('2026-06-01T00:00:00.000Z');
    const candidates = [
      makeCandidate({
        providerListingId: 'listing-1',
        origin: 'wishlist',
        priceAmount: 10000,
        availability: Availability.IN_STOCK,
        lastSeenAt: firstDate,
      }),
      makeCandidate({
        providerListingId: 'listing-1',
        origin: 'alert',
        priceAmount: 8000,
        availability: Availability.OUT_OF_STOCK,
        lastSeenAt: secondDate,
      }),
    ];
    const [target] = selectRefreshTargets(candidates);
    // First-seen values must win.
    expect(target?.currentPriceAmount).toBe(10000);
    expect(target?.currentAvailability).toBe(Availability.IN_STOCK);
    expect(target?.lastSeenAt).toEqual(firstDate);
  });

  it('stable sort: provider → canonicalBookId → providerListingId', () => {
    const candidates: ScopedCandidateListing[] = [
      makeCandidate({ providerListingId: 'z-listing', provider: Provider.YAKABOO, canonicalBookId: 'book-b', origin: 'wishlist', url: 'https://example.com/z' }),
      makeCandidate({ providerListingId: 'a-listing', provider: Provider.BOOK_YE, canonicalBookId: 'book-a', origin: 'wishlist', url: 'https://example.com/a' }),
      makeCandidate({ providerListingId: 'm-listing', provider: Provider.VIVAT, canonicalBookId: 'book-c', origin: 'wishlist', url: 'https://example.com/m' }),
      makeCandidate({ providerListingId: 'b-listing', provider: Provider.YAKABOO, canonicalBookId: 'book-a', origin: 'wishlist', url: 'https://example.com/b' }),
    ];
    const targets = selectRefreshTargets(candidates);

    // Expect sorted by provider string, then canonicalBookId, then providerListingId.
    const sorted = [...targets].sort((a, b) => {
      if (a.provider !== b.provider) return a.provider < b.provider ? -1 : 1;
      if (a.canonicalBookId !== b.canonicalBookId) return a.canonicalBookId < b.canonicalBookId ? -1 : 1;
      return a.providerListingId < b.providerListingId ? -1 : 1;
    });

    expect(targets.map((t) => t.providerListingId)).toEqual(
      sorted.map((t) => t.providerListingId),
    );
  });

  it('multiple providers all produce targets', () => {
    const candidates: ScopedCandidateListing[] = [
      makeCandidate({ providerListingId: 'yak-1', provider: Provider.YAKABOO, origin: 'wishlist', url: 'https://yakaboo.ua/1' }),
      makeCandidate({ providerListingId: 'vivat-1', provider: Provider.VIVAT, origin: 'wishlist', url: 'https://vivat.ua/1' }),
      makeCandidate({ providerListingId: 'bye-1', provider: Provider.BOOK_YE, origin: 'wishlist', url: 'https://book-ye.com.ua/1' }),
    ];
    const targets = selectRefreshTargets(candidates);
    expect(targets).toHaveLength(3);
    const providers = targets.map((t) => t.provider);
    expect(providers).toContain(Provider.YAKABOO);
    expect(providers).toContain(Provider.VIVAT);
    expect(providers).toContain(Provider.BOOK_YE);
  });
});

// ---------------------------------------------------------------------------
// findRefreshTargetCandidates — with a hand-rolled fake prisma
// ---------------------------------------------------------------------------

describe('findRefreshTargetCandidates', () => {
  it('emits wishlist origin for each row', async () => {
    const fakeRow = {
      id: 'listing-1',
      provider: Provider.YAKABOO,
      canonicalBookId: 'book-1',
      url: 'https://yakaboo.ua/book-1',
      priceAmount: 15000,
      priceCurrency: 'UAH',
      availability: Availability.IN_STOCK,
      lastSeenAt: FIXED_DATE,
      canonicalBook: {
        wishlistItems: [{ alert: null }],
      },
    };

    const fakePrisma = {
      providerListing: {
        findMany: vi.fn(async () => [fakeRow]),
      },
    } as unknown as PrismaClient;

    const candidates = await findRefreshTargetCandidates(fakePrisma);
    const wishlistOnes = candidates.filter((c) => c.origin === 'wishlist');
    expect(wishlistOnes).toHaveLength(1);
    expect(wishlistOnes[0]!.providerListingId).toBe('listing-1');
  });

  it('does not emit alert origin when alert is null', async () => {
    const fakeRow = {
      id: 'listing-1',
      provider: Provider.YAKABOO,
      canonicalBookId: 'book-1',
      url: 'https://yakaboo.ua/book-1',
      priceAmount: 15000,
      priceCurrency: 'UAH',
      availability: Availability.IN_STOCK,
      lastSeenAt: FIXED_DATE,
      canonicalBook: {
        wishlistItems: [{ alert: null }],
      },
    };

    const fakePrisma = {
      providerListing: {
        findMany: vi.fn(async () => [fakeRow]),
      },
    } as unknown as PrismaClient;

    const candidates = await findRefreshTargetCandidates(fakePrisma);
    expect(candidates.filter((c) => c.origin === 'alert')).toHaveLength(0);
  });

  it('emits alert origin when any wishlist item has an ACTIVE alert', async () => {
    const fakeRow = {
      id: 'listing-1',
      provider: Provider.YAKABOO,
      canonicalBookId: 'book-1',
      url: 'https://yakaboo.ua/book-1',
      priceAmount: 15000,
      priceCurrency: 'UAH',
      availability: Availability.IN_STOCK,
      lastSeenAt: FIXED_DATE,
      canonicalBook: {
        wishlistItems: [
          { alert: { status: 'ACTIVE' } },
          { alert: null },
        ],
      },
    };

    const fakePrisma = {
      providerListing: {
        findMany: vi.fn(async () => [fakeRow]),
      },
    } as unknown as PrismaClient;

    const candidates = await findRefreshTargetCandidates(fakePrisma);
    expect(candidates.filter((c) => c.origin === 'alert')).toHaveLength(1);
    expect(candidates.filter((c) => c.origin === 'wishlist')).toHaveLength(1);
  });

  it('does not emit alert origin when alert status is PAUSED', async () => {
    const fakeRow = {
      id: 'listing-1',
      provider: Provider.YAKABOO,
      canonicalBookId: 'book-1',
      url: 'https://yakaboo.ua/book-1',
      priceAmount: 15000,
      priceCurrency: 'UAH',
      availability: Availability.IN_STOCK,
      lastSeenAt: FIXED_DATE,
      canonicalBook: {
        wishlistItems: [{ alert: { status: 'PAUSED' } }],
      },
    };

    const fakePrisma = {
      providerListing: {
        findMany: vi.fn(async () => [fakeRow]),
      },
    } as unknown as PrismaClient;

    const candidates = await findRefreshTargetCandidates(fakePrisma);
    expect(candidates.filter((c) => c.origin === 'alert')).toHaveLength(0);
  });
});
