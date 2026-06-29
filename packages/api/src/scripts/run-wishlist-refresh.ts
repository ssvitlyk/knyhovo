import { prisma } from '../db.js';
import { ScrapeRunTrigger } from '@prisma/client';
import { runWishlistRefresh } from '../refresh/wishlist.refresh.js';
import { HttpTargetFetcher } from '../refresh/http-target-fetcher.js';
import { closeRegistryResources } from '../refresh/fetcher-registry.js';
import { RefreshAlreadyRunningError } from '../refresh/concurrency-guard.js';
import { loadAlertConfig } from '../alerts/config.js';
import { createAlertMailer } from '../alerts/mailer-factory.js';
import { dispatchPendingDeliveries } from '../alerts/dispatch.js';
import { generateToken } from '../auth/crypto.js';

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

// W10.6: HttpTargetFetcher() with no argument routes per-provider through the
// fetcher registry — Cloudflare-protected providers (Yakaboo, Book-Ye) use
// PlaywrightHtmlFetcher, the rest use plain HTTP.
const fetcher = new HttpTargetFetcher();

// W4b: build the email dispatcher. With no RESEND_API_KEY this uses the console
// mailer, so the refresh still runs end-to-end without sending real mail.
const alertConfig = loadAlertConfig();
const alertMailer = createAlertMailer(alertConfig);

async function main(): Promise<void> {
  const triggeredBy = parseTriggeredBy(process.env['SCRAPE_TRIGGERED_BY']);
  const startedAt = Date.now();
  console.log(`[run-wishlist-refresh] starting at ${new Date(startedAt).toISOString()} (triggeredBy=${triggeredBy})`);

  try {
    const { outcomes, anySucceeded, events, notifications, dispatchSummary } = await runWishlistRefresh({
      prisma,
      fetcher,
      triggeredBy,
      dispatch: (p, now) =>
        dispatchPendingDeliveries(p, {
          mailer: alertMailer,
          config: alertConfig.dispatch,
          now: () => now,
          generateToken,
          logger: { info: (m) => console.log(m), error: (m) => console.error(m) },
        }),
    });

    console.log(
      `Wishlist refresh complete: providers=${outcomes.length} events=${events.length} ` +
        `notifications=${notifications.length} ` +
        `emails=${dispatchSummary ? `sent=${dispatchSummary.sent} failed=${dispatchSummary.failed} skipped=${dispatchSummary.skipped} deferred=${dispatchSummary.deferred}` : 'off'} ` +
        `anySucceeded=${anySucceeded}`,
    );

    if (!anySucceeded && outcomes.length > 0) {
      console.error(`Wishlist refresh failed: all ${outcomes.length} provider run(s) failed.`);
      process.exitCode = 1;
    }
  } catch (err) {
    // Cron-overlap is not an error: another refresh holds the lock. Skip idempotently.
    if (err instanceof RefreshAlreadyRunningError) {
      console.log(`[run-wishlist-refresh] skip: ${err.message}`);
      return;
    }
    throw err;
  } finally {
    const durationMs = Date.now() - startedAt;
    console.log(`[run-wishlist-refresh] finished in ${durationMs}ms (exitCode=${process.exitCode ?? 0})`);
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
    // Close the shared Playwright browser used by the registry (no-op if unused).
    await closeRegistryResources();
  });
