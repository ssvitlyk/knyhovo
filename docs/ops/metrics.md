# Production Metrics & Observability

This PR ships the **production metrics layer** — a registry, a set of metric
primitives, a Prometheus exporter, and pipeline instrumentation — but
intentionally **no HTTP `/metrics` endpoint yet**. See
[Why there is no HTTP endpoint yet](#why-there-is-no-http-endpoint-yet).

The layer sits **on top of** the existing per-run `ScrapeMetrics`: the pipeline
keeps producing the same in-memory counters and persisting them to `scrape_runs`,
and the metrics registry only *reads* finished provider outcomes and folds them
into counters/histograms. It adds no scraping, persistence, retry, matcher, or
health behavior.

## What's included

| Component | File | Role |
|-----------|------|------|
| `MetricCounter` / `MetricGauge` / `MetricHistogram` | `metrics/metric-*.ts` | Label-aware metric primitives (no external deps). |
| `MetricsRegistry` / `InMemoryMetricsRegistry` | `metrics/metrics-registry.ts` | Generic get-or-create metric collection + snapshot. |
| `ProductionMetricsRegistry` | `metrics/metrics-registry.ts` | Domain registry: `record(outcome)` folds one provider run into the production metrics. |
| `PrometheusExporter` | `metrics/prometheus-exporter.ts` | Renders a `MetricsSnapshot` into Prometheus text exposition format. |
| Instrumentation | `refresh/full-catalog.refresh.ts` | Calls `record(...)` after each provider, when a registry is supplied (observation only). |

The exporter and registry are decoupled by the `MetricsSource` interface
(`snapshot(): MetricsSnapshot`), so the eventual transport can read from any
source without touching the exporter.

## Why there is no HTTP endpoint yet

Ingestion and the API are **separate processes**:

```
┌─ cron CLI process ─────────────┐     ┌─ API server process ───────────┐
│ pnpm scrape                    │     │ tsx src/server.ts (long-lived)  │
│  → runProductionScrape(...)    │     │  → buildApp()                   │
│  → record() into registry A    │     │                                 │
│  → process exits ⟹ A discarded │     │  would serve registry B         │
└────────────────────────────────┘     └─────────────────────────────────┘
       registry A (instance #1)               registry B (instance #2)
```

A metrics registry is **in-memory and per-process**. The scrape runs in the
short-lived cron CLI and its registry dies on exit; the API server is a different
process with its own registry that nothing in that process ever writes to.

So a `GET /metrics` served from the API process would return a valid-looking
Prometheus exposition with **empty / stale data** that does not reflect real
production ingestion — actively misleading for Ops. Rather than ship a misleading
endpoint, PR2 stops at the reusable layer.

## Next step (follow-up PR): `scrape_runs`-derived exporter

The metrics are **already persisted** to the `scrape_runs` table on every run.
The recommended transport is therefore an HTTP endpoint backed by a
`scrape_runs`-derived `MetricsSource`:

```
scrape_runs (DB)  →  MetricsSource (query + map)  →  PrometheusExporter  →  GET /metrics
```

This makes `/metrics` correct on the API server **regardless of the process
boundary**, with no extra infrastructure, and reuses the exporter unchanged. Only
the HTTP transport and the DB-backed source are new.

> **Push Gateway** is a possible alternative (the cron CLI pushes its in-memory
> registry to a gateway that Prometheus scrapes), but it is **not** the
> recommended direction here: it adds a stateful component and risks stale series,
> while the `scrape_runs`-derived exporter draws from data we already store.

## Available metrics

All series carry a `provider` label (e.g. `provider="yakaboo"`).

| Metric | Type | Meaning |
|--------|------|---------|
| `scrape_runs_total` | counter | Provider scrape runs started. |
| `scrape_duration_ms` | histogram | Run duration in milliseconds (buckets: 50ms → 5min). |
| `provider_success_total` | counter | Runs finishing `SUCCESS`. |
| `provider_partial_total` | counter | Runs finishing `PARTIAL`. |
| `provider_failed_total` | counter | Runs finishing `FAILED`. |
| `products_scraped_total` | counter | Listings returned by the scraper. |
| `products_written_total` | counter | Listings persisted (created + updated). |
| `products_skipped_total` | counter | Scraped listings not written (no-price skips + canonical conflicts). |
| `skipped_no_price_total` | counter | New listings skipped because they had no price. |
| `canonical_created_total` | counter | Canonical books created during matching. |
| `canonical_matched_total` | counter | Listings matched to an existing canonical book. |
| `canonical_conflicts_total` | counter | Listings dropped due to a canonical conflict. |
| `canonical_conflicts_by_reason` | counter | Conflicts partitioned by `reason` label (`ISBN_CONFLICT` / `VOLUME_MISMATCH` / `BUNDLE_MISMATCH`). |
| `price_history_inserted_total` | counter | Price-history rows inserted. |
| `availability_updated_total` | counter | Existing listings whose availability was refreshed. |
| `rate_limited_total` | counter | Runs that hit an HTTP 429/503 rate-limit signal. |
| `listing_created_total` | counter | Provider listings created. |
| `listing_updated_total` | counter | Provider listings updated. |

`products_written_total` equals `listing_created_total + listing_updated_total`;
both are exposed so you can break writes down by create-vs-update.

## Grafana recommendations (once the endpoint lands)

Useful starting panels (PromQL). Counters are cumulative, so use
`rate()`/`increase()` rather than the raw value:

- **Ingestion throughput** — `sum by (provider) (increase(products_written_total[1h]))`
- **Scrape success ratio** —
  `sum(increase(provider_success_total[24h])) / sum(increase(scrape_runs_total[24h]))`
- **Run duration p95** —
  `histogram_quantile(0.95, sum by (le, provider) (rate(scrape_duration_ms_bucket[6h])))`
- **Conflict pressure** — `sum by (reason) (increase(canonical_conflicts_by_reason[24h]))`
  (watch for `ISBN_CONFLICT` spikes — see the canonical-matcher audit).
- **Rate-limit alerts** — alert when `increase(rate_limited_total[1h]) > 0`.
- **Skip rate** —
  `sum(increase(products_skipped_total[24h])) / sum(increase(products_scraped_total[24h]))`

[expo]: https://prometheus.io/docs/instrumenting/exposition_formats/
