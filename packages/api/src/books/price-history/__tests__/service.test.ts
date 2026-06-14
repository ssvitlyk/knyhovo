import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { getBookPriceHistory } from '../service.js';

// Fixed "now" for deterministic period windows.
const NOW = new Date('2026-04-01T00:00:00.000Z');
const DEPS = { now: () => NOW };

const BOOK_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LISTING_A = 'listing-a-0000-0000-0000-000000000001';
const LISTING_B = 'listing-b-0000-0000-0000-000000000002';

// ── Dates inside various windows (relative to NOW = 2026-04-01) ──────────────
const IN_30D = new Date('2026-03-15T00:00:00.000Z');  // within 30d window
const IN_90D = new Date('2026-01-15T00:00:00.000Z');  // within 90d, outside 30d
const IN_1Y  = new Date('2025-05-01T00:00:00.000Z');  // within 1y, outside 90d
const OLD    = new Date('2024-01-01T00:00:00.000Z');  // outside 1y window

function makePoint(
  priceAmount: number,
  recordedAt: Date,
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN' = 'IN_STOCK',
) {
  return { priceAmount, priceCurrency: 'UAH' as const, availability, recordedAt };
}

function makeListing(
  id: string,
  priceAmount: number,
  availability: 'IN_STOCK' | 'OUT_OF_STOCK' | 'UNKNOWN',
  history: ReturnType<typeof makePoint>[],
) {
  return { id, priceAmount, priceCurrency: 'UAH' as const, availability, priceHistory: history };
}

function makePrisma(returnValue: unknown): PrismaClient {
  const db = {
    canonicalBook: {
      findUnique: vi.fn(async () => returnValue),
    },
  };
  return db as unknown as PrismaClient;
}

describe('getBookPriceHistory', () => {
  it('throws BookNotFoundError when book is not found', async () => {
    const prisma = makePrisma(null);
    await expect(getBookPriceHistory(prisma, BOOK_ID, '90d', DEPS)).rejects.toThrow(
      'Book not found',
    );
  });

  it('returns empty-state DTO when book has no listings with history', async () => {
    const prisma = makePrisma({ id: BOOK_ID, listings: [] });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, '90d', DEPS);
    expect(dto.current).toBeNull();
    expect(dto.points).toEqual([]);
    expect(dto.bookId).toBe(BOOK_ID);
    expect(dto.period).toBe('90d');
  });

  it('returns empty-state DTO when listing exists but has no history points', async () => {
    const prisma = makePrisma({
      id: BOOK_ID,
      listings: [makeListing(LISTING_A, 30000, 'IN_STOCK', [])],
    });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, '90d', DEPS);
    expect(dto.current).toBeNull();
    expect(dto.points).toEqual([]);
  });

  it('selects the cheapest available listing (IN_STOCK, lowest priceAmount)', async () => {
    const prisma = makePrisma({
      id: BOOK_ID,
      listings: [
        makeListing(LISTING_A, 40000, 'IN_STOCK', [makePoint(40000, IN_90D)]),
        makeListing(LISTING_B, 30000, 'IN_STOCK', [makePoint(30000, IN_90D)]),
      ],
    });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, '90d', DEPS);
    // Should pick LISTING_B (cheaper)
    expect(dto.current?.amount).toBe(30000);
  });

  it('tie-breaks cheapest available listing by id ascending', async () => {
    // Both listings have identical current price (30000) and both satisfy the
    // cheapest-available criteria, so selection is decided purely by id ascending
    // (LISTING_A < LISTING_B lexicographically). Their *histories* differ so the
    // chosen listing is observable: A has two points, B has one. The wrong choice
    // would surface as a different point count / current amount — so this test
    // fails if the id tie-break is removed.
    const prisma = makePrisma({
      id: BOOK_ID,
      listings: [
        makeListing(LISTING_B, 30000, 'IN_STOCK', [makePoint(31000, IN_90D)]),
        makeListing(LISTING_A, 30000, 'IN_STOCK', [
          makePoint(28000, IN_90D),
          makePoint(27000, IN_30D),
        ]),
      ],
    });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, '90d', DEPS);
    // LISTING_A selected by id-ascending tie-break → its 2-point history, not B's.
    expect(dto.points).toHaveLength(2);
    expect(dto.points.map((p) => p.amount)).toEqual([28000, 27000]);
    expect(dto.current?.amount).toBe(27000);
  });

  it('falls back to listing with latest history point when no available listing has history', async () => {
    // Both OOS — pick by latest recordedAt in history
    const earlier = new Date('2026-01-01T00:00:00.000Z');
    const later   = new Date('2026-03-01T00:00:00.000Z');
    const prisma = makePrisma({
      id: BOOK_ID,
      listings: [
        makeListing(LISTING_A, 30000, 'OUT_OF_STOCK', [makePoint(30000, earlier)]),
        makeListing(LISTING_B, 35000, 'OUT_OF_STOCK', [makePoint(35000, later)]),
      ],
    });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, '90d', DEPS);
    expect(dto.current?.amount).toBe(35000);
  });

  it('filters points by 30d window', async () => {
    const prisma = makePrisma({
      id: BOOK_ID,
      listings: [
        makeListing(LISTING_A, 30000, 'IN_STOCK', [
          makePoint(30000, OLD),
          makePoint(29000, IN_1Y),
          makePoint(28000, IN_90D),
          makePoint(27000, IN_30D),
        ]),
      ],
    });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, '30d', DEPS);
    expect(dto.points).toHaveLength(1);
    expect(dto.points[0].amount).toBe(27000);
  });

  it('filters points by 90d window', async () => {
    const prisma = makePrisma({
      id: BOOK_ID,
      listings: [
        makeListing(LISTING_A, 30000, 'IN_STOCK', [
          makePoint(30000, OLD),
          makePoint(29000, IN_1Y),
          makePoint(28000, IN_90D),
          makePoint(27000, IN_30D),
        ]),
      ],
    });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, '90d', DEPS);
    expect(dto.points).toHaveLength(2);
    expect(dto.points.map((p) => p.amount)).toEqual([28000, 27000]);
  });

  it('filters points by 1y window', async () => {
    const prisma = makePrisma({
      id: BOOK_ID,
      listings: [
        makeListing(LISTING_A, 30000, 'IN_STOCK', [
          makePoint(30000, OLD),
          makePoint(29000, IN_1Y),
          makePoint(28000, IN_90D),
          makePoint(27000, IN_30D),
        ]),
      ],
    });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, '1y', DEPS);
    expect(dto.points).toHaveLength(3);
    expect(dto.points.map((p) => p.amount)).toEqual([29000, 28000, 27000]);
  });

  it('returns all points for period=all (no filter)', async () => {
    const prisma = makePrisma({
      id: BOOK_ID,
      listings: [
        makeListing(LISTING_A, 30000, 'IN_STOCK', [
          makePoint(30000, OLD),
          makePoint(29000, IN_1Y),
          makePoint(28000, IN_90D),
          makePoint(27000, IN_30D),
        ]),
      ],
    });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, 'all', DEPS);
    expect(dto.points).toHaveLength(4);
  });

  it('returns empty-state when listing has history but zero points in the 30d window', async () => {
    // History points exist, but all are older than 30d.
    const prisma = makePrisma({
      id: BOOK_ID,
      listings: [
        makeListing(LISTING_A, 30000, 'IN_STOCK', [
          makePoint(30000, IN_90D), // outside 30d window
        ]),
      ],
    });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, '30d', DEPS);
    expect(dto.current).toBeNull();
    expect(dto.points).toEqual([]);
  });

  it('filters out mixed-currency points (keeps only selected listing currency)', async () => {
    // The selected listing is UAH but its history contains one stray non-UAH
    // point (cast through the row type, which only permits 'UAH'). The response
    // must drop it. If the currency filter were removed, all 3 points would
    // appear and this test would fail.
    const usdPoint = {
      priceAmount: 999,
      priceCurrency: 'USD',
      availability: 'IN_STOCK' as const,
      recordedAt: IN_90D,
    } as unknown as ReturnType<typeof makePoint>;
    const history = [
      makePoint(30000, IN_90D),
      usdPoint,
      makePoint(28000, IN_30D),
    ];
    const prisma = makePrisma({
      id: BOOK_ID,
      listings: [makeListing(LISTING_A, 30000, 'IN_STOCK', history)],
    });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, '90d', DEPS);
    // Only the two UAH points remain; the USD point is filtered out.
    expect(dto.points).toHaveLength(2);
    expect(dto.points.map((p) => p.amount)).toEqual([30000, 28000]);
    expect(dto.points.every((p) => p.currency === 'UAH')).toBe(true);
  });

  it('returns currency from selected listing in the DTO', async () => {
    const prisma = makePrisma({
      id: BOOK_ID,
      listings: [
        makeListing(LISTING_A, 30000, 'IN_STOCK', [makePoint(30000, IN_90D)]),
      ],
    });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, '90d', DEPS);
    expect(dto.currency).toBe('UAH');
  });

  it('prefers available listing over OOS listing even when OOS has lower price', async () => {
    const prisma = makePrisma({
      id: BOOK_ID,
      listings: [
        makeListing(LISTING_A, 20000, 'OUT_OF_STOCK', [makePoint(20000, IN_90D)]),
        makeListing(LISTING_B, 30000, 'IN_STOCK', [makePoint(30000, IN_90D)]),
      ],
    });
    const dto = await getBookPriceHistory(prisma, BOOK_ID, '90d', DEPS);
    // LISTING_B (IN_STOCK) should be preferred even though it's more expensive
    expect(dto.current?.amount).toBe(30000);
  });
});
