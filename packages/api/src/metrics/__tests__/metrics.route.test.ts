import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../app.js';

// ── Fake Prisma ───────────────────────────────────────────────────────────────

type FindManyResult = {
  provider: string;
  status: string;
  durationMs: number | null;
  itemsFound: number;
  itemsUpdated: number;
  priceChanges: number;
  availabilityChanges: number;
  errorsCount: number;
}[];

function makeFakePrisma(rows: FindManyResult): PrismaClient {
  return {
    scrapeRun: {
      findMany: vi.fn(async () => rows),
    },
  } as unknown as PrismaClient;
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeRow(overrides: Partial<FindManyResult[0]> = {}): FindManyResult[0] {
  return {
    provider: 'YAKABOO',
    status: 'SUCCESS',
    durationMs: 2000,
    itemsFound: 100,
    itemsUpdated: 80,
    priceChanges: 15,
    availabilityChanges: 5,
    errorsCount: 0,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /metrics', () => {
  it('200 with correct Prometheus content-type header', async () => {
    const prisma = makeFakePrisma([makeRow()]);
    const app = buildApp(prisma);
    const res = await app.inject({ method: 'GET', url: '/metrics' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('text/plain; version=0.0.4; charset=utf-8');
  });

  it('empty DB (no rows) → 200 and empty body', async () => {
    const prisma = makeFakePrisma([]);
    const app = buildApp(prisma);
    const res = await app.inject({ method: 'GET', url: '/metrics' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('');
  });

  it('multiple runs including FAILED → body contains expected metric lines and yakaboo label', async () => {
    const prisma = makeFakePrisma([
      makeRow({ provider: 'YAKABOO', status: 'SUCCESS', durationMs: 1000 }),
      makeRow({ provider: 'YAKABOO', status: 'FAILED', durationMs: 500, errorsCount: 2 }),
    ]);
    const app = buildApp(prisma);
    const res = await app.inject({ method: 'GET', url: '/metrics' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('# TYPE scrape_runs_total counter');
    expect(res.body).toContain('provider="yakaboo"');
    // Two runs total for yakaboo
    expect(res.body).toContain('scrape_runs_total{provider="yakaboo"} 2');
    expect(res.body).toContain('provider_success_total{provider="yakaboo"} 1');
    expect(res.body).toContain('provider_failed_total{provider="yakaboo"} 1');
  });

  it('histogram lines present: bucket, sum, count, +Inf', async () => {
    const prisma = makeFakePrisma([
      makeRow({ durationMs: 1000 }),
      makeRow({ durationMs: 3000 }),
    ]);
    const app = buildApp(prisma);
    const res = await app.inject({ method: 'GET', url: '/metrics' });

    expect(res.body).toContain('scrape_duration_ms_bucket');
    expect(res.body).toContain('scrape_duration_ms_sum');
    expect(res.body).toContain('scrape_duration_ms_count');
    expect(res.body).toContain('le="+Inf"');
  });
});
