import type { ScrapeMetrics, ConflictReason } from '../pipeline/types.js';
import { MetricCounter } from './metric-counter.js';
import { MetricGauge } from './metric-gauge.js';
import { MetricHistogram } from './metric-histogram.js';
import type { MetricsSnapshot, MetricsSource } from './types.js';

/**
 * Generic registry contract: a named collection of metrics that produces a
 * point-in-time {@link MetricsSnapshot}. `counter`/`gauge`/`histogram` are
 * get-or-create — calling them twice with the same name returns the same
 * instance, so registration is idempotent.
 */
export interface MetricsRegistry extends MetricsSource {
  counter(name: string, help: string): MetricCounter;
  gauge(name: string, help: string): MetricGauge;
  histogram(name: string, help: string, buckets?: readonly number[]): MetricHistogram;
}

/**
 * In-memory implementation of {@link MetricsRegistry}. This is the single
 * storage backend — it backs both tests (used directly to assert on primitives)
 * and {@link ProductionMetricsRegistry} (which layers domain metrics on top).
 */
export class InMemoryMetricsRegistry implements MetricsRegistry {
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

/**
 * One finished provider run, in the minimal shape this layer needs to update
 * metrics. Built by the refresh layer from a `ProviderRefreshOutcome`; kept
 * structural so the metrics module stays decoupled from the refresh module.
 */
export interface ProviderObservation {
  readonly provider: string;
  /** Mirrors `ScrapeRunStatus` ('SUCCESS' | 'PARTIAL' | 'FAILED' | …). */
  readonly status: string;
  readonly metrics: ScrapeMetrics;
  readonly rateLimited: boolean;
  /** Wall-clock duration of the run, when known. */
  readonly durationMs?: number;
}

const CONFLICT_REASONS: readonly ConflictReason[] = [
  'ISBN_CONFLICT',
  'VOLUME_MISMATCH',
  'BUNDLE_MISMATCH',
];

/**
 * Domain registry: pre-declares every production metric and translates a
 * finished provider run into metric updates via {@link record}. It owns no
 * pipeline logic — it only reads the {@link ScrapeMetrics} the pipeline already
 * produced and increments counters accordingly.
 *
 * Backed by any {@link MetricsRegistry} (defaults to a fresh in-memory one) so
 * tests can inject a registry and assert on the underlying primitives.
 */
export class ProductionMetricsRegistry implements MetricsSource {
  private readonly scrapeRunsTotal: MetricCounter;
  private readonly scrapeDurationMs: MetricHistogram;
  private readonly providerSuccessTotal: MetricCounter;
  private readonly providerFailedTotal: MetricCounter;
  private readonly providerPartialTotal: MetricCounter;
  private readonly productsScrapedTotal: MetricCounter;
  private readonly productsWrittenTotal: MetricCounter;
  private readonly productsSkippedTotal: MetricCounter;
  private readonly skippedNoPriceTotal: MetricCounter;
  private readonly canonicalCreatedTotal: MetricCounter;
  private readonly canonicalMatchedTotal: MetricCounter;
  private readonly canonicalConflictsTotal: MetricCounter;
  private readonly canonicalConflictsByReason: MetricCounter;
  private readonly priceHistoryInsertedTotal: MetricCounter;
  private readonly availabilityUpdatedTotal: MetricCounter;
  private readonly rateLimitedTotal: MetricCounter;
  private readonly listingCreatedTotal: MetricCounter;
  private readonly listingUpdatedTotal: MetricCounter;

  constructor(private readonly registry: MetricsRegistry = new InMemoryMetricsRegistry()) {
    this.scrapeRunsTotal = registry.counter('scrape_runs_total', 'Total provider scrape runs.');
    this.scrapeDurationMs = registry.histogram(
      'scrape_duration_ms',
      'Provider scrape run duration in milliseconds.',
    );
    this.providerSuccessTotal = registry.counter(
      'provider_success_total',
      'Provider runs that finished with status SUCCESS.',
    );
    this.providerFailedTotal = registry.counter(
      'provider_failed_total',
      'Provider runs that finished with status FAILED.',
    );
    this.providerPartialTotal = registry.counter(
      'provider_partial_total',
      'Provider runs that finished with status PARTIAL.',
    );
    this.productsScrapedTotal = registry.counter(
      'products_scraped_total',
      'Listings returned by the scraper.',
    );
    this.productsWrittenTotal = registry.counter(
      'products_written_total',
      'Listings persisted (created or updated).',
    );
    this.productsSkippedTotal = registry.counter(
      'products_skipped_total',
      'Scraped listings not written (no-price skips plus canonical conflicts).',
    );
    this.skippedNoPriceTotal = registry.counter(
      'skipped_no_price_total',
      'New listings skipped because they had no price to persist.',
    );
    this.canonicalCreatedTotal = registry.counter(
      'canonical_created_total',
      'Canonical books created during matching.',
    );
    this.canonicalMatchedTotal = registry.counter(
      'canonical_matched_total',
      'Listings matched to an existing canonical book.',
    );
    this.canonicalConflictsTotal = registry.counter(
      'canonical_conflicts_total',
      'Listings dropped because canonical matching found a conflict.',
    );
    this.canonicalConflictsByReason = registry.counter(
      'canonical_conflicts_by_reason',
      'Canonical conflicts partitioned by reason.',
    );
    this.priceHistoryInsertedTotal = registry.counter(
      'price_history_inserted_total',
      'Price-history rows inserted.',
    );
    this.availabilityUpdatedTotal = registry.counter(
      'availability_updated_total',
      'Existing listings whose availability was refreshed.',
    );
    this.rateLimitedTotal = registry.counter(
      'rate_limited_total',
      'Provider runs that hit an HTTP 429/503 rate-limit signal.',
    );
    this.listingCreatedTotal = registry.counter(
      'listing_created_total',
      'Provider listings created.',
    );
    this.listingUpdatedTotal = registry.counter(
      'listing_updated_total',
      'Provider listings updated.',
    );
  }

  /** Fold one finished provider run into the metrics. Adds no pipeline behavior. */
  record(obs: ProviderObservation): void {
    const labels = { provider: obs.provider };
    const m = obs.metrics;

    this.scrapeRunsTotal.inc(labels);
    if (obs.status === 'SUCCESS') this.providerSuccessTotal.inc(labels);
    else if (obs.status === 'PARTIAL') this.providerPartialTotal.inc(labels);
    else if (obs.status === 'FAILED') this.providerFailedTotal.inc(labels);

    if (obs.durationMs !== undefined) this.scrapeDurationMs.observe(obs.durationMs, labels);

    this.productsScrapedTotal.inc(labels, m.scraped);
    this.productsWrittenTotal.inc(labels, m.providerListingsCreated + m.providerListingsUpdated);
    this.productsSkippedTotal.inc(labels, m.skippedNoPrice + m.conflicts);
    this.skippedNoPriceTotal.inc(labels, m.skippedNoPrice);

    this.canonicalCreatedTotal.inc(labels, m.created);
    this.canonicalMatchedTotal.inc(labels, m.matched);
    this.canonicalConflictsTotal.inc(labels, m.conflicts);
    for (const reason of CONFLICT_REASONS) {
      const n = m.conflictsByReason[reason];
      if (n > 0) this.canonicalConflictsByReason.inc({ ...labels, reason }, n);
    }

    this.priceHistoryInsertedTotal.inc(labels, m.priceHistoryCreated);
    this.availabilityUpdatedTotal.inc(labels, m.availabilityUpdated);
    this.listingCreatedTotal.inc(labels, m.providerListingsCreated);
    this.listingUpdatedTotal.inc(labels, m.providerListingsUpdated);

    if (obs.rateLimited) this.rateLimitedTotal.inc(labels);
  }

  snapshot(): MetricsSnapshot {
    return this.registry.snapshot();
  }
}
