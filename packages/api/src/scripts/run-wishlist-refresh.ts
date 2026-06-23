import { prisma } from '../db.js';
import { ScrapeRunTrigger } from '@prisma/client';
import { runWishlistRefresh } from '../refresh/wishlist.refresh.js';
import { HttpTargetFetcher } from '../refresh/http-target-fetcher.js';

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

// NOTE(W10.4): HttpTargetFetcher uses plain HTTP (FetchHtmlFetcher) by default.
// Cloudflare-protected providers (Yakaboo, Book-Ye) will be blocked on live URLs —
// Playwright wiring for those providers is deferred to W10.4.x/W10.6.
const fetcher = new HttpTargetFetcher();

async function main(): Promise<void> {
  const triggeredBy = parseTriggeredBy(process.env['SCRAPE_TRIGGERED_BY']);

  const { outcomes, anySucceeded, events, notifications } = await runWishlistRefresh({
    prisma,
    fetcher,
    triggeredBy,
  });

  console.log(
    `Wishlist refresh complete: providers=${outcomes.length} events=${events.length} notifications=${notifications.length} anySucceeded=${anySucceeded}`,
  );

  if (!anySucceeded && outcomes.length > 0) {
    console.error(`Wishlist refresh failed: all ${outcomes.length} provider run(s) failed.`);
    process.exitCode = 1;
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
    // NOTE: run-wishlist does NOT use browserManager — no Playwright is needed
    // for single-page product fetches via HttpTargetFetcher (plain HTTP).
  });
