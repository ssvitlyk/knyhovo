import type { ProviderName } from '@knyhovo/shared';
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

export function formatSummary(
  provider: ProviderName,
  m: ScrapeMetrics,
  scrapeErrors: string[],
): string {
  const lines: string[] = [
    `Provider: ${provider}`,
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
  }

  return lines.join('\n');
}
