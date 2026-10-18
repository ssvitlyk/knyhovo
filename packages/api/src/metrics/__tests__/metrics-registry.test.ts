import { describe, it, expect } from 'vitest';
import { InMemoryMetricsRegistry } from '../metrics-registry.js';
import type { HistogramSnapshot } from '../types.js';

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
