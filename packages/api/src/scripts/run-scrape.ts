// NOTE: `@knyhovo/scrapers` is consumed as its compiled `dist/`, but Vitest runs
// the TypeScript source. To stop a stale `dist` from silently running old scraper
// code here, the `scrape` npm script runs `turbo run build --filter=@knyhovo/scrapers`
// first (Turbo caches, so it is a near-no-op when nothing changed). Never run this
// file with raw `tsx` and expect fresh scraper code — go through `pnpm scrape`.
import { prisma } from '../db.js';
import {
  YakabooScraper,
  VivatScraper,
  BookYeScraper,
  BookChefScraper,
  LaboratoryScraper,
  KnigolandScraper,
  BookClubScraper,
  MegaknigaScraper,
  browserManager,
} from '@knyhovo/scrapers';
import type { ScraperProvider, ProviderName } from '@knyhovo/shared';
import { ScrapeRunTrigger } from '@prisma/client';
import { createLogger } from '../pipeline/index.js';
import { runProductionScrape } from '../refresh/production-runner.js';
import {
  parseScraperOptionsFromEnv,
  getScrapeStateRetentionDays,
  getHeartbeatIntervalSeconds,
  getHeartbeatTimeoutMinutes,
  getLegacyStaleTimeoutHours,
} from './scrape-env.js';
import { isGenreAssignAfterScrapeEnabled } from './genre-assign-env.js';
import { parseModeArg, parseProviderArg, parseForceProviderArg } from './run-scrape-args.js';
import { getDisabledProviders } from '../config/provider-filter.js';

// Register new providers here — the pipeline is provider-agnostic and needs no changes.
// Vivat is server-rendered Next.js, so the default FetchHtmlFetcher works (no Cloudflare).
// Книгарня «Є» (book-ye) sits behind a Cloudflare JS challenge, so its default fetcher
// is a PlaywrightHtmlFetcher that waits for product cards to render.
const providers: ScraperProvider[] = [
  new YakabooScraper(),
  new VivatScraper(),
  new BookYeScraper(),
  new BookChefScraper(),
  new LaboratoryScraper(),
  new KnigolandScraper(),
  new BookClubScraper(),
  new MegaknigaScraper(),
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
  const scraperOptions = parseScraperOptionsFromEnv(process.env);
  const genreAssignAfterScrape = isGenreAssignAfterScrapeEnabled(process.env);
  const mode = parseModeArg(process.argv.slice(2));

  // provider-enable-disable PRD §2.1-2.2: SCRAPE_DISABLED_PROVIDERS is the single
  // source of truth for which providers are voluntarily paused. `--provider=` no
  // longer bypasses it — `--force-provider=` is the one explicit, named override.
  const disabled = getDisabledProviders(process.env);
  const providerFilter = parseProviderArg(process.argv.slice(2), providers.map((p) => p.name));
  const forceProvider = parseForceProviderArg(process.argv.slice(2), providers.map((p) => p.name));

  if (providerFilter !== undefined && forceProvider !== undefined) {
    throw new Error('--provider and --force-provider are mutually exclusive');
  }

  let selectedProviders: ScraperProvider[];
  if (forceProvider !== undefined) {
    // Explicit override: runs this provider even if it's in SCRAPE_DISABLED_PROVIDERS.
    selectedProviders = providers.filter((p) => p.name === forceProvider);
  } else if (providerFilter !== undefined) {
    // `providerFilter` has already been validated by `parseProviderArg` against
    // `providers.map(p => p.name)`, so it's guaranteed to be a real `ProviderName`.
    if (disabled.has(providerFilter as ProviderName)) {
      throw new Error(
        `Provider '${providerFilter}' is disabled via SCRAPE_DISABLED_PROVIDERS. ` +
          `Use --force-provider=${providerFilter} to run it explicitly.`,
      );
    }
    selectedProviders = providers.filter((p) => p.name === providerFilter);
  } else {
    // Standard run (cron or manual with no flags): disabled providers are silently skipped.
    selectedProviders = providers.filter((p) => !disabled.has(p.name));
  }

  const requestedProvider = forceProvider ?? providerFilter ?? 'all';
  const forced = forceProvider !== undefined;
  const enabledProviders = selectedProviders.map((p) => p.name);
  const disabledProvidersList = Array.from(disabled);

  const retentionDays = getScrapeStateRetentionDays(process.env);
  const heartbeatIntervalMs = getHeartbeatIntervalSeconds(process.env) * 1000;
  const staleReap = {
    heartbeatTimeoutMs: getHeartbeatTimeoutMinutes(process.env) * 60_000,
    legacyStartedAtTimeoutMs: getLegacyStaleTimeoutHours(process.env) * 3_600_000,
  };
  const startedAt = Date.now();
  logger.info(
    `run-scrape starting at ${new Date(startedAt).toISOString()} (requestedProvider=${requestedProvider}, forced=${forced}, ` +
      `enabledProviders=[${enabledProviders.join(',')}], disabledProviders=[${disabledProvidersList.join(',')}], ` +
      `activeProvidersCount=${selectedProviders.length}, mode=${mode}, triggeredBy=${triggeredBy}, retentionDays=${retentionDays})`,
  );
  if (scraperOptions?.enrichDescriptions === true) {
    logger.info(
      `description enrichment enabled (descriptionDelayMs=${scraperOptions.descriptionDelayMs ?? 'provider default'})`,
    );
  }

  try {
    const result = await runProductionScrape({
      prisma,
      providers: selectedProviders,
      triggeredBy,
      logger,
      genreAssignAfterScrape,
      mode,
      retentionDays,
      heartbeatIntervalMs,
      staleReap,
      ...(scraperOptions !== undefined ? { scraperOptions } : {}),
    });
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
