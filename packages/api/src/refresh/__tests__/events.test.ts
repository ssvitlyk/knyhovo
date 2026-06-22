import { describe, it, expect } from 'vitest';
import { Provider, Availability } from '@prisma/client';
import { detectAlertEvents } from '../events.js';
import type { TargetPreviousState, RefreshedListingState } from '../events.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DETECTED_AT = new Date('2026-01-01T00:00:00.000Z');

function makePrevious(overrides: Partial<TargetPreviousState> = {}): TargetPreviousState {
  return {
    provider: Provider.YAKABOO,
    providerListingId: 'listing-1',
    canonicalBookId: 'book-1',
    priceAmount: 10000,
    availability: Availability.IN_STOCK,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// detectAlertEvents — W10 PRD §5 transition matrix
// ---------------------------------------------------------------------------

describe('detectAlertEvents', () => {
  it('PRICE_DROP: price drops while IN_STOCK both sides', () => {
    const prev = makePrevious({ priceAmount: 10000, availability: Availability.IN_STOCK });
    const refreshed: RefreshedListingState = {
      kind: 'fetched',
      priceAmount: 8000,
      availability: Availability.IN_STOCK,
    };
    const events = detectAlertEvents(prev, refreshed, DETECTED_AT);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('PRICE_DROP');
    expect(events[0]!.currentPriceAmount).toBe(8000);
    expect(events[0]!.previousPriceAmount).toBe(10000);
    expect(events[0]!.detectedAt).toEqual(DETECTED_AT);
  });

  it('BACK_IN_STOCK: OUT_OF_STOCK → IN_STOCK (same price) produces BACK_IN_STOCK only, no PRICE_DROP', () => {
    const prev = makePrevious({ priceAmount: 10000, availability: Availability.OUT_OF_STOCK });
    const refreshed: RefreshedListingState = {
      kind: 'fetched',
      priceAmount: 10000,
      availability: Availability.IN_STOCK,
    };
    const events = detectAlertEvents(prev, refreshed, DETECTED_AT);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('BACK_IN_STOCK');
    expect(events.some((e) => e.type === 'PRICE_DROP')).toBe(false);
  });

  it('OUT_OF_STOCK: IN_STOCK → OUT_OF_STOCK produces OUT_OF_STOCK event', () => {
    const prev = makePrevious({ priceAmount: 10000, availability: Availability.IN_STOCK });
    const refreshed: RefreshedListingState = {
      kind: 'fetched',
      priceAmount: null,
      availability: Availability.OUT_OF_STOCK,
    };
    const events = detectAlertEvents(prev, refreshed, DETECTED_AT);
    const outOfStock = events.find((e) => e.type === 'OUT_OF_STOCK');
    expect(outOfStock).toBeDefined();
    expect(events.some((e) => e.type === 'PRICE_DROP')).toBe(false);
  });

  it('OUT_OF_STOCK: no PRICE_DROP even if priceAmount null while going out of stock', () => {
    const prev = makePrevious({ priceAmount: 10000, availability: Availability.IN_STOCK });
    const refreshed: RefreshedListingState = {
      kind: 'fetched',
      priceAmount: null,
      availability: Availability.OUT_OF_STOCK,
    };
    const events = detectAlertEvents(prev, refreshed, DETECTED_AT);
    expect(events.some((e) => e.type === 'PRICE_DROP')).toBe(false);
  });

  it('LISTING_GONE: gone returns single LISTING_GONE with previous price/availability (non-destructive)', () => {
    const prev = makePrevious({ priceAmount: 12000, availability: Availability.IN_STOCK });
    const refreshed: RefreshedListingState = { kind: 'gone' };
    const events = detectAlertEvents(prev, refreshed, DETECTED_AT);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('LISTING_GONE');
    // Non-destructive: previous state preserved in both current and previous fields.
    expect(events[0]!.currentPriceAmount).toBe(12000);
    expect(events[0]!.previousPriceAmount).toBe(12000);
    expect(events[0]!.currentAvailability).toBe(Availability.IN_STOCK);
    expect(events[0]!.previousAvailability).toBe(Availability.IN_STOCK);
  });

  it('no events: same price + same availability => []', () => {
    const prev = makePrevious({ priceAmount: 10000, availability: Availability.IN_STOCK });
    const refreshed: RefreshedListingState = {
      kind: 'fetched',
      priceAmount: 10000,
      availability: Availability.IN_STOCK,
    };
    expect(detectAlertEvents(prev, refreshed, DETECTED_AT)).toEqual([]);
  });

  it('null current price with IN_STOCK → IN_STOCK => [] (null does not count as a drop)', () => {
    const prev = makePrevious({ priceAmount: 10000, availability: Availability.IN_STOCK });
    const refreshed: RefreshedListingState = {
      kind: 'fetched',
      priceAmount: null,
      availability: Availability.IN_STOCK,
    };
    expect(detectAlertEvents(prev, refreshed, DETECTED_AT)).toEqual([]);
  });

  it('price drops but availability is OUT_OF_STOCK => no PRICE_DROP; OUT_OF_STOCK event fires if previous was IN_STOCK', () => {
    const prev = makePrevious({ priceAmount: 10000, availability: Availability.IN_STOCK });
    const refreshed: RefreshedListingState = {
      kind: 'fetched',
      priceAmount: 5000, // lower price
      availability: Availability.OUT_OF_STOCK,
    };
    const events = detectAlertEvents(prev, refreshed, DETECTED_AT);
    // PRICE_DROP must NOT fire when availability is OUT_OF_STOCK.
    expect(events.some((e) => e.type === 'PRICE_DROP')).toBe(false);
    // OUT_OF_STOCK transition fires.
    expect(events.some((e) => e.type === 'OUT_OF_STOCK')).toBe(true);
  });

  it('BACK_IN_STOCK + PRICE_DROP: comes back in stock at a lower price => both events', () => {
    const prev = makePrevious({ priceAmount: 10000, availability: Availability.OUT_OF_STOCK });
    const refreshed: RefreshedListingState = {
      kind: 'fetched',
      priceAmount: 7000,
      availability: Availability.IN_STOCK,
    };
    const events = detectAlertEvents(prev, refreshed, DETECTED_AT);
    expect(events.some((e) => e.type === 'BACK_IN_STOCK')).toBe(true);
    expect(events.some((e) => e.type === 'PRICE_DROP')).toBe(true);
  });

  it('UNKNOWN → IN_STOCK availability transition => BACK_IN_STOCK', () => {
    const prev = makePrevious({ availability: Availability.UNKNOWN });
    const refreshed: RefreshedListingState = {
      kind: 'fetched',
      priceAmount: 10000,
      availability: Availability.IN_STOCK,
    };
    const events = detectAlertEvents(prev, refreshed, DETECTED_AT);
    expect(events.some((e) => e.type === 'BACK_IN_STOCK')).toBe(true);
  });

  it('preserves provider/listing IDs in emitted events', () => {
    const prev = makePrevious({
      provider: Provider.VIVAT,
      providerListingId: 'vivat-listing-99',
      canonicalBookId: 'canonical-42',
    });
    const refreshed: RefreshedListingState = {
      kind: 'fetched',
      priceAmount: 5000,
      availability: Availability.IN_STOCK,
    };
    const [event] = detectAlertEvents(prev, refreshed, DETECTED_AT);
    expect(event?.provider).toBe(Provider.VIVAT);
    expect(event?.providerListingId).toBe('vivat-listing-99');
    expect(event?.canonicalBookId).toBe('canonical-42');
  });
});
