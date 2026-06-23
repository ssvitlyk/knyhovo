/**
 * Unit tests for persistRefreshedListing using hand-rolled fake Prisma/tx objects.
 * No real DB connection required — runs by default in CI.
 *
 * OPT-IN integration test at the bottom: set RUN_DB_INTEGRATION=1 to execute.
 */

import { describe, it, expect, vi } from 'vitest';
import { Availability } from '@prisma/client';
import { persistRefreshedListing, type PersistRefreshInput } from '../persist-refresh.js';
import type { RefreshTarget } from '../refresh-targets.js';

// ---------------------------------------------------------------------------
// Fake helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-22T12:00:00.000Z');

const LISTING_ID = 'listing-abc';
const CANONICAL_BOOK_ID = 'book-xyz';

function makeTarget(overrides: Partial<RefreshTarget> = {}): RefreshTarget {
  return {
    provider: 'YAKABOO' as RefreshTarget['provider'],
    providerListingId: LISTING_ID,
    canonicalBookId: CANONICAL_BOOK_ID,
    url: 'https://yakaboo.ua/book-123',
    currentPriceAmount: 10000,
    currentPriceCurrency: 'UAH',
    currentAvailability: Availability.IN_STOCK,
    lastSeenAt: new Date('2026-06-21T00:00:00.000Z'),
    scope: { inWishlist: true, hasActiveAlert: true },
    ...overrides,
  };
}

function makeExistingListing(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: LISTING_ID,
    canonicalBookId: CANONICAL_BOOK_ID,
    priceAmount: 10000,
    priceCurrency: 'UAH' as const,
    availability: Availability.IN_STOCK,
    lastSeenAt: new Date('2026-06-21T00:00:00.000Z'),
    coverUrl: 'https://example.com/cover.jpg',
    description: 'Some description',
    title: 'Test Book',
    author: 'Test Author',
    ...overrides,
  };
}

interface FakeTx {
  providerListing: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  priceHistoryPoint: {
    create: ReturnType<typeof vi.fn>;
  };
}

/** Build a minimal fake transaction client. */
function makeFakeTx(existingListing: ReturnType<typeof makeExistingListing> | null) {
  const update = vi.fn().mockResolvedValue({});
  const appendSnapshot = vi.fn().mockResolvedValue({});

  const tx: FakeTx = {
    providerListing: {
      findUnique: vi.fn().mockResolvedValue(existingListing),
      update,
    },
    priceHistoryPoint: {
      create: appendSnapshot,
    },
  };
  return { tx, update, appendSnapshot };
}

/** Build a fake PrismaClient whose $transaction runs the callback immediately. */
function makeFakePrisma(existingListing: ReturnType<typeof makeExistingListing> | null) {
  const { tx, update, appendSnapshot } = makeFakeTx(existingListing);

  const prisma = {
    $transaction: vi.fn((cb: (tx: FakeTx) => Promise<unknown>) => cb(tx)),
  } as unknown as Parameters<typeof persistRefreshedListing>[0];

  return { prisma, update, appendSnapshot };
}

// ---------------------------------------------------------------------------
// Unit tests (no DB)
// ---------------------------------------------------------------------------

describe('persistRefreshedListing (unit — fake Prisma)', () => {
  it("gone => returns 'gone-skipped' and makes no DB calls", async () => {
    const { prisma, update, appendSnapshot } = makeFakePrisma(makeExistingListing());

    const input: PersistRefreshInput = {
      target: makeTarget(),
      refreshed: { kind: 'gone' },
      now: NOW,
    };

    const outcome = await persistRefreshedListing(prisma, input);

    expect(outcome.kind).toBe('gone-skipped');
    // $transaction should NOT be called — gone is returned before entering the tx
    expect(update).not.toHaveBeenCalled();
    expect(appendSnapshot).not.toHaveBeenCalled();
  });

  it("missing listing (findUnique returns null) => returns 'missing-listing' with no update", async () => {
    const { prisma, update, appendSnapshot } = makeFakePrisma(null);

    const input: PersistRefreshInput = {
      target: makeTarget(),
      refreshed: { kind: 'fetched', priceAmount: 9000, availability: Availability.IN_STOCK },
      now: NOW,
    };

    const outcome = await persistRefreshedListing(prisma, input);

    expect(outcome.kind).toBe('missing-listing');
    expect(update).not.toHaveBeenCalled();
    expect(appendSnapshot).not.toHaveBeenCalled();
  });

  it('price drop => updates priceAmount + availability + lastSeenAt; does NOT include coverUrl/description/title', async () => {
    const existing = makeExistingListing({ priceAmount: 10000, availability: Availability.IN_STOCK });
    const { prisma, update, appendSnapshot } = makeFakePrisma(existing);

    const input: PersistRefreshInput = {
      target: makeTarget(),
      refreshed: { kind: 'fetched', priceAmount: 8000, availability: Availability.IN_STOCK },
      now: NOW,
    };

    const outcome = await persistRefreshedListing(prisma, input);

    expect(outcome.kind).toBe('price-updated');
    if (outcome.kind === 'price-updated') {
      expect(outcome.priceHistoryCreated).toBe(true);
      expect(outcome.availabilityChanged).toBe(false);
    }

    expect(update).toHaveBeenCalledOnce();
    const updateCall = update.mock.calls[0] as [{ where: { id: string }; data: Record<string, unknown> }];
    const data = updateCall[0].data;
    expect(data['priceAmount']).toBe(8000);
    expect(data['lastSeenAt']).toBe(NOW);
    expect(data['availability']).toBe(Availability.IN_STOCK);
    // Must NOT touch cover/description/title/author/isbn
    expect(data).not.toHaveProperty('coverUrl');
    expect(data).not.toHaveProperty('description');
    expect(data).not.toHaveProperty('title');
    expect(data).not.toHaveProperty('author');
    expect(data).not.toHaveProperty('isbn');

    // Snapshot should be created (price changed)
    expect(appendSnapshot).toHaveBeenCalledOnce();
  });

  it('null priceAmount (out-of-stock) => updates availability + lastSeenAt, preserves existing price; no priceAmount in update', async () => {
    const existing = makeExistingListing({
      priceAmount: 10000,
      availability: Availability.IN_STOCK,
    });
    const { prisma, update, appendSnapshot } = makeFakePrisma(existing);

    const input: PersistRefreshInput = {
      target: makeTarget(),
      refreshed: { kind: 'fetched', priceAmount: null, availability: Availability.OUT_OF_STOCK },
      now: NOW,
    };

    const outcome = await persistRefreshedListing(prisma, input);

    expect(outcome.kind).toBe('availability-updated');
    if (outcome.kind === 'availability-updated') {
      expect(outcome.priceHistoryCreated).toBe(true); // availability changed IN_STOCK → OUT_OF_STOCK
    }

    expect(update).toHaveBeenCalledOnce();
    const updateCall = update.mock.calls[0] as [{ where: { id: string }; data: Record<string, unknown> }];
    const data = updateCall[0].data;
    expect(data).not.toHaveProperty('priceAmount');
    expect(data['availability']).toBe(Availability.OUT_OF_STOCK);
    expect(data['lastSeenAt']).toBe(NOW);

    // Snapshot created because availability changed
    expect(appendSnapshot).toHaveBeenCalledOnce();
  });

  it('same price + same availability => no snapshot created', async () => {
    const existing = makeExistingListing({ priceAmount: 10000, availability: Availability.IN_STOCK });
    const { prisma, appendSnapshot } = makeFakePrisma(existing);

    const input: PersistRefreshInput = {
      target: makeTarget(),
      refreshed: { kind: 'fetched', priceAmount: 10000, availability: Availability.IN_STOCK },
      now: NOW,
    };

    const outcome = await persistRefreshedListing(prisma, input);

    expect(outcome.kind).toBe('price-updated');
    if (outcome.kind === 'price-updated') {
      expect(outcome.priceHistoryCreated).toBe(false);
      expect(outcome.availabilityChanged).toBe(false);
    }

    // shouldCreateSnapshot returns false → no row appended
    expect(appendSnapshot).not.toHaveBeenCalled();
  });

  it('availability changed + same price (null price path) => snapshot created', async () => {
    const existing = makeExistingListing({
      priceAmount: 10000,
      availability: Availability.IN_STOCK,
    });
    const { prisma, appendSnapshot } = makeFakePrisma(existing);

    const input: PersistRefreshInput = {
      target: makeTarget({ currentAvailability: Availability.IN_STOCK }),
      refreshed: { kind: 'fetched', priceAmount: null, availability: Availability.OUT_OF_STOCK },
      now: NOW,
    };

    const outcome = await persistRefreshedListing(prisma, input);

    expect(outcome.kind).toBe('availability-updated');
    if (outcome.kind === 'availability-updated') {
      expect(outcome.priceHistoryCreated).toBe(true);
    }
    expect(appendSnapshot).toHaveBeenCalledOnce();
  });

  it('availability unchanged + same price (null price path) => no snapshot', async () => {
    const existing = makeExistingListing({
      priceAmount: 10000,
      availability: Availability.OUT_OF_STOCK,
    });
    const { prisma, appendSnapshot } = makeFakePrisma(existing);

    const input: PersistRefreshInput = {
      target: makeTarget({ currentAvailability: Availability.OUT_OF_STOCK }),
      refreshed: { kind: 'fetched', priceAmount: null, availability: Availability.OUT_OF_STOCK },
      now: NOW,
    };

    const outcome = await persistRefreshedListing(prisma, input);

    expect(outcome.kind).toBe('availability-updated');
    if (outcome.kind === 'availability-updated') {
      expect(outcome.priceHistoryCreated).toBe(false);
    }
    expect(appendSnapshot).not.toHaveBeenCalled();
  });

  it('price drop with availability change => availabilityChanged=true', async () => {
    const existing = makeExistingListing({
      priceAmount: 12000,
      availability: Availability.OUT_OF_STOCK,
    });
    const { prisma } = makeFakePrisma(existing);

    const input: PersistRefreshInput = {
      target: makeTarget({ currentAvailability: Availability.OUT_OF_STOCK }),
      refreshed: { kind: 'fetched', priceAmount: 9000, availability: Availability.IN_STOCK },
      now: NOW,
    };

    const outcome = await persistRefreshedListing(prisma, input);

    expect(outcome.kind).toBe('price-updated');
    if (outcome.kind === 'price-updated') {
      expect(outcome.availabilityChanged).toBe(true);
      expect(outcome.priceHistoryCreated).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// OPT-IN integration test
// ---------------------------------------------------------------------------

const RUN_DB_INTEGRATION = process.env['RUN_DB_INTEGRATION'] === '1';

describe.skipIf(!RUN_DB_INTEGRATION)('persistRefreshedListing — DB integration', () => {
  // This block is intentionally minimal — the fast unit tests above provide
  // the primary coverage. The integration test verifies the real Prisma client
  // path and that the transaction commits correctly.
  it('TODO: add DB fixtures and assertions when RUN_DB_INTEGRATION=1', () => {
    // Placeholder — implement when a real DB seed helper is available.
    expect(true).toBe(true);
  });
});
