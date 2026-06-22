import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { Provider, Availability, ScrapeRunStatus, ScrapeRunTrigger, ScrapeRunKind } from '@prisma/client';
import { runWishlistRefresh } from '../wishlist.refresh.js';
import type { WishlistTargetFetcher } from '../wishlist.refresh.js';
import type { RefreshTarget } from '../refresh-targets.js';
import type { RefreshedListingState } from '../events.js';

// ---------------------------------------------------------------------------
// Fixed clock
// ---------------------------------------------------------------------------

const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z');
const now = (): Date => FIXED_NOW;

// ---------------------------------------------------------------------------
// Fake PrismaClient that records scrape_run create/update calls
// ---------------------------------------------------------------------------

function makeFakePrisma() {
  return {
    scrapeRun: {
      create: vi.fn(async ({ data }: { data: { provider: Provider; kind: string; startedAt: Date } }) => ({
        id: `run-${data.provider}`,
        startedAt: data.startedAt,
      })),
      update: vi.fn(async () => ({})),
    },
  } as unknown as PrismaClient;
}

// ---------------------------------------------------------------------------
// Target fixtures
// ---------------------------------------------------------------------------

function makeTarget(overrides: Partial<RefreshTarget> & { provider: Provider; providerListingId: string }): RefreshTarget {
  return {
    canonicalBookId: 'book-1',
    url: `https://example.com/${overrides.providerListingId}`,
    currentPriceAmount: 10000,
    currentPriceCurrency: 'UAH',
    currentAvailability: Availability.IN_STOCK,
    lastSeenAt: FIXED_NOW,
    scope: { inWishlist: true, hasActiveAlert: false },
    ...overrides,
  };
}

const yakabooTarget = makeTarget({
  provider: Provider.YAKABOO,
  providerListingId: 'yak-1',
  currentPriceAmount: 10000,
  currentAvailability: Availability.IN_STOCK,
});

const vivatTarget = makeTarget({
  provider: Provider.VIVAT,
  providerListingId: 'vivat-1',
  currentPriceAmount: 12000,
  currentAvailability: Availability.IN_STOCK,
});

const silentLogger = { info: vi.fn(), error: vi.fn() };
const noSleep = async (): Promise<void> => {};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runWishlistRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('empty targets => no scrapeRun.create calls, outcomes=[], anySucceeded=true', async () => {
    const prisma = makeFakePrisma();
    const fetcher: WishlistTargetFetcher = { fetchTarget: vi.fn() };

    const result = await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      loadTargets: async () => [],
      sleep: noSleep,
      now,
      logger: silentLogger,
    });

    expect(result.outcomes).toHaveLength(0);
    expect(result.anySucceeded).toBe(true);
    expect(result.events).toHaveLength(0);
    expect(prisma.scrapeRun.create).not.toHaveBeenCalled();
  });

  it('one scrape_run per provider, finishScrapeRun called with SUCCESS, events captured', async () => {
    const prisma = makeFakePrisma();

    const fetcher: WishlistTargetFetcher = {
      fetchTarget: vi.fn(async (target: RefreshTarget): Promise<RefreshedListingState> => {
        if (target.providerListingId === 'yak-1') {
          // Price drop
          return { kind: 'fetched', priceAmount: 7000, availability: Availability.IN_STOCK };
        }
        if (target.providerListingId === 'vivat-1') {
          // Out of stock
          return { kind: 'fetched', priceAmount: null, availability: Availability.OUT_OF_STOCK };
        }
        return { kind: 'fetched', priceAmount: 10000, availability: Availability.IN_STOCK };
      }),
    };

    const result = await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      loadTargets: async () => [yakabooTarget, vivatTarget],
      sleep: noSleep,
      now,
      logger: silentLogger,
    });

    // One scrapeRun per provider (YAKABOO + VIVAT).
    expect(prisma.scrapeRun.create).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(prisma.scrapeRun.create).mock.calls) {
      expect(call[0].data.kind).toBe(ScrapeRunKind.WISHLIST_REFRESH);
    }

    // Both runs finalized.
    expect(prisma.scrapeRun.update).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(prisma.scrapeRun.update).mock.calls) {
      expect(call[0].data.status).toBe(ScrapeRunStatus.SUCCESS);
    }

    expect(result.anySucceeded).toBe(true);

    // YAKABOO: price drop event.
    const priceDrop = result.events.find((e) => e.type === 'PRICE_DROP');
    expect(priceDrop).toBeDefined();
    expect(priceDrop?.provider).toBe(Provider.YAKABOO);
    expect(priceDrop?.currentPriceAmount).toBe(7000);

    // VIVAT: out of stock event.
    const outOfStock = result.events.find((e) => e.type === 'OUT_OF_STOCK');
    expect(outOfStock).toBeDefined();
    expect(outOfStock?.provider).toBe(Provider.VIVAT);
  });

  it('rate-limited fetcher: provider loop breaks, rateLimited=true, remaining providers still processed', async () => {
    const prisma = makeFakePrisma();
    let yakCallCount = 0;

    const fetcher: WishlistTargetFetcher = {
      fetchTarget: vi.fn(async (target: RefreshTarget): Promise<RefreshedListingState> => {
        if (target.provider === Provider.YAKABOO) {
          yakCallCount++;
          throw new Error('HTTP 429 Too Many Requests');
        }
        return { kind: 'fetched', priceAmount: 10000, availability: Availability.IN_STOCK };
      }),
    };

    const extraYakTarget = makeTarget({ provider: Provider.YAKABOO, providerListingId: 'yak-2' });

    const result = await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      loadTargets: async () => [yakabooTarget, extraYakTarget, vivatTarget],
      sleep: noSleep,
      now,
      logger: silentLogger,
    });

    // YAKABOO ran but got rate-limited on first target → loop breaks.
    const yakOutcome = result.outcomes.find((o) => o.provider === Provider.YAKABOO);
    expect(yakOutcome).toBeDefined();
    expect(yakOutcome?.rateLimited).toBe(true);
    // Only one yak call (loop broke after first 429).
    expect(yakCallCount).toBe(1);

    // VIVAT still processed (provider isolation).
    const vivatOutcome = result.outcomes.find((o) => o.provider === Provider.VIVAT);
    expect(vivatOutcome).toBeDefined();
    expect(vivatOutcome?.status).toBe(ScrapeRunStatus.SUCCESS);

    expect(result.anySucceeded).toBe(true);
  });

  it('non-rate-limit fetch error: recorded in scrapeErrors, treated as gone, other targets still processed', async () => {
    const prisma = makeFakePrisma();
    let secondCallMade = false;

    const twoTargets = [
      makeTarget({ provider: Provider.YAKABOO, providerListingId: 'yak-fail' }),
      makeTarget({ provider: Provider.YAKABOO, providerListingId: 'yak-ok' }),
    ];

    const fetcher: WishlistTargetFetcher = {
      fetchTarget: vi.fn(async (target: RefreshTarget): Promise<RefreshedListingState> => {
        if (target.providerListingId === 'yak-fail') {
          throw new Error('connection timeout');
        }
        secondCallMade = true;
        return { kind: 'fetched', priceAmount: 10000, availability: Availability.IN_STOCK };
      }),
    };

    const result = await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      loadTargets: async () => twoTargets,
      sleep: noSleep,
      now,
      logger: silentLogger,
    });

    // Second target was still processed.
    expect(secondCallMade).toBe(true);

    const yakOutcome = result.outcomes[0]!;
    // Non-rate-limit error is recorded.
    expect(yakOutcome.scrapeErrors).toHaveLength(1);
    expect(yakOutcome.scrapeErrors[0]).toContain('connection timeout');
    expect(yakOutcome.rateLimited).toBe(false);

    // Graceful gone event emitted for the failing target.
    const goneEvent = result.events.find((e) => e.type === 'LISTING_GONE');
    expect(goneEvent).toBeDefined();
    expect(goneEvent?.providerListingId).toBe('yak-fail');
  });

  it('triggeredBy is passed to startScrapeRun', async () => {
    const prisma = makeFakePrisma();
    const fetcher: WishlistTargetFetcher = {
      fetchTarget: vi.fn(async (): Promise<RefreshedListingState> => ({
        kind: 'fetched',
        priceAmount: 10000,
        availability: Availability.IN_STOCK,
      })),
    };

    await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy: ScrapeRunTrigger.CRON,
      loadTargets: async () => [yakabooTarget],
      sleep: noSleep,
      now,
      logger: silentLogger,
    });

    const createCall = vi.mocked(prisma.scrapeRun.create).mock.calls[0]!;
    expect(createCall[0].data.triggeredBy).toBe(ScrapeRunTrigger.CRON);
  });

  it('outcomes are returned in sorted provider order (deterministic)', async () => {
    const prisma = makeFakePrisma();
    const fetcher: WishlistTargetFetcher = {
      fetchTarget: vi.fn(async (): Promise<RefreshedListingState> => ({
        kind: 'fetched',
        priceAmount: 10000,
        availability: Availability.IN_STOCK,
      })),
    };

    const result = await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      // Provide targets in reverse-alphabetical order.
      loadTargets: async () => [vivatTarget, yakabooTarget],
      sleep: noSleep,
      now,
      logger: silentLogger,
    });

    const providerOrder = result.outcomes.map((o) => o.provider);
    const sorted = [...providerOrder].sort();
    expect(providerOrder).toEqual(sorted);
  });

  it('anySucceeded=false when all provider runs fail', async () => {
    const prisma = makeFakePrisma();
    // Make the scrapeRun.create fail so the outer catch fires.
    vi.mocked(prisma.scrapeRun.create).mockRejectedValue(new Error('db down'));

    const fetcher: WishlistTargetFetcher = {
      fetchTarget: vi.fn(async (): Promise<RefreshedListingState> => ({ kind: 'gone' })),
    };

    const result = await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      loadTargets: async () => [yakabooTarget],
      sleep: noSleep,
      now,
      logger: silentLogger,
    });

    expect(result.anySucceeded).toBe(false);
    expect(result.outcomes[0]?.status).toBe(ScrapeRunStatus.FAILED);
  });

  it('uses injected clock for deterministic timestamps', async () => {
    const prisma = makeFakePrisma();
    const fetcher: WishlistTargetFetcher = {
      fetchTarget: vi.fn(async (): Promise<RefreshedListingState> => ({
        kind: 'fetched',
        priceAmount: 10000,
        availability: Availability.IN_STOCK,
      })),
    };

    await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      loadTargets: async () => [yakabooTarget],
      sleep: noSleep,
      now,
      logger: silentLogger,
    });

    // startedAt passed to create must match injected clock.
    const createCall = vi.mocked(prisma.scrapeRun.create).mock.calls[0]!;
    expect(createCall[0].data.startedAt).toEqual(FIXED_NOW);
  });

  it('sleep is called between targets within a provider', async () => {
    const prisma = makeFakePrisma();
    const sleepMock = vi.fn(async (): Promise<void> => {});
    const twoTargets = [
      makeTarget({ provider: Provider.YAKABOO, providerListingId: 'yak-a' }),
      makeTarget({ provider: Provider.YAKABOO, providerListingId: 'yak-b' }),
    ];

    const fetcher: WishlistTargetFetcher = {
      fetchTarget: vi.fn(async (): Promise<RefreshedListingState> => ({
        kind: 'fetched',
        priceAmount: 10000,
        availability: Availability.IN_STOCK,
      })),
    };

    await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      loadTargets: async () => twoTargets,
      sleep: sleepMock,
      delayMs: 500,
      now,
      logger: silentLogger,
    });

    // Two targets → sleep once between them.
    expect(sleepMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledWith(500);
  });
});
