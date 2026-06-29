import type { HistogramSnapshot, Labels } from './types.js';
import { labelKey } from './types.js';

/**
 * Default buckets (milliseconds) for scrape-duration histograms — spanning a
 * fast single-page fetch (~50ms) to a multi-minute full-catalog crawl (5min).
 */
export const DEFAULT_DURATION_BUCKETS_MS: readonly number[] = [
  50, 100, 250, 500, 1000, 2500, 5000, 10_000, 30_000, 60_000, 120_000, 300_000,
];

interface SeriesState {
  labels: Labels;
  /** Per-bucket NON-cumulative counts, aligned to `bounds`; last entry is `+Inf`. */
  counts: number[];
  sum: number;
  count: number;
}

/**
 * A histogram: observations bucketed by configurable upper bounds, plus a running
 * sum and count, partitioned by label set. Snapshots expose cumulative bucket
 * counts (Prometheus convention), including the terminal `+Inf` bucket.
 */
export class MetricHistogram {
  /** Sorted bucket upper bounds (exclusive of the implicit `+Inf`). */
  private readonly bounds: number[];
  private readonly series = new Map<string, SeriesState>();

  constructor(
    readonly name: string,
    readonly help: string,
    buckets: readonly number[] = DEFAULT_DURATION_BUCKETS_MS,
  ) {
    this.bounds = [...buckets].sort((a, b) => a - b);
  }

  observe(value: number, labels: Labels = {}): void {
    const key = labelKey(labels);
    let state = this.series.get(key);
    if (!state) {
      // +1 slot for the implicit +Inf bucket.
      state = { labels, counts: new Array<number>(this.bounds.length + 1).fill(0), sum: 0, count: 0 };
      this.series.set(key, state);
    }
    state.sum += value;
    state.count += 1;
    const idx = this.bounds.findIndex((bound) => value <= bound);
    state.counts[idx === -1 ? this.bounds.length : idx]! += 1;
  }

  snapshot(): HistogramSnapshot {
    return {
      type: 'histogram',
      name: this.name,
      help: this.help,
      samples: [...this.series.values()].map((s) => {
        let cumulative = 0;
        const buckets = this.bounds.map((le, i) => {
          cumulative += s.counts[i]!;
          return { le, count: cumulative };
        });
        // Terminal +Inf bucket equals the total observation count.
        cumulative += s.counts[this.bounds.length]!;
        buckets.push({ le: Number.POSITIVE_INFINITY, count: cumulative });
        return { labels: s.labels, buckets, sum: s.sum, count: s.count };
      }),
    };
  }
}
