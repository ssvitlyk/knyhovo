export { MetricCounter } from './metric-counter.js';
export { MetricGauge } from './metric-gauge.js';
export { MetricHistogram, DEFAULT_DURATION_BUCKETS_MS } from './metric-histogram.js';
export {
  InMemoryMetricsRegistry,
  ProductionMetricsRegistry,
} from './metrics-registry.js';
export type { MetricsRegistry, ProviderObservation } from './metrics-registry.js';
export { PrometheusExporter, PROMETHEUS_CONTENT_TYPE } from './prometheus-exporter.js';
export { labelKey } from './types.js';
export type {
  Labels,
  MetricType,
  MetricsSnapshot,
  MetricSnapshot,
  MetricsSource,
  CounterSnapshot,
  GaugeSnapshot,
  HistogramSnapshot,
  HistogramBucket,
  CounterSample,
  GaugeSample,
  HistogramSample,
} from './types.js';

// NOTE: PR2 ships the metrics layer (registry + exporter + instrumentation) but
// intentionally NO HTTP transport. A `GET /metrics` served from the long-running
// API process would only ever reflect that process's in-memory registry, while
// ingestion runs in a separate, short-lived cron CLI process — so the endpoint
// would report empty/stale data and mislead Ops. The HTTP transport lands in a
// follow-up PR, backed by a `scrape_runs`-derived `MetricsSource`. See
// docs/ops/metrics.md.
