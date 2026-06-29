# Production Metrics & Observability

The system exposes a **production-ready `GET /metrics`** endpoint in the
Prometheus text exposition format (v0.0.4). It is backed by the persisted
`scrape_runs` table rather than any in-memory registry, so it reports correct
data on the long-running API server regardless of the process boundary. See
[The `/metrics` endpoint](#the-metrics-endpoint).

The metrics layer sits **on top of** the existing per-run `ScrapeMetrics`: the
pipeline keeps producing the same in-memory counters and persisting them to
`scrape_runs`, and the metrics primitives only *read* finished provider outcomes
and fold them into counters/histograms. It adds no scraping, persistence, retry,
matcher, or health behavior.

## What's included

| Component | File | Role |
|-----------|------|------|
| `MetricCounter` / `MetricGauge` / `MetricHistogram` | `metrics/metric-*.ts` | Label-aware metric primitives (no external deps). |
| `MetricsRegistry` / `InMemoryMetricsRegistry` | `metrics/metrics-registry.ts` | Generic get-or-create metric collection + snapshot. |
| `ProductionMetricsRegistry` | `metrics/metrics-registry.ts` | Domain registry: `record(outcome)` folds one provider run into the production metrics. |
| `PrometheusExporter` | `metrics/prometheus-exporter.ts` | Renders a `MetricsSnapshot` into Prometheus text exposition format. |
| `ScrapeRunsMetricsSource` | `metrics/scrape-runs-source.ts` | DB-backed `MetricsSource`: aggregates `scrape_runs` rows into a `MetricsSnapshot`. |
| `fetchScrapeRunMetricRows` | `metrics/scrape-runs.repository.ts` | Reads the `scrape_runs` columns the source needs and maps the provider enum → slug. |
| `GET /metrics` route | `metrics/route.ts` | HTTP transport: fetch rows → build source → export → reply. |
| Instrumentation | `refresh/full-catalog.refresh.ts` | Calls `record(...)` after each provider, when a registry is supplied (observation only). |

The exporter and any source are decoupled by the `MetricsSource` interface
(`snapshot(): MetricsSnapshot`), so the HTTP transport reads from the
`scrape_runs`-derived source without touching the exporter.

## The `/metrics` endpoint

Ingestion and the API run as **separate processes**:

```
┌─ cron CLI process ─────────────┐     ┌─ API server process ───────────┐
│ pnpm scrape                    │     │ tsx src/server.ts (long-lived)  │
│  → runProductionScrape(...)    │     │  → buildApp()                   │
│  → writes rows to scrape_runs ─┼──┐  │  → GET /metrics                 │
│  → process exits               │  │  │     reads scrape_runs ◄─────────┼─┐
└────────────────────────────────┘  │  └─────────────────────────────────┘ │
                                     └────────── scrape_runs (DB) ──────────┘
```

A metrics **registry** is in-memory and per-process: the cron CLI's registry dies
on exit, and the API server is a different process with its own (empty) registry.
A `/metrics` served from a process-local registry would therefore return a
valid-looking Prometheus exposition with **empty / stale data** — actively
misleading for Ops.

The endpoint sidesteps this entirely by reading **persisted** data. Every run
already writes its aggregated counts to `scrape_runs`, so the transport is:

```
scrape_runs (DB)  →  ScrapeRunsMetricsSource (query + aggregate)  →  PrometheusExporter  →  GET /metrics
```

On each request the route fetches the `scrape_runs` rows, folds them into a fresh
in-memory registry inside `ScrapeRunsMetricsSource.snapshot()` (reusing the same
metric primitives and exporter — nothing new in the rendering path), and returns
the result. This makes `/metrics` correct on the API server **regardless of the
process boundary**, with no extra infrastructure. The **process boundary is no
longer a problem.**

Counters aggregate over **all** persisted rows (rows are immutable), so the
series are monotonic — the semantics Prometheus expects for a counter.

> **Push Gateway** is a possible alternative (the cron CLI pushes its in-memory
> registry to a gateway that Prometheus scrapes), but it is **not** used here: it
> adds a stateful component and risks stale series, while the `scrape_runs`-derived
> source draws from data we already store.

### What the endpoint exports vs. the in-process registry

`scrape_runs` persists **aggregated** per-run counts, not the full granular
`ScrapeMetrics`. The endpoint therefore exports the faithful subset derivable from
those columns and **intentionally omits** metrics that have no backing column —
rather than emit misleading zeros. Omitted: `products_skipped_total`,
`skipped_no_price_total`, `canonical_created_total`, `canonical_matched_total`,
`canonical_conflicts_total`, `canonical_conflicts_by_reason`, `rate_limited_total`,
and the separate `listing_created_total` / `listing_updated_total` split. These
remain available in-process to anything that holds a `ProductionMetricsRegistry`.

## Available metrics

All series carry a `provider` label (e.g. `provider="yakaboo"`). The **`/metrics`?**
column marks which metrics the `scrape_runs`-derived endpoint exports; the rest
exist only in-process (held by a `ProductionMetricsRegistry`).

| Metric | Type | `/metrics`? | Meaning |
|--------|------|:-----------:|---------|
| `scrape_runs_total` | counter | ✅ | Provider scrape runs (all rows, incl. running). |
| `scrape_duration_ms` | histogram | ✅ | Run duration in milliseconds (buckets: 50ms → 5min). |
| `provider_success_total` | counter | ✅ | Runs finishing `SUCCESS`. |
| `provider_partial_total` | counter | ✅ | Runs finishing `PARTIAL`. |
| `provider_failed_total` | counter | ✅ | Runs finishing `FAILED`. |
| `products_scraped_total` | counter | ✅ | Listings returned by the scraper (`items_found`). |
| `products_written_total` | counter | ✅ | Listings persisted (created + updated). |
| `price_history_inserted_total` | counter | ✅ | Price-history rows inserted (`price_changes`). |
| `availability_updated_total` | counter | ✅ | Existing listings whose availability was refreshed. |
| `scrape_errors_total` | counter | ✅ | Total scrape errors recorded across runs (`errors_count`). |
| `products_skipped_total` | counter | — | Scraped listings not written (no-price skips + canonical conflicts). |
| `skipped_no_price_total` | counter | — | New listings skipped because they had no price. |
| `canonical_created_total` | counter | — | Canonical books created during matching. |
| `canonical_matched_total` | counter | — | Listings matched to an existing canonical book. |
| `canonical_conflicts_total` | counter | — | Listings dropped due to a canonical conflict. |
| `canonical_conflicts_by_reason` | counter | — | Conflicts partitioned by `reason` label (`ISBN_CONFLICT` / `VOLUME_MISMATCH` / `BUNDLE_MISMATCH`). |
| `rate_limited_total` | counter | — | Runs that hit an HTTP 429/503 rate-limit signal. |
| `listing_created_total` | counter | — | Provider listings created. |
| `listing_updated_total` | counter | — | Provider listings updated. |

On `/metrics`, `products_written_total` is derived as
`items_updated − availability_changes` (i.e. created + updated), since
`scrape_runs` stores only the combined `items_updated` count. The create-vs-update
split (`listing_created_total` / `listing_updated_total`) is not persisted per-run
and is therefore in-process only.

## Grafana recommendations

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

> The **Conflict pressure**, **Rate-limit** and **Skip rate** panels use metrics
> not exported by `/metrics` (see the `/metrics`? column above); they apply only
> if the in-process metrics are scraped through another transport.

[expo]: https://prometheus.io/docs/instrumenting/exposition_formats/
