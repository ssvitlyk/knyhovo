import { prisma } from '../db.js';
import { YakabooScraper, VivatScraper, BookYeScraper, browserManager } from '@knyhovo/scrapers';
import { runScrapePipeline, formatSummary } from '../pipeline/index.js';
import type { ScraperProvider } from '@knyhovo/shared';

// Register new providers here — the pipeline is provider-agnostic and needs no changes.
// Vivat is server-rendered Next.js, so the default FetchHtmlFetcher works (no Cloudflare).
// Книгарня «Є» (book-ye) sits behind a Cloudflare JS challenge, so its default fetcher
// is a PlaywrightHtmlFetcher that waits for product cards to render.
const providers: ScraperProvider[] = [
  new YakabooScraper(),
  new VivatScraper(),
  new BookYeScraper(),
];

async function main(): Promise<void> {
  const { results } = await runScrapePipeline({ prisma, providers });
  for (const result of results) {
    console.log(formatSummary(result.provider, result.metrics, result.scrapeErrors));
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
