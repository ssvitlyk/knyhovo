import { matchOrCreate } from '@knyhovo/scrapers';
import type { CanonicalBook, ScraperResult } from '@knyhovo/shared';
import type { CanonicalBookId } from '@knyhovo/shared';
import { Prisma } from '@prisma/client';
import type { RunScrapeOptions, PipelineResult, ProviderRunResult, Logger } from './types.js';
import { createMetrics } from './metrics.js';
import { persistListing } from './persist-listing.js';

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
        // A null price means the book is currently unavailable (out of stock /
        // delisted). We skip persistence entirely because ProviderListing.priceAmount
        // is NOT NULL — there is no price to store.
        //
        // KNOWN LIMITATION: if a ProviderListing already exists with an old price,
        // skipping leaves that stale price and lastSeenAt in the DB, so the book
        // still appears available at its last known price even after it disappeared
        // from sale.
        //
        // TODO(S6): persist availability state. Once the schema gains an availability
        // field (e.g. ProviderListing.availability / isAvailable, sourced from
        // RawProviderListing.availability), mark the existing listing as
        // out-of-stock here and refresh lastSeenAt instead of skipping it. This
        // needs a Prisma schema change and is intentionally out of S5 scope.
        metrics.skippedNoPrice++;
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
