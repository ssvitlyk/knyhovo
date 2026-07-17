import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { getBuyingOpportunities } from '../service.js';
import type { BuyingOpportunityWishlistRow } from '../repository.js';

const USER_ID = 'user-a-id-111111111111111111111111';
const FIXED_NOW = new Date('2026-07-16T00:00:00.000Z');
const DAY_MS = 86_400_000;

function makeFakePrisma(rows: BuyingOpportunityWishlistRow[]): PrismaClient {
  const db = {
    wishlistItem: {
      findMany: vi.fn(async () => rows),
    },
  };
  return db as unknown as PrismaClient;
}

function makeRow(overrides: Partial<BuyingOpportunityWishlistRow> = {}): BuyingOpportunityWishlistRow {
  return {
    canonicalBook: {
      id: 'book-1',
      title: 'Кобзар',
      listings: [
        {
          id: 'listing-1',
          provider: 'YAKABOO',
          priceAmount: 10000,
          priceCurrency: 'UAH',
          availability: 'IN_STOCK',
          priceHistory: [],
        },
      ],
    },
    alert: null,
    ...overrides,
  };
}

describe('getBuyingOpportunities', () => {
  it('returns { items: [], totalWishlistCount: 0 } for an empty wishlist', async () => {
    const prisma = makeFakePrisma([]);

    const result = await getBuyingOpportunities(prisma, USER_ID, { now: () => FIXED_NOW });

    expect(result).toEqual({ items: [], totalWishlistCount: 0 });
  });

  it('totalWishlistCount counts every row, including non-qualifying ones', async () => {
    const rows = [
      makeRow(), // flat price, no history — does not qualify
      makeRow({
        canonicalBook: {
          id: 'book-2',
          title: 'Лісова пісня',
          listings: [
            {
              id: 'listing-2',
              provider: 'BOOK_CLUB',
              priceAmount: 9000,
              priceCurrency: 'UAH',
              availability: 'IN_STOCK',
              priceHistory: [
                { priceAmount: 12000, priceCurrency: 'UAH', availability: 'IN_STOCK', recordedAt: new Date(FIXED_NOW.getTime() - DAY_MS) },
                { priceAmount: 9000, priceCurrency: 'UAH', availability: 'IN_STOCK', recordedAt: FIXED_NOW },
              ],
            },
          ],
        },
      }),
    ];
    const prisma = makeFakePrisma(rows);

    const result = await getBuyingOpportunities(prisma, USER_ID, { now: () => FIXED_NOW });

    expect(result.totalWishlistCount).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.bookId).toBe('book-2');
  });

  it('propagates deps.now() into the engine 90-day window', async () => {
    // Same two history points throughout — only the injected clock moves.
    // The older point (20000) is the 90-day-window candidate; whether it's
    // in range flips the reason from LOWEST_90_DAYS to PRICE_DROPPED (prevPrice
    // itself is window-independent, so PRICE_DROPPED still fires once min90
    // drops out of range).
    const historyPoint = new Date('2026-01-01T00:00:00.000Z');
    const currentPoint = new Date(historyPoint.getTime() + 1 * DAY_MS);
    const nowInsideWindow = new Date(historyPoint.getTime() + 90 * DAY_MS);
    const nowOutsideWindow = new Date(historyPoint.getTime() + 91 * DAY_MS);

    function makeHistoryRow(): BuyingOpportunityWishlistRow {
      return makeRow({
        canonicalBook: {
          id: 'book-3',
          title: 'Тіні забутих предків',
          listings: [
            {
              id: 'listing-3',
              provider: 'VIVAT',
              priceAmount: 9000,
              priceCurrency: 'UAH',
              availability: 'IN_STOCK',
              priceHistory: [
                { priceAmount: 20000, priceCurrency: 'UAH', availability: 'IN_STOCK', recordedAt: historyPoint },
                { priceAmount: 9000, priceCurrency: 'UAH', availability: 'IN_STOCK', recordedAt: currentPoint },
              ],
            },
          ],
        },
      });
    }

    const insidePrisma = makeFakePrisma([makeHistoryRow()]);
    const insideResult = await getBuyingOpportunities(insidePrisma, USER_ID, { now: () => nowInsideWindow });
    expect(insideResult.items[0]!.reason).toBe('LOWEST_90_DAYS');

    const outsidePrisma = makeFakePrisma([makeHistoryRow()]);
    const outsideResult = await getBuyingOpportunities(outsidePrisma, USER_ID, { now: () => nowOutsideWindow });
    expect(outsideResult.items[0]!.reason).toBe('PRICE_DROPPED');
  });
});
