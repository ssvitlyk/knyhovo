// NOTE: `@knyhovo/scrapers` is consumed as its compiled `dist/`, but Vitest runs
// the TypeScript source. To stop a stale `dist` from silently running old scraper
// code here, the `scrape` npm script runs `turbo run build --filter=@knyhovo/scrapers`
// first (Turbo caches, so it is a near-no-op when nothing changed). Never run this
// file with raw `tsx` and expect fresh scraper code — go through `pnpm scrape`.
import { prisma } from '../db.js';
import { YakabooScraper, VivatScraper, BookYeScraper, browserManager } from '@knyhovo/scrapers';
import type { ScraperProvider } from '@knyhovo/shared';
import { ScrapeRunTrigger } from '@prisma/client';
import { createLogger } from '../pipeline/index.js';
import { runProductionScrape } from '../refresh/production-runner.js';

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
  const logger = createLogger();
  const triggeredBy = parseTriggeredBy(process.env['SCRAPE_TRIGGERED_BY']);
  const startedAt = Date.now();
  logger.info(`run-scrape starting at ${new Date(startedAt).toISOString()} (triggeredBy=${triggeredBy})`);

  try {
    const result = await runProductionScrape({ prisma, providers, triggeredBy, logger });
    process.exitCode = result.exitCode;
  } finally {
    const durationMs = Date.now() - startedAt;
    logger.info(`run-scrape finished in ${durationMs}ms (exitCode=${process.exitCode ?? 0})`);
  }
}

void main()
  .catch((err: unknown) => {
    // Fatal error before/around orchestration — non-zero exit.
    createLogger().error(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await browserManager.close();
  });
