import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { appendSnapshot } from '../repository.js';

const LISTING_ID = 'pl-1';

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
