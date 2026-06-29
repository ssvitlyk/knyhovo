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

export { ScrapeRunsMetricsSource } from './scrape-runs-source.js';
export type { ScrapeRunMetricsRow } from './scrape-runs-source.js';

// NOTE: PR3 added `GET /metrics` (see src/metrics/route.ts), backed by
// ScrapeRunsMetricsSource which aggregates from the scrape_runs DB table on
// each request. This approach is correct regardless of process boundary — the
// API process reads persisted run data rather than any in-memory registry.
