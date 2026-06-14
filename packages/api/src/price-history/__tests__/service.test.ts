import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { shouldCreateSnapshot, recordPriceChange } from '../service.js';
import type { ListingPriceState } from '../dto.js';

const RECORDED_AT = new Date('2026-01-01T00:00:00.000Z');
const LISTING_ID = 'pl-1';

function state(overrides: Partial<ListingPriceState> = {}): ListingPriceState {
  return { priceAmount: 34900, priceCurrency: 'UAH', availability: 'IN_STOCK', ...overrides };
}

function makeFakePrisma(create = vi.fn(async () => ({}))): {
  prisma: PrismaClient;
  create: ReturnType<typeof vi.fn>;
} {
  const db = { priceHistoryPoint: { create } };
  return { prisma: db as unknown as PrismaClient, create };
}

describe('shouldCreateSnapshot', () => {
  it('returns true for the first observation (no previous state)', () => {
    expect(shouldCreateSnapshot(null, state())).toBe(true);
  });

  it('returns false when price and availability are unchanged', () => {
    expect(shouldCreateSnapshot(state(), state())).toBe(false);
  });

  it('returns true when price decreases', () => {
    expect(shouldCreateSnapshot(state({ priceAmount: 34900 }), state({ priceAmount: 29900 }))).toBe(true);
  });

  it('returns true when price increases', () => {
    expect(shouldCreateSnapshot(state({ priceAmount: 34900 }), state({ priceAmount: 39900 }))).toBe(true);
  });

  it('returns true when availability changes but price is the same', () => {
    expect(
      shouldCreateSnapshot(state({ availability: 'IN_STOCK' }), state({ availability: 'OUT_OF_STOCK' })),
    ).toBe(true);
  });
});

describe('recordPriceChange', () => {
  it('appends a snapshot for the first observation', async () => {
    const { prisma, create } = makeFakePrisma();
    const result = await recordPriceChange(prisma, {
      providerListingId: LISTING_ID,
      previous: null,
      next: state(),
      recordedAt: RECORDED_AT,
    });
    expect(result.created).toBe(true);
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      data: {
        providerListingId: LISTING_ID,
        priceAmount: 34900,
        priceCurrency: 'UAH',
        availability: 'IN_STOCK',
        recordedAt: RECORDED_AT,
      },
    });
  });

  it('does not append a snapshot when nothing changed', async () => {
    const { prisma, create } = makeFakePrisma();
    const result = await recordPriceChange(prisma, {
      providerListingId: LISTING_ID,
      previous: state(),
      next: state(),
      recordedAt: RECORDED_AT,
    });
    expect(result.created).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('appends a snapshot when price decreases', async () => {
    const { prisma, create } = makeFakePrisma();
    const result = await recordPriceChange(prisma, {
      providerListingId: LISTING_ID,
      previous: state({ priceAmount: 34900 }),
      next: state({ priceAmount: 29900 }),
      recordedAt: RECORDED_AT,
    });
    expect(result.created).toBe(true);
    expect(create).toHaveBeenCalledOnce();
  });

  it('appends a snapshot when price increases', async () => {
    const { prisma, create } = makeFakePrisma();
    const result = await recordPriceChange(prisma, {
      providerListingId: LISTING_ID,
      previous: state({ priceAmount: 34900 }),
      next: state({ priceAmount: 39900 }),
      recordedAt: RECORDED_AT,
    });
    expect(result.created).toBe(true);
    expect(create).toHaveBeenCalledOnce();
  });

  it('appends a snapshot when availability changes', async () => {
    const { prisma, create } = makeFakePrisma();
    const result = await recordPriceChange(prisma, {
      providerListingId: LISTING_ID,
      previous: state({ availability: 'IN_STOCK' }),
      next: state({ availability: 'OUT_OF_STOCK' }),
      recordedAt: RECORDED_AT,
    });
    expect(result.created).toBe(true);
    expect(create).toHaveBeenCalledOnce();
  });
});
