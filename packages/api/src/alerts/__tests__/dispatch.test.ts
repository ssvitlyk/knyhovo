import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';

// Mock the repository layers so the dispatcher runs fully in-memory.
vi.mock('../../refresh/notification-delivery.repository.js', () => ({
  findDueDeliveries: vi.fn(),
  loadDeliveryContext: vi.fn(),
  markDeliverySent: vi.fn(async () => undefined),
  markDeliveryFailed: vi.fn(async () => undefined),
  markDeliverySkipped: vi.fn(async () => undefined),
  deferDelivery: vi.fn(async () => undefined),
  countUserDeliveriesSince: vi.fn(async () => 0),
  setUserUnsubscribeToken: vi.fn(async () => undefined),
}));
vi.mock('../../wishlist/alert/repository.js', () => ({
  updateAlertNotificationMarker: vi.fn(async () => undefined),
  updateAlertStockMarker: vi.fn(async () => undefined),
}));

import * as repo from '../../refresh/notification-delivery.repository.js';
import * as alertRepo from '../../wishlist/alert/repository.js';
import { dispatchPendingDeliveries, type DispatchConfig, type DispatchDeps } from '../dispatch.js';
import { FakeAlertMailer, type SendResult, type AlertMailer } from '../mailer.js';

const NOW = new Date('2026-06-29T12:00:00.000Z');
const prisma = {} as PrismaClient;

const CONFIG: DispatchConfig = {
  maxAttempts: 4,
  backoffMs: [60_000, 300_000, 1_800_000],
  maxEmailsPerDay: 20,
  rateLimitDeferMs: 3_600_000,
  baseUrl: 'https://knyhovo.com',
  limit: 200,
};

type Ctx = NonNullable<Awaited<ReturnType<typeof repo.loadDeliveryContext>>>;
type Due = Awaited<ReturnType<typeof repo.findDueDeliveries>>[number];

function makeDue(overrides: Partial<Due> = {}): Due {
  return {
    id: 'del-1',
    alertId: 'alert-1',
    userId: 'user-1',
    canonicalBookId: 'book-1',
    type: 'PRICE_DROP',
    triggerPriceAmount: 24999,
    attempts: 0,
    dedupKey: 'alert-1:price:24999',
    ...overrides,
  };
}

function makeCtx(overrides: Partial<Ctx> = {}): Ctx {
  return {
    id: 'del-1',
    type: 'PRICE_DROP',
    alertId: 'alert-1',
    canonicalBookId: 'book-1',
    attempts: 0,
    triggerPriceAmount: 24999,
    targetPriceAmount: 30000,
    user: {
      id: 'user-1',
      email: 'reader@example.com',
      priceDropEnabled: true,
      backInStockEnabled: true,
      unsubscribedAt: null,
      unsubscribeToken: 'tok-1',
    },
    book: { title: 'Кобзар', author: 'Шевченко' },
    bestListing: { provider: 'YAKABOO', url: 'https://yakaboo.ua/k', priceAmount: 24999 },
    ...overrides,
  };
}

function makeDeps(mailer: AlertMailer = new FakeAlertMailer()): DispatchDeps {
  return { mailer, config: CONFIG, now: () => NOW, generateToken: () => 'gen-token' };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.countUserDeliveriesSince).mockResolvedValue(0);
});

describe('dispatchPendingDeliveries', () => {
  it('sends a PRICE_DROP and advances the price marker only after success', async () => {
    vi.mocked(repo.findDueDeliveries).mockResolvedValue([makeDue()]);
    vi.mocked(repo.loadDeliveryContext).mockResolvedValue(makeCtx());
    const mailer = new FakeAlertMailer({ ok: true, messageId: 'm-1' });

    const summary = await dispatchPendingDeliveries(prisma, makeDeps(mailer));

    expect(summary).toEqual({ sent: 1, failed: 0, skipped: 0, deferred: 0 });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.subject).toContain('Кобзар');
    expect(repo.markDeliverySent).toHaveBeenCalledWith(prisma, 'del-1', {
      providerMessageId: 'm-1',
      sentAt: NOW,
    });
    expect(alertRepo.updateAlertNotificationMarker).toHaveBeenCalledWith(prisma, 'alert-1', {
      lastNotifiedAt: NOW,
      lastNotifiedPriceAmount: 24999,
    });
    expect(alertRepo.updateAlertStockMarker).not.toHaveBeenCalled();
  });

  it('sends a BACK_IN_STOCK and advances the stock marker', async () => {
    vi.mocked(repo.findDueDeliveries).mockResolvedValue([makeDue({ type: 'BACK_IN_STOCK', triggerPriceAmount: null })]);
    vi.mocked(repo.loadDeliveryContext).mockResolvedValue(makeCtx({ type: 'BACK_IN_STOCK', triggerPriceAmount: null }));

    const summary = await dispatchPendingDeliveries(prisma, makeDeps());

    expect(summary.sent).toBe(1);
    expect(alertRepo.updateAlertStockMarker).toHaveBeenCalledWith(prisma, 'alert-1', {
      lastStockNotifiedAt: NOW,
      lastNotifiedAvailability: 'IN_STOCK',
    });
    expect(alertRepo.updateAlertNotificationMarker).not.toHaveBeenCalled();
  });

  it('skips and does not send when the user is unsubscribed', async () => {
    vi.mocked(repo.findDueDeliveries).mockResolvedValue([makeDue()]);
    vi.mocked(repo.loadDeliveryContext).mockResolvedValue(
      makeCtx({ user: { ...makeCtx().user, unsubscribedAt: NOW } }),
    );
    const mailer = new FakeAlertMailer();

    const summary = await dispatchPendingDeliveries(prisma, makeDeps(mailer));

    expect(summary.skipped).toBe(1);
    expect(mailer.sent).toHaveLength(0);
    expect(repo.markDeliverySkipped).toHaveBeenCalledWith(prisma, 'del-1', { lastError: 'user unsubscribed' });
  });

  it('skips when the matching per-type preference is disabled', async () => {
    vi.mocked(repo.findDueDeliveries).mockResolvedValue([makeDue()]);
    vi.mocked(repo.loadDeliveryContext).mockResolvedValue(
      makeCtx({ user: { ...makeCtx().user, priceDropEnabled: false } }),
    );

    const summary = await dispatchPendingDeliveries(prisma, makeDeps());
    expect(summary.skipped).toBe(1);
    expect(repo.markDeliverySkipped).toHaveBeenCalledWith(prisma, 'del-1', { lastError: 'price-drop disabled' });
  });

  it('skips when the book is no longer in stock', async () => {
    vi.mocked(repo.findDueDeliveries).mockResolvedValue([makeDue()]);
    vi.mocked(repo.loadDeliveryContext).mockResolvedValue(makeCtx({ bestListing: null }));

    const summary = await dispatchPendingDeliveries(prisma, makeDeps());
    expect(summary.skipped).toBe(1);
    expect(repo.markDeliverySkipped).toHaveBeenCalledWith(prisma, 'del-1', { lastError: 'no in-stock listing' });
  });

  it('defers (no attempt consumed) when the per-user daily cap is reached', async () => {
    vi.mocked(repo.findDueDeliveries).mockResolvedValue([makeDue()]);
    vi.mocked(repo.loadDeliveryContext).mockResolvedValue(makeCtx());
    vi.mocked(repo.countUserDeliveriesSince).mockResolvedValue(20);
    const mailer = new FakeAlertMailer();

    const summary = await dispatchPendingDeliveries(prisma, makeDeps(mailer));

    expect(summary.deferred).toBe(1);
    expect(mailer.sent).toHaveLength(0);
    expect(repo.deferDelivery).toHaveBeenCalledWith(prisma, 'del-1', new Date(NOW.getTime() + CONFIG.rateLimitDeferMs));
    expect(repo.markDeliveryFailed).not.toHaveBeenCalled();
  });

  it('lazily generates and persists an unsubscribe token when missing', async () => {
    vi.mocked(repo.findDueDeliveries).mockResolvedValue([makeDue()]);
    vi.mocked(repo.loadDeliveryContext).mockResolvedValue(
      makeCtx({ user: { ...makeCtx().user, unsubscribeToken: null } }),
    );
    const mailer = new FakeAlertMailer();

    await dispatchPendingDeliveries(prisma, makeDeps(mailer));

    expect(repo.setUserUnsubscribeToken).toHaveBeenCalledWith(prisma, 'user-1', 'gen-token');
    expect(mailer.sent[0]?.unsubscribeUrl).toContain('token=gen-token');
  });

  it('retries a transient failure with backoff and does not advance the marker', async () => {
    vi.mocked(repo.findDueDeliveries).mockResolvedValue([makeDue({ attempts: 0 })]);
    vi.mocked(repo.loadDeliveryContext).mockResolvedValue(makeCtx());
    const mailer = new FakeAlertMailer({ ok: false, retryable: true, error: '503' } as SendResult);

    const summary = await dispatchPendingDeliveries(prisma, makeDeps(mailer));

    expect(summary.failed).toBe(1);
    expect(repo.markDeliveryFailed).toHaveBeenCalledWith(prisma, 'del-1', {
      lastError: '503',
      attempts: 1,
      nextAttemptAt: new Date(NOW.getTime() + 60_000),
    });
    expect(alertRepo.updateAlertNotificationMarker).not.toHaveBeenCalled();
  });

  it('skips a non-retryable failure immediately', async () => {
    vi.mocked(repo.findDueDeliveries).mockResolvedValue([makeDue()]);
    vi.mocked(repo.loadDeliveryContext).mockResolvedValue(makeCtx());
    const mailer = new FakeAlertMailer({ ok: false, retryable: false, error: 'bad address' } as SendResult);

    const summary = await dispatchPendingDeliveries(prisma, makeDeps(mailer));
    expect(summary.skipped).toBe(1);
    expect(repo.markDeliverySkipped).toHaveBeenCalledWith(prisma, 'del-1', { lastError: 'bad address' });
  });

  it('gives up (skip) when retries are exhausted', async () => {
    vi.mocked(repo.findDueDeliveries).mockResolvedValue([makeDue({ attempts: 3 })]);
    vi.mocked(repo.loadDeliveryContext).mockResolvedValue(makeCtx({ attempts: 3 }));
    const mailer = new FakeAlertMailer({ ok: false, retryable: true, error: 'still 503' } as SendResult);

    const summary = await dispatchPendingDeliveries(prisma, makeDeps(mailer));
    expect(summary.skipped).toBe(1);
    expect(repo.markDeliverySkipped).toHaveBeenCalledWith(prisma, 'del-1', {
      lastError: 'exhausted retries: still 503',
    });
    expect(repo.markDeliveryFailed).not.toHaveBeenCalled();
  });

  it('isolates a crash in one delivery by marking it failed', async () => {
    vi.mocked(repo.findDueDeliveries).mockResolvedValue([makeDue()]);
    vi.mocked(repo.loadDeliveryContext).mockResolvedValue(makeCtx());
    const throwingMailer = {
      sendAlertEmail: vi.fn(async () => {
        throw new Error('kaboom');
      }),
    };

    const summary = await dispatchPendingDeliveries(prisma, makeDeps(throwingMailer));
    expect(summary.failed).toBe(1);
    expect(repo.markDeliveryFailed).toHaveBeenCalledWith(prisma, 'del-1', {
      lastError: 'kaboom',
      attempts: 1,
      nextAttemptAt: new Date(NOW.getTime() + 60_000),
    });
  });
});
