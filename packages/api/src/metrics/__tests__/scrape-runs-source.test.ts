import { describe, it, expect } from 'vitest';
import { ScrapeRunsMetricsSource } from '../scrape-runs-source.js';
import type { ScrapeRunMetricsRow } from '../scrape-runs-source.js';
import type { CounterSnapshot, HistogramSnapshot, MetricsSnapshot } from '../types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<ScrapeRunMetricsRow> = {}): ScrapeRunMetricsRow {
  return {
    provider: 'yakaboo',
    status: 'SUCCESS',
    durationMs: 1000,
    itemsFound: 100,
    itemsUpdated: 80,
    priceChanges: 10,
    availabilityChanges: 5,
    errorsCount: 0,
    ...overrides,
  };
}

function findCounter(snapshot: MetricsSnapshot, name: string): CounterSnapshot | undefined {
  const m = snapshot.metrics.find((x) => x.name === name);
  return m?.type === 'counter' ? (m as CounterSnapshot) : undefined;
}

function findHistogram(snapshot: MetricsSnapshot, name: string): HistogramSnapshot | undefined {
  const m = snapshot.metrics.find((x) => x.name === name);
  return m?.type === 'histogram' ? (m as HistogramSnapshot) : undefined;
}

function counterSample(snapshot: MetricsSnapshot, name: string, provider: string): number {
  const c = findCounter(snapshot, name);
  if (!c) return 0;
  const s = c.samples.find((x) => x.labels['provider'] === provider);
  return s?.value ?? 0;
}

function histogramSample(snapshot: MetricsSnapshot, name: string, provider: string) {
  const h = findHistogram(snapshot, name);
  return h?.samples.find((x) => x.labels['provider'] === provider);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ScrapeRunsMetricsSource', () => {
  it('empty rows → snapshot has no metrics', () => {
    const source = new ScrapeRunsMetricsSource([]);
    expect(source.snapshot().metrics).toHaveLength(0);
  });

  it('single SUCCESS run → correct counter and histogram values', () => {
    const row = makeRow({
      provider: 'yakaboo',
      status: 'SUCCESS',
      durationMs: 2500,
      itemsFound: 200,
      itemsUpdated: 150,
      priceChanges: 30,
      availabilityChanges: 20,
      errorsCount: 3,
    });
    const snap = new ScrapeRunsMetricsSource([row]).snapshot();

    expect(counterSample(snap, 'scrape_runs_total', 'yakaboo')).toBe(1);
    expect(counterSample(snap, 'provider_success_total', 'yakaboo')).toBe(1);
    expect(counterSample(snap, 'products_scraped_total', 'yakaboo')).toBe(200);
    // products_written_total = itemsUpdated - availabilityChanges = 150 - 20 = 130
    expect(counterSample(snap, 'products_written_total', 'yakaboo')).toBe(130);
    expect(counterSample(snap, 'price_history_inserted_total', 'yakaboo')).toBe(30);
    expect(counterSample(snap, 'availability_updated_total', 'yakaboo')).toBe(20);
    expect(counterSample(snap, 'scrape_errors_total', 'yakaboo')).toBe(3);

    const hSample = histogramSample(snap, 'scrape_duration_ms', 'yakaboo');
    expect(hSample).toBeDefined();
    expect(hSample!.count).toBe(1);
    expect(hSample!.sum).toBe(2500);
    // Terminal +Inf bucket must have count === 1
    expect(hSample!.buckets.at(-1)!.le).toBe(Number.POSITIVE_INFINITY);
    expect(hSample!.buckets.at(-1)!.count).toBe(1);
  });

  it('multiple runs for the same provider → counters sum', () => {
    const rows = [
      makeRow({ provider: 'yakaboo', status: 'SUCCESS', itemsFound: 100, priceChanges: 5, availabilityChanges: 2, itemsUpdated: 50 }),
      makeRow({ provider: 'yakaboo', status: 'SUCCESS', itemsFound: 200, priceChanges: 10, availabilityChanges: 3, itemsUpdated: 80 }),
    ];
    const snap = new ScrapeRunsMetricsSource(rows).snapshot();

    expect(counterSample(snap, 'scrape_runs_total', 'yakaboo')).toBe(2);
    expect(counterSample(snap, 'provider_success_total', 'yakaboo')).toBe(2);
    expect(counterSample(snap, 'products_scraped_total', 'yakaboo')).toBe(300);
    expect(counterSample(snap, 'price_history_inserted_total', 'yakaboo')).toBe(15);
  });

  it('mixed statuses — correct per-status counters; RUNNING contributes to total only', () => {
    const rows = [
      makeRow({ status: 'SUCCESS' }),
      makeRow({ status: 'PARTIAL' }),
      makeRow({ status: 'FAILED' }),
      makeRow({ status: 'RUNNING', durationMs: null }),
    ];
    const snap = new ScrapeRunsMetricsSource(rows).snapshot();

    expect(counterSample(snap, 'scrape_runs_total', 'yakaboo')).toBe(4);
    expect(counterSample(snap, 'provider_success_total', 'yakaboo')).toBe(1);
    expect(counterSample(snap, 'provider_partial_total', 'yakaboo')).toBe(1);
    expect(counterSample(snap, 'provider_failed_total', 'yakaboo')).toBe(1);

    // RUNNING has durationMs=null so histogram only has 3 observations
    const hSample = histogramSample(snap, 'scrape_duration_ms', 'yakaboo');
    expect(hSample!.count).toBe(3);
  });

  it('RUNNING row does not add to histogram when durationMs is null', () => {
    const rows = [makeRow({ status: 'RUNNING', durationMs: null })];
    const snap = new ScrapeRunsMetricsSource(rows).snapshot();

    expect(counterSample(snap, 'scrape_runs_total', 'yakaboo')).toBe(1);
    // No histogram sample at all since no durations were observed
    expect(histogramSample(snap, 'scrape_duration_ms', 'yakaboo')).toBeUndefined();
  });

  it('two providers → separate samples per provider label', () => {
    const rows = [
      makeRow({ provider: 'yakaboo', status: 'SUCCESS', itemsFound: 10 }),
      makeRow({ provider: 'book-club', status: 'FAILED', itemsFound: 5 }),
    ];
    const snap = new ScrapeRunsMetricsSource(rows).snapshot();

    expect(counterSample(snap, 'scrape_runs_total', 'yakaboo')).toBe(1);
    expect(counterSample(snap, 'scrape_runs_total', 'book-club')).toBe(1);
    expect(counterSample(snap, 'provider_success_total', 'yakaboo')).toBe(1);
    expect(counterSample(snap, 'provider_success_total', 'book-club')).toBe(0);
    expect(counterSample(snap, 'provider_failed_total', 'book-club')).toBe(1);
    expect(counterSample(snap, 'products_scraped_total', 'yakaboo')).toBe(10);
    expect(counterSample(snap, 'products_scraped_total', 'book-club')).toBe(5);

    // Verify label is provider on the counter sample
    const counterM = findCounter(snap, 'scrape_runs_total');
    const yakabootSample = counterM?.samples.find((s) => s.labels['provider'] === 'yakaboo');
    const bookClubSample = counterM?.samples.find((s) => s.labels['provider'] === 'book-club');
    expect(yakabootSample?.labels['provider']).toBe('yakaboo');
    expect(bookClubSample?.labels['provider']).toBe('book-club');
  });

  it('histogram bucket cumulativity for several duration values', () => {
    // DEFAULT_DURATION_BUCKETS_MS includes 1000ms, 2500ms, 5000ms
    const rows = [
      makeRow({ durationMs: 500 }),  // falls in <=500 bucket
      makeRow({ durationMs: 1500 }), // falls in <=2500 bucket
      makeRow({ durationMs: 6000 }), // falls in +Inf only
    ];
    const snap = new ScrapeRunsMetricsSource(rows).snapshot();
    const hSample = histogramSample(snap, 'scrape_duration_ms', 'yakaboo');

    expect(hSample).toBeDefined();
    expect(hSample!.count).toBe(3);
    expect(hSample!.sum).toBe(500 + 1500 + 6000);

    // Find the +Inf bucket: must equal total count
    const infBucket = hSample!.buckets.find((b) => b.le === Number.POSITIVE_INFINITY);
    expect(infBucket?.count).toBe(3);

    // Cumulative: the <=500 bucket should have count 1; <=2500 should have 2
    const b500 = hSample!.buckets.find((b) => b.le === 500);
    expect(b500?.count).toBe(1);

    const b2500 = hSample!.buckets.find((b) => b.le === 2500);
    expect(b2500?.count).toBe(2);
  });
});
