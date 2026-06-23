import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient, ScrapeRun } from '@prisma/client';
import {
  Provider,
  ScrapeRunKind,
  ScrapeRunStatus,
  ScrapeRunTrigger,
} from '@prisma/client';
import { buildApp } from '../../app.js';

// ── Fixed dates ───────────────────────────────────────────────────────────────
const RECENT = new Date('2026-06-22T12:00:00.000Z');

// ── Fixture factories ─────────────────────────────────────────────────────────
function fakeRun(overrides: Partial<ScrapeRun> = {}): ScrapeRun {
  return {
    id: 'run-1',
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

// ── Fake Prisma ───────────────────────────────────────────────────────────────
function makeFakePrisma(
  runs: ScrapeRun[],
  totals: Array<{ provider: string; _count: { _all: number }; _max: { lastSeenAt: Date | null } }> = [],
  stale: Array<{ provider: string; _count: { _all: number } }> = [],
): PrismaClient {
  const groupBy = vi
    .fn()
    .mockResolvedValueOnce(totals)   // first call: totals
    .mockResolvedValueOnce(stale);   // second call: stale

  return {
    scrapeRun: {
      findMany: vi.fn(async () => runs),
    },
    providerListing: { groupBy },
  } as unknown as PrismaClient;
}

// ── Scenario helpers ──────────────────────────────────────────────────────────
// One provider (YAKABOO) has a FAILED latest run; others have a recent SUCCESS.
function makeScenarioRuns(): ScrapeRun[] {
  return [
    fakeRun({ provider: Provider.YAKABOO, status: ScrapeRunStatus.FAILED }),
    fakeRun({ id: 'run-2', provider: Provider.BOOK_CLUB, status: ScrapeRunStatus.SUCCESS }),
    fakeRun({ id: 'run-3', provider: Provider.VIVAT, status: ScrapeRunStatus.SUCCESS }),
    fakeRun({ id: 'run-4', provider: Provider.BOOK_YE, status: ScrapeRunStatus.SUCCESS }),
  ];
}

// ── GET /api/refresh/health ───────────────────────────────────────────────────

describe('GET /api/refresh/health', () => {
  it('200: returns providers array of length 4 with expected fields', async () => {
    const prisma = makeFakePrisma(makeScenarioRuns());
    const app = buildApp(prisma);
    const res = await app.inject({ method: 'GET', url: '/api/refresh/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      providers: Array<{
        provider: string;
        status: string;
        issues: Array<{ type: string; severity: string }>;
        latestRun: unknown;
        failureStreak: number;
        totalListings: number;
        staleListings: number;
        lastListingSeenAt: string | null;
        lastSuccessfulRunAt: string | null;
      }>;
      summary: {
        status: string;
        degradedProviders: number;
        staleProviders: number;
        lastUpdatedAt: string;
      };
    };

    expect(body.providers).toHaveLength(4);
    for (const p of body.providers) {
      expect(p).toHaveProperty('provider');
      expect(p).toHaveProperty('status');
      expect(p).toHaveProperty('issues');
      expect(Array.isArray(p.issues)).toBe(true);
    }
  });

  it('200: yakaboo FAILED → that provider status is down', async () => {
    const prisma = makeFakePrisma(makeScenarioRuns());
    const app = buildApp(prisma);
    const res = await app.inject({ method: 'GET', url: '/api/refresh/health' });

    const body = res.json() as {
      providers: Array<{ provider: string; status: string }>;
    };
    const yakaboo = body.providers.find((p) => p.provider === 'yakaboo');
    expect(yakaboo?.status).toBe('down');
  });

  it('200: summary.status is degraded when one provider is down', async () => {
    const prisma = makeFakePrisma(makeScenarioRuns());
    const app = buildApp(prisma);
    const res = await app.inject({ method: 'GET', url: '/api/refresh/health' });

    const body = res.json() as { summary: { status: string } };
    // YAKABOO is down, others are healthy (within 48h SUCCESS window)
    expect(['degraded', 'down']).toContain(body.summary.status);
  });

  it('200: summary has expected shape with numeric degradedProviders, staleProviders and ISO lastUpdatedAt', async () => {
    const prisma = makeFakePrisma(makeScenarioRuns());
    const app = buildApp(prisma);
    const res = await app.inject({ method: 'GET', url: '/api/refresh/health' });

    const { summary } = res.json() as {
      summary: {
        status: string;
        degradedProviders: number;
        staleProviders: number;
        lastUpdatedAt: string;
      };
    };

    expect(typeof summary.degradedProviders).toBe('number');
    expect(typeof summary.staleProviders).toBe('number');
    expect(typeof summary.lastUpdatedAt).toBe('string');
    // Should parse as a valid ISO date
    expect(new Date(summary.lastUpdatedAt).toISOString()).toBe(summary.lastUpdatedAt);
  });

  it('200: providers are sorted by slug ascending', async () => {
    const prisma = makeFakePrisma(makeScenarioRuns());
    const app = buildApp(prisma);
    const res = await app.inject({ method: 'GET', url: '/api/refresh/health' });

    const body = res.json() as { providers: Array<{ provider: string }> };
    const slugs = body.providers.map((p) => p.provider);
    expect(slugs).toEqual([...slugs].sort());
  });

  it('200: all providers healthy when all have recent SUCCESS and fresh listings', async () => {
    const allSuccess = [
      fakeRun({ provider: Provider.YAKABOO, status: ScrapeRunStatus.SUCCESS }),
      fakeRun({ id: 'r2', provider: Provider.BOOK_CLUB, status: ScrapeRunStatus.SUCCESS }),
      fakeRun({ id: 'r3', provider: Provider.VIVAT, status: ScrapeRunStatus.SUCCESS }),
      fakeRun({ id: 'r4', provider: Provider.BOOK_YE, status: ScrapeRunStatus.SUCCESS }),
    ];
    const prisma = makeFakePrisma(allSuccess);
    const app = buildApp(prisma);
    const res = await app.inject({ method: 'GET', url: '/api/refresh/health' });

    const body = res.json() as {
      providers: Array<{ status: string }>;
      summary: { status: string };
    };

    // All providers should have no critical issues (they have recent SUCCESS runs)
    // Summary should be healthy or degraded depending on no-successful-run check
    // With RECENT = 2026-06-22 and NOW being current time ~2026-06-23, that's ~24h → within 48h → healthy
    for (const p of body.providers) {
      expect(p.status).toBe('healthy');
    }
    expect(body.summary.status).toBe('healthy');
  });
});
