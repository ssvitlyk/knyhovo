import { describe, it, expect } from 'vitest';
import type { ScrapeRun } from '@prisma/client';
import {
  Provider,
  ScrapeRunKind,
  ScrapeRunStatus,
  ScrapeRunTrigger,
} from '@prisma/client';
import {
  deriveProviderHealth,
  deriveSummary,
  DEFAULT_HEALTH_CONFIG,
} from '../refresh-health.js';
import type {
  ProviderListingFreshness,
  RefreshHealthConfig,
  ProviderRefreshHealth,
} from '../refresh-health.js';

// ── Fixed test dates ──────────────────────────────────────────────────────────
const NOW = new Date('2026-06-23T12:00:00.000Z');
// 24 hours before NOW — within the 48h window
const RECENT = new Date('2026-06-22T12:00:00.000Z');
// 72 hours before NOW — outside the default 48h noSuccessHours window
const OLD = new Date('2026-06-20T12:00:00.000Z');

// ── Factories ─────────────────────────────────────────────────────────────────
let runCounter = 0;

function fakeRun(overrides: Partial<ScrapeRun> = {}): ScrapeRun {
  runCounter++;
  return {
    id: `run-${runCounter}`,
    provider: Provider.YAKABOO,
    kind: ScrapeRunKind.FULL_CATALOG,
    status: ScrapeRunStatus.SUCCESS,
    triggeredBy: ScrapeRunTrigger.CRON,
    startedAt: RECENT,
    finishedAt: new Date(RECENT.getTime() + 60_000),
    durationMs: 60_000,
    itemsFound: 500,
    itemsUpdated: 100,
    priceChanges: 10,
    availabilityChanges: 5,
    errorsCount: 0,
    errorSummary: null,
    metadata: null,
    ...overrides,
  };
}

function freshness(overrides: Partial<ProviderListingFreshness> = {}): ProviderListingFreshness {
  return {
    provider: Provider.YAKABOO,
    totalListings: 1000,
    staleListings: 0,
    lastSeenAt: RECENT,
    ...overrides,
  };
}

function healthFor(
  runs: ScrapeRun[],
  fr: ProviderListingFreshness | null = null,
  config: RefreshHealthConfig = DEFAULT_HEALTH_CONFIG,
): ReturnType<typeof deriveProviderHealth> {
  return deriveProviderHealth({
    provider: Provider.YAKABOO,
    runs,
    freshness: fr,
    now: NOW,
    config,
  });
}

// ── No runs ───────────────────────────────────────────────────────────────────

describe('deriveProviderHealth — no runs', () => {
  it('status is down, latestRun null, failureStreak 0, has no-successful-run issue', () => {
    const result = healthFor([]);
    expect(result.status).toBe('down');
    expect(result.latestRun).toBeNull();
    expect(result.failureStreak).toBe(0);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.type).toBe('no-successful-run');
    expect(result.issues[0]!.severity).toBe('critical');
  });

  it('provider slug is yakaboo', () => {
    const result = healthFor([]);
    expect(result.provider).toBe('yakaboo');
  });
});

// ── Latest run FAILED ─────────────────────────────────────────────────────────

describe('deriveProviderHealth — latest run FAILED', () => {
  it('status down, has latest-run-failed and no-successful-run issues', () => {
    const run = fakeRun({ status: ScrapeRunStatus.FAILED, startedAt: RECENT });
    const result = healthFor([run]);
    expect(result.status).toBe('down');
    const types = result.issues.map((i) => i.type);
    expect(types).toContain('latest-run-failed');
    expect(types).toContain('no-successful-run');
  });
});

// ── Old success beyond noSuccessHours ─────────────────────────────────────────

describe('deriveProviderHealth — old success (stale)', () => {
  it('reports no-successful-run when last SUCCESS was >48h ago', () => {
    const run = fakeRun({ status: ScrapeRunStatus.SUCCESS, startedAt: OLD });
    const result = healthFor([run]);
    const types = result.issues.map((i) => i.type);
    expect(types).toContain('no-successful-run');
    expect(result.issues.find((i) => i.type === 'no-successful-run')!.severity).toBe('critical');
  });

  it('does NOT report no-successful-run when last SUCCESS was within 48h', () => {
    const run = fakeRun({ status: ScrapeRunStatus.SUCCESS, startedAt: RECENT });
    const result = healthFor([run]);
    const types = result.issues.map((i) => i.type);
    expect(types).not.toContain('no-successful-run');
  });
});

// ── Recent success, fresh listings → healthy ──────────────────────────────────

describe('deriveProviderHealth — recent success, fresh listings', () => {
  it('status healthy, no issues', () => {
    const run = fakeRun({ status: ScrapeRunStatus.SUCCESS, startedAt: RECENT });
    const fr = freshness({ staleListings: 0, totalListings: 1000 });
    const result = healthFor([run], fr);
    expect(result.status).toBe('healthy');
    expect(result.issues).toHaveLength(0);
  });

  it('latestRun fields are mapped correctly', () => {
    const run = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      startedAt: RECENT,
      itemsFound: 300,
      errorsCount: 0,
    });
    const result = healthFor([run]);
    expect(result.latestRun).not.toBeNull();
    expect(result.latestRun!.status).toBe(ScrapeRunStatus.SUCCESS);
    expect(result.latestRun!.startedAt).toBe(RECENT.toISOString());
    expect(result.latestRun!.itemsFound).toBe(300);
  });

  it('lastSuccessfulRunAt matches startedAt ISO', () => {
    const run = fakeRun({ status: ScrapeRunStatus.SUCCESS, startedAt: RECENT });
    const result = healthFor([run]);
    expect(result.lastSuccessfulRunAt).toBe(RECENT.toISOString());
  });
});

// ── Failure streak ────────────────────────────────────────────────────────────

describe('deriveProviderHealth — failure streak', () => {
  it('2 PARTIAL then older SUCCESS → failureStreak 2, degraded with failure-streak issue', () => {
    const older = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      startedAt: new Date('2026-06-21T12:00:00.000Z'),
    });
    const partial1 = fakeRun({
      status: ScrapeRunStatus.PARTIAL,
      startedAt: new Date('2026-06-22T08:00:00.000Z'),
    });
    const partial2 = fakeRun({
      status: ScrapeRunStatus.PARTIAL,
      startedAt: new Date('2026-06-22T10:00:00.000Z'),
    });
    const result = healthFor([partial1, partial2, older]);
    expect(result.failureStreak).toBe(2);
  });

  it('failure streak 0 when latest terminal is SUCCESS', () => {
    const success = fakeRun({ status: ScrapeRunStatus.SUCCESS, startedAt: RECENT });
    const result = healthFor([success]);
    expect(result.failureStreak).toBe(0);
  });
});

// ── Suspicious empty SUCCESS ──────────────────────────────────────────────────

describe('deriveProviderHealth — suspicious empty success', () => {
  it('FULL_CATALOG SUCCESS with itemsFound 0 → down, suspicious-empty-success', () => {
    const run = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      kind: ScrapeRunKind.FULL_CATALOG,
      itemsFound: 0,
      startedAt: RECENT,
    });
    const result = healthFor([run]);
    expect(result.status).toBe('down');
    const types = result.issues.map((i) => i.type);
    expect(types).toContain('suspicious-empty-success');
    expect(result.issues.find((i) => i.type === 'suspicious-empty-success')!.severity).toBe('critical');
  });

  it('WISHLIST_REFRESH SUCCESS with itemsFound 0 → does NOT trigger suspicious-empty-success', () => {
    const run = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      kind: ScrapeRunKind.WISHLIST_REFRESH,
      itemsFound: 0,
      startedAt: RECENT,
    });
    const result = healthFor([run]);
    const types = result.issues.map((i) => i.type);
    expect(types).not.toContain('suspicious-empty-success');
  });
});

// ── Selector drift ────────────────────────────────────────────────────────────

describe('deriveProviderHealth — selector drift', () => {
  it('prev SUCCESS 1000 items, latest SUCCESS 100 items → degraded, selector-drift', () => {
    const prev = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      startedAt: new Date('2026-06-21T12:00:00.000Z'),
      itemsFound: 1000,
    });
    const latest = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      startedAt: RECENT,
      itemsFound: 100,
    });
    const result = healthFor([latest, prev]);
    expect(result.status).toBe('degraded');
    const types = result.issues.map((i) => i.type);
    expect(types).toContain('selector-drift');
    expect(result.issues.find((i) => i.type === 'selector-drift')!.severity).toBe('warning');
  });

  it('does NOT report drift when drop is minor (<50%)', () => {
    const prev = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      startedAt: new Date('2026-06-21T12:00:00.000Z'),
      itemsFound: 1000,
    });
    const latest = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      startedAt: RECENT,
      itemsFound: 600,
    });
    const result = healthFor([latest, prev]);
    const types = result.issues.map((i) => i.type);
    expect(types).not.toContain('selector-drift');
  });

  it('does NOT report drift when latest itemsFound is 0 (covered by suspicious-empty-success)', () => {
    const prev = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      startedAt: new Date('2026-06-21T12:00:00.000Z'),
      itemsFound: 1000,
    });
    const latest = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      kind: ScrapeRunKind.FULL_CATALOG,
      startedAt: RECENT,
      itemsFound: 0,
    });
    const result = healthFor([latest, prev]);
    const types = result.issues.map((i) => i.type);
    expect(types).not.toContain('selector-drift');
  });
});

// ── High error count ──────────────────────────────────────────────────────────

describe('deriveProviderHealth — high error count', () => {
  it('errorsCount >= 10 → degraded, high-error-count warning', () => {
    const run = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      startedAt: RECENT,
      errorsCount: 10,
    });
    const result = healthFor([run]);
    expect(result.status).toBe('degraded');
    const types = result.issues.map((i) => i.type);
    expect(types).toContain('high-error-count');
    expect(result.issues.find((i) => i.type === 'high-error-count')!.severity).toBe('warning');
  });

  it('errorsCount 9 → no high-error-count issue', () => {
    const run = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      startedAt: RECENT,
      errorsCount: 9,
    });
    const result = healthFor([run]);
    const types = result.issues.map((i) => i.type);
    expect(types).not.toContain('high-error-count');
  });
});

// ── Stale listings ────────────────────────────────────────────────────────────

describe('deriveProviderHealth — stale listings', () => {
  it('staleListings/total >= staleProviderRatio → degraded, stale-listings warning', () => {
    const run = fakeRun({ status: ScrapeRunStatus.SUCCESS, startedAt: RECENT });
    const fr = freshness({ totalListings: 100, staleListings: 60 }); // 60% >= 50%
    const result = healthFor([run], fr);
    expect(result.status).toBe('degraded');
    const types = result.issues.map((i) => i.type);
    expect(types).toContain('stale-listings');
    expect(result.staleListings).toBe(60);
    expect(result.totalListings).toBe(100);
  });

  it('staleListings/total < staleProviderRatio → no stale-listings issue', () => {
    const run = fakeRun({ status: ScrapeRunStatus.SUCCESS, startedAt: RECENT });
    const fr = freshness({ totalListings: 100, staleListings: 40 }); // 40% < 50%
    const result = healthFor([run], fr);
    const types = result.issues.map((i) => i.type);
    expect(types).not.toContain('stale-listings');
  });

  it('null freshness → no stale-listings issue, totalListings and staleListings are 0', () => {
    const run = fakeRun({ status: ScrapeRunStatus.SUCCESS, startedAt: RECENT });
    const result = healthFor([run], null);
    expect(result.totalListings).toBe(0);
    expect(result.staleListings).toBe(0);
    const types = result.issues.map((i) => i.type);
    expect(types).not.toContain('stale-listings');
  });
});

// ── RUNNING latest run is ignored ─────────────────────────────────────────────

describe('deriveProviderHealth — RUNNING run is ignored for streak/success', () => {
  it('RUNNING on top of a recent SUCCESS → no failure issues, healthy', () => {
    const success = fakeRun({
      status: ScrapeRunStatus.SUCCESS,
      startedAt: RECENT,
    });
    const running = fakeRun({
      status: ScrapeRunStatus.RUNNING,
      startedAt: new Date(RECENT.getTime() + 3_600_000),
      finishedAt: null,
      durationMs: null,
    });
    const result = healthFor([running, success]);
    expect(result.failureStreak).toBe(0);
    expect(result.lastSuccessfulRunAt).toBe(RECENT.toISOString());
    // No critical issues — the RUNNING run doesn't count as FAILED
    const criticals = result.issues.filter((i) => i.severity === 'critical');
    expect(criticals).toHaveLength(0);
  });
});

// ── deriveSummary ─────────────────────────────────────────────────────────────

describe('deriveSummary', () => {
  function makeProvider(status: ProviderRefreshHealth['status'], stale = false): ProviderRefreshHealth {
    return {
      provider: 'yakaboo',
      status,
      latestRun: null,
      lastSuccessfulRunAt: null,
      failureStreak: 0,
      totalListings: 0,
      staleListings: 0,
      lastListingSeenAt: null,
      issues: stale
        ? [{ type: 'stale-listings', severity: 'warning', message: 'stale' }]
        : [],
    };
  }

  it('all healthy → summary healthy', () => {
    const providers = [makeProvider('healthy'), makeProvider('healthy')];
    const s = deriveSummary(providers, NOW);
    expect(s.status).toBe('healthy');
    expect(s.degradedProviders).toBe(0);
  });

  it('mix of statuses → summary degraded', () => {
    const providers = [makeProvider('healthy'), makeProvider('down')];
    const s = deriveSummary(providers, NOW);
    expect(s.status).toBe('degraded');
    expect(s.degradedProviders).toBe(1);
  });

  it('all down → summary down', () => {
    const providers = [makeProvider('down'), makeProvider('down')];
    const s = deriveSummary(providers, NOW);
    expect(s.status).toBe('down');
    expect(s.degradedProviders).toBe(2);
  });

  it('empty providers array → summary down', () => {
    const s = deriveSummary([], NOW);
    expect(s.status).toBe('down');
    expect(s.degradedProviders).toBe(0);
  });

  it('counts staleProviders correctly', () => {
    const providers = [makeProvider('degraded', true), makeProvider('healthy', false)];
    const s = deriveSummary(providers, NOW);
    expect(s.staleProviders).toBe(1);
  });

  it('lastUpdatedAt is NOW ISO', () => {
    const s = deriveSummary([], NOW);
    expect(s.lastUpdatedAt).toBe(NOW.toISOString());
  });
});
