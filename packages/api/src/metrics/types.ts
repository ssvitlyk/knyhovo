/**
 * Production metrics layer — value types.
 *
 * These describe the *shape* of metrics and their point-in-time snapshots. They
 * are deliberately free of any provider/pipeline coupling so the registry and
 * the Prometheus exporter can be unit-tested in isolation.
 */

/** A label set attached to a single time series, e.g. `{ provider: 'yakaboo' }`. */
export type Labels = Readonly<Record<string, string>>;

export type MetricType = 'counter' | 'gauge' | 'histogram';

/** One observed bucket of a histogram (`le` is the inclusive upper bound). */
export interface HistogramBucket {
  readonly le: number;
  readonly count: number;
}

export interface CounterSample {
  readonly labels: Labels;
  readonly value: number;
}

export interface GaugeSample {
  readonly labels: Labels;
  readonly value: number;
}

export interface HistogramSample {
  readonly labels: Labels;
  /** Cumulative bucket counts, ascending by `le`; the final `+Inf` equals `count`. */
  readonly buckets: readonly HistogramBucket[];
  readonly sum: number;
  readonly count: number;
}

export interface CounterSnapshot {
  readonly type: 'counter';
  readonly name: string;
  readonly help: string;
  readonly samples: readonly CounterSample[];
}

export interface GaugeSnapshot {
  readonly type: 'gauge';
  readonly name: string;
  readonly help: string;
  readonly samples: readonly GaugeSample[];
}

export interface HistogramSnapshot {
  readonly type: 'histogram';
  readonly name: string;
  readonly help: string;
  readonly samples: readonly HistogramSample[];
}

export type MetricSnapshot = CounterSnapshot | GaugeSnapshot | HistogramSnapshot;

/** A consistent, point-in-time view of every metric in a registry. */
export interface MetricsSnapshot {
  readonly metrics: readonly MetricSnapshot[];
}

/** Anything the `/metrics` route can render — kept minimal on purpose. */
export interface MetricsSource {
  snapshot(): MetricsSnapshot;
}

/**
 * Serialize a label set into a stable key so two equal sets (regardless of
 * insertion order) collapse onto the same time series.
 */
export function labelKey(labels: Labels): string {
  const names = Object.keys(labels).sort();
  return names.map((name) => `${name}=${labels[name]}`).join(',');
}
