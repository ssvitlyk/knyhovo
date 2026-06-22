/**
 * W10.3 detection-only skeleton. Detects price/availability transitions and
 * writes scrape_runs rows. It does NOT yet persist to provider_listings/price_history
 * and does NOT send notifications — real single-page fetch + persistence is a
 * TODO for W10.3.x/W10.4. Provider isolation, throttle and stop-on-429/503
 * mirror full-catalog.refresh.ts (W10.2).
 */
import type { PrismaClient, ScrapeRunTrigger, Provider } from '@prisma/client';
import { ScrapeRunKind, ScrapeRunStatus } from '@prisma/client';
import { isRateLimited } from '@knyhovo/scrapers';
import { createMetrics } from '../pipeline/index.js';
import type { ScrapeMetrics, Logger } from '../pipeline/index.js';
import { startScrapeRun, finishScrapeRun, deriveRunStatus } from './scrape-run.repository.js';
import { collectRefreshTargets } from './refresh-targets.js';
import type { RefreshTarget } from './refresh-targets.js';
import { detectAlertEvents } from './events.js';
import type { AlertEvent, RefreshedListingState, TargetPreviousState } from './events.js';

// ---------------------------------------------------------------------------
// Port (mockable fetcher)
// ---------------------------------------------------------------------------

export interface WishlistTargetFetcher {
  /**
   * Re-fetch a single product page for a target. Throws on network/HTTP error
   * (orchestration classifies isRateLimited to stop the provider; other throws
   * are recorded and treated as a graceful 'gone'). May also return {kind:'gone'}
   * directly when a 404 is detected without throwing.
   */
  fetchTarget(target: RefreshTarget, opts: { readonly timeoutMs: number }): Promise<RefreshedListingState>;
}

// ---------------------------------------------------------------------------
// Options & result types
// ---------------------------------------------------------------------------

export interface WishlistRefreshOptions {
  readonly prisma: PrismaClient;
  readonly fetcher: WishlistTargetFetcher;
  readonly triggeredBy: ScrapeRunTrigger;
  /** Per-request timeout, ms. Default 30000. */
  readonly timeoutMs?: number;
  /** Throttle delay between consecutive product-page fetches, ms. Default 1000. Applied between targets within a provider. */
  readonly delayMs?: number;
  readonly logger?: Logger;
  readonly now?: () => Date;
  /** Injectable target source (defaults to collectRefreshTargets) — lets tests supply targets without prisma. */
  readonly loadTargets?: (prisma: PrismaClient) => Promise<RefreshTarget[]>;
  /** Injectable sleep for deterministic tests (default: real setTimeout). */
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface WishlistProviderRefreshOutcome {
  readonly provider: Provider;
  readonly runId: string | null;
  readonly status: ScrapeRunStatus;
  readonly metrics: ScrapeMetrics;
  readonly events: readonly AlertEvent[];
  readonly scrapeErrors: readonly string[];
  readonly rateLimited: boolean;
  readonly targetCount: number;
}

export interface WishlistRefreshResult {
  readonly outcomes: readonly WishlistProviderRefreshOutcome[];
  readonly events: readonly AlertEvent[]; // flattened across providers
  readonly anySucceeded: boolean;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function runWishlistRefresh(
  opts: WishlistRefreshOptions,
): Promise<WishlistRefreshResult> {
  const logger: Logger = opts.logger ?? {
    info: (m: string) => console.log(m),
    error: (m: string) => console.error(m),
  };
  const clock = opts.now ?? ((): Date => new Date());
  const sleep = opts.sleep ?? ((ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms)));
  const timeoutMs = opts.timeoutMs ?? 30000;
  const delayMs = opts.delayMs ?? 1000;
  const loadTargets = opts.loadTargets ?? collectRefreshTargets;

  const allTargets = await loadTargets(opts.prisma);

  if (allTargets.length === 0) {
    logger.info('Wishlist refresh: no targets');
    return { outcomes: [], events: [], anySucceeded: true };
  }

  // Group by provider, iterate in sorted provider order for determinism.
  const byProvider = new Map<Provider, RefreshTarget[]>();
  for (const target of allTargets) {
    const existing = byProvider.get(target.provider);
    if (existing == null) {
      byProvider.set(target.provider, [target]);
    } else {
      existing.push(target);
    }
  }
  const sortedProviders = Array.from(byProvider.keys()).sort();

  const outcomes: WishlistProviderRefreshOutcome[] = [];
  for (const provider of sortedProviders) {
    const targets = byProvider.get(provider)!;
    outcomes.push(
      await refreshProviderTargets(provider, targets, opts, logger, clock, sleep, timeoutMs, delayMs),
    );
    logger.info('');
  }

  const anySucceeded = outcomes.some(
    (o) => o.status === ScrapeRunStatus.SUCCESS || o.status === ScrapeRunStatus.PARTIAL,
  );

  const events = outcomes.flatMap((o) => Array.from(o.events));

  return { outcomes, events, anySucceeded };
}

// ---------------------------------------------------------------------------
// Per-provider loop
// ---------------------------------------------------------------------------

async function refreshProviderTargets(
  provider: Provider,
  targets: RefreshTarget[],
  opts: WishlistRefreshOptions,
  logger: Logger,
  clock: () => Date,
  sleep: (ms: number) => Promise<void>,
  timeoutMs: number,
  delayMs: number,
): Promise<WishlistProviderRefreshOutcome> {
  let runId: string | null = null;
  let startedAt: Date | null = null;

  try {
    const started = await startScrapeRun(opts.prisma, {
      provider,
      kind: ScrapeRunKind.WISHLIST_REFRESH,
      triggeredBy: opts.triggeredBy,
      startedAt: clock(),
      metadata: { targetCount: targets.length },
    });
    runId = started.id;
    startedAt = started.startedAt;

    const metrics = createMetrics();
    const events: AlertEvent[] = [];
    const scrapeErrors: string[] = [];
    let rateLimited = false;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]!;
      let refreshed: RefreshedListingState;

      try {
        refreshed = await opts.fetcher.fetchTarget(target, { timeoutMs });
        metrics.scraped++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        scrapeErrors.push(`${target.url}: ${msg}`);
        if (isRateLimited(err)) {
          rateLimited = true;
          break; // stop-on-429/503, do not retry
        }
        // Non-rate-limit fetch failure: graceful, non-destructive.
        refreshed = { kind: 'gone' };
      }

      const prev: TargetPreviousState = {
        provider: target.provider,
        providerListingId: target.providerListingId,
        canonicalBookId: target.canonicalBookId,
        priceAmount: target.currentPriceAmount,
        availability: target.currentAvailability,
      };

      const targetEvents = detectAlertEvents(prev, refreshed, clock());
      events.push(...targetEvents);

      // Update metrics from detected events.
      // NOTE: These columns reflect DETECTED changes; no DB writes happen in W10.3.
      // Persistence to provider_listings/price_history is deferred to W10.3.x/W10.4.
      for (const event of targetEvents) {
        if (event.type === 'PRICE_DROP') {
          metrics.priceHistoryCreated++;
        }
        if (event.type === 'BACK_IN_STOCK' || event.type === 'OUT_OF_STOCK') {
          metrics.availabilityUpdated++;
        }
      }

      // Throttle between consecutive fetches within a provider.
      if (delayMs > 0 && i < targets.length - 1) {
        await sleep(delayMs);
      }
    }

    const status = deriveRunStatus(metrics, scrapeErrors);
    const priceDrops = events.filter((e) => e.type === 'PRICE_DROP').length;
    const availabilityChanges = events.filter(
      (e) => e.type === 'BACK_IN_STOCK' || e.type === 'OUT_OF_STOCK',
    ).length;

    await finishScrapeRun(opts.prisma, runId, {
      startedAt,
      finishedAt: clock(),
      status,
      metrics,
      scrapeErrors,
      metadata: { targetCount: targets.length, priceDrops, availabilityChanges },
    });

    logger.info(
      `${provider}: targets=${targets.length} fetched=${metrics.scraped} priceDrops=${priceDrops} availChanges=${availabilityChanges} errors=${scrapeErrors.length} → ${status}`,
    );
    if (rateLimited) {
      logger.error(`${provider}: rate-limited (HTTP 429/503) — stopped without retry`);
    }

    return {
      provider,
      runId,
      status,
      metrics,
      events,
      scrapeErrors,
      rateLimited,
      targetCount: targets.length,
    };
  } catch (err) {
    // Provider isolation: one provider's failure must not stop the rest.
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Provider ${provider} failed: ${message}`);

    const metrics = createMetrics();
    // Best-effort: close an already-opened run as FAILED so it never dangles RUNNING.
    if (runId !== null && startedAt !== null) {
      try {
        await finishScrapeRun(opts.prisma, runId, {
          startedAt,
          finishedAt: clock(),
          status: ScrapeRunStatus.FAILED,
          metrics,
          scrapeErrors: [message],
        });
      } catch (finishErr) {
        const finishMsg = finishErr instanceof Error ? finishErr.message : String(finishErr);
        logger.error(`Failed to finalize run ${runId} for ${provider}: ${finishMsg}`);
      }
    }

    return {
      provider,
      runId,
      status: ScrapeRunStatus.FAILED,
      metrics,
      events: [],
      scrapeErrors: [message],
      rateLimited: isRateLimited(err),
      targetCount: targets.length,
    };
  }
}
