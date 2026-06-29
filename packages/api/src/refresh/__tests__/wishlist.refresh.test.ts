import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { Provider, Availability, ScrapeRunStatus, ScrapeRunTrigger, ScrapeRunKind } from '@prisma/client';
import { runWishlistRefresh } from '../wishlist.refresh.js';
import type { WishlistTargetFetcher } from '../wishlist.refresh.js';
import type { RefreshTarget } from '../refresh-targets.js';
import type { RefreshedListingState } from '../events.js';
import type { PersistRefreshOutcome } from '../persist-refresh.js';
import type { EnqueuedDelivery } from '../alert-notify.js';

// Mock the concurrency-guard so wishlist tests can control lock behaviour without a real DB.
vi.mock('../concurrency-guard.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../concurrency-guard.js')>();
  return {
    ...actual,
    acquireRefreshLock: vi.fn(async () => ({ acquiredAt: new Date(), kind: ScrapeRunKind.WISHLIST_REFRESH })),
    releaseRefreshLock: vi.fn(async () => undefined),
  };
});

import { acquireRefreshLock, releaseRefreshLock, RefreshAlreadyRunningError } from '../concurrency-guard.js';

const mockAcquire = vi.mocked(acquireRefreshLock);
const mockRelease = vi.mocked(releaseRefreshLock);

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
      findFirst: vi.fn(async () => null),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  } as unknown as PrismaClient;
}

// ---------------------------------------------------------------------------
// Injectable port no-ops for tests (avoids real DB writes)
// ---------------------------------------------------------------------------

const noopPersist = async (): Promise<PersistRefreshOutcome> => ({ kind: 'gone-skipped' });
const noopNotify = async (): Promise<EnqueuedDelivery[]> => [];

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
    // Default: guard allows — no running lock
    mockAcquire.mockResolvedValue({ acquiredAt: FIXED_NOW, kind: ScrapeRunKind.WISHLIST_REFRESH });
    mockRelease.mockResolvedValue(undefined);
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
      persistRefresh: noopPersist,
      runAlertNotifications: noopNotify,
    });

    expect(result.outcomes).toHaveLength(0);
    expect(result.anySucceeded).toBe(true);
    expect(result.events).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
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
      persistRefresh: noopPersist,
      runAlertNotifications: noopNotify,
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
      persistRefresh: noopPersist,
      runAlertNotifications: noopNotify,
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
      persistRefresh: noopPersist,
      runAlertNotifications: noopNotify,
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
      persistRefresh: noopPersist,
      runAlertNotifications: noopNotify,
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
      persistRefresh: noopPersist,
      runAlertNotifications: noopNotify,
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
      persistRefresh: noopPersist,
      runAlertNotifications: noopNotify,
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
      persistRefresh: noopPersist,
      runAlertNotifications: noopNotify,
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
      persistRefresh: noopPersist,
      runAlertNotifications: noopNotify,
    });

    // Two targets → sleep once between them.
    expect(sleepMock).toHaveBeenCalledTimes(1);
    expect(sleepMock).toHaveBeenCalledWith(500);
  });

  // ---------------------------------------------------------------------------
  // W10.4: persistence metrics from persist outcome
  // ---------------------------------------------------------------------------

  it('persist outcome=price-updated increments providerListingsUpdated + priceHistoryCreated', async () => {
    const prisma = makeFakePrisma();
    const fetcher: WishlistTargetFetcher = {
      fetchTarget: vi.fn(async (): Promise<RefreshedListingState> => ({
        kind: 'fetched',
        priceAmount: 7000,
        availability: Availability.IN_STOCK,
      })),
    };

    const result = await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      loadTargets: async () => [yakabooTarget],
      sleep: noSleep,
      now,
      logger: silentLogger,
      persistRefresh: async (): Promise<PersistRefreshOutcome> => ({
        kind: 'price-updated',
        priceHistoryCreated: true,
        availabilityChanged: false,
      }),
      runAlertNotifications: noopNotify,
    });

    const metrics = result.outcomes[0]!.metrics;
    expect(metrics.providerListingsUpdated).toBe(1);
    expect(metrics.priceHistoryCreated).toBe(1);
    expect(metrics.availabilityUpdated).toBe(0);
  });

  it('persist outcome=availability-updated increments providerListingsUpdated + availabilityUpdated', async () => {
    const prisma = makeFakePrisma();
    const fetcher: WishlistTargetFetcher = {
      fetchTarget: vi.fn(async (): Promise<RefreshedListingState> => ({
        kind: 'fetched',
        priceAmount: null,
        availability: Availability.OUT_OF_STOCK,
      })),
    };

    const result = await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      loadTargets: async () => [yakabooTarget],
      sleep: noSleep,
      now,
      logger: silentLogger,
      persistRefresh: async (): Promise<PersistRefreshOutcome> => ({
        kind: 'availability-updated',
        priceHistoryCreated: false,
      }),
      runAlertNotifications: noopNotify,
    });

    const metrics = result.outcomes[0]!.metrics;
    expect(metrics.providerListingsUpdated).toBe(1);
    expect(metrics.availabilityUpdated).toBe(1);
    expect(metrics.priceHistoryCreated).toBe(0);
  });

  it('persist failure is non-fatal: scrapeErrors gets entry, loop continues', async () => {
    const prisma = makeFakePrisma();
    let secondFetchCalled = false;
    const twoTargets = [
      makeTarget({ provider: Provider.YAKABOO, providerListingId: 'yak-a' }),
      makeTarget({ provider: Provider.YAKABOO, providerListingId: 'yak-b' }),
    ];

    const fetcher: WishlistTargetFetcher = {
      fetchTarget: vi.fn(async (target: RefreshTarget): Promise<RefreshedListingState> => {
        if (target.providerListingId === 'yak-b') secondFetchCalled = true;
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
      persistRefresh: async (): Promise<PersistRefreshOutcome> => {
        throw new Error('DB write failed');
      },
      runAlertNotifications: noopNotify,
    });

    // Second target was still processed despite first persist failing.
    expect(secondFetchCalled).toBe(true);
    // Persist errors are captured in scrapeErrors.
    expect(result.outcomes[0]!.scrapeErrors.some((e) => e.includes('DB write failed'))).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // W10.4: alert dedup / notifications wiring
  // ---------------------------------------------------------------------------

  it('runAlertNotifications is called with affected canonicalBookIds, result exposed on result.notifications', async () => {
    const prisma = makeFakePrisma();
    const capturedIds: string[] = [];

    const targetA = makeTarget({ provider: Provider.YAKABOO, providerListingId: 'yak-a', canonicalBookId: 'book-A' });
    const targetB = makeTarget({ provider: Provider.VIVAT, providerListingId: 'vivat-b', canonicalBookId: 'book-B' });

    const fetcher: WishlistTargetFetcher = {
      fetchTarget: vi.fn(async (): Promise<RefreshedListingState> => ({
        kind: 'fetched',
        priceAmount: 7000,
        availability: Availability.IN_STOCK,
      })),
    };

    const fakeNotification: EnqueuedDelivery = {
      alertId: 'alert-1',
      canonicalBookId: 'book-A',
      type: 'PRICE_DROP',
      dedupKey: 'alert-1:price:7000',
      created: true,
    };

    const result = await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      loadTargets: async () => [targetA, targetB],
      sleep: noSleep,
      now,
      logger: silentLogger,
      persistRefresh: noopPersist,
      runAlertNotifications: async (_p, ids): Promise<EnqueuedDelivery[]> => {
        capturedIds.push(...ids);
        return [fakeNotification];
      },
    });

    // Both book IDs must be included in the dedup call.
    expect(capturedIds).toContain('book-A');
    expect(capturedIds).toContain('book-B');
    expect(capturedIds).toHaveLength(2);

    // Notification returned by port is surfaced in result.
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).toEqual(fakeNotification);
  });

  it('alert dedup failure is non-fatal: notifications=[], rest of result is valid', async () => {
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
      loadTargets: async () => [yakabooTarget],
      sleep: noSleep,
      now,
      logger: silentLogger,
      persistRefresh: noopPersist,
      runAlertNotifications: async (): Promise<EnqueuedDelivery[]> => {
        throw new Error('dedup DB exploded');
      },
    });

    // Dedup failure must not crash the refresh or set anySucceeded=false.
    expect(result.notifications).toHaveLength(0);
    expect(result.anySucceeded).toBe(true);
    expect(result.outcomes[0]?.status).toBe(ScrapeRunStatus.SUCCESS);
  });

  // ---------------------------------------------------------------------------
  // W10.6: concurrency guard integration
  // ---------------------------------------------------------------------------

  it('guard: rejects with RefreshAlreadyRunningError when acquireRefreshLock throws', async () => {
    const runningInfo = {
      id: 'existing-run',
      provider: Provider.YAKABOO,
      kind: ScrapeRunKind.FULL_CATALOG,
      startedAt: FIXED_NOW,
    };
    mockAcquire.mockRejectedValue(new RefreshAlreadyRunningError(runningInfo));
    const prisma = makeFakePrisma();

    await expect(
      runWishlistRefresh({
        prisma,
        fetcher: { fetchTarget: vi.fn() },
        triggeredBy: ScrapeRunTrigger.MANUAL,
        loadTargets: async () => [yakabooTarget],
        sleep: noSleep,
        now,
        logger: silentLogger,
        persistRefresh: noopPersist,
        runAlertNotifications: noopNotify,
      }),
    ).rejects.toThrow(RefreshAlreadyRunningError);

    // No provider scrape_run rows should be created
    expect(prisma.scrapeRun.create).not.toHaveBeenCalled();
  });

  it('guard: releaseRefreshLock is called in finally even when loadTargets throws', async () => {
    const prisma = makeFakePrisma();

    await expect(
      runWishlistRefresh({
        prisma,
        fetcher: { fetchTarget: vi.fn() },
        triggeredBy: ScrapeRunTrigger.MANUAL,
        loadTargets: async () => { throw new Error('boom'); },
        sleep: noSleep,
        now,
        logger: silentLogger,
        persistRefresh: noopPersist,
        runAlertNotifications: noopNotify,
      }),
    ).rejects.toThrow('boom');

    // Release must still have been called in the finally block
    expect(mockRelease).toHaveBeenCalledOnce();
  });

  it('guard: releaseRefreshLock is called in finally on happy path', async () => {
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
      persistRefresh: noopPersist,
      runAlertNotifications: noopNotify,
    });

    expect(mockRelease).toHaveBeenCalledOnce();
  });

  // ---------------------------------------------------------------------------
  // W10.4 headline: dedup across two consecutive runs (no duplicate notification)
  // ---------------------------------------------------------------------------

  it('dedup across runs: same low price on run2 enqueues the same key (created=false), no duplicate row', async () => {
    // Simulate the real runAlertNotificationsForBooks behaviour using injected deps
    // so this test is fully in-memory with no DB. In the W4b outbox model, dedup is
    // enforced by the delivery dedupKey, not by the alert marker.
    const { runAlertNotificationsForBooks } = await import('../alert-notify.js');

    const prisma = makeFakePrisma();

    const BOOK_ID = 'book-dedup';
    const ALERT_ID = 'alert-dedup';
    const TARGET_PRICE = 8000;
    const LOWEST_PRICE = 7000; // below target → should notify

    const fakeActiveAlerts = async () => [
      {
        alertId: ALERT_ID,
        canonicalBookId: BOOK_ID,
        userId: 'user-1',
        targetPriceAmount: TARGET_PRICE,
        lastNotifiedAt: null,
        lastNotifiedPriceAmount: null,
        // Already in stock at baseline so back-in-stock does not fire on first sight.
        lastObservedAvailability: 'IN_STOCK' as const,
      },
    ];

    const fakeLowestPrices = async () => new Map<string, number>([[BOOK_ID, LOWEST_PRICE]]);

    // In-memory outbox keyed by dedupKey (emulates the unique constraint).
    const outbox = new Set<string>();
    const fakeEnqueue = async (
      _prisma: PrismaClient,
      input: { dedupKey: string },
    ) => {
      if (outbox.has(input.dedupKey)) return { created: false, id: input.dedupKey };
      outbox.add(input.dedupKey);
      return { created: true, id: input.dedupKey };
    };

    const deps = {
      findActiveAlerts: fakeActiveAlerts,
      findLowestPrices: fakeLowestPrices,
      enqueue: fakeEnqueue,
    };

    // Run 1: price below target, no prior delivery → enqueue created.
    const run1 = await runAlertNotificationsForBooks(prisma, [BOOK_ID], FIXED_NOW, deps);
    expect(run1).toHaveLength(1);
    expect(run1[0]?.alertId).toBe(ALERT_ID);
    expect(run1[0]?.type).toBe('PRICE_DROP');
    expect(run1[0]?.created).toBe(true);
    expect(outbox.size).toBe(1);

    // Run 2: same price → same dedupKey → idempotent, no duplicate row.
    const run2 = await runAlertNotificationsForBooks(prisma, [BOOK_ID], FIXED_NOW, deps);
    expect(run2).toHaveLength(1);
    expect(run2[0]?.created).toBe(false);
    expect(outbox.size).toBe(1);
  });
});
