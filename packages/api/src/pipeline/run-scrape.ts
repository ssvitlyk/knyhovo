import { matchOrCreate } from '@knyhovo/scrapers';
import type { CanonicalBook, ScraperResult } from '@knyhovo/shared';
import type { CanonicalBookId } from '@knyhovo/shared';
import { Prisma } from '@prisma/client';
import type { RunScrapeOptions, PipelineResult, ProviderRunResult, Logger } from './types.js';
import { createMetrics } from './metrics.js';
import { persistListing, markUnavailable } from './persist-listing.js';

export async function runScrapePipeline(opts: RunScrapeOptions): Promise<PipelineResult> {
  const logger: Logger = opts.logger ?? {
    info: (m: string) => console.log(m),
    error: (m: string) => console.error(m),
  };

  const results: ProviderRunResult[] = [];

  for (const provider of opts.providers) {
    logger.info(`Scraping ${provider.name}...`);
    const metrics = createMetrics();

    let scrapeResult: ScraperResult;
    try {
      scrapeResult = await provider.scrape(opts.scraperOptions);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ provider: provider.name, metrics, scrapeErrors: [message] });
      continue;
    }

    metrics.scraped = scrapeResult.listings.length;

    const candidates: CanonicalBook[] = (await opts.prisma.canonicalBook.findMany()).map((row) => ({
      id: row.id as CanonicalBookId,
      title: row.title,
      author: row.author,
      isbn: row.isbn,
      createdAt: row.createdAt.toISOString(),
    }));

    const scrapedAt = new Date(scrapeResult.scrapedAt);

    for (const listing of scrapeResult.listings) {
      if (listing.price === null) {
        // No price means the book is currently unavailable. Instead of skipping
        // entirely (which left stale prices in the DB), refresh availability and
        // lastSeenAt on an existing listing. A brand-new listing with no price has
        // nothing to persist (priceAmount is NOT NULL), so it is skipped.
        const outcome = await opts.prisma.$transaction((tx: Prisma.TransactionClient) =>
          markUnavailable(tx, { listing, scrapedAt }),
        );
        if (outcome.kind === 'availability-updated') {
          metrics.availabilityUpdated++;
        } else {
          metrics.skippedNoPrice++;
        }
        continue;
      }

      const result = matchOrCreate(listing, candidates);

      if (result.type === 'conflict') {
        metrics.conflicts++;
        metrics.conflictsByReason[result.reason]++;
        continue;
      }

      try {
        const outcome = await opts.prisma.$transaction((tx: Prisma.TransactionClient) =>
          persistListing(tx, { listing, result, scrapedAt }),
        );

        if (outcome.kind === 'listing-created') {
          metrics.providerListingsCreated++;
          if (result.type === 'created') {
            metrics.created++;
          } else {
            metrics.matched++;
          }
          if (outcome.createdCanonical) {
            candidates.push(outcome.createdCanonical);
          }
        } else {
          // listing-updated
          metrics.providerListingsUpdated++;
          metrics.matched++;
        }

        if (outcome.priceHistoryCreated) {
          metrics.priceHistoryCreated++;
        }
      } catch (err) {
        metrics.errors++;
        logger.error(
          `Listing failed (${listing.url}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    results.push({ provider: provider.name, metrics, scrapeErrors: scrapeResult.errors });
  }

  return { results };
}
