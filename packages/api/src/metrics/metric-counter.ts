import type { CounterSnapshot, Labels } from './types.js';
import { labelKey } from './types.js';

/**
 * A monotonically increasing counter, partitioned by label set.
 *
 * Counters only ever go up (a negative `inc` throws): they model totals such as
 * "products scraped" or "scrape runs". Use a {@link MetricGauge} for values that
 * can fall.
 */
export class MetricCounter {
  private readonly series = new Map<string, { labels: Labels; value: number }>();

  constructor(
    readonly name: string,
    readonly help: string,
  ) {}

  inc(labels: Labels = {}, value = 1): void {
    if (value < 0) {
      throw new Error(`MetricCounter "${this.name}" cannot be incremented by a negative value`);
    }
    const key = labelKey(labels);
    const existing = this.series.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.series.set(key, { labels, value });
    }
  }

  get(labels: Labels = {}): number {
    return this.series.get(labelKey(labels))?.value ?? 0;
  }

  snapshot(): CounterSnapshot {
    return {
      type: 'counter',
      name: this.name,
      help: this.help,
      samples: [...this.series.values()].map((s) => ({ labels: s.labels, value: s.value })),
    };
  }
}
