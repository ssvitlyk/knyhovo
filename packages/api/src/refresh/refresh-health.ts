import type { ScrapeRun, PrismaClient } from '@prisma/client';
import { Provider, ScrapeRunStatus, ScrapeRunKind } from '@prisma/client';
import type { ProviderName } from '@knyhovo/shared';
import {
  fetchRecentRuns,
  fetchListingFreshness,
} from './refresh-health.repository.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RefreshHealthStatus = 'healthy' | 'degraded' | 'down';
export type RefreshHealthIssueSeverity = 'warning' | 'critical';
export type RefreshHealthIssueType =
  | 'no-successful-run'
  | 'latest-run-failed'
  | 'failure-streak'
  | 'suspicious-empty-success'
  | 'selector-drift'
  | 'high-error-count'
  | 'stale-listings';

export interface RefreshHealthIssue {
  type: RefreshHealthIssueType;
  severity: RefreshHealthIssueSeverity;
  message: string;
}

export interface ProviderLatestRun {
  kind: ScrapeRunKind;
  status: ScrapeRunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  itemsFound: number;
  itemsUpdated: number;
  priceChanges: number;
  availabilityChanges: number;
  errorsCount: number;
}

export interface ProviderRefreshHealth {
  provider: ProviderName;
  status: RefreshHealthStatus;
  latestRun: ProviderLatestRun | null;
  lastSuccessfulRunAt: string | null;
  failureStreak: number;
  totalListings: number;
  staleListings: number;
  lastListingSeenAt: string | null;
  issues: RefreshHealthIssue[];
}

export interface RefreshHealthSummary {
  status: RefreshHealthStatus;
  /** Count of providers whose status !== 'healthy'. */
  degradedProviders: number;
  /** Count of providers with a 'stale-listings' issue. */
  staleProviders: number;
  /** ISO timestamp of the `now` value used when the report was built. */
  lastUpdatedAt: string;
}

export interface RefreshHealthReport {
  providers: ProviderRefreshHealth[];
  summary: RefreshHealthSummary;
}

export interface RefreshHealthConfig {
  noSuccessHours: number;
  failureStreakThreshold: number;
  highErrorCount: number;
  staleListingHours: number;
  staleProviderRatio: number;
  fillRateDropRatio: number;
}

export const DEFAULT_HEALTH_CONFIG: RefreshHealthConfig = {
  noSuccessHours: 48,
  failureStreakThreshold: 2,
  highErrorCount: 10,
  staleListingHours: 72,
  staleProviderRatio: 0.5,
  fillRateDropRatio: 0.5,
};

/** Input shape for per-provider listing freshness (decoupled from the DB layer). */
export interface ProviderListingFreshness {
  provider: Provider;
  totalListings: number;
  staleListings: number;
  lastSeenAt: Date | null;
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const PROVIDER_SLUG: Record<Provider, ProviderName> = {
  YAKABOO: 'yakaboo',
  BOOK_CLUB: 'book-club',
  VIVAT: 'vivat',
  BOOK_YE: 'book-ye',
};

const ALL_PROVIDERS: Provider[] = [
  Provider.YAKABOO,
  Provider.BOOK_CLUB,
  Provider.VIVAT,
  Provider.BOOK_YE,
];

// ---------------------------------------------------------------------------
// Pure derivation
// ---------------------------------------------------------------------------

function toLatestRun(run: ScrapeRun): ProviderLatestRun {
  return {
    kind: run.kind,
    status: run.status,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    durationMs: run.durationMs,
    itemsFound: run.itemsFound,
    itemsUpdated: run.itemsUpdated,
    priceChanges: run.priceChanges,
    availabilityChanges: run.availabilityChanges,
    errorsCount: run.errorsCount,
  };
}

function isTerminal(run: ScrapeRun): boolean {
  return (
    run.status === ScrapeRunStatus.SUCCESS ||
    run.status === ScrapeRunStatus.PARTIAL ||
    run.status === ScrapeRunStatus.FAILED
  );
}

/**
 * Derive the health report for a single provider from its scrape runs and
 * listing freshness data.
 */
export function deriveProviderHealth(input: {
  provider: Provider;
  runs: ScrapeRun[];
  freshness: ProviderListingFreshness | null;
  now: Date;
  config: RefreshHealthConfig;
}): ProviderRefreshHealth {
  const { provider, freshness, now, config } = input;

  // Sort newest first (non-destructive)
  const runs = [...input.runs].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
  );

  const latestRun = runs[0] ?? null;
  const terminalRuns = runs.filter(isTerminal);

  // Most recent terminal run with SUCCESS status
  const lastSuccessfulRun =
    terminalRuns.find((r) => r.status === ScrapeRunStatus.SUCCESS) ?? null;
  const lastSuccessfulRunAt = lastSuccessfulRun?.startedAt.toISOString() ?? null;

  // Leading FAILED|PARTIAL streak among terminal runs (newest → oldest)
  let failureStreak = 0;
  for (const run of terminalRuns) {
    if (
      run.status === ScrapeRunStatus.FAILED ||
      run.status === ScrapeRunStatus.PARTIAL
    ) {
      failureStreak++;
    } else {
      break;
    }
  }

  // ── Issue detection ────────────────────────────────────────────────────────
  const issues: RefreshHealthIssue[] = [];

  // 1. no-successful-run (critical)
  const noSuccessMs = config.noSuccessHours * 3_600_000;
  if (
    lastSuccessfulRun === null ||
    now.getTime() - lastSuccessfulRun.startedAt.getTime() > noSuccessMs
  ) {
    const hoursAgo =
      lastSuccessfulRun === null
        ? null
        : Math.floor(
            (now.getTime() - lastSuccessfulRun.startedAt.getTime()) / 3_600_000,
          );
    const since =
      hoursAgo === null ? 'never' : `${hoursAgo}h ago`;
    issues.push({
      type: 'no-successful-run',
      severity: 'critical',
      message: `No successful run in the last ${config.noSuccessHours}h (last: ${since}).`,
    });
  }

  // 2. latest-run-failed (critical)
  const latestTerminal = terminalRuns[0] ?? null;
  if (latestRun !== null && latestTerminal?.status === ScrapeRunStatus.FAILED) {
    issues.push({
      type: 'latest-run-failed',
      severity: 'critical',
      message: 'The most recent run finished with status FAILED.',
    });
  }

  // 3. suspicious-empty-success (critical)
  if (
    latestRun !== null &&
    latestRun.status === ScrapeRunStatus.SUCCESS &&
    latestRun.kind === ScrapeRunKind.FULL_CATALOG &&
    latestRun.itemsFound === 0
  ) {
    issues.push({
      type: 'suspicious-empty-success',
      severity: 'critical',
      message: 'Latest FULL_CATALOG run succeeded but found 0 items — possible selector breakage.',
    });
  }

  // 4. selector-drift (warning) — only when latest success has items (0 is covered by #3)
  const successRuns = terminalRuns.filter(
    (r) => r.status === ScrapeRunStatus.SUCCESS,
  );
  const latestSuccess = successRuns[0] ?? null;
  const prevSuccess = successRuns[1] ?? null;
  if (
    latestSuccess !== null &&
    prevSuccess !== null &&
    latestSuccess.itemsFound > 0 &&
    prevSuccess.itemsFound > 0 &&
    latestSuccess.itemsFound < prevSuccess.itemsFound * (1 - config.fillRateDropRatio)
  ) {
    issues.push({
      type: 'selector-drift',
      severity: 'warning',
      message: `Items found dropped from ${prevSuccess.itemsFound} to ${latestSuccess.itemsFound} (>${Math.round(config.fillRateDropRatio * 100)}% fall).`,
    });
  }

  // 5. high-error-count (warning)
  if (latestRun !== null && latestRun.errorsCount >= config.highErrorCount) {
    issues.push({
      type: 'high-error-count',
      severity: 'warning',
      message: `Latest run had ${latestRun.errorsCount} errors (threshold: ${config.highErrorCount}).`,
    });
  }

  // 6. stale-listings (warning)
  if (
    freshness !== null &&
    freshness.totalListings > 0 &&
    freshness.staleListings / freshness.totalListings >= config.staleProviderRatio
  ) {
    issues.push({
      type: 'stale-listings',
      severity: 'warning',
      message: `${freshness.staleListings}/${freshness.totalListings} listings are stale (>${Math.round(config.staleProviderRatio * 100)}%).`,
    });
  }

  // ── Status roll-up ─────────────────────────────────────────────────────────
  const hasCritical = issues.some((i) => i.severity === 'critical');
  const hasWarning = issues.some((i) => i.severity === 'warning');
  const status: RefreshHealthStatus = hasCritical
    ? 'down'
    : hasWarning
      ? 'degraded'
      : 'healthy';

  return {
    provider: PROVIDER_SLUG[provider],
    status,
    latestRun: latestRun ? toLatestRun(latestRun) : null,
    lastSuccessfulRunAt,
    failureStreak,
    totalListings: freshness?.totalListings ?? 0,
    staleListings: freshness?.staleListings ?? 0,
    lastListingSeenAt: freshness?.lastSeenAt?.toISOString() ?? null,
    issues,
  };
}

/**
 * Derive the overall summary from per-provider health results.
 */
export function deriveSummary(
  providers: ProviderRefreshHealth[],
  now: Date,
): RefreshHealthSummary {
  const degradedProviders = providers.filter((p) => p.status !== 'healthy').length;
  const staleProviders = providers.filter((p) =>
    p.issues.some((i) => i.type === 'stale-listings'),
  ).length;

  let status: RefreshHealthStatus;
  if (providers.length === 0) {
    status = 'down';
  } else if (providers.every((p) => p.status === 'healthy')) {
    status = 'healthy';
  } else if (providers.every((p) => p.status === 'down')) {
    status = 'down';
  } else {
    status = 'degraded';
  }

  return {
    status,
    degradedProviders,
    staleProviders,
    lastUpdatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Build a full refresh health report by fetching run and listing data from the
 * DB, then deriving health per provider.
 */
export async function getRefreshHealth(
  prisma: PrismaClient,
  deps?: { now?: Date; config?: RefreshHealthConfig },
): Promise<RefreshHealthReport> {
  const now = deps?.now ?? new Date();
  const config = deps?.config ?? DEFAULT_HEALTH_CONFIG;

  const staleBefore = new Date(now.getTime() - config.staleListingHours * 3_600_000);

  const [allRuns, freshnessRows] = await Promise.all([
    fetchRecentRuns(prisma),
    fetchListingFreshness(prisma, staleBefore),
  ]);

  const freshnessMap = new Map<Provider, ProviderListingFreshness>(
    freshnessRows.map((f) => [f.provider, f]),
  );

  const providerHealthList = ALL_PROVIDERS.map((provider) =>
    deriveProviderHealth({
      provider,
      runs: allRuns.filter((r) => r.provider === provider),
      freshness: freshnessMap.get(provider) ?? null,
      now,
      config,
    }),
  );

  // Sort by slug ascending for determinism
  providerHealthList.sort((a, b) => a.provider.localeCompare(b.provider));

  const summary = deriveSummary(providerHealthList, now);

  return { providers: providerHealthList, summary };
}
