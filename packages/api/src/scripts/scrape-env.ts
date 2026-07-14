import type { ScraperOptions } from '@knyhovo/shared';

/**
 * Parse environment variables into a `ScraperOptions` fragment for the
 * opt-in description-enrichment pass (W9a F2).
 *
 * Pure function — no IO, no mutation of `env`. Reads:
 *   - `SCRAPE_ENRICH_DESCRIPTIONS`: `'true'` or `'1'` enables the pass;
 *     any other value (or absence) leaves it disabled.
 *   - `SCRAPE_DESCRIPTION_DELAY_MS`: a positive-integer string sets the
 *     delay between product-page requests, in ms. Invalid or absent values
 *     are ignored. Only meaningful together with the enrich flag — if the
 *     delay is set but enrichment is off, no options are produced.
 *
 * Returns `undefined` when nothing is enabled, so callers can spread the
 * result exactly like the existing `...(x !== undefined ? { x } : {})` pattern.
 */
export function parseScraperOptionsFromEnv(env: NodeJS.ProcessEnv): ScraperOptions | undefined {
  const enrichDescriptions = env['SCRAPE_ENRICH_DESCRIPTIONS'] === 'true' || env['SCRAPE_ENRICH_DESCRIPTIONS'] === '1';
  if (!enrichDescriptions) return undefined;

  const options: ScraperOptions = { enrichDescriptions: true };

  const rawDelay = env['SCRAPE_DESCRIPTION_DELAY_MS'];
  if (rawDelay !== undefined && /^[1-9]\d*$/.test(rawDelay)) {
    return { ...options, descriptionDelayMs: Number(rawDelay) };
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
