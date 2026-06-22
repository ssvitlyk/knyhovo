import { prisma } from '../db.js';
import { ScrapeRunTrigger } from '@prisma/client';
import { runWishlistRefresh } from '../refresh/wishlist.refresh.js';
import type { WishlistTargetFetcher } from '../refresh/wishlist.refresh.js';
import type { RefreshTarget } from '../refresh/refresh-targets.js';
import type { RefreshedListingState } from '../refresh/events.js';

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

// TODO(W10.3.x/W10.4): replace with a real per-provider single-product fetcher
// (HtmlFetcher + product-page parse → RefreshedListingState). Until then this
// placeholder makes the wiring explicit and visible in scrape_runs.errorSummary.
const placeholderFetcher: WishlistTargetFetcher = {
  fetchTarget(target: RefreshTarget): Promise<RefreshedListingState> {
    return Promise.reject(
      new Error(`single-page fetch not implemented for ${target.provider} (${target.url})`),
    );
  },
};

async function main(): Promise<void> {
  const triggeredBy = parseTriggeredBy(process.env['SCRAPE_TRIGGERED_BY']);

  const { outcomes, anySucceeded, events } = await runWishlistRefresh({
    prisma,
    fetcher: placeholderFetcher,
    triggeredBy,
  });

  console.log(
    `Wishlist refresh complete: providers=${outcomes.length} events=${events.length} anySucceeded=${anySucceeded}`,
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
    // for single-page product fetches via the placeholder or future HTTP fetcher.
  });
