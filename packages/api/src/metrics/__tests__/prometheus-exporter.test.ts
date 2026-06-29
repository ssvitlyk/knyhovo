import { describe, it, expect } from 'vitest';
import { PrometheusExporter, PROMETHEUS_CONTENT_TYPE } from '../prometheus-exporter.js';
import { InMemoryMetricsRegistry } from '../metrics-registry.js';

const exporter = new PrometheusExporter();

describe('PrometheusExporter', () => {
  it('declares the v0.0.4 text content type', () => {
    expect(PROMETHEUS_CONTENT_TYPE).toBe('text/plain; version=0.0.4; charset=utf-8');
  });

  it('renders a counter with HELP, TYPE, and labelled samples', () => {
    const reg = new InMemoryMetricsRegistry();
    const c = reg.counter('scrape_runs_total', 'Total provider scrape runs.');
    c.inc({ provider: 'yakaboo' }, 3);

    const out = exporter.export(reg.snapshot());
    expect(out).toContain('# HELP scrape_runs_total Total provider scrape runs.');
    expect(out).toContain('# TYPE scrape_runs_total counter');
    expect(out).toContain('scrape_runs_total{provider="yakaboo"} 3');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('renders an unlabelled sample without braces', () => {
    const reg = new InMemoryMetricsRegistry();
    reg.counter('total', 'Total.').inc({}, 7);
    expect(exporter.export(reg.snapshot())).toContain('\ntotal 7');
  });

  it('sorts labels alphabetically for stable output', () => {
    const reg = new InMemoryMetricsRegistry();
    reg.counter('x_total', 'X.').inc({ provider: 'yakaboo', reason: 'ISBN_CONFLICT' }, 1);
    expect(exporter.export(reg.snapshot())).toContain(
      'x_total{provider="yakaboo",reason="ISBN_CONFLICT"} 1',
    );
  });

  it('escapes backslashes, quotes, and newlines in label values', () => {
    const reg = new InMemoryMetricsRegistry();
    reg.counter('x_total', 'X.').inc({ note: 'a"b\\c\nd' }, 1);
    expect(exporter.export(reg.snapshot())).toContain('x_total{note="a\\"b\\\\c\\nd"} 1');
  });

  it('renders a histogram with _bucket (incl. +Inf), _sum and _count', () => {
    const reg = new InMemoryMetricsRegistry();
    const h = reg.histogram('scrape_duration_ms', 'Duration.', [100, 1000]);
    h.observe(50, { provider: 'yakaboo' });
    h.observe(500, { provider: 'yakaboo' });

    const out = exporter.export(reg.snapshot());
    expect(out).toContain('# TYPE scrape_duration_ms histogram');
    expect(out).toContain('scrape_duration_ms_bucket{le="100",provider="yakaboo"} 1');
    expect(out).toContain('scrape_duration_ms_bucket{le="1000",provider="yakaboo"} 2');
    expect(out).toContain('scrape_duration_ms_bucket{le="+Inf",provider="yakaboo"} 2');
    expect(out).toContain('scrape_duration_ms_sum{provider="yakaboo"} 550');
    expect(out).toContain('scrape_duration_ms_count{provider="yakaboo"} 2');
  });

  it('renders a gauge', () => {
    const reg = new InMemoryMetricsRegistry();
    reg.gauge('running', 'Running providers.').set(2);
    const out = exporter.export(reg.snapshot());
    expect(out).toContain('# TYPE running gauge');
    expect(out).toContain('running 2');
  });

  it('returns an empty string for an empty registry', () => {
    expect(exporter.export(new InMemoryMetricsRegistry().snapshot())).toBe('');
  });

  it('renders non-finite values as +Inf / -Inf / NaN (Prometheus spec)', () => {
    const reg = new InMemoryMetricsRegistry();
    reg.gauge('pos', 'Pos.').set(Number.POSITIVE_INFINITY);
    reg.gauge('neg', 'Neg.').set(Number.NEGATIVE_INFINITY);
    reg.gauge('nan', 'NaN.').set(Number.NaN);

    const out = exporter.export(reg.snapshot());
    expect(out).toContain('\npos +Inf');
    expect(out).toContain('\nneg -Inf');
    expect(out).toContain('\nnan NaN');
  });

  it('leaves ordinary finite numbers unchanged', () => {
    const reg = new InMemoryMetricsRegistry();
    reg.gauge('g', 'G.').set(42);
    expect(exporter.export(reg.snapshot())).toContain('\ng 42');
  });
});
