import type { ScraperOptions } from '@knyhovo/shared';

/**
 * Parse environment variables into a `ScraperOptions` fragment. Composes two
 * independent opt-in features:
 *
 *   - Description enrichment (W9a F2):
 *     - `SCRAPE_ENRICH_DESCRIPTIONS`: `'true'` or `'1'` enables the pass;
 *       any other value (or absence) leaves it disabled.
 *     - `SCRAPE_DESCRIPTION_DELAY_MS`: a positive-integer string sets the
 *       delay between product-page requests, in ms. Invalid or absent values
 *       are ignored. Only meaningful together with the enrich flag — if the
 *       delay is set but enrichment is off, no options are produced.
 *   - Per-page stage debug logging (hang diagnosis):
 *     - `SCRAPE_DEBUG_FETCH_STAGES`: `'true'` or `'1'` enables it; any other
 *       value (or absence) leaves it disabled.
 *   - Sitemap fetch timeout (bookchef silent-stall fix):
 *     - `SCRAPE_SITEMAP_TIMEOUT_MS`: a positive-integer string sets
 *       `sitemapTimeoutMs`. Invalid or absent values are ignored (provider
 *       default applies).
 *   - Circuit-breaker threshold (bookchef silent-stall fix):
 *     - `SCRAPE_MAX_CONSECUTIVE_FETCH_FAILURES`: a positive-integer string
 *       sets `maxConsecutiveFetchFailures`. Invalid or absent values are
 *       ignored (provider default applies).
 *   - Product/page cap (manual & staging runs):
 *     - `SCRAPE_MAX_PAGES`: a positive-integer string sets `maxPages`. Invalid
 *       or absent values are ignored (provider default applies — e.g. Knigoland
 *       stays uncapped). Scope with `--provider=<name>` to cap one provider.
 *
 * Pure function — no IO, no mutation of `env`. Every feature above may be
 * enabled independently of the others; when several are set, all appear on
 * the returned options. Returns `undefined` when nothing is enabled, so
 * callers can spread the result exactly like the existing
 * `...(x !== undefined ? { x } : {})` pattern.
 */
export function parseScraperOptionsFromEnv(env: NodeJS.ProcessEnv): ScraperOptions | undefined {
  const enrichDescriptions = env['SCRAPE_ENRICH_DESCRIPTIONS'] === 'true' || env['SCRAPE_ENRICH_DESCRIPTIONS'] === '1';
  const debugFetchStages = env['SCRAPE_DEBUG_FETCH_STAGES'] === 'true' || env['SCRAPE_DEBUG_FETCH_STAGES'] === '1';

  let options: ScraperOptions | undefined;

  if (enrichDescriptions) {
    options = { enrichDescriptions: true };
    const rawDelay = env['SCRAPE_DESCRIPTION_DELAY_MS'];
    if (rawDelay !== undefined && /^[1-9]\d*$/.test(rawDelay)) {
      options = { ...options, descriptionDelayMs: Number(rawDelay) };
    }
  }

  if (debugFetchStages) {
    options = { ...options, debugFetchStages: true };
  }

  const rawSitemapTimeout = env['SCRAPE_SITEMAP_TIMEOUT_MS'];
  if (rawSitemapTimeout !== undefined && /^[1-9]\d*$/.test(rawSitemapTimeout)) {
    options = { ...options, sitemapTimeoutMs: Number(rawSitemapTimeout) };
  }

  const rawMaxConsecutiveFailures = env['SCRAPE_MAX_CONSECUTIVE_FETCH_FAILURES'];
  if (rawMaxConsecutiveFailures !== undefined && /^[1-9]\d*$/.test(rawMaxConsecutiveFailures)) {
    options = { ...options, maxConsecutiveFetchFailures: Number(rawMaxConsecutiveFailures) };
  }

  // Explicit product/page cap for manual & staging runs. Absent → provider default
  // (Knigoland is uncapped by default — it pulls the full ~50k catalog). Combine
  // with `--provider=knigoland` to cap only Knigoland without touching other
  // providers, since a scoped run executes no others.
  const rawMaxPages = env['SCRAPE_MAX_PAGES'];
  if (rawMaxPages !== undefined && /^[1-9]\d*$/.test(rawMaxPages)) {
    options = { ...options, maxPages: Number(rawMaxPages) };
  }

  return options;
}

/** Default retention window (days) for stale `provider_scrape_state` rows (bookchef-incremental-scraping PRD §2.1). */
const DEFAULT_SCRAPE_STATE_RETENTION_DAYS = 90;

/** Default minimum acceptable shadow-validation precision (bookchef-incremental-scraping PRD §7). */
const DEFAULT_LASTMOD_PRECISION_MIN = 0.05;

/**
 * Parse `SCRAPE_STATE_RETENTION_DAYS` — the TTL (in days) for stale
 * `provider_scrape_state` rows swept after a successful full run. Any
 * non-positive-integer value (absent, non-numeric, zero, negative,
 * fractional) falls back to the default. Always returns a number.
 */
export function getScrapeStateRetentionDays(env: NodeJS.ProcessEnv): number {
  const raw = env['SCRAPE_STATE_RETENTION_DAYS'];
  if (raw !== undefined && /^[1-9]\d*$/.test(raw)) {
    return Number(raw);
  }
  return DEFAULT_SCRAPE_STATE_RETENTION_DAYS;
}

/**
 * Parse `SCRAPE_LASTMOD_PRECISION_MIN` — the minimum shadow-validation
 * precision below which the `low-lastmod-precision` health warning fires.
 * Any value that doesn't parse as a finite number in `[0, 1]` falls back to
 * the default. Always returns a number.
 */
export function getLastmodPrecisionMin(env: NodeJS.ProcessEnv): number {
  const raw = env['SCRAPE_LASTMOD_PRECISION_MIN'];
  if (raw !== undefined) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
      return parsed;
    }
  }
  return DEFAULT_LASTMOD_PRECISION_MIN;
}

/** Default listings-per-batch for the background enrichment job (megakniga-resumable-enrichment PRD §4.4). */
const DEFAULT_ENRICH_BATCH_SIZE = 50;

/**
 * Parse `SCRAPE_ENRICH_BATCH_SIZE` — listings per batch (one transaction per
 * batch) for the `scrape:enrich` job. Any non-positive-integer value falls
 * back to the default. Always returns a number. An explicit `--batch-size`
 * CLI flag takes precedence over this env in the CLI entrypoint.
 */
export function getEnrichBatchSize(env: NodeJS.ProcessEnv): number {
  const raw = env['SCRAPE_ENRICH_BATCH_SIZE'];
  if (raw !== undefined && /^[1-9]\d*$/.test(raw)) {
    return Number(raw);
  }
  return DEFAULT_ENRICH_BATCH_SIZE;
}

/**
 * Parse `SCRAPE_ENRICH_DELAY_MS` — delay between product-page requests during
 * the `scrape:enrich` job, in ms. Invalid or absent values return `undefined`
 * (the provider's own enrichment default applies, e.g. 300ms for megakniga).
 */
export function getEnrichDelayMs(env: NodeJS.ProcessEnv): number | undefined {
  const raw = env['SCRAPE_ENRICH_DELAY_MS'];
  if (raw !== undefined && /^[1-9]\d*$/.test(raw)) {
    return Number(raw);
  }
  return undefined;
}

/** Default circuit-breaker threshold: consecutive infrastructure failures that stop a run (megakniga-resumable-enrichment PRD §4). */
const DEFAULT_ENRICH_CIRCUIT_BREAKER_THRESHOLD = 10;

/**
 * Parse `SCRAPE_ENRICH_CIRCUIT_BREAKER_THRESHOLD` — how many CONSECUTIVE
 * infrastructure failures (timeout/DNS/connection/5xx, NOT 429/503) trip the
 * enrichment circuit breaker so a mass site outage does not fetch-fail all
 * ~27k listings. Any non-positive-integer value falls back to the default.
 * Always returns a number (the breaker is on by default).
 */
export function getEnrichCircuitBreakerThreshold(env: NodeJS.ProcessEnv): number {
  const raw = env['SCRAPE_ENRICH_CIRCUIT_BREAKER_THRESHOLD'];
  if (raw !== undefined && /^[1-9]\d*$/.test(raw)) {
    return Number(raw);
  }
  return DEFAULT_ENRICH_CIRCUIT_BREAKER_THRESHOLD;
}

/** Default max consecutive no-progress restarts before the restart-loop guard blocks (megakniga-resumable-enrichment PRD §4.7). */
const DEFAULT_ENRICH_MAX_NO_PROGRESS_RESTARTS = 3;

/**
 * Parse `SCRAPE_ENRICH_MAX_NO_PROGRESS_RESTARTS` — the CLI-side restart-loop
 * guard threshold: when this many consecutive prior enrichment runs each made
 * zero progress (`items_processed = 0`), the next start refuses to run and
 * exits 0 (breaking the loop). Any non-positive-integer value falls back to
 * the default. Always returns a number.
 */
export function getEnrichMaxNoProgressRestarts(env: NodeJS.ProcessEnv): number {
  const raw = env['SCRAPE_ENRICH_MAX_NO_PROGRESS_RESTARTS'];
  if (raw !== undefined && /^[1-9]\d*$/.test(raw)) {
    return Number(raw);
  }
  return DEFAULT_ENRICH_MAX_NO_PROGRESS_RESTARTS;
}

/** Default heartbeat interval (seconds) for a running scrape (stale-scrape-recovery PRD §2.2). */
const DEFAULT_HEARTBEAT_INTERVAL_SECONDS = 60;

/** Default heartbeat staleness timeout (minutes) before a RUNNING row is reaped (stale-scrape-recovery PRD §2.3). */
const DEFAULT_HEARTBEAT_TIMEOUT_MINUTES = 15;

/** Default legacy `startedAt`-based staleness timeout (hours) for pre-heartbeat rows (stale-scrape-recovery PRD §2.3). */
const DEFAULT_LEGACY_STALE_TIMEOUT_HOURS = 24;

/**
 * Parse `SCRAPE_HEARTBEAT_INTERVAL_SECONDS` — how often a running scrape
 * writes its liveness heartbeat. Any non-positive-integer value (absent,
 * non-numeric, zero, negative, fractional) falls back to the default.
 * Always returns a number.
 */
export function getHeartbeatIntervalSeconds(env: NodeJS.ProcessEnv): number {
  const raw = env['SCRAPE_HEARTBEAT_INTERVAL_SECONDS'];
  if (raw !== undefined && /^[1-9]\d*$/.test(raw)) {
    return Number(raw);
  }
  return DEFAULT_HEARTBEAT_INTERVAL_SECONDS;
}

/**
 * Parse `SCRAPE_HEARTBEAT_TIMEOUT_MINUTES` — how long a RUNNING row's
 * heartbeat may go silent before it is considered dead and reaped. Any
 * non-positive-integer value falls back to the default. Always returns a
 * number.
 */
export function getHeartbeatTimeoutMinutes(env: NodeJS.ProcessEnv): number {
  const raw = env['SCRAPE_HEARTBEAT_TIMEOUT_MINUTES'];
  if (raw !== undefined && /^[1-9]\d*$/.test(raw)) {
    return Number(raw);
  }
  return DEFAULT_HEARTBEAT_TIMEOUT_MINUTES;
}

/**
 * Parse `SCRAPE_STALE_STARTEDAT_TIMEOUT_HOURS` — the fallback staleness
 * threshold (by `startedAt`) used only for legacy rows created before the
 * heartbeat column existed (`lastHeartbeatAt` is `NULL`). Any
 * non-positive-integer value falls back to the default. Always returns a
 * number.
 */
export function getLegacyStaleTimeoutHours(env: NodeJS.ProcessEnv): number {
  const raw = env['SCRAPE_STALE_STARTEDAT_TIMEOUT_HOURS'];
  if (raw !== undefined && /^[1-9]\d*$/.test(raw)) {
    return Number(raw);
  }
  return DEFAULT_LEGACY_STALE_TIMEOUT_HOURS;
}
