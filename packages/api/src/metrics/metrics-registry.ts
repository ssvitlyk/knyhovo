import { MetricCounter } from './metric-counter.js';
import { MetricGauge } from './metric-gauge.js';
import { MetricHistogram } from './metric-histogram.js';
import type { MetricsSnapshot, MetricsSource } from './types.js';

/**
 * In-memory metrics registry: a named collection of counters, gauges and
 * histograms that produces a point-in-time {@link MetricsSnapshot}.
 * `counter`/`gauge`/`histogram` are get-or-create — calling them twice with the
 * same name returns the same instance, so registration is idempotent.
 */
export class InMemoryMetricsRegistry implements MetricsSource {
  private readonly counters = new Map<string, MetricCounter>();
  private readonly gauges = new Map<string, MetricGauge>();
  private readonly histograms = new Map<string, MetricHistogram>();

  counter(name: string, help: string): MetricCounter {
    let metric = this.counters.get(name);
    if (!metric) {
      metric = new MetricCounter(name, help);
      this.counters.set(name, metric);
    }
    return metric;
  }

  gauge(name: string, help: string): MetricGauge {
    let metric = this.gauges.get(name);
    if (!metric) {
      metric = new MetricGauge(name, help);
      this.gauges.set(name, metric);
    }
    return metric;
  }

  histogram(name: string, help: string, buckets?: readonly number[]): MetricHistogram {
    let metric = this.histograms.get(name);
    if (!metric) {
      metric = new MetricHistogram(name, help, buckets);
      this.histograms.set(name, metric);
    }
    return metric;
  }

  snapshot(): MetricsSnapshot {
    return {
      metrics: [
        ...[...this.counters.values()].map((c) => c.snapshot()),
        ...[...this.gauges.values()].map((g) => g.snapshot()),
        ...[...this.histograms.values()].map((h) => h.snapshot()),
      ],
    };
  }
}
