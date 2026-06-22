import { prisma } from '../db.js';
import { YakabooScraper, VivatScraper, BookYeScraper, browserManager } from '@knyhovo/scrapers';
import { runScrapePipeline, formatSummary, mapProviderName } from '../pipeline/index.js';
import type { ScraperProvider } from '@knyhovo/shared';
import { ScrapeRunKind, ScrapeRunTrigger } from '@prisma/client';
import { startScrapeRun, finishScrapeRun, deriveRunStatus } from '../refresh/scrape-run.repository.js';

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

  for (const provider of providers) {
    const { id, startedAt } = await startScrapeRun(prisma, {
      provider: mapProviderName(provider.name),
      kind: ScrapeRunKind.FULL_CATALOG,
      triggeredBy,
    });

    const { results } = await runScrapePipeline({ prisma, providers: [provider] });
    const r = results[0]!;
    const status = deriveRunStatus(r.metrics, r.scrapeErrors);
    await finishScrapeRun(prisma, id, {
      startedAt,
      status,
      metrics: r.metrics,
      scrapeErrors: r.scrapeErrors,
    });

    console.log(formatSummary(r.provider, r.metrics, r.scrapeErrors));
    console.log('');
  }
}

void main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await browserManager.close();
  });
