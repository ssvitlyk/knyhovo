import { describe, it, expect, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { HtmlFetcher } from '@knyhovo/scrapers';
import type { ExtractedProductDetails } from '@knyhovo/scrapers';
import {
  buildCandidateWhere,
  buildFillOnlyPatch,
  countEnrichmentCandidates,
  deriveEnrichmentStatus,
  formatDuration,
  metricsForRunClose,
  resolveEnrichmentResume,
  runEnrichment,
  toRawListing,
  type CandidateRow,
  type EnrichmentBatchProgress,
  type EnrichmentRunSummary,
} from '../engine.js';
import { mapMetricsToRunCounts } from '../../refresh/scrape-run.repository.js';
import type { ProviderEnrichmentConfig } from '../providers.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LONG_DESCRIPTION =
  'Книга про пригоди, що триває достатньо довго, аби пройти будь-яку санітарну ' +
  'нормалізацію опису без втрат і лишитися змістовним текстом для картки товару.';

function makeRow(overrides: Partial<CandidateRow> & { id: string }): CandidateRow {
  return {
    url: `https://www.megakniga.com.ua/products/${overrides.id}`,
    title: 'Книга',
    author: 'Автор',
    isbn: null,
    priceAmount: 43210,
    priceCurrency: 'UAH',
    availability: 'IN_STOCK',
    coverUrl: null,
    description: null,
    publisher: null,
    language: null,
    format: null,
    series: null,
    publicationYear: null,
    rawCategories: [],
    ...overrides,
  };
}

/**
 * The fake "product page" is a JSON document; the fake extractor parses it.
 * This keeps engine tests independent of any real provider's HTML while the
 * real extract path (fetch → extract → sanitize → merge) still runs in full.
 */
function pageFor(details: ExtractedProductDetails): string {
  return JSON.stringify(details);
}

const TEST_CONFIG: ProviderEnrichmentConfig = {
  extract: (html: string) => JSON.parse(html) as ExtractedProductDetails,
  delayMs: 0,
  timeoutMs: 1000,
  maxRetries: 0,
  retryBaseDelayMs: 1,
  retryMaxDelayMs: 2,
};

const FULL_DETAILS: ExtractedProductDetails = {
  description: LONG_DESCRIPTION,
  metadata: { isbn: '9786171501232', publisher: 'Віват', format: 'Тверда' },
  rawCategories: ['Книги', 'Проза'],
};

// ── In-memory fake Prisma ─────────────────────────────────────────────────────

type CandidateWhere = { provider: string; id?: { gt: string }; OR?: unknown };

/** Mirrors buildCandidateWhere's OR predicate for the fake DB. */
function needsEnrichment(row: CandidateRow): boolean {
  return (
    row.isbn === null ||
    row.description === null ||
    row.publisher === null ||
    row.format === null ||
    row.rawCategories.length === 0
  );
}

function makeFakePrisma(
  rows: CandidateRow[],
  opts: { failTransactionTimes?: number } = {},
): {
  prisma: PrismaClient;
  updateCalls: Array<{ id: string; data: Record<string, unknown> }>;
  checkpointCalls: Array<{ runId: string; data: Record<string, unknown> }>;
} {
  const updateCalls: Array<{ id: string; data: Record<string, unknown> }> = [];
  const checkpointCalls: Array<{ runId: string; data: Record<string, unknown> }> = [];
  let txFailuresLeft = opts.failTransactionTimes ?? 0;

  const select = (where: CandidateWhere): CandidateRow[] =>
    rows
      .filter(
        (row) =>
          // No OR clause means a --force query: every provider row matches.
          (where.OR === undefined || needsEnrichment(row)) &&
          (where.id === undefined || row.id > where.id.gt),
      )
      .sort((a, b) => (a.id < b.id ? -1 : 1));

  const fake = {
    providerListing: {
      count: ({ where }: { where: CandidateWhere }): Promise<number> =>
        Promise.resolve(select(where).length),
      findMany: ({ where, take }: { where: CandidateWhere; take: number }): Promise<CandidateRow[]> =>
        Promise.resolve(select(where).slice(0, take).map((row) => ({ ...row }))),
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }): Promise<CandidateRow> => {
        const row = rows.find((r) => r.id === where.id);
        if (row === undefined) return Promise.reject(new Error(`no row ${where.id}`));
        Object.assign(row, data);
        updateCalls.push({ id: where.id, data });
        return Promise.resolve(row);
      },
    },
    scrapeRun: {
      // The in-transaction checkpoint (PR3) lands here via the tx client.
      updateMany: ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }): Promise<{ count: number }> => {
        checkpointCalls.push({ runId: where.id, data });
        return Promise.resolve({ count: 1 });
      },
    },
    // Interactive-transaction fake: a "serialization failure" rejects before
    // the callback runs (nothing applied — how a real aborted tx behaves for
    // an in-memory store); otherwise the callback gets the fake itself as tx.
    $transaction: (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => {
      if (txFailuresLeft > 0) {
        txFailuresLeft--;
        return Promise.reject(new Error('could not serialize access'));
      }
      return fn(fake);
    },
  };

  return { prisma: fake as unknown as PrismaClient, updateCalls, checkpointCalls };
}

function makeFetcher(
  respond: (url: string) => string,
): { fetcher: HtmlFetcher; fetched: string[] } {
  const fetched: string[] = [];
  return {
    fetched,
    fetcher: {
      fetch: (url: string): Promise<string> => {
        fetched.push(url);
        return Promise.resolve(respond(url));
      },
    },
  };
}

const silentLogger = { info: (): void => {}, error: (): void => {} };

// ── Pure helpers ──────────────────────────────────────────────────────────────

describe('buildCandidateWhere', () => {
  it('filters by provider and missing-field predicate, without a cursor', () => {
    const where = buildCandidateWhere('MEGAKNIGA', null);
    expect(where.provider).toBe('MEGAKNIGA');
    expect(where.id).toBeUndefined();
    expect(where.OR).toEqual([
      { isbn: null },
      { description: null },
      { publisher: null },
      { format: null },
      { rawCategories: { isEmpty: true } },
    ]);
  });

  it('adds exclusive keyset pagination when a cursor is set', () => {
    expect(buildCandidateWhere('MEGAKNIGA', 'abc').id).toEqual({ gt: 'abc' });
  });

  it('drops the missing-field predicate under force, keeping provider + keyset', () => {
    const where = buildCandidateWhere('MEGAKNIGA', 'abc', true);
    expect(where.OR).toBeUndefined();
    expect(where.provider).toBe('MEGAKNIGA');
    expect(where.id).toEqual({ gt: 'abc' });
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes and hours compactly', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(38_000)).toBe('38s');
    expect(formatDuration(4 * 60_000 + 12_000)).toBe('4m12s');
    expect(formatDuration(2 * 3_600_000 + 5 * 60_000)).toBe('2h05m');
    expect(formatDuration(-500)).toBe('0s');
  });
});

describe('toRawListing', () => {
  it('rebuilds the RawProviderListing shape from a persisted row', () => {
    const row = makeRow({ id: 'r1', availability: 'OUT_OF_STOCK', isbn: '9786171501232' });
    const listing = toRawListing('megakniga', row);
    expect(listing).toMatchObject({
      provider: 'megakniga',
      url: row.url,
      isbn: '9786171501232',
      availability: 'out-of-stock',
      price: { amount: 43210, currency: 'UAH' },
      rawCategories: [],
    });
  });
});

describe('buildFillOnlyPatch', () => {
  it('fills every empty field the pass produced a value for', () => {
    const row = makeRow({ id: 'r1' });
    const enriched = {
      ...toRawListing('megakniga', row),
      isbn: '9786171501232',
      description: LONG_DESCRIPTION,
      publisher: 'Віват',
      format: 'Тверда',
      rawCategories: ['Книги', 'Проза'],
    };
    expect(buildFillOnlyPatch(row, enriched)).toEqual({
      isbn: '9786171501232',
      description: LONG_DESCRIPTION,
      publisher: 'Віват',
      format: 'Тверда',
      rawCategories: ['Книги', 'Проза'],
    });
  });

  it('never overwrites a non-empty persisted value', () => {
    const row = makeRow({
      id: 'r1',
      isbn: '9789660000000',
      description: 'існуючий опис',
      rawCategories: ['Старі', 'Категорії'],
    });
    const enriched = {
      ...toRawListing('megakniga', row),
      isbn: '9786171501232',
      description: LONG_DESCRIPTION,
      publisher: 'Віват',
      rawCategories: ['Нові'],
    };
    expect(buildFillOnlyPatch(row, enriched)).toEqual({ publisher: 'Віват' });
  });

  it('returns null when the pass gained nothing usable', () => {
    const row = makeRow({ id: 'r1' });
    expect(buildFillOnlyPatch(row, toRawListing('megakniga', row))).toBeNull();
  });
});

describe('deriveEnrichmentStatus', () => {
  const base: EnrichmentRunSummary = {
    totalCandidates: 10,
    processed: 10,
    enriched: 10,
    failed: 0,
    batches: 1,
    stoppedEarly: null,
    errorSamples: [],
    finalCursor: null,
  };

  it('SUCCESS when the queue is exhausted cleanly', () => {
    expect(deriveEnrichmentStatus(base)).toBe('SUCCESS');
  });

  it('PARTIAL on failures with at least one write', () => {
    expect(deriveEnrichmentStatus({ ...base, failed: 2, enriched: 8 })).toBe('PARTIAL');
  });

  it('PARTIAL when stopped early by limit or rate limit', () => {
    expect(deriveEnrichmentStatus({ ...base, stoppedEarly: 'limit' })).toBe('PARTIAL');
    expect(deriveEnrichmentStatus({ ...base, stoppedEarly: 'rate-limited' })).toBe('PARTIAL');
  });

  it('PARTIAL (not FAILED) when the queue was exhausted but every item failed — PRD §4.2: FAILED marks a crash/reap, and the failed rows stay candidates for the next campaign', () => {
    expect(deriveEnrichmentStatus({ ...base, failed: 10, enriched: 0 })).toBe('PARTIAL');
  });
});

describe('resolveEnrichmentResume (PRD §4.5 steps 1, 4, 5)', () => {
  it('resumes from a PARTIAL run with a cursor', () => {
    expect(
      resolveEnrichmentResume({ id: 'run-1', status: 'PARTIAL', cursor: 'listing-42' }),
    ).toEqual({ startCursor: 'listing-42', resumedFromRunId: 'run-1' });
  });

  it('resumes from a FAILED run with a cursor (crash checkpoint survives)', () => {
    expect(
      resolveEnrichmentResume({ id: 'run-2', status: 'FAILED', cursor: 'listing-7' }),
    ).toEqual({ startCursor: 'listing-7', resumedFromRunId: 'run-2' });
  });

  it('starts fresh after SUCCESS — cursor NULL ⇔ campaign done', () => {
    expect(resolveEnrichmentResume({ id: 'run-3', status: 'SUCCESS', cursor: null })).toEqual({
      startCursor: null,
      resumedFromRunId: null,
    });
  });

  it('starts fresh from a PARTIAL run whose queue was exhausted (cursor cleared)', () => {
    expect(resolveEnrichmentResume({ id: 'run-4', status: 'PARTIAL', cursor: null })).toEqual({
      startCursor: null,
      resumedFromRunId: null,
    });
  });

  it('starts fresh when there is no previous run at all', () => {
    expect(resolveEnrichmentResume(null)).toEqual({ startCursor: null, resumedFromRunId: null });
  });

  it('does NOT resume a RUNNING row — stale-reap and the lock are PR4', () => {
    expect(
      resolveEnrichmentResume({ id: 'run-5', status: 'RUNNING', cursor: 'listing-9' }),
    ).toEqual({ startCursor: null, resumedFromRunId: null });
  });
});

describe('metricsForRunClose', () => {
  it('null (crash before the first committed batch) yields honest zeros', () => {
    const metrics = metricsForRunClose(null);
    expect(metrics.scraped).toBe(0);
    expect(metrics.providerListingsUpdated).toBe(0);
    expect(metrics.errors).toBe(0);
  });

  it('a FAILED close after a mid-run crash preserves the checkpointed counters', () => {
    // The last committed batch reported: 250 candidates, 240 written,
    // 10 item failures of which 3 messages were sampled.
    const lastProgress = {
      totalCandidates: 250,
      enriched: 240,
      failed: 10,
      errorSamples: ['Product a: HTTP 500', 'Product b: HTTP 500', 'Product c: timeout'],
    };
    const crash = 'could not serialize access';

    const counts = mapMetricsToRunCounts(metricsForRunClose(lastProgress), [
      crash,
      ...lastProgress.errorSamples,
    ]);

    // items_updated=0 after 240 committed writes is exactly the bug this guards against.
    expect(counts.itemsFound).toBe(250);
    expect(counts.itemsUpdated).toBe(240);
    // 10 per-item failures + the crash itself.
    expect(counts.errorsCount).toBe(11);
    expect(counts.errorSummary).toMatch(/^could not serialize access; Product a/);
  });
});

// ── runEnrichment ─────────────────────────────────────────────────────────────

describe('runEnrichment', () => {
  it('throws a clear error for a provider without background wiring', async () => {
    const { prisma } = makeFakePrisma([]);
    await expect(
      runEnrichment({ prisma, provider: 'vivat', batchSize: 10, logger: silentLogger }),
    ).rejects.toThrow(/does not support background enrichment/);
  });

  it('walks the whole queue in keyset batches — every row fetched exactly once, no skips', async () => {
    const rows = ['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => makeRow({ id }));
    const { prisma, updateCalls } = makeFakePrisma(rows);
    const { fetcher, fetched } = makeFetcher(() => pageFor(FULL_DETAILS));

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 2,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(summary).toMatchObject({
      totalCandidates: 5,
      processed: 5,
      enriched: 5,
      failed: 0,
      batches: 3,
      stoppedEarly: null,
    });
    // Exactly one fetch per row, in stable id order.
    expect(fetched).toEqual(rows.map((r) => r.url));
    expect(updateCalls.map((u) => u.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    // The batch update is fill-only data.
    expect(updateCalls[0]!.data).toMatchObject({ isbn: '9786171501232', publisher: 'Віват' });
  });

  it('persists only fields the row was missing (fill-only against the DB value)', async () => {
    const rows = [
      makeRow({ id: 'b1', description: 'вже є опис', isbn: '9789660000000' }),
    ];
    const { prisma, updateCalls } = makeFakePrisma(rows);
    const { fetcher } = makeFetcher(() => pageFor(FULL_DETAILS));

    await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]!.data).toEqual({
      publisher: 'Віват',
      format: 'Тверда',
      rawCategories: ['Книги', 'Проза'],
    });
    expect(rows[0]!.description).toBe('вже є опис');
    expect(rows[0]!.isbn).toBe('9789660000000');
  });

  it('one failed product fetch does not kill the batch or the run', async () => {
    const rows = ['c1', 'c2', 'c3'].map((id) => makeRow({ id }));
    const { prisma, updateCalls } = makeFakePrisma(rows);
    const { fetcher } = makeFetcher((url) => {
      if (url.endsWith('/c2')) throw new Error('HTTP 500');
      return pageFor(FULL_DETAILS);
    });

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(summary).toMatchObject({ processed: 3, enriched: 2, failed: 1 });
    expect(summary.errorSamples[0]).toMatch(/c2.*HTTP 500/);
    expect(updateCalls.map((u) => u.id)).toEqual(['c1', 'c3']);
    expect(deriveEnrichmentStatus(summary)).toBe('PARTIAL');
  });

  it('stops after --limit listings and reports stoppedEarly=limit', async () => {
    const rows = ['d1', 'd2', 'd3', 'd4', 'd5'].map((id) => makeRow({ id }));
    const { prisma } = makeFakePrisma(rows);
    const { fetcher, fetched } = makeFetcher(() => pageFor(FULL_DETAILS));

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 2,
      limit: 3,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(summary).toMatchObject({ processed: 3, enriched: 3, stoppedEarly: 'limit' });
    expect(fetched).toHaveLength(3);
  });

  it('commits what it has and stops the run on a rate-limit response', async () => {
    const rows = ['e1', 'e2', 'e3', 'e4'].map((id) => makeRow({ id }));
    const { prisma, updateCalls } = makeFakePrisma(rows);
    const { fetcher, fetched } = makeFetcher((url) => {
      if (url.endsWith('/e2')) throw new Error('HTTP 429 Too Many Requests');
      return pageFor(FULL_DETAILS);
    });

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(summary.stoppedEarly).toBe('rate-limited');
    // The shared pass stops at the 429 — e3/e4 are never fetched…
    expect(fetched).toEqual([rows[0]!.url, rows[1]!.url]);
    // …but what was gathered before the stop is committed.
    expect(updateCalls.map((u) => u.id)).toEqual(['e1']);
    expect(deriveEnrichmentStatus(summary)).toBe('PARTIAL');
  });

  it('a re-run over an enriched queue finds zero candidates and fetches nothing', async () => {
    const rows = ['f1', 'f2'].map((id) => makeRow({ id }));
    const { prisma } = makeFakePrisma(rows);
    const first = makeFetcher(() => pageFor(FULL_DETAILS));

    await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher: first.fetcher,
      config: TEST_CONFIG,
    });
    expect(first.fetched).toHaveLength(2);

    const second = makeFetcher(() => pageFor(FULL_DETAILS));
    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher: second.fetcher,
      config: TEST_CONFIG,
    });

    expect(summary).toMatchObject({ totalCandidates: 0, processed: 0, enriched: 0 });
    expect(second.fetched).toHaveLength(0);
    expect(deriveEnrichmentStatus(summary)).toBe('SUCCESS');
  });

  it('force re-walks fully-enriched rows, but fill-only still protects their values', async () => {
    const enrichedRow = makeRow({
      id: 'h1',
      isbn: '9789660000000',
      description: 'опис',
      publisher: 'КСД',
      format: 'Тверда',
      rawCategories: ['Книги'],
    });
    const rows = [enrichedRow, makeRow({ id: 'h2' })];
    const { prisma, updateCalls } = makeFakePrisma(rows);
    const { fetcher, fetched } = makeFetcher(() => pageFor(FULL_DETAILS));

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      force: true,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    // Both rows fetched under force (without it, h1 would not even be a candidate)…
    expect(summary).toMatchObject({ totalCandidates: 2, processed: 2 });
    expect(fetched).toHaveLength(2);
    // …but only the incomplete row gains data; h1 keeps every existing value.
    expect(updateCalls.map((u) => u.id)).toEqual(['h2']);
    expect(rows[0]).toMatchObject({ isbn: '9789660000000', publisher: 'КСД' });
  });

  it('countEnrichmentCandidates matches the run predicate, with and without force', async () => {
    const rows = [
      makeRow({
        id: 'i1',
        isbn: '9789660000000',
        description: 'опис',
        publisher: 'КСД',
        format: 'Тверда',
        rawCategories: ['Книги'],
      }),
      makeRow({ id: 'i2' }),
    ];
    const { prisma } = makeFakePrisma(rows);
    expect(await countEnrichmentCandidates(prisma, 'megakniga')).toBe(1);
    expect(await countEnrichmentCandidates(prisma, 'megakniga', true)).toBe(2);
  });

  it('fires onBatch after each committed batch with cumulative progress and an ETA', async () => {
    const rows = ['j1', 'j2', 'j3'].map((id) => makeRow({ id }));
    const { prisma, updateCalls } = makeFakePrisma(rows);
    const { fetcher } = makeFetcher(() => pageFor(FULL_DETAILS));
    const snapshots: Array<EnrichmentBatchProgress & { committedAtCallback: number }> = [];

    await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 2,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
      onBatch: (progress) => {
        snapshots.push({ ...progress, committedAtCallback: updateCalls.length });
      },
    });

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]).toMatchObject({
      batch: 1,
      processed: 2,
      totalCandidates: 3,
      enriched: 2,
      failed: 0,
      cursor: 'j2',
      // The batch was already committed when the callback fired.
      committedAtCallback: 2,
    });
    expect(snapshots[0]!.etaMs).not.toBeNull();
    expect(snapshots[0]!.etaMs).toBeGreaterThanOrEqual(0);
    expect(snapshots[1]).toMatchObject({
      batch: 2,
      processed: 3,
      cursor: 'j3',
      committedAtCallback: 3,
      // Queue exhausted — nothing left to extrapolate.
      etaMs: null,
    });
  });

  it('a transient batch-transaction failure is retried with backoff and the batch commits', async () => {
    const rows = ['k1', 'k2'].map((id) => makeRow({ id }));
    // Two failures — exactly the retry budget (2 retries after the first try).
    const { prisma, updateCalls } = makeFakePrisma(rows, { failTransactionTimes: 2 });
    const { fetcher, fetched } = makeFetcher(() => pageFor(FULL_DETAILS));

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
      txRetryDelayMs: 0,
    });

    expect(summary).toMatchObject({ processed: 2, enriched: 2, failed: 0 });
    // The retry re-runs only the transaction, never the HTTP phase.
    expect(fetched).toHaveLength(2);
    expect(updateCalls.map((u) => u.id)).toEqual(['k1', 'k2']);
  });

  it('a batch transaction failing beyond the retry budget propagates; onBatch never fires', async () => {
    const rows = ['k1', 'k2'].map((id) => makeRow({ id }));
    const { prisma } = makeFakePrisma(rows, { failTransactionTimes: 3 });
    const { fetcher } = makeFetcher(() => pageFor(FULL_DETAILS));
    const onBatch = vi.fn();

    await expect(
      runEnrichment({
        prisma,
        provider: 'megakniga',
        batchSize: 50,
        logger: silentLogger,
        fetcher,
        config: TEST_CONFIG,
        txRetryDelayMs: 0,
        onBatch,
      }),
    ).rejects.toThrow(/could not serialize access/);

    // No commit happened — no progress callback, no checkpoint to mislead.
    expect(onBatch).not.toHaveBeenCalled();
  });

  it('resumes from startCursor: rows at or before the cursor are never fetched', async () => {
    const rows = ['m1', 'm2', 'm3', 'm4'].map((id) => makeRow({ id }));
    const { prisma, updateCalls } = makeFakePrisma(rows);
    const { fetcher, fetched } = makeFetcher(() => pageFor(FULL_DETAILS));

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      startCursor: 'm2',
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    // The remainder of the campaign, not the whole queue.
    expect(summary).toMatchObject({ totalCandidates: 2, processed: 2, enriched: 2 });
    expect(fetched).toEqual([rows[2]!.url, rows[3]!.url]);
    expect(updateCalls.map((u) => u.id)).toEqual(['m3', 'm4']);
    // Queue exhausted → campaign done.
    expect(summary.finalCursor).toBeNull();
  });

  it('finalCursor: NULL on queue exhaustion (even with failures), the last processed id on an early stop', async () => {
    const exhaustedWithFailures = await (async () => {
      const rows = ['n1', 'n2'].map((id) => makeRow({ id }));
      const { prisma } = makeFakePrisma(rows);
      const { fetcher } = makeFetcher((url) => {
        if (url.endsWith('/n1')) throw new Error('HTTP 500');
        return pageFor(FULL_DETAILS);
      });
      return runEnrichment({
        prisma,
        provider: 'megakniga',
        batchSize: 50,
        logger: silentLogger,
        fetcher,
        config: TEST_CONFIG,
      });
    })();
    // n1 failed but the queue WAS exhausted: nothing to resume — the failed
    // row stays a candidate for the next campaign by predicate.
    expect(exhaustedWithFailures).toMatchObject({ failed: 1, finalCursor: null });

    const stoppedByLimit = await (async () => {
      const rows = ['p1', 'p2', 'p3'].map((id) => makeRow({ id }));
      const { prisma } = makeFakePrisma(rows);
      const { fetcher } = makeFetcher(() => pageFor(FULL_DETAILS));
      return runEnrichment({
        prisma,
        provider: 'megakniga',
        batchSize: 2,
        limit: 2,
        logger: silentLogger,
        fetcher,
        config: TEST_CONFIG,
      });
    })();
    expect(stoppedByLimit).toMatchObject({ stoppedEarly: 'limit', finalCursor: 'p2' });

    const stoppedByRateLimit = await (async () => {
      const rows = ['q1', 'q2', 'q3', 'q4'].map((id) => makeRow({ id }));
      const { prisma } = makeFakePrisma(rows);
      const { fetcher } = makeFetcher((url) => {
        if (url.endsWith('/q3')) throw new Error('HTTP 429 Too Many Requests');
        return pageFor(FULL_DETAILS);
      });
      return runEnrichment({
        prisma,
        provider: 'megakniga',
        batchSize: 2,
        logger: silentLogger,
        fetcher,
        config: TEST_CONFIG,
      });
    })();
    // The 429 hit q3 inside batch 2, so q4 was never fetched by the shared
    // pass. The cursor must NOT advance past unfetched rows: it stays at the
    // end of the last fully-walked batch (q2) — the resumed run re-walks
    // q3/q4 while the already-enriched q1/q2 drop out by predicate.
    expect(stoppedByRateLimit).toMatchObject({
      stoppedEarly: 'rate-limited',
      finalCursor: 'q2',
    });
  });

  it('a rate limit in the FIRST batch of a fresh campaign keeps finalCursor NULL — resume = start over, enriched rows drop out by predicate', async () => {
    const rows = ['t1', 't2', 't3'].map((id) => makeRow({ id }));
    const { prisma, updateCalls } = makeFakePrisma(rows);
    const { fetcher } = makeFetcher((url) => {
      if (url.endsWith('/t2')) throw new Error('HTTP 429 Too Many Requests');
      return pageFor(FULL_DETAILS);
    });

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(summary).toMatchObject({ stoppedEarly: 'rate-limited', finalCursor: null });
    // t1's enrichment was still committed before the stop.
    expect(updateCalls.map((u) => u.id)).toEqual(['t1']);
  });

  it('with runId, every batch transaction checkpoints cursor + cumulative counters onto the run', async () => {
    const rows = ['r1', 'r2', 'r3'].map((id) => makeRow({ id }));
    const { prisma, checkpointCalls } = makeFakePrisma(rows);
    const { fetcher } = makeFetcher((url) => {
      if (url.endsWith('/r3')) throw new Error('HTTP 500');
      return pageFor(FULL_DETAILS);
    });

    await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 2,
      runId: 'run-xyz',
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(checkpointCalls).toHaveLength(2);
    expect(checkpointCalls.every((c) => c.runId === 'run-xyz')).toBe(true);
    expect(checkpointCalls[0]!.data).toMatchObject({
      itemsFound: 3,
      itemsUpdated: 2,
      itemsProcessed: 2,
      errorsCount: 0,
      errorSummary: null,
      cursor: 'r2',
    });
    expect(checkpointCalls[1]!.data).toMatchObject({
      itemsUpdated: 2,
      itemsProcessed: 3,
      errorsCount: 1,
      cursor: 'r3',
    });
    expect(checkpointCalls[1]!.data['errorSummary']).toMatch(/r3.*HTTP 500/);
  });

  it('without runId no scrapeRun checkpoint is attempted (engine stays run-agnostic)', async () => {
    const rows = [makeRow({ id: 's1' })];
    const { prisma, checkpointCalls } = makeFakePrisma(rows);
    const { fetcher } = makeFetcher(() => pageFor(FULL_DETAILS));

    await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(checkpointCalls).toHaveLength(0);
  });

  it('a page with no usable data counts as processed but writes nothing', async () => {
    const rows = [makeRow({ id: 'g1' })];
    const { prisma, updateCalls } = makeFakePrisma(rows);
    const { fetcher } = makeFetcher(() =>
      pageFor({ description: null, metadata: null }),
    );

    const summary = await runEnrichment({
      prisma,
      provider: 'megakniga',
      batchSize: 50,
      logger: silentLogger,
      fetcher,
      config: TEST_CONFIG,
    });

    expect(summary).toMatchObject({ processed: 1, enriched: 0, failed: 0 });
    expect(updateCalls).toHaveLength(0);
    expect(deriveEnrichmentStatus(summary)).toBe('SUCCESS');
  });
});
