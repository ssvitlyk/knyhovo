import type { MetricsSnapshot, MetricsSource } from './types.js';
import { InMemoryMetricsRegistry } from './metrics-registry.js';
import { DEFAULT_DURATION_BUCKETS_MS } from './metric-histogram.js';

/**
 * A single aggregated row from the scrape_runs table, already mapped to
 * provider slug and plain status string. Decoupled from the Prisma client
 * so this module has no DB dependency.
 */
export interface ScrapeRunMetricsRow {
  provider: string; // already a slug, e.g. 'yakaboo', 'book-club'
  status: string; // 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED'
  durationMs: number | null;
  itemsFound: number;
  itemsUpdated: number;
  priceChanges: number;
  availabilityChanges: number;
  errorsCount: number;
}

/**
 * A {@link MetricsSource} that builds a fresh {@link MetricsSnapshot} from a
 * static slice of scrape_runs rows. Pure and synchronous — no DB access here;
 * the caller is responsible for fetching the rows.
 *
 * Metric names and help strings match {@link ProductionMetricsRegistry} for
 * the overlapping metrics so Prometheus sees a consistent label space regardless
 * of which source is queried.
 *
 * Counters and histograms are only registered (via get-or-create) the first time
 * a row is processed, so an empty row set produces an empty snapshot.
 */
export class ScrapeRunsMetricsSource implements MetricsSource {
  constructor(private readonly rows: readonly ScrapeRunMetricsRow[]) {}

  snapshot(): MetricsSnapshot {
    const registry = new InMemoryMetricsRegistry();

    if (this.rows.length === 0) {
      return registry.snapshot();
    }

    const scrapeRunsTotal = registry.counter('scrape_runs_total', 'Total provider scrape runs.');
    const providerSuccessTotal = registry.counter(
      'provider_success_total',
      'Provider runs that finished with status SUCCESS.',
    );
    const providerPartialTotal = registry.counter(
      'provider_partial_total',
      'Provider runs that finished with status PARTIAL.',
    );
    const providerFailedTotal = registry.counter(
      'provider_failed_total',
      'Provider runs that finished with status FAILED.',
    );
    const scrapeDurationMs = registry.histogram(
      'scrape_duration_ms',
      'Provider scrape run duration in milliseconds.',
      DEFAULT_DURATION_BUCKETS_MS,
    );
    const productsScrapedTotal = registry.counter(
      'products_scraped_total',
      'Listings returned by the scraper.',
    );
    const productsWrittenTotal = registry.counter(
      'products_written_total',
      'Listings persisted (created or updated).',
    );
    const priceHistoryInsertedTotal = registry.counter(
      'price_history_inserted_total',
      'Price-history rows inserted.',
    );
    const availabilityUpdatedTotal = registry.counter(
      'availability_updated_total',
      'Existing listings whose availability was refreshed.',
    );
    const scrapeErrorsTotal = registry.counter(
      'scrape_errors_total',
      'Total scrape errors recorded across runs.',
    );

    for (const row of this.rows) {
      const labels = { provider: row.provider };

      scrapeRunsTotal.inc(labels);

      if (row.status === 'SUCCESS') providerSuccessTotal.inc(labels);
      else if (row.status === 'PARTIAL') providerPartialTotal.inc(labels);
      else if (row.status === 'FAILED') providerFailedTotal.inc(labels);
      // RUNNING: no status counter, no histogram observation

      if (row.durationMs !== null) scrapeDurationMs.observe(row.durationMs, labels);

      productsScrapedTotal.inc(labels, row.itemsFound);
      productsWrittenTotal.inc(labels, row.itemsUpdated - row.availabilityChanges);
      priceHistoryInsertedTotal.inc(labels, row.priceChanges);
      availabilityUpdatedTotal.inc(labels, row.availabilityChanges);
      scrapeErrorsTotal.inc(labels, row.errorsCount);
    }

    return registry.snapshot();
  }
}
