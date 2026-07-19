/**
 * Real-Postgres integration for the PR4 layer of megakniga-resumable-
 * enrichment (PRD test matrix rows 10, 11): the stale-heartbeat reap wired to
 * the enrichment CLI start, the partial unique index
 * `scrape_runs_one_active_enrichment` as the DB-level lock, and the heartbeat
 * behavior against live rows. Everything here works on `scrape_runs` alone —
 * no listings, no HTTP.
 *
 * Gated on `TEST_DATABASE_URL` — skipped entirely otherwise. The partial
 * unique index only exists after `prisma migrate deploy` ran against the test
 * database:
 *
 *   docker exec knyhovo-db-1 psql -U knyhovo -d postgres -c "CREATE DATABASE knyhovo_test"
 *   DATABASE_URL=postgresql://knyhovo:knyhovo@localhost:5432/knyhovo_test npx prisma migrate deploy
 *   TEST_DATABASE_URL=postgresql://knyhovo:knyhovo@localhost:5432/knyhovo_test npx vitest run src/enrichment/__tests__/enrichment-lock.pg.test.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  Prisma,
  PrismaClient,
  Provider,
  ScrapeRunKind,
  ScrapeRunStatus,
  ScrapeRunTrigger,
} from '@prisma/client';
import {
  ENRICHMENT_REAP_KINDS,
  EnrichmentAlreadyRunningError,
  openEnrichmentRun,
} from '../engine.js';
import {
  GUARDED_KINDS,
  reapStaleRuns,
  type StaleReapConfig,
} from '../../refresh/concurrency-guard.js';
import {
  heartbeatScrapeRun,
  startScrapeRun,
} from '../../refresh/scrape-run.repository.js';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const silentLogger = { info: (): void => {}, error: (): void => {} };

/** Default thresholds: 15 min of heartbeat silence, 24 h for legacy NULL rows. */
const STALE_REAP: StaleReapConfig = {
  heartbeatTimeoutMs: 15 * 60_000,
  legacyStartedAtTimeoutMs: 24 * 3_600_000,
};

const MINUTE = 60_000;

function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * MINUTE);
}

describe.skipIf(!TEST_DATABASE_URL)('enrichment lock + stale reap — Postgres integration', () => {
  const prisma = new PrismaClient({ datasourceUrl: TEST_DATABASE_URL });

  beforeEach(async () => {
    await prisma.scrapeRun.deleteMany({});
  });

  afterAll(async () => {
    await prisma.scrapeRun.deleteMany({});
    await prisma.$disconnect();
  });

  /** A RUNNING enrichment row with a controllable heartbeat and checkpoint. */
  async function seedRunningEnrichment(opts: {
    provider?: Provider;
    kind?: ScrapeRunKind;
    lastHeartbeatAt: Date | null;
    cursor?: string;
    startedAt?: Date;
  }): Promise<string> {
    const row = await prisma.scrapeRun.create({
      data: {
        provider: opts.provider ?? Provider.MEGAKNIGA,
        kind: opts.kind ?? ScrapeRunKind.DESCRIPTION_ENRICHMENT,
        status: ScrapeRunStatus.RUNNING,
        triggeredBy: ScrapeRunTrigger.MANUAL,
        startedAt: opts.startedAt ?? minutesAgo(60),
        lastHeartbeatAt: opts.lastHeartbeatAt,
        ...(opts.cursor !== undefined ? { cursor: opts.cursor } : {}),
      },
      select: { id: true },
    });
    return row.id;
  }

  const openOpts = {
    provider: 'megakniga' as const,
    triggeredBy: ScrapeRunTrigger.MANUAL,
    metadata: { batchSize: 50 },
    staleReap: STALE_REAP,
    logger: silentLogger,
  };

  // ── Matrix row 10: stale RUNNING recovery ─────────────────────────────────

  it('a fresh RUNNING run (live heartbeat) blocks a second start with "enrichment already running"', async () => {
    const liveId = await seedRunningEnrichment({ lastHeartbeatAt: minutesAgo(1) });

    const attempt = openEnrichmentRun({ prisma, ...openOpts });
    await expect(attempt).rejects.toThrow(EnrichmentAlreadyRunningError);
    await attempt.catch((err: EnrichmentAlreadyRunningError) => {
      expect(err.message).toContain('enrichment already running');
      expect(err.runId).toBe(liveId);
      expect(err.lastHeartbeatAt).not.toBeNull();
    });

    // The second process created and modified nothing.
    const rows = await prisma.scrapeRun.findMany({});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: liveId, status: ScrapeRunStatus.RUNNING });
  });

  it('a stale RUNNING run is reaped to FAILED with its cursor intact, and the new run resumes from it (metadata.resumedFromRunId)', async () => {
    const staleId = await seedRunningEnrichment({
      lastHeartbeatAt: minutesAgo(20), // > 15 min → dead
      cursor: 'cursor-from-batch-12',
    });

    const opened = await openEnrichmentRun({ prisma, ...openOpts });

    expect(opened.reaped).toBe(1);
    // No fresh-start-by-predicate when a cursor is available (PRD §4.5 step 4).
    expect(opened.resume).toEqual({
      startCursor: 'cursor-from-batch-12',
      resumedFromRunId: staleId,
    });

    const staleRow = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: staleId } });
    expect(staleRow.status).toBe(ScrapeRunStatus.FAILED);
    expect(staleRow.errorSummary).toBe('Reaped stale heartbeat');
    expect(staleRow.cursor).toBe('cursor-from-batch-12');
    expect(staleRow.finishedAt).not.toBeNull();

    const newRow = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: opened.run.id } });
    expect(newRow.status).toBe(ScrapeRunStatus.RUNNING);
    expect(newRow.cursor).toBe('cursor-from-batch-12');
    expect(newRow.metadata).toMatchObject({ resumedFromRunId: staleId, batchSize: 50 });
  });

  it('conditional reap mutex: a heartbeat landing between the SELECT and the UPDATE cancels the reap — the run stays RUNNING', async () => {
    const runId = await seedRunningEnrichment({ lastHeartbeatAt: minutesAgo(20) });

    // Simulate the run's own live process winning the race: its heartbeat
    // lands right after the reaper's findMany, before the conditional UPDATE.
    const raced = new Proxy(prisma, {
      get(target, prop, receiver) {
        if (prop !== 'scrapeRun') return Reflect.get(target, prop, receiver);
        const scrapeRun = Reflect.get(target, prop, receiver) as PrismaClient['scrapeRun'];
        return new Proxy(scrapeRun, {
          get(model, method, modelReceiver) {
            const orig = Reflect.get(model, method, modelReceiver);
            if (typeof orig !== 'function') return orig;
            const fn = (orig as unknown as (...callArgs: unknown[]) => Promise<unknown>).bind(
              model,
            );
            if (method !== 'findMany') return fn;
            return async (args: unknown) => {
              const found = await fn(args);
              await prisma.scrapeRun.update({
                where: { id: runId },
                data: { lastHeartbeatAt: new Date() },
              });
              return found;
            };
          },
        });
      },
    }) as PrismaClient;

    const result = await reapStaleRuns(raced, STALE_REAP, ENRICHMENT_REAP_KINDS);

    expect(result.candidates).toBe(1);
    expect(result.reaped).toBe(0);
    const row = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: runId } });
    expect(row.status).toBe(ScrapeRunStatus.RUNNING);
    expect(row.errorSummary).toBeNull();
  });

  // ── Matrix row 11: DB-level lock ──────────────────────────────────────────

  it('the partial unique index rejects a second RUNNING enrichment INSERT for the same provider with P2002', async () => {
    await startScrapeRun(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      triggeredBy: ScrapeRunTrigger.MANUAL,
    });

    const second = startScrapeRun(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      triggeredBy: ScrapeRunTrigger.MANUAL,
    });
    await expect(second).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002',
    );
  });

  it('two parallel starts: exactly one creates the RUNNING run, the other gets the clear already-running error and writes nothing', async () => {
    const [a, b] = await Promise.allSettled([
      openEnrichmentRun({ prisma, ...openOpts }),
      openEnrichmentRun({ prisma, ...openOpts }),
    ]);

    const outcomes = [a, b];
    const won = outcomes.filter((o) => o.status === 'fulfilled');
    const lost = outcomes.filter((o) => o.status === 'rejected');
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(1);
    expect((lost[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      EnrichmentAlreadyRunningError,
    );

    const running = await prisma.scrapeRun.findMany({
      where: { status: ScrapeRunStatus.RUNNING },
    });
    expect(running).toHaveLength(1);
    expect(running[0]!.id).toBe((won[0] as PromiseFulfilledResult<{ run: { id: string } }>).value.run.id);
  });

  it('the index does NOT block: another provider, another kind, or closed SUCCESS/PARTIAL/FAILED runs', async () => {
    // Active megakniga enrichment…
    await seedRunningEnrichment({ lastHeartbeatAt: new Date() });

    // (a) …does not block another provider's enrichment run;
    await expect(
      seedRunningEnrichment({ provider: Provider.YAKABOO, lastHeartbeatAt: new Date() }),
    ).resolves.toBeTruthy();

    // (b) …does not block a FULL_CATALOG run of the SAME provider (and that
    // catalog run does not block enrichment — GUARDED_KINDS untouched);
    await expect(
      seedRunningEnrichment({ kind: ScrapeRunKind.FULL_CATALOG, lastHeartbeatAt: new Date() }),
    ).resolves.toBeTruthy();

    // (c) closed runs of the same provider+kind coexist freely with a RUNNING one.
    for (const status of [
      ScrapeRunStatus.SUCCESS,
      ScrapeRunStatus.PARTIAL,
      ScrapeRunStatus.FAILED,
    ]) {
      await prisma.scrapeRun.create({
        data: {
          provider: Provider.MEGAKNIGA,
          kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
          status,
          triggeredBy: ScrapeRunTrigger.MANUAL,
          startedAt: minutesAgo(120),
          finishedAt: minutesAgo(110),
        },
      });
    }
    const total = await prisma.scrapeRun.count();
    expect(total).toBe(6);
  });

  // ── Kind isolation of the reap (PRD §4.6: zero behavior change elsewhere) ──

  it('the enrichment reap never touches a stale FULL_CATALOG run, and the GUARDED_KINDS reap never touches a stale enrichment run', async () => {
    const staleCatalogId = await seedRunningEnrichment({
      kind: ScrapeRunKind.FULL_CATALOG,
      lastHeartbeatAt: minutesAgo(30),
    });
    const staleEnrichmentId = await seedRunningEnrichment({
      lastHeartbeatAt: minutesAgo(30),
    });

    const enrichmentSweep = await reapStaleRuns(prisma, STALE_REAP, ENRICHMENT_REAP_KINDS);
    expect(enrichmentSweep.reaped).toBe(1);
    expect(enrichmentSweep.staleRows[0]!.id).toBe(staleEnrichmentId);
    const catalogRow = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: staleCatalogId } });
    expect(catalogRow.status).toBe(ScrapeRunStatus.RUNNING);

    // Reset the enrichment row back to stale RUNNING and sweep the other way.
    await prisma.scrapeRun.update({
      where: { id: staleEnrichmentId },
      data: { status: ScrapeRunStatus.RUNNING, finishedAt: null, errorSummary: null },
    });
    const guardedSweep = await reapStaleRuns(prisma, STALE_REAP, GUARDED_KINDS);
    expect(guardedSweep.reaped).toBe(1);
    expect(guardedSweep.staleRows[0]!.id).toBe(staleCatalogId);
    const enrichmentRow = await prisma.scrapeRun.findUniqueOrThrow({
      where: { id: staleEnrichmentId },
    });
    expect(enrichmentRow.status).toBe(ScrapeRunStatus.RUNNING);
  });

  // ── Heartbeat against the live schema ─────────────────────────────────────

  it('heartbeatScrapeRun advances last_heartbeat_at on a RUNNING row', async () => {
    const run = await startScrapeRun(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      triggeredBy: ScrapeRunTrigger.MANUAL,
      startedAt: minutesAgo(10),
    });

    const tick = new Date();
    const applied = await heartbeatScrapeRun(prisma, run.id, () => tick);

    expect(applied).toBe(true);
    const row = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(row.lastHeartbeatAt).toEqual(tick);
  });

  it('heartbeatScrapeRun never resurrects a closed/reaped run', async () => {
    const staleId = await seedRunningEnrichment({ lastHeartbeatAt: minutesAgo(20) });
    await reapStaleRuns(prisma, STALE_REAP, ENRICHMENT_REAP_KINDS);
    const reaped = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: staleId } });
    expect(reaped.status).toBe(ScrapeRunStatus.FAILED);

    // The dead process's timer fires one last time — it must change nothing.
    const applied = await heartbeatScrapeRun(prisma, staleId, () => new Date());

    expect(applied).toBe(false);
    const after = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: staleId } });
    expect(after.status).toBe(ScrapeRunStatus.FAILED);
    expect(after.lastHeartbeatAt).toEqual(reaped.lastHeartbeatAt);
  });

  // ── Migration cleanup on a dirty DB (F1) ──────────────────────────────────

  /**
   * Executes the real 20260719160000 migration SQL (cleanup UPDATE + CREATE
   * UNIQUE INDEX) statement by statement, exactly as `prisma migrate deploy`
   * would. Comment lines are stripped; the file has no semicolons inside
   * string literals, so a plain `;` split yields the two statements.
   */
  async function runLockMigrationSql(): Promise<void> {
    const here = dirname(fileURLToPath(import.meta.url));
    const sqlPath = join(
      here,
      '../../../prisma/migrations/20260719160000_scrape_run_enrichment_lock/migration.sql',
    );
    const raw = readFileSync(sqlPath, 'utf8');
    const statements = raw
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
  }

  it('the migration is safe on a dirty DB: two RUNNING enrichment rows are closed to FAILED (cursor intact) and the unique index is (re)created', async () => {
    // Simulate the pre-migration world: the lock index does not yet exist, so
    // the pre-PR4 invariant "multiple RUNNING enrichment rows can coexist"
    // holds — exactly the state a kill -9 / OOM / restart chain leaves behind.
    await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "scrape_runs_one_active_enrichment"');

    const runningA = await seedRunningEnrichment({
      lastHeartbeatAt: minutesAgo(1),
      cursor: 'cursor-A',
    });
    const runningB = await seedRunningEnrichment({
      lastHeartbeatAt: minutesAgo(1),
      cursor: 'cursor-B',
    });
    // A closed row must be left untouched by the cleanup (status guard).
    const alreadyFailed = await prisma.scrapeRun.create({
      data: {
        provider: Provider.MEGAKNIGA,
        kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
        status: ScrapeRunStatus.FAILED,
        triggeredBy: ScrapeRunTrigger.MANUAL,
        startedAt: minutesAgo(120),
        finishedAt: minutesAgo(110),
        cursor: 'cursor-C',
        errorSummary: 'pre-existing failure',
      },
      select: { id: true, finishedAt: true },
    });

    // The migration would previously throw a unique violation here; the
    // cleanup UPDATE makes it pass.
    await expect(runLockMigrationSql()).resolves.toBeUndefined();

    // Both stranded RUNNING rows are now FAILED, with cursor preserved.
    for (const id of [runningA, runningB]) {
      const row = await prisma.scrapeRun.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe(ScrapeRunStatus.FAILED);
      expect(row.errorSummary).toBe('Closed by scrape_runs_one_active_enrichment migration');
      expect(row.finishedAt).not.toBeNull();
    }
    const rowA = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: runningA } });
    const rowB = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: runningB } });
    expect(rowA.cursor).toBe('cursor-A');
    expect(rowB.cursor).toBe('cursor-B');

    // The pre-existing FAILED row is not rewritten by the cleanup.
    const rowC = await prisma.scrapeRun.findUniqueOrThrow({ where: { id: alreadyFailed.id } });
    expect(rowC.errorSummary).toBe('pre-existing failure');
    expect(rowC.cursor).toBe('cursor-C');
    expect(rowC.finishedAt).toEqual(alreadyFailed.finishedAt);

    // The unique index exists and enforces the lock again: a fresh RUNNING row
    // is fine, but a second one for the same provider is now rejected (P2002).
    await startScrapeRun(prisma, {
      provider: Provider.MEGAKNIGA,
      kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
      triggeredBy: ScrapeRunTrigger.MANUAL,
    });
    await expect(
      startScrapeRun(prisma, {
        provider: Provider.MEGAKNIGA,
        kind: ScrapeRunKind.DESCRIPTION_ENRICHMENT,
        triggeredBy: ScrapeRunTrigger.MANUAL,
      }),
    ).rejects.toSatisfy(
      (err: unknown) =>
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002',
    );
  });
});
