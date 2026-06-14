import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { appendSnapshot, findLatest, findHistory, findLowestPrice } from '../repository.js';
import type { PricePoint } from '../dto.js';

const LISTING_ID = 'pl-1';

function point(overrides: Partial<PricePoint> = {}): PricePoint {
  return {
    priceAmount: 34900,
    priceCurrency: 'UAH',
    availability: 'IN_STOCK',
    recordedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('appendSnapshot', () => {
  it('inserts a price-history row with all fields', async () => {
    const create = vi.fn(async () => ({}));
    const prisma = { priceHistoryPoint: { create } } as unknown as PrismaClient;
    const recordedAt = new Date('2026-02-01T00:00:00.000Z');

    await appendSnapshot(prisma, {
      providerListingId: LISTING_ID,
      priceAmount: 29900,
      priceCurrency: 'UAH',
      availability: 'OUT_OF_STOCK',
      recordedAt,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        providerListingId: LISTING_ID,
        priceAmount: 29900,
        priceCurrency: 'UAH',
        availability: 'OUT_OF_STOCK',
        recordedAt,
      },
    });
  });
});

describe('findLatest', () => {
  it('queries the most recent snapshot (recordedAt desc)', async () => {
    const findFirst = vi.fn(async () => point({ recordedAt: new Date('2026-03-01T00:00:00.000Z') }));
    const prisma = { priceHistoryPoint: { findFirst } } as unknown as PrismaClient;

    const result = await findLatest(prisma, LISTING_ID);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerListingId: LISTING_ID },
        orderBy: { recordedAt: 'desc' },
      }),
    );
    expect(result?.recordedAt).toEqual(new Date('2026-03-01T00:00:00.000Z'));
  });

  it('returns null when there is no history', async () => {
    const findFirst = vi.fn(async () => null);
    const prisma = { priceHistoryPoint: { findFirst } } as unknown as PrismaClient;
    expect(await findLatest(prisma, LISTING_ID)).toBeNull();
  });
});

describe('findHistory', () => {
  it('queries the timeline oldest-first (recordedAt asc)', async () => {
    const rows = [
      point({ recordedAt: new Date('2026-01-01T00:00:00.000Z'), priceAmount: 34900 }),
      point({ recordedAt: new Date('2026-02-01T00:00:00.000Z'), priceAmount: 29900 }),
      point({ recordedAt: new Date('2026-03-01T00:00:00.000Z'), priceAmount: 31900 }),
    ];
    const findMany = vi.fn(async () => rows);
    const prisma = { priceHistoryPoint: { findMany } } as unknown as PrismaClient;

    const result = await findHistory(prisma, LISTING_ID);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerListingId: LISTING_ID },
        orderBy: { recordedAt: 'asc' },
      }),
    );
    // Chronological ordering preserved as returned by the query.
    expect(result.map((p) => p.recordedAt.toISOString())).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      '2026-03-01T00:00:00.000Z',
    ]);
  });

  it('applies a since/until window when provided', async () => {
    const findMany = vi.fn(async () => []);
    const prisma = { priceHistoryPoint: { findMany } } as unknown as PrismaClient;
    const since = new Date('2026-01-15T00:00:00.000Z');
    const until = new Date('2026-02-15T00:00:00.000Z');

    await findHistory(prisma, LISTING_ID, { since, until });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerListingId: LISTING_ID, recordedAt: { gte: since, lte: until } },
        orderBy: { recordedAt: 'asc' },
      }),
    );
  });
});

describe('findLowestPrice', () => {
  it('queries the minimum price (priceAmount asc, recordedAt asc tiebreak)', async () => {
    const findFirst = vi.fn(async () => point({ priceAmount: 19900 }));
    const prisma = { priceHistoryPoint: { findFirst } } as unknown as PrismaClient;

    const result = await findLowestPrice(prisma, LISTING_ID);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerListingId: LISTING_ID },
        orderBy: [{ priceAmount: 'asc' }, { recordedAt: 'asc' }],
      }),
    );
    expect(result?.priceAmount).toBe(19900);
  });
});
