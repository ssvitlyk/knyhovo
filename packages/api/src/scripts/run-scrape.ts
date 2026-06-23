import { prisma } from '../db.js';
import { YakabooScraper, VivatScraper, BookYeScraper, browserManager } from '@knyhovo/scrapers';
import type { ScraperProvider } from '@knyhovo/shared';
import { ScrapeRunTrigger } from '@prisma/client';
import { runFullCatalogRefresh } from '../refresh/full-catalog.refresh.js';
import { RefreshAlreadyRunningError } from '../refresh/concurrency-guard.js';

// Register new providers here — the pipeline is provider-agnostic and needs no changes.
// Vivat is server-rendered Next.js, so the default FetchHtmlFetcher works (no Cloudflare).
// Книгарня «Є» (book-ye) sits behind a Cloudflare JS challenge, so its default fetcher
// is a PlaywrightHtmlFetcher that waits for product cards to render.
const providers: ScraperProvider[] = [
  new YakabooScraper(),
  new VivatScraper(),
  new BookYeScraper(),
];

/**
 * Parse the SCRAPE_TRIGGERED_BY environment variable into a ScrapeRunTrigger
 * enum value. Defaults to MANUAL when the value is absent or unrecognised.
 */
function parseTriggeredBy(val: string | undefined): ScrapeRunTrigger {
  switch (val?.toUpperCase()) {
    case 'CRON':
      return ScrapeRunTrigger.CRON;
    case 'SYSTEM':
      return ScrapeRunTrigger.SYSTEM;
    default:
      return ScrapeRunTrigger.MANUAL;
  }
}

async function main(): Promise<void> {
  const triggeredBy = parseTriggeredBy(process.env['SCRAPE_TRIGGERED_BY']);
  const startedAt = Date.now();
  console.log(`[run-scrape] starting at ${new Date(startedAt).toISOString()} (triggeredBy=${triggeredBy})`);

  try {
    const { outcomes, anySucceeded } = await runFullCatalogRefresh({
      prisma,
      providers,
      triggeredBy,
    });

    if (!anySucceeded) {
      // Every provider failed — surface a non-zero exit for the scheduler.
      console.error(`Full catalog refresh failed: all ${outcomes.length} provider(s) failed.`);
      process.exitCode = 1;
    }
  } catch (err) {
    // Cron-overlap is not an error: another refresh holds the lock. Skip idempotently.
    if (err instanceof RefreshAlreadyRunningError) {
      console.log(`[run-scrape] skip: ${err.message}`);
      return;
    }
    throw err;
  } finally {
    const durationMs = Date.now() - startedAt;
    console.log(`[run-scrape] finished in ${durationMs}ms (exitCode=${process.exitCode ?? 0})`);
  }
}

void main()
  .catch((err: unknown) => {
    // Fatal error before/around orchestration — non-zero exit.
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await browserManager.close();
  });
