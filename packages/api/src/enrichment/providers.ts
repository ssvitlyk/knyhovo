import { extractMegaknigaProductDetails } from '@knyhovo/scrapers';
import type { ProductDetailsExtract } from '@knyhovo/scrapers';
import type { ProviderName } from '@knyhovo/shared';

/**
 * Per-provider wiring for the background enrichment job
 * (megakniga-resumable-enrichment PRD §4.1) — the analogue of
 * `SINGLE_PRODUCT_PARSERS` for the `scrape:enrich` CLI. A provider belongs
 * here exactly when its scraper declares `enrichmentMode: 'background'`;
 * the timing values mirror the provider's own inline-enrichment defaults so
 * the job is no more aggressive than the pass it replaces.
 */
export interface ProviderEnrichmentConfig {
  /** Product-page HTML → extracted details (pure, never throws). */
  readonly extract: ProductDetailsExtract;
  /** Delay between consecutive product-page requests, ms. */
  readonly delayMs: number;
  /** Per-request timeout, ms. */
  readonly timeoutMs: number;
  /** Transient-failure retries per request (429/timeout/reset). */
  readonly maxRetries: number;
  /** Exponential-backoff base for retries, ms. */
  readonly retryBaseDelayMs: number;
  /** Exponential-backoff ceiling for retries, ms. */
  readonly retryMaxDelayMs: number;
}

/** Providers enrichable by the background job. v1: megakniga only. */
export const ENRICHMENT_PROVIDERS: ReadonlyMap<ProviderName, ProviderEnrichmentConfig> =
  new Map<ProviderName, ProviderEnrichmentConfig>([
    [
      'megakniga',
      {
        extract: extractMegaknigaProductDetails,
        // Mirrors megakniga/constants.ts enrichment defaults (PRD §5 of the
        // provider PRD): 300ms between product pages, 15s timeout, 2 retries.
        delayMs: 300,
        timeoutMs: 15_000,
        maxRetries: 2,
        retryBaseDelayMs: 500,
        retryMaxDelayMs: 8_000,
      },
    ],
  ]);
