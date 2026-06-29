import { describe, it, expect } from 'vitest';
import {
  InMemoryMetricsRegistry,
  ProductionMetricsRegistry,
} from '../metrics-registry.js';
import type { ScrapeMetrics } from '../../pipeline/types.js';
import type { CounterSnapshot, HistogramSnapshot } from '../types.js';

function makeMetrics(overrides: Partial<ScrapeMetrics> = {}): ScrapeMetrics {
  return {
    scraped: 0,
    matched: 0,
    created: 0,
    conflicts: 0,
    conflictsByReason: { ISBN_CONFLICT: 0, VOLUME_MISMATCH: 0, BUNDLE_MISMATCH: 0 },
    providerListingsCreated: 0,
    providerListingsUpdated: 0,
    priceHistoryCreated: 0,
    availabilityUpdated: 0,
    skippedNoPrice: 0,
    errors: 0,
    ...overrides,
  };
}

/** Find a counter sample's value by metric name and label set in a snapshot. */
function counterValue(
  registry: ProductionMetricsRegistry,
  name: string,
  labels: Record<string, string>,
): number {
  const metric = registry.snapshot().metrics.find((m) => m.name === name);
  if (!metric || metric.type !== 'counter') return NaN;
  const key = JSON.stringify(Object.entries(labels).sort());
  const sample = metric.samples.find((s) => JSON.stringify(Object.entries(s.labels).sort()) === key);
  return sample?.value ?? 0;
}

describe('InMemoryMetricsRegistry — primitives', () => {
  it('increments a counter and partitions by label set', () => {
    const reg = new InMemoryMetricsRegistry();
    const c = reg.counter('hits_total', 'Hits.');
    c.inc({ provider: 'yakaboo' });
    c.inc({ provider: 'yakaboo' }, 4);
    c.inc({ provider: 'vivat' });

    expect(c.get({ provider: 'yakaboo' })).toBe(5);
    expect(c.get({ provider: 'vivat' })).toBe(1);
    expect(c.get({ provider: 'unknown' })).toBe(0);
  });

  it('treats label order as irrelevant for series identity', () => {
    const reg = new InMemoryMetricsRegistry();
    const c = reg.counter('x_total', 'X.');
    c.inc({ a: '1', b: '2' });
    c.inc({ b: '2', a: '1' }, 9);
    expect(c.get({ a: '1', b: '2' })).toBe(10);
  });

  it('rejects negative counter increments', () => {
    const reg = new InMemoryMetricsRegistry();
    expect(() => reg.counter('x_total', 'X.').inc({}, -1)).toThrow();
  });

  it('returns the same instance on repeated registration (get-or-create)', () => {
    const reg = new InMemoryMetricsRegistry();
    expect(reg.counter('x_total', 'X.')).toBe(reg.counter('x_total', 'X.'));
    expect(reg.gauge('g', 'G.')).toBe(reg.gauge('g', 'G.'));
    expect(reg.histogram('h', 'H.')).toBe(reg.histogram('h', 'H.'));
  });

  it('supports gauge set/inc/dec', () => {
    const reg = new InMemoryMetricsRegistry();
    const g = reg.gauge('running', 'Running.');
    g.set(5);
    g.inc();
    g.dec({}, 2);
    expect(g.get()).toBe(4);
  });

  it('buckets histogram observations cumulatively with sum and count', () => {
    const reg = new InMemoryMetricsRegistry();
    const h = reg.histogram('dur_ms', 'Duration.', [100, 1000]);
    h.observe(50);
    h.observe(500);
    h.observe(5000);

    const snap = reg.snapshot().metrics.find((m) => m.name === 'dur_ms') as HistogramSnapshot;
    const sample = snap.samples[0]!;
    expect(sample.count).toBe(3);
    expect(sample.sum).toBe(5550);
    // Cumulative: <=100 has 1, <=1000 has 2, +Inf has 3.
    expect(sample.buckets.map((b) => b.count)).toEqual([1, 2, 3]);
    expect(sample.buckets.at(-1)!.le).toBe(Number.POSITIVE_INFINITY);
  });

  it('snapshot lists counters, gauges, then histograms', () => {
    const reg = new InMemoryMetricsRegistry();
    reg.counter('c_total', 'C.').inc();
    reg.gauge('g', 'G.').set(1);
    reg.histogram('h', 'H.').observe(1);
    const types = reg.snapshot().metrics.map((m) => m.type);
    expect(types).toEqual(['counter', 'gauge', 'histogram']);
  });
});

describe('ProductionMetricsRegistry.record', () => {
  it('folds a SUCCESS provider run into the expected counters', () => {
    const reg = new ProductionMetricsRegistry();
    reg.record({
      provider: 'yakaboo',
      status: 'SUCCESS',
      rateLimited: false,
      durationMs: 1234,
      metrics: makeMetrics({
        scraped: 100,
        matched: 40,
        created: 10,
        providerListingsCreated: 50,
        providerListingsUpdated: 30,
        priceHistoryCreated: 25,
        availabilityUpdated: 4,
        skippedNoPrice: 6,
        conflicts: 3,
        conflictsByReason: { ISBN_CONFLICT: 2, VOLUME_MISMATCH: 1, BUNDLE_MISMATCH: 0 },
      }),
    });

    const yak = { provider: 'yakaboo' };
    expect(counterValue(reg, 'scrape_runs_total', yak)).toBe(1);
    expect(counterValue(reg, 'provider_success_total', yak)).toBe(1);
    expect(counterValue(reg, 'provider_failed_total', yak)).toBe(0);
    expect(counterValue(reg, 'products_scraped_total', yak)).toBe(100);
    expect(counterValue(reg, 'products_written_total', yak)).toBe(80); // 50 + 30
    expect(counterValue(reg, 'products_skipped_total', yak)).toBe(9); // 6 no-price + 3 conflicts
    expect(counterValue(reg, 'skipped_no_price_total', yak)).toBe(6);
    expect(counterValue(reg, 'canonical_created_total', yak)).toBe(10);
    expect(counterValue(reg, 'canonical_matched_total', yak)).toBe(40);
    expect(counterValue(reg, 'canonical_conflicts_total', yak)).toBe(3);
    expect(counterValue(reg, 'price_history_inserted_total', yak)).toBe(25);
    expect(counterValue(reg, 'availability_updated_total', yak)).toBe(4);
    expect(counterValue(reg, 'listing_created_total', yak)).toBe(50);
    expect(counterValue(reg, 'listing_updated_total', yak)).toBe(30);
    expect(counterValue(reg, 'rate_limited_total', yak)).toBe(0);
  });

  it('partitions canonical_conflicts_by_reason by reason and omits zero reasons', () => {
    const reg = new ProductionMetricsRegistry();
    reg.record({
      provider: 'yakaboo',
      status: 'SUCCESS',
      rateLimited: false,
      metrics: makeMetrics({
        conflicts: 3,
        conflictsByReason: { ISBN_CONFLICT: 2, VOLUME_MISMATCH: 1, BUNDLE_MISMATCH: 0 },
      }),
    });

    expect(counterValue(reg, 'canonical_conflicts_by_reason', { provider: 'yakaboo', reason: 'ISBN_CONFLICT' })).toBe(2);
    expect(counterValue(reg, 'canonical_conflicts_by_reason', { provider: 'yakaboo', reason: 'VOLUME_MISMATCH' })).toBe(1);
    const byReason = reg.snapshot().metrics.find((m) => m.name === 'canonical_conflicts_by_reason') as CounterSnapshot;
    // BUNDLE_MISMATCH was zero, so it must not create a series.
    expect(byReason.samples.some((s) => s.labels['reason'] === 'BUNDLE_MISMATCH')).toBe(false);
  });

  it('counts PARTIAL and FAILED statuses and rate-limit signal', () => {
    const reg = new ProductionMetricsRegistry();
    reg.record({ provider: 'a', status: 'PARTIAL', rateLimited: true, metrics: makeMetrics() });
    reg.record({ provider: 'b', status: 'FAILED', rateLimited: false, metrics: makeMetrics() });

    expect(counterValue(reg, 'provider_partial_total', { provider: 'a' })).toBe(1);
    expect(counterValue(reg, 'rate_limited_total', { provider: 'a' })).toBe(1);
    expect(counterValue(reg, 'provider_failed_total', { provider: 'b' })).toBe(1);
  });

  it('accumulates across repeated records for the same provider', () => {
    const reg = new ProductionMetricsRegistry();
    reg.record({ provider: 'yakaboo', status: 'SUCCESS', rateLimited: false, metrics: makeMetrics({ scraped: 10 }) });
    reg.record({ provider: 'yakaboo', status: 'SUCCESS', rateLimited: false, metrics: makeMetrics({ scraped: 5 }) });

    expect(counterValue(reg, 'scrape_runs_total', { provider: 'yakaboo' })).toBe(2);
    expect(counterValue(reg, 'products_scraped_total', { provider: 'yakaboo' })).toBe(15);
  });

  it('records duration into the scrape_duration_ms histogram only when provided', () => {
    const reg = new ProductionMetricsRegistry();
    reg.record({ provider: 'yakaboo', status: 'SUCCESS', rateLimited: false, durationMs: 2000, metrics: makeMetrics() });
    reg.record({ provider: 'yakaboo', status: 'FAILED', rateLimited: false, metrics: makeMetrics() });

    const hist = reg.snapshot().metrics.find((m) => m.name === 'scrape_duration_ms') as HistogramSnapshot;
    const sample = hist.samples.find((s) => s.labels['provider'] === 'yakaboo')!;
    expect(sample.count).toBe(1); // only the run with durationMs
    expect(sample.sum).toBe(2000);
  });
});
