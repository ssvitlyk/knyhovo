import { matchOrCreate } from '@knyhovo/scrapers';
import type { CanonicalBook, ScraperResult, ProviderName } from '@knyhovo/shared';
import type { CanonicalBookId } from '@knyhovo/shared';
import { Prisma } from '@prisma/client';
import type { RunScrapeOptions, PipelineResult, ProviderRunResult, Logger } from './types.js';
import { createMetrics } from './metrics.js';
import { persistListing, markUnavailable, mapProviderName } from './persist-listing.js';
import { bindContext } from '../logging/logger.js';

/**
 * Load canonical rows for matching, surviving a stale DB connection.
 *
 * The scrape phase (with description enrichment) can run for tens of minutes
 * with zero DB activity, and this is the first query afterwards — a pooled
 * connection dropped in the meantime fails exactly here (staging refresh of
 * 2026-07-09 collapsed this way). A single explicit re-attempt after a
 * connection touch recovers that case; a genuinely down DB still throws.
 * This is one deliberate reconnect, not a retry loop.
 */
async function loadCanonicalRows(
  prisma: RunScrapeOptions['prisma'],
  logger: Logger,
): Promise<Awaited<ReturnType<RunScrapeOptions['prisma']['canonicalBook']['findMany']>>> {
  try {
    return await prisma.canonicalBook.findMany();
  } catch (err) {
    logger.error(
      `canonical candidates query failed (stale connection after a long scrape?): ` +
        `${err instanceof Error ? err.message : String(err)} — reconnecting once`,
    );
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      // Touch is best-effort; the re-attempt below decides success or failure.
    }
    return await prisma.canonicalBook.findMany();
  }
}

/**
 * Providers whose product-page extractor also finds edition metadata
 * (book-metadata PRD), not just a description. Their skip-set query must
 * re-fetch pages that already have a description but no metadata yet — v1
 * ships Vivat only (source verified); other providers stay description-only.
 */
const METADATA_ENRICHED_PROVIDERS: ReadonlySet<ProviderName> = new Set(['vivat']);

export async function runScrapePipeline(opts: RunScrapeOptions): Promise<PipelineResult> {
  const logger: Logger = opts.logger ?? {
    info: (m: string) => console.log(m),
    error: (m: string) => console.error(m),
  };

  const results: ProviderRunResult[] = [];

  for (const provider of opts.providers) {
    const scrapeLogger = bindContext(logger, { phase: 'scrape' });
    scrapeLogger.info(`Scraping ${provider.name}...`);
    const metrics = createMetrics();

    // When the enrichment pass is on, tell the scraper which product URLs
    // already have a stored description so it does not re-fetch those pages.
    // An explicit caller-provided skip set still wins.
    let skipDescriptionUrls = opts.scraperOptions?.skipDescriptionUrls;
    if (opts.scraperOptions?.enrichDescriptions && skipDescriptionUrls === undefined) {
      const isMetadataProvider = METADATA_ENRICHED_PROVIDERS.has(provider.name);
      const enrichedRows = await opts.prisma.providerListing.findMany({
        where: {
          provider: mapProviderName(provider.name),
          description: { not: null },
          ...(isMetadataProvider ? { publisher: { not: null } } : {}),
        },
        select: { url: true },
      });
      skipDescriptionUrls = new Set(enrichedRows.map((row) => row.url));
      scrapeLogger.info(
        `${provider.name}: ${skipDescriptionUrls.size} listings already ` +
          `${isMetadataProvider ? 'have descriptions + metadata' : 'have descriptions'} — ` +
          `enrichment will skip them`,
      );
    }

    let scrapeResult: ScraperResult;
    try {
      // Thread the scrape-phase logger into the provider so its progress/metrics
      // surface in production; an explicit scraperOptions.logger still wins.
      scrapeResult = await provider.scrape({
        ...opts.scraperOptions,
        logger: opts.scraperOptions?.logger ?? scrapeLogger,
        ...(skipDescriptionUrls !== undefined ? { skipDescriptionUrls } : {}),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ provider: provider.name, metrics, scrapeErrors: [message] });
      continue;
    }

    metrics.scraped = scrapeResult.listings.length;
    scrapeLogger.info(
      `${provider.name}: scrape complete — ${scrapeResult.listings.length} listings, ` +
        `${scrapeResult.errors.length} scrape errors`,
    );

    const persistLogger = bindContext(logger, { phase: 'persist' });
    persistLogger.info(`${provider.name}: loading canonical candidates...`);
    const candidates: CanonicalBook[] = (
      await loadCanonicalRows(opts.prisma, persistLogger)
    ).map((row) => ({
      id: row.id as CanonicalBookId,
      title: row.title,
      author: row.author,
      isbn: row.isbn,
      createdAt: row.createdAt.toISOString(),
    }));
    persistLogger.info(
      `${provider.name}: canonical matching + persist starting — ` +
        `${scrapeResult.listings.length} listings against ${candidates.length} candidates`,
    );

    const scrapedAt = new Date(scrapeResult.scrapedAt);

    let processed = 0;
    for (const listing of scrapeResult.listings) {
      processed++;
      if (processed % 100 === 0) {
        persistLogger.info(
          `${provider.name}: persist progress ${processed}/${scrapeResult.listings.length}`,
        );
      }
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
          if (outcome.priceHistoryCreated) {
            metrics.priceHistoryCreated++;
          }
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
        bindContext(logger, { phase: 'persist' }).error(
          `Listing failed (${listing.url}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    persistLogger.info(
      `${provider.name}: canonical matching + persist done — ` +
        `${processed}/${scrapeResult.listings.length} listings processed`,
    );
    results.push({ provider: provider.name, metrics, scrapeErrors: scrapeResult.errors });
  }

  return { results };
}
