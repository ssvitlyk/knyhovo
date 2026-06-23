/**
 * Unit tests for runAlertNotificationsForBooks using injected fake deps.
 * No real DB connection required.
 */

import { describe, it, expect, vi } from 'vitest';
import { runAlertNotificationsForBooks } from '../alert-notify.js';
import type { ActiveAlertForBook } from '../../wishlist/alert/repository.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-22T14:00:00.000Z');

const BOOK_A = 'book-a';
const BOOK_B = 'book-b';
const ALERT_1 = 'alert-001';
const TARGET = 10000; // 100 UAH

// Fake prisma — not used directly since all deps are injected, but typed correctly.
const fakePrisma = {} as Parameters<typeof runAlertNotificationsForBooks>[0];

function makeAlert(overrides: Partial<ActiveAlertForBook> = {}): ActiveAlertForBook {
  return {
    alertId: ALERT_1,
    canonicalBookId: BOOK_A,
    targetPriceAmount: TARGET,
    lastNotifiedAt: null,
    lastNotifiedPriceAmount: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runAlertNotificationsForBooks', () => {
  it('returns [] immediately when canonicalBookIds is empty', async () => {
    const findActiveAlerts = vi.fn();
    const findLowestPrices = vi.fn();
    const updateMarker = vi.fn();

    const events = await runAlertNotificationsForBooks(fakePrisma, [], NOW, {
      findActiveAlerts,
      findLowestPrices,
      updateMarker,
    });

    expect(events).toEqual([]);
    expect(findActiveAlerts).not.toHaveBeenCalled();
    expect(findLowestPrices).not.toHaveBeenCalled();
    expect(updateMarker).not.toHaveBeenCalled();
  });

  it('fires notify on first drop below target; updateMarker called with correct data', async () => {
    const alert = makeAlert({ alertId: ALERT_1, canonicalBookId: BOOK_A });
    const findActiveAlerts = vi.fn().mockResolvedValue([alert]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map([[BOOK_A, TARGET - 500]]));
    const updateMarker = vi.fn().mockResolvedValue(undefined);

    const events = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      updateMarker,
    });

    expect(events).toHaveLength(1);
    const evt = events[0]!;
    expect(evt.alertId).toBe(ALERT_1);
    expect(evt.canonicalBookId).toBe(BOOK_A);
    expect(evt.lowestPriceAmount).toBe(TARGET - 500);
    expect(evt.targetPriceAmount).toBe(TARGET);
    expect(evt.notifiedAt).toEqual(NOW);

    expect(updateMarker).toHaveBeenCalledOnce();
    expect(updateMarker).toHaveBeenCalledWith(fakePrisma, ALERT_1, {
      lastNotifiedAt: NOW,
      lastNotifiedPriceAmount: TARGET - 500,
    });
  });

  it('dedup suppresses second run with same price', async () => {
    const alert = makeAlert({
      lastNotifiedAt: new Date('2026-06-21T00:00:00.000Z'),
      lastNotifiedPriceAmount: TARGET - 500,
    });
    const findActiveAlerts = vi.fn().mockResolvedValue([alert]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map([[BOOK_A, TARGET - 500]]));
    const updateMarker = vi.fn();

    const events = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      updateMarker,
    });

    expect(events).toHaveLength(0);
    expect(updateMarker).not.toHaveBeenCalled();
  });

  it('reset clears marker when price rises above target', async () => {
    const alert = makeAlert({
      lastNotifiedAt: new Date('2026-06-20T00:00:00.000Z'),
      lastNotifiedPriceAmount: TARGET - 500,
    });
    const findActiveAlerts = vi.fn().mockResolvedValue([alert]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map([[BOOK_A, TARGET + 2000]]));
    const updateMarker = vi.fn().mockResolvedValue(undefined);

    const events = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      updateMarker,
    });

    expect(events).toHaveLength(0);
    expect(updateMarker).toHaveBeenCalledOnce();
    expect(updateMarker).toHaveBeenCalledWith(fakePrisma, ALERT_1, {
      lastNotifiedAt: null,
      lastNotifiedPriceAmount: null,
    });
  });

  it('reset when no in-stock offer and marker exists', async () => {
    const alert = makeAlert({
      lastNotifiedAt: new Date('2026-06-20T00:00:00.000Z'),
      lastNotifiedPriceAmount: TARGET - 100,
    });
    const findActiveAlerts = vi.fn().mockResolvedValue([alert]);
    // No in-stock listing for BOOK_A → absent from map
    const findLowestPrices = vi.fn().mockResolvedValue(new Map<string, number>());
    const updateMarker = vi.fn().mockResolvedValue(undefined);

    const events = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      updateMarker,
    });

    expect(events).toHaveLength(0);
    expect(updateMarker).toHaveBeenCalledWith(fakePrisma, ALERT_1, {
      lastNotifiedAt: null,
      lastNotifiedPriceAmount: null,
    });
  });

  it('no in-stock offer and no marker => none; no updateMarker call', async () => {
    const alert = makeAlert(); // no marker
    const findActiveAlerts = vi.fn().mockResolvedValue([alert]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map<string, number>());
    const updateMarker = vi.fn();

    const events = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      updateMarker,
    });

    expect(events).toHaveLength(0);
    expect(updateMarker).not.toHaveBeenCalled();
  });

  it('multiple alerts sorted by alertId', async () => {
    const alerts: ActiveAlertForBook[] = [
      makeAlert({ alertId: 'zzz-alert', canonicalBookId: BOOK_B, targetPriceAmount: 5000 }),
      makeAlert({ alertId: 'aaa-alert', canonicalBookId: BOOK_A, targetPriceAmount: TARGET }),
    ];
    const priceMap = new Map<string, number>([
      [BOOK_A, TARGET - 100],
      [BOOK_B, 4000],
    ]);
    const findActiveAlerts = vi.fn().mockResolvedValue(alerts);
    const findLowestPrices = vi.fn().mockResolvedValue(priceMap);
    const updateMarker = vi.fn().mockResolvedValue(undefined);

    const events = await runAlertNotificationsForBooks(
      fakePrisma,
      [BOOK_A, BOOK_B],
      NOW,
      { findActiveAlerts, findLowestPrices, updateMarker },
    );

    expect(events).toHaveLength(2);
    expect(events[0]!.alertId).toBe('aaa-alert');
    expect(events[1]!.alertId).toBe('zzz-alert');
  });

  it('strictly lower price on subsequent run => notify again', async () => {
    const alert = makeAlert({
      lastNotifiedAt: new Date('2026-06-21T00:00:00.000Z'),
      lastNotifiedPriceAmount: TARGET - 200,
    });
    const findActiveAlerts = vi.fn().mockResolvedValue([alert]);
    const findLowestPrices = vi.fn().mockResolvedValue(new Map([[BOOK_A, TARGET - 500]]));
    const updateMarker = vi.fn().mockResolvedValue(undefined);

    const events = await runAlertNotificationsForBooks(fakePrisma, [BOOK_A], NOW, {
      findActiveAlerts,
      findLowestPrices,
      updateMarker,
    });

    expect(events).toHaveLength(1);
    expect(events[0]!.lowestPriceAmount).toBe(TARGET - 500);
    expect(updateMarker).toHaveBeenCalledWith(fakePrisma, ALERT_1, {
      lastNotifiedAt: NOW,
      lastNotifiedPriceAmount: TARGET - 500,
    });
  });
});
