import type { GaugeSnapshot, Labels } from './types.js';
import { labelKey } from './types.js';

/**
 * A gauge: a value that can go up or down (e.g. "providers currently running",
 * "last run timestamp"), partitioned by label set.
 */
export class MetricGauge {
  private readonly series = new Map<string, { labels: Labels; value: number }>();

  constructor(
    readonly name: string,
    readonly help: string,
  ) {}

  set(value: number, labels: Labels = {}): void {
    this.series.set(labelKey(labels), { labels, value });
  }

  inc(labels: Labels = {}, value = 1): void {
    const key = labelKey(labels);
    const existing = this.series.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.series.set(key, { labels, value });
    }
  }

  dec(labels: Labels = {}, value = 1): void {
    this.inc(labels, -value);
  }

  get(labels: Labels = {}): number {
    return this.series.get(labelKey(labels))?.value ?? 0;
  }

  snapshot(): GaugeSnapshot {
    return {
      type: 'gauge',
      name: this.name,
      help: this.help,
      samples: [...this.series.values()].map((s) => ({ labels: s.labels, value: s.value })),
    };
  }
}
