import { describe, it, expect } from 'vitest';
import {
  extractSignals,
  evaluateSignals,
  evaluateBuyingOpportunities,
  REASON_RANK,
  type BuyingSignals,
} from '../engine.js';
import type {
  BuyingOpportunityWishlistRow,
  BuyingOpportunityListingRow,
  BuyingOpportunityPointRow,
  BuyingOpportunityAlertRow,
} from '../repository.js';

const NOW = new Date('2026-07-16T00:00:00.000Z');
const DAY_MS = 86_400_000;

const BOOK_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function point(
  priceAmount: number,
  recordedAt: Date,
  availability: BuyingOpportunityPointRow['availability'] = 'IN_STOCK',
  priceCurrency: BuyingOpportunityPointRow['priceCurrency'] = 'UAH',
): BuyingOpportunityPointRow {
  return { priceAmount, priceCurrency, availability, recordedAt };
}

function listing(overrides: {
  id: string;
  provider?: BuyingOpportunityListingRow['provider'];
  priceAmount: number;
  availability?: BuyingOpportunityListingRow['availability'];
  priceCurrency?: BuyingOpportunityListingRow['priceCurrency'];
  priceHistory?: BuyingOpportunityPointRow[];
}): BuyingOpportunityListingRow {
  return {
    id: overrides.id,
    provider: overrides.provider ?? 'YAKABOO',
    priceAmount: overrides.priceAmount,
    priceCurrency: overrides.priceCurrency ?? 'UAH',
    availability: overrides.availability ?? 'IN_STOCK',
    priceHistory: overrides.priceHistory ?? [],
  };
}

function row(overrides: {
  id?: string;
  title?: string;
  listings: BuyingOpportunityListingRow[];
  alert?: BuyingOpportunityAlertRow | null;
}): BuyingOpportunityWishlistRow {
  return {
    canonicalBook: {
      id: overrides.id ?? BOOK_UUID,
      title: overrides.title ?? 'Кобзар',
      listings: overrides.listings,
    },
    alert: overrides.alert ?? null,
  };
}

function activeAlert(targetPriceAmount: number, targetPriceCurrency: 'UAH' = 'UAH'): BuyingOpportunityAlertRow {
  return { status: 'ACTIVE', targetPriceAmount, targetPriceCurrency };
}

// ── extractSignals ────────────────────────────────────────────────────────────

describe('extractSignals', () => {
  it('returns null when no listing is strictly IN_STOCK', () => {
    const r = row({
      listings: [
        listing({ id: '1', priceAmount: 10000, availability: 'OUT_OF_STOCK' }),
        listing({ id: '2', priceAmount: 12000, availability: 'UNKNOWN' }),
      ],
      alert: activeAlert(50000), // target met would not matter — excluded regardless
    });

    expect(extractSignals(r, NOW)).toBeNull();
  });

  it('picks the cheapest IN_STOCK listing, tie-broken by id ascending', () => {
    const r = row({
      listings: [
        listing({ id: 'b', priceAmount: 10000, provider: 'BOOK_CLUB' }),
        listing({ id: 'a', priceAmount: 10000, provider: 'YAKABOO' }),
      ],
    });

    const signals = extractSignals(r, NOW);
    expect(signals?.price).toBe(10000);
    expect(signals?.store).toBe('yakaboo');
  });

  it('excludes non-finite prices from the in-stock candidate set', () => {
    const r = row({
      listings: [
        listing({ id: 'a', priceAmount: Number.NaN }),
        listing({ id: 'b', priceAmount: 15000 }),
      ],
    });

    expect(extractSignals(r, NOW)?.price).toBe(15000);
  });

  it('prevPrice is the second-to-last point of the FULL history (unwindowed)', () => {
    const r = row({
      listings: [
        listing({
          id: 'a',
          priceAmount: 20000,
          priceHistory: [
            point(30000, new Date(NOW.getTime() - 400 * DAY_MS)),
            point(25000, new Date(NOW.getTime() - 10 * DAY_MS)),
            point(20000, NOW),
          ],
        }),
      ],
    });

    expect(extractSignals(r, NOW)?.prevPrice).toBe(25000);
  });

  it('prevPrice is null with fewer than 2 history points', () => {
    const r = row({
      listings: [
        listing({ id: 'a', priceAmount: 20000, priceHistory: [point(20000, NOW)] }),
      ],
    });

    expect(extractSignals(r, NOW)?.prevPrice).toBeNull();
  });

  it('min90 excludes the last point of the full history (no tautological LOWEST_90_DAYS)', () => {
    const r = row({
      listings: [
        listing({
          id: 'a',
          priceAmount: 15000,
          priceHistory: [
            point(20000, new Date(NOW.getTime() - 30 * DAY_MS)),
            point(15000, NOW), // last point — must be excluded from the window
          ],
        }),
      ],
    });

    expect(extractSignals(r, NOW)?.min90).toBe(20000);
  });

  it('a single-point (fresh flat) book has min90 = null, not a tautological low', () => {
    const r = row({
      listings: [
        listing({ id: 'a', priceAmount: 15000, priceHistory: [point(15000, NOW)] }),
      ],
    });

    const signals = extractSignals(r, NOW);
    expect(signals?.min90).toBeNull();
    expect(signals?.prevPrice).toBeNull();
  });

  it('a point recorded exactly 90 days ago is included in the window (inclusive boundary)', () => {
    const exactlyNinety = new Date(NOW.getTime() - 90 * DAY_MS);
    const r = row({
      listings: [
        listing({
          id: 'a',
          priceAmount: 18000,
          priceHistory: [
            point(12000, exactlyNinety),
            point(18000, NOW),
          ],
        }),
      ],
    });

    expect(extractSignals(r, NOW)?.min90).toBe(12000);
  });

  it('a point older than 90 days is excluded from the window', () => {
    const tooOld = new Date(NOW.getTime() - 91 * DAY_MS);
    const r = row({
      listings: [
        listing({
          id: 'a',
          priceAmount: 18000,
          priceHistory: [
            point(5000, tooOld),
            point(18000, NOW),
          ],
        }),
      ],
    });

    expect(extractSignals(r, NOW)?.min90).toBeNull();
  });

  it('targetPrice comes only from an ACTIVE alert with matching currency', () => {
    const r = row({
      listings: [listing({ id: 'a', priceAmount: 15000 })],
      alert: activeAlert(20000),
    });

    expect(extractSignals(r, NOW)?.targetPrice).toBe(20000);
  });

  it('targetPrice is null when the alert is PAUSED', () => {
    const r = row({
      listings: [listing({ id: 'a', priceAmount: 15000 })],
      alert: { status: 'PAUSED', targetPriceAmount: 20000, targetPriceCurrency: 'UAH' },
    });

    expect(extractSignals(r, NOW)?.targetPrice).toBeNull();
  });

  it('targetPrice is null when the alert currency differs from the price currency', () => {
    const r = row({
      listings: [listing({ id: 'a', priceAmount: 15000 })],
      alert: { status: 'ACTIVE', targetPriceAmount: 20000, targetPriceCurrency: 'EUR' as unknown as 'UAH' },
    });

    expect(extractSignals(r, NOW)?.targetPrice).toBeNull();
  });

  it('history is ignored (prevPrice/min90 stay null) when the selected listing currency differs from the cheapest (price) currency', () => {
    const r = row({
      listings: [
        // No history — excluded from selectListing's candidates entirely, so
        // it never becomes `selected`, but it IS the cheapest IN_STOCK listing
        // (currency = UAH).
        listing({ id: 'a', priceAmount: 15000, priceCurrency: 'UAH', priceHistory: [] }),
        // The only listing with history — becomes `selected`, but its currency
        // ('EUR') differs from the price currency above.
        listing({
          id: 'b',
          priceAmount: 99999,
          availability: 'UNKNOWN',
          priceCurrency: 'EUR' as unknown as 'UAH',
          priceHistory: [
            point(30000, new Date(NOW.getTime() - 30 * DAY_MS), 'IN_STOCK', 'EUR' as unknown as 'UAH'),
            point(15000, NOW, 'IN_STOCK', 'EUR' as unknown as 'UAH'),
          ],
        }),
      ],
    });

    const signals = extractSignals(r, NOW);
    expect(signals?.price).toBe(15000);
    expect(signals?.currency).toBe('UAH');
    expect(signals?.prevPrice).toBeNull();
    expect(signals?.min90).toBeNull();
  });

  it('TARGET_REACHED is possible without any history at all (prevPrice stays null)', () => {
    const r = row({
      listings: [listing({ id: 'a', priceAmount: 15000, priceHistory: [] })],
      alert: activeAlert(20000),
    });

    const signals = extractSignals(r, NOW);
    expect(signals?.targetPrice).toBe(20000);
    expect(signals?.prevPrice).toBeNull();
    expect(signals?.min90).toBeNull();
  });
});

// ── evaluateSignals ───────────────────────────────────────────────────────────

function signals(overrides: Partial<BuyingSignals>): BuyingSignals {
  return {
    bookId: BOOK_UUID,
    title: 'Кобзар',
    price: 10000,
    currency: 'UAH',
    store: 'yakaboo',
    prevPrice: null,
    min90: null,
    targetPrice: null,
    ...overrides,
  };
}

describe('evaluateSignals', () => {
  it('TARGET_REACHED when price <= targetPrice (boundary: equal)', () => {
    const verdict = evaluateSignals(signals({ price: 10000, targetPrice: 10000 }));
    expect(verdict?.reason).toBe('TARGET_REACHED');
  });

  it('LOWEST_90_DAYS when price <= min90 (boundary: equal)', () => {
    const verdict = evaluateSignals(signals({ price: 10000, min90: 10000 }));
    expect(verdict?.reason).toBe('LOWEST_90_DAYS');
  });

  it('PRICE_DROPPED requires strict < (equal prevPrice does NOT qualify)', () => {
    expect(evaluateSignals(signals({ price: 10000, prevPrice: 10000 }))).toBeNull();
  });

  it('PRICE_DROPPED fires when price < prevPrice', () => {
    const verdict = evaluateSignals(signals({ price: 9000, prevPrice: 10000 }));
    expect(verdict?.reason).toBe('PRICE_DROPPED');
    expect(verdict?.savingsAmount).toBe(1000);
  });

  it('priority: TARGET_REACHED wins over LOWEST_90_DAYS and PRICE_DROPPED', () => {
    const verdict = evaluateSignals(
      signals({ price: 5000, targetPrice: 8000, min90: 6000, prevPrice: 7000 }),
    );
    expect(verdict?.reason).toBe('TARGET_REACHED');
  });

  it('priority: LOWEST_90_DAYS wins over PRICE_DROPPED when target not met', () => {
    const verdict = evaluateSignals(
      signals({ price: 6000, targetPrice: 3000, min90: 6000, prevPrice: 7000 }),
    );
    expect(verdict?.reason).toBe('LOWEST_90_DAYS');
  });

  it('savings falls back to (targetPrice - price) when prevPrice is null', () => {
    const verdict = evaluateSignals(signals({ price: 8000, targetPrice: 10000, prevPrice: null }));
    expect(verdict?.savingsAmount).toBe(2000);
  });

  it('savings falls back to (min90 - price) when prevPrice is null', () => {
    const verdict = evaluateSignals(signals({ price: 8000, min90: 9000, prevPrice: null }));
    expect(verdict?.savingsAmount).toBe(1000);
  });

  it('savings is clamped to 0 when the reference is below price (prevPrice present but stale)', () => {
    // Target met (price <= target), but Knyhovo's own last tracked price was
    // actually lower than the current price — savings must never go negative.
    const verdict = evaluateSignals(
      signals({ price: 9000, targetPrice: 10000, prevPrice: 5000 }),
    );
    expect(verdict?.reason).toBe('TARGET_REACHED');
    expect(verdict?.savingsAmount).toBe(0);
  });

  it('returns null when price is above target/min90 and not below prevPrice', () => {
    expect(
      evaluateSignals(signals({ price: 10000, prevPrice: 10000, min90: 9000, targetPrice: 9000 })),
    ).toBeNull();
  });
});

// ── REASON_RANK ───────────────────────────────────────────────────────────────

describe('REASON_RANK', () => {
  it('orders TARGET_REACHED < LOWEST_90_DAYS < PRICE_DROPPED', () => {
    expect(REASON_RANK.TARGET_REACHED).toBeLessThan(REASON_RANK.LOWEST_90_DAYS);
    expect(REASON_RANK.LOWEST_90_DAYS).toBeLessThan(REASON_RANK.PRICE_DROPPED);
  });
});

// ── evaluateBuyingOpportunities (end-to-end + sorting) ────────────────────────

describe('evaluateBuyingOpportunities', () => {
  it('excludes non-qualifying books and returns [] when nothing qualifies', () => {
    const rows = [
      row({ listings: [listing({ id: 'a', priceAmount: 10000, priceHistory: [point(10000, NOW)] })] }),
    ];
    expect(evaluateBuyingOpportunities(rows, NOW)).toEqual([]);
  });

  it('sorts by reason priority ascending, then savingsAmount descending, then title (uk)', () => {
    const rows = [
      row({
        id: 'book-drop-small',
        title: 'Яблуко',
        listings: [
          listing({
            id: 'a',
            priceAmount: 9000,
            priceHistory: [point(9500, new Date(NOW.getTime() - 1 * DAY_MS)), point(9000, NOW)],
          }),
        ],
      }),
      row({
        id: 'book-drop-big',
        title: 'Апельсин',
        listings: [
          listing({
            id: 'b',
            priceAmount: 5000,
            priceHistory: [point(9000, new Date(NOW.getTime() - 1 * DAY_MS)), point(5000, NOW)],
          }),
        ],
      }),
      row({
        id: 'book-target',
        title: 'Ю-книга',
        listings: [listing({ id: 'c', priceAmount: 10000 })],
        alert: activeAlert(10000),
      }),
    ];

    const items = evaluateBuyingOpportunities(rows, NOW);
    expect(items.map((i) => i.bookId)).toEqual(['book-target', 'book-drop-big', 'book-drop-small']);
  });

  it('uk tie-break by title when reason and savingsAmount are equal', () => {
    const rows = [
      row({
        id: 'book-b',
        title: 'Б-книга',
        listings: [
          listing({
            id: 'a',
            priceAmount: 9000,
            priceHistory: [point(10000, new Date(NOW.getTime() - 1 * DAY_MS)), point(9000, NOW)],
          }),
        ],
      }),
      row({
        id: 'book-a',
        title: 'А-книга',
        listings: [
          listing({
            id: 'b',
            priceAmount: 9000,
            priceHistory: [point(10000, new Date(NOW.getTime() - 1 * DAY_MS)), point(9000, NOW)],
          }),
        ],
      }),
    ];

    const items = evaluateBuyingOpportunities(rows, NOW);
    expect(items.map((i) => i.bookId)).toEqual(['book-a', 'book-b']);
  });

  it('DTO omits title and includes all contract fields', () => {
    const rows = [
      row({
        id: 'book-target',
        title: 'Ю-книга',
        listings: [listing({ id: 'c', priceAmount: 10000, provider: 'BOOK_CLUB' })],
        alert: activeAlert(10000),
      }),
    ];

    const items = evaluateBuyingOpportunities(rows, NOW);
    expect(items).toEqual([
      {
        bookId: 'book-target',
        reason: 'TARGET_REACHED',
        savingsAmount: 0,
        price: 10000,
        prevPrice: null,
        currency: 'UAH',
        store: 'book-club',
      },
    ]);
    expect((items[0] as unknown as { title?: string }).title).toBeUndefined();
  });
});
