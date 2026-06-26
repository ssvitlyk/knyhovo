import type { ProviderName } from '@knyhovo/shared';
// Import the lightweight classifier via its dedicated subpath, NOT the package
// barrel: the barrel pulls in the provider/parser/Playwright runtime, which has
// no place in generic run-summary formatting and bloats unrelated test collect.
import { detectProviderBlock } from '@knyhovo/scrapers/blocked-status';
import type { ScrapeMetrics } from './types.js';

export function createMetrics(): ScrapeMetrics {
  return {
    scraped: 0,
    matched: 0,
    created: 0,
    conflicts: 0,
    conflictsByReason: {
      ISBN_CONFLICT: 0,
      VOLUME_MISMATCH: 0,
      BUNDLE_MISMATCH: 0,
    },
    providerListingsCreated: 0,
    providerListingsUpdated: 0,
    priceHistoryCreated: 0,
    availabilityUpdated: 0,
    skippedNoPrice: 0,
    errors: 0,
  };
}

/** At-a-glance status for the run log (distinct from the persisted ScrapeRunStatus). */
export type ProviderDisplayStatus = 'OK' | 'BLOCKED' | 'FAILED';

export interface ProviderStatus {
  readonly status: ProviderDisplayStatus;
  /** Status headline for the summary, e.g. "OK", "BLOCKED (HTTP 403)", "FAILED". */
  readonly headline: string;
  /** Multi-line "Reason" body, or null when the run is OK. */
  readonly reason: string | null;
}

/**
 * Classify a finished provider run into an at-a-glance status for the run log:
 *   - BLOCKED — an anti-bot block was detected (Cloudflare/Turnstile, HTTP 403);
 *   - FAILED  — nothing was scraped and at least one real error occurred;
 *   - OK      — listings were scraped (a few per-listing errors are tolerated).
 * This is a display concept, separate from the persisted ScrapeRunStatus.
 */
export function deriveProviderStatus(m: ScrapeMetrics, scrapeErrors: string[]): ProviderStatus {
  const block = detectProviderBlock(scrapeErrors);
  if (block) {
    return { status: 'BLOCKED', headline: `BLOCKED (${block.label})`, reason: block.reason };
  }
  const hadError = scrapeErrors.length > 0 || m.errors > 0;
  if (m.scraped === 0 && hadError) {
    return { status: 'FAILED', headline: 'FAILED', reason: scrapeErrors[0] ?? 'Unknown error' };
  }
  return { status: 'OK', headline: 'OK', reason: null };
}

const SEPARATOR = '-'.repeat(40);

export function formatSummary(
  provider: ProviderName,
  m: ScrapeMetrics,
  scrapeErrors: string[],
): string {
  const { headline, reason } = deriveProviderStatus(m, scrapeErrors);

  const lines: string[] = [
    SEPARATOR,
    `Provider: ${provider}`,
    '',
    `Status: ${headline}`,
    '',
    `Scraped: ${m.scraped}`,
    `Matched: ${m.matched}`,
    `Created: ${m.created}`,
    `Conflicts: ${m.conflicts}`,
    `  ISBN_CONFLICT: ${m.conflictsByReason.ISBN_CONFLICT}`,
    `  VOLUME_MISMATCH: ${m.conflictsByReason.VOLUME_MISMATCH}`,
    `  BUNDLE_MISMATCH: ${m.conflictsByReason.BUNDLE_MISMATCH}`,
    '',
    'Provider listings:',
    `  created: ${m.providerListingsCreated}`,
    `  updated: ${m.providerListingsUpdated}`,
    '',
    'Price history:',
    `  inserted: ${m.priceHistoryCreated}`,
    '',
    `Skipped no price: ${m.skippedNoPrice}`,
    `Availability updated: ${m.availabilityUpdated}`,
    `Errors: ${m.errors}`,
  ];

  if (scrapeErrors.length > 0) {
    lines.push(`Scrape errors: ${scrapeErrors.length}`);
    for (const error of scrapeErrors.slice(0, 5)) {
      lines.push(`  - ${error}`);
    }
  }

  if (reason) {
    lines.push('', 'Reason:', reason);
  }

  lines.push(SEPARATOR);

  return lines.join('\n');
}
