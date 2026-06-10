import type { PrismaClient } from '@prisma/client';
import type { ScraperProvider, ScraperOptions, ProviderName, CanonicalBook } from '@knyhovo/shared';
import type { ConflictReason } from '@knyhovo/scrapers';

export type { ConflictReason };

export interface ScrapeMetrics {
  scraped: number;
  matched: number;
  created: number;
  conflicts: number;
  conflictsByReason: {
    ISBN_CONFLICT: number;
    VOLUME_MISMATCH: number;
    BUNDLE_MISMATCH: number;
  };
  providerListingsCreated: number;
  providerListingsUpdated: number;
  priceHistoryCreated: number;
  availabilityUpdated: number;
  skippedNoPrice: number;
  errors: number;
}

export interface Logger {
  info(msg: string): void;
  error(msg: string): void;
}

export interface ProviderRunResult {
  provider: ProviderName;
  metrics: ScrapeMetrics;
  scrapeErrors: string[];
}

export interface PipelineResult {
  results: ProviderRunResult[];
}

export interface RunScrapeOptions {
  prisma: PrismaClient;
  providers: ScraperProvider[];
  scraperOptions?: ScraperOptions;
  logger?: Logger;
}

export type ListingPersistOutcome =
  | { kind: 'listing-created'; createdCanonical: CanonicalBook | null; priceHistoryCreated: boolean }
  | { kind: 'listing-updated'; priceHistoryCreated: boolean };

export type UnavailableOutcome =
  | { kind: 'availability-updated' }
  | { kind: 'skipped-new-no-price' };

export type PersistOutcome = ListingPersistOutcome | UnavailableOutcome;
