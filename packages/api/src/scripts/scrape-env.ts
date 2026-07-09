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
