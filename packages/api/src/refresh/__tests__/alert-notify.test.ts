/**
 * Unit tests for the W4b ENQUEUE phase (runAlertNotificationsForBooks) using
 * injected fake deps. No real DB connection required.
 *
 * Verifies: price-drop enqueue + idempotency, price-marker reset (re-arm),
 * back-in-stock transition (rising edge once per episode), no spurious first-sight
 * back-in-stock, and that the price marker is NOT advanced on notify (deferred to
 * the dispatch phase).
 */

import { describe, it, expect, vi } from 'vitest';
import { runAlertNotificationsForBooks } from '../alert-notify.js';
import type { ActiveAlertForBook } from '../../wishlist/alert/repository.js';

const NOW = new Date('2026-06-29T14:00:00.000Z');

const BOOK_A = 'book-a';
const ALERT_1 = 'alert-001';
const USER_1 = 'user-1';
const TARGET = 10000; // 100 UAH

const fakePrisma = {} as Parameters<typeof runAlertNotificationsForBooks>[0];

function makeAlert(overrides: Partial<ActiveAlertForBook> = {}): ActiveAlertForBook {
  return {
    alertId: ALERT_1,
    canonicalBookId: BOOK_A,
    userId: USER_1,
    targetPriceAmount: TARGET,
    lastNotifiedAt: null,
    lastNotifiedPriceAmount: null,
    lastObservedAvailability: 'IN_STOCK', // baseline in stock so back-in-stock stays quiet
    ...overrides,
  };
}

/** Default enqueue stub: always reports a fresh insert. */
function makeEnqueue() {
  return vi.fn(async (_p: unknown, input: { dedupKey: string }) => ({
    created: true,
    id: input.dedupKey,
  }));
}

describe('runAlertNotificationsForBooks (enqueue phase)', () => {
  it('returns [] immediately when canonicalBookIds is empty', async () => {
    const findActiveAlerts = vi.fn();
    const findLowestPrices = vi.fn();
    const enqueue = makeEnqueue();

    const out = await runAlertNotificationsForBooks(fakePrisma, [], NOW, {
      findActiveAlerts,
      findLowestPrices,
      enqueue,
    });

    expect(out).toEqual([]);
    expect(findActiveAlerts).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('enqueues a PRICE_DROP on first drop below target with the price dedupKey', async () => {
    const findActiveAlerts = vi.fn().mockResolvedValue([makeAlert()]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map([[BOOK_A, TARGET - 500]]));
    const enqueue = makeEnqueue();
    const updatePriceMarker = vi.fn();

    const out = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      enqueue,
      updatePriceMarker,
    });

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ alertId: ALERT_1, type: 'PRICE_DROP', created: true });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]?.[1]).toMatchObject({
      dedupKey: `${ALERT_1}:price:${TARGET - 500}`,
      type: 'PRICE_DROP',
      userId: USER_1,
      triggerPriceAmount: TARGET - 500,
    });
    // Marker must NOT be advanced on notify (deferred to dispatch).
    expect(updatePriceMarker).not.toHaveBeenCalled();
  });

  it('does not enqueue PRICE_DROP when price is above target', async () => {
    const findActiveAlerts = vi.fn().mockResolvedValue([makeAlert()]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map([[BOOK_A, TARGET + 500]]));
    const enqueue = makeEnqueue();

    const out = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      enqueue,
    });

    expect(out).toHaveLength(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('resets the price marker (re-arm) when the price condition no longer holds', async () => {
    const alert = makeAlert({ lastNotifiedAt: NOW, lastNotifiedPriceAmount: TARGET - 500 });
    const findActiveAlerts = vi.fn().mockResolvedValue([alert]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map([[BOOK_A, TARGET + 1000]]));
    const enqueue = makeEnqueue();
    const updatePriceMarker = vi.fn();

    const out = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      enqueue,
      updatePriceMarker,
    });

    expect(out).toHaveLength(0);
    expect(enqueue).not.toHaveBeenCalled();
    expect(updatePriceMarker).toHaveBeenCalledWith(fakePrisma, ALERT_1, {
      lastNotifiedAt: null,
      lastNotifiedPriceAmount: null,
    });
  });

  it('does NOT fire back-in-stock on first sight of an already in-stock book (observe baseline)', async () => {
    // No prior observation; book in stock and below target.
    const alert = makeAlert({ lastObservedAvailability: null });
    const findActiveAlerts = vi.fn().mockResolvedValue([alert]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map([[BOOK_A, TARGET - 500]]));
    const enqueue = makeEnqueue();
    const updateStockMarker = vi.fn();

    const out = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      enqueue,
      updateStockMarker,
    });

    // Only the price-drop fires; back-in-stock records baseline only.
    expect(out.map((e) => e.type)).toEqual(['PRICE_DROP']);
    expect(updateStockMarker).toHaveBeenCalledWith(fakePrisma, ALERT_1, {
      lastNotifiedAvailability: 'IN_STOCK',
    });
  });

  it('fires BACK_IN_STOCK on a genuine OUT→IN transition and advances the marker to IN_STOCK', async () => {
    // Previously observed out of stock, now in stock but ABOVE target (so no price-drop).
    const alert = makeAlert({ lastObservedAvailability: 'OUT_OF_STOCK' });
    const findActiveAlerts = vi.fn().mockResolvedValue([alert]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map([[BOOK_A, TARGET + 2000]]));
    const enqueue = makeEnqueue();
    const updateStockMarker = vi.fn();

    const out = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      enqueue,
      updateStockMarker,
    });

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: 'BACK_IN_STOCK', created: true });
    expect(enqueue.mock.calls[0]?.[1]).toMatchObject({
      dedupKey: `${ALERT_1}:stock:${NOW.toISOString()}`,
      type: 'BACK_IN_STOCK',
      triggerPriceAmount: TARGET + 2000,
    });
    expect(updateStockMarker).toHaveBeenCalledWith(fakePrisma, ALERT_1, {
      lastNotifiedAvailability: 'IN_STOCK',
    });
  });

  it('records OUT_OF_STOCK observation (re-arm) without enqueueing when the book goes out of stock', async () => {
    const alert = makeAlert({ lastObservedAvailability: 'IN_STOCK' });
    const findActiveAlerts = vi.fn().mockResolvedValue([alert]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map()); // no in-stock listing
    const enqueue = makeEnqueue();
    const updateStockMarker = vi.fn();

    const out = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      enqueue,
      updateStockMarker,
    });

    expect(out).toHaveLength(0);
    expect(enqueue).not.toHaveBeenCalled();
    expect(updateStockMarker).toHaveBeenCalledWith(fakePrisma, ALERT_1, {
      lastNotifiedAvailability: 'OUT_OF_STOCK',
    });
  });

  it('emits both PRICE_DROP and BACK_IN_STOCK on a transition into stock below target, sorted by type', async () => {
    const alert = makeAlert({ lastObservedAvailability: 'OUT_OF_STOCK' });
    const findActiveAlerts = vi.fn().mockResolvedValue([alert]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map([[BOOK_A, TARGET - 100]]));
    const enqueue = makeEnqueue();
    const updateStockMarker = vi.fn();

    const out = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      enqueue,
      updateStockMarker,
    });

    expect(out.map((e) => e.type)).toEqual(['BACK_IN_STOCK', 'PRICE_DROP']);
    expect(enqueue).toHaveBeenCalledTimes(2);
  });

  it('reports created=false when the delivery key already exists (idempotent enqueue)', async () => {
    const findActiveAlerts = vi.fn().mockResolvedValue([makeAlert()]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map([[BOOK_A, TARGET - 500]]));
    const enqueue = vi.fn(async (_p: unknown, input: { dedupKey: string }) => ({
      created: false,
      id: input.dedupKey,
    }));

    const out = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      enqueue,
    });

    expect(out[0]?.created).toBe(false);
  });
});
