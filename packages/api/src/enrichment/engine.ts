import { FetchHtmlFetcher, enrichProductDetails, fetchWithRetry } from '@knyhovo/scrapers';
import type { HtmlFetcher } from '@knyhovo/scrapers';
import type { Availability, ProviderName, RawProviderListing } from '@knyhovo/shared';
import type { PrismaClient, ScrapeRunTrigger } from '@prisma/client';
import { Prisma, ScrapeRunKind, ScrapeRunStatus } from '@prisma/client';
import { createMetrics } from '../pipeline/metrics.js';
import { mapProviderName } from '../pipeline/persist-listing.js';
import type { Logger, ScrapeMetrics } from '../pipeline/types.js';
import { reapStaleRuns, type StaleReapConfig } from '../refresh/concurrency-guard.js';
import {
  checkpointScrapeRunCounters,
  findLatestScrapeRun,
  findRunningScrapeRun,
  startScrapeRun,
  summarizeScrapeErrors,
} from '../refresh/scrape-run.repository.js';
import { ENRICHMENT_PROVIDERS, type ProviderEnrichmentConfig } from './providers.js';

/**
 * Background enrichment engine (megakniga-resumable-enrichment PRD §4.4).
 *
 * Walks already-persisted `provider_listings` in stable-`id` keyset batches,
 * fetches each product page through the shared `enrichProductDetails` pass
 * (throttle, sanitization, rate-limit stop — all reused, not reimplemented),
 * and commits every batch in ONE transaction before moving on. A kill at any
 * point loses at most the current batch; everything committed stays.
 *
 * Since PR3 the keyset cursor is persisted: when a `runId` is supplied, every
 * batch transaction also checkpoints the run row (cursor + live counters), so
 * a restarted process resumes exactly where the last committed batch ended
 * (`startCursor`), never re-fetching what was already walked.
 */

/** Cap on stored error samples — enough for an errorSummary, no memory growth. */
const ERROR_SAMPLE_CAP = 20;

/** Ceiling for one batch transaction (PRD §4.4) — updates only, HTTP is outside. */
const BATCH_TX_TIMEOUT_MS = 60_000;

/** Retries for a failed batch transaction before the run gives up (PRD §4.4: retry ×2). */
const BATCH_TX_RETRIES = 2;

/** Base backoff between batch-transaction retries; attempt N waits base × 2^N. */
const BATCH_TX_RETRY_DELAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Candidate predicate (PRD §4.3): a listing needs enrichment while any
 * enrichment-sourced field is still empty. Keyset (`id > cursor`, `ORDER BY
 * id`) instead of OFFSET so batch updates can never skip or duplicate rows.
 * `force` drops the missing-field predicate and walks every listing of the
 * provider (re-enrichment after an extractor gained new fields) — the
 * fill-only write rules still protect existing values.
 */
export function buildCandidateWhere(
  provider: ReturnType<typeof mapProviderName>,
  cursor: string | null,
  force = false,
): Prisma.ProviderListingWhereInput {
  return {
    provider,
    ...(cursor !== null ? { id: { gt: cursor } } : {}),
    ...(force
      ? {}
      : {
          OR: [
            { isbn: null },
            { description: null },
            { publisher: null },
            { format: null },
            { rawCategories: { isEmpty: true } },
          ],
        }),
  };
}

/**
 * Count the current enrichment queue for a provider — what a run would
 * process. Also serves the CLI's `--dry-run` report.
 */
export async function countEnrichmentCandidates(
  prisma: PrismaClient,
  provider: ProviderName,
  force = false,
  cursor: string | null = null,
): Promise<number> {
  return prisma.providerListing.count({
    where: buildCandidateWhere(mapProviderName(provider), cursor, force),
  });
}

const CANDIDATE_SELECT = {
  id: true,
  url: true,
  title: true,
  author: true,
  isbn: true,
  priceAmount: true,
  priceCurrency: true,
  availability: true,
  coverUrl: true,
  description: true,
  publisher: true,
  language: true,
  format: true,
  series: true,
  publicationYear: true,
  rawCategories: true,
} as const satisfies Prisma.ProviderListingSelect;

export type CandidateRow = Prisma.ProviderListingGetPayload<{ select: typeof CANDIDATE_SELECT }>;

const AVAILABILITY_FROM_DB: Record<CandidateRow['availability'], Availability> = {
  IN_STOCK: 'in-stock',
  OUT_OF_STOCK: 'out-of-stock',
  UNKNOWN: 'unknown',
};

/**
 * Rebuild the `RawProviderListing` shape `enrichProductDetails` operates on
 * from a persisted row, so the shared pass (merge semantics, sanitization)
 * applies to DB-backed listings exactly as it does to freshly scraped ones.
 */
export function toRawListing(provider: ProviderName, row: CandidateRow): RawProviderListing {
  return {
    provider,
    title: row.title,
    author: row.author,
    isbn: row.isbn,
    price: { amount: row.priceAmount, currency: row.priceCurrency },
    url: row.url,
    availability: AVAILABILITY_FROM_DB[row.availability],
    coverUrl: row.coverUrl,
    description: row.description,
    publisher: row.publisher,
    language: row.language,
    format: row.format,
    series: row.series,
    publicationYear: row.publicationYear,
    rawCategories: row.rawCategories,
  };
}

function isEmptyText(value: string | null | undefined): boolean {
  return value == null || value === '';
}

function isUsableText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value !== '';
}

/**
 * Diff a listing after the enrichment pass against its persisted row and
 * build a fill-only update patch (PRD §4.1): a field is written ONLY when the
 * DB value is still empty and the pass produced a non-empty one. Enrichment
 * never overwrites known values, which is what makes re-processing any row
 * idempotent. Returns null when nothing usable was gained.
 */
export function buildFillOnlyPatch(
  row: CandidateRow,
  enriched: RawProviderListing,
): Prisma.ProviderListingUpdateInput | null {
  const patch: Prisma.ProviderListingUpdateInput = {};
  let changed = false;

  const textFields = ['isbn', 'description', 'publisher', 'language', 'format', 'series'] as const;
  for (const field of textFields) {
    if (isEmptyText(row[field]) && isUsableText(enriched[field])) {
      patch[field] = enriched[field];
      changed = true;
    }
  }
  if (row.publicationYear == null && enriched.publicationYear != null) {
    patch.publicationYear = enriched.publicationYear;
    changed = true;
  }
  if (isEmptyText(row.coverUrl) && isUsableText(enriched.coverUrl)) {
    patch.coverUrl = enriched.coverUrl;
    changed = true;
  }
  if (
    row.rawCategories.length === 0 &&
    enriched.rawCategories != null &&
    enriched.rawCategories.length > 0
  ) {
    patch.rawCategories = [...enriched.rawCategories];
    changed = true;
  }

  return changed ? patch : null;
}

export interface RunEnrichmentOptions {
  prisma: PrismaClient;
  provider: ProviderName;
  /** Listings per batch (one transaction per batch). */
  batchSize: number;
  /** Stop after processing this many listings (smoke/canary runs). */
  limit?: number;
  /** Walk every listing of the provider, ignoring the missing-field predicate (PRD §4.3). */
  force?: boolean;
  /**
   * Resume point (PRD §4.5): the persisted cursor of the previous run —
   * candidates start strictly after this id. Null/absent = full campaign
   * from the beginning of the id space.
   */
  startCursor?: string | null;
  /**
   * scrape_runs row to checkpoint (PRD §4.4): when set, every batch
   * transaction atomically writes cursor + live counters onto this run, so a
   * kill between batches can never desynchronize data and checkpoint.
   */
  runId?: string;
  /** Backoff base between batch-transaction retries; tests pass 0. */
  txRetryDelayMs?: number;
  logger: Logger;
  /** Injectable transport for tests; production defaults to FetchHtmlFetcher + retry. */
  fetcher?: HtmlFetcher;
  /** Override the provider's default inter-request delay (SCRAPE_ENRICH_DELAY_MS). */
  delayMs?: number;
  /**
   * Cooperative cancellation for graceful shutdown (PRD §4.7). When it fires,
   * the engine finishes the in-flight fetch, commits the batch prefix it has
   * gathered, checkpoints the cursor at the last fully-processed listing, and
   * stops with `stoppedEarly='aborted'` (a resumable PARTIAL). The CLI wires it
   * to SIGINT/SIGTERM; tests inject it directly — no real signals needed.
   */
  signal?: AbortSignal;
  /**
   * Circuit-breaker threshold (PRD §4): stop the campaign after this many
   * CONSECUTIVE infrastructure failures (timeout/DNS/connection/5xx) inside a
   * batch — a mass site outage must not fetch-fail all ~27k listings. On a trip
   * the gathered prefix is committed, the cursor does NOT advance past the
   * unprocessed tail, and the run stops resumable with
   * `stoppedEarly='circuit-breaker'`. Undefined disables the breaker.
   */
  circuitBreakerThreshold?: number;
  /** Injectable wiring for tests (fake extractor, zero delays); production resolves from ENRICHMENT_PROVIDERS. */
  config?: ProviderEnrichmentConfig;
  /**
   * Fires after each batch has COMMITTED (genres:backfill idiom). Since PR3
   * the scrape_runs checkpoint itself is written INSIDE the batch transaction
   * (see `runId`), so this is purely observational — the CLI uses it to keep
   * the last committed progress at hand for a truthful FAILED close.
   */
  onBatch?: (progress: EnrichmentBatchProgress) => void | Promise<void>;
}

/** Snapshot handed to `onBatch` after every committed batch. Counters are cumulative. */
export interface EnrichmentBatchProgress {
  batch: number;
  processed: number;
  totalCandidates: number;
  enriched: number;
  failed: number;
  /**
   * The persisted checkpoint after this batch — the safe resume point. On a
   * rate-limited batch it stays at the previous batch's end (null when that
   * was the campaign start), never past an unfetched row.
   */
  cursor: string | null;
  elapsedMs: number;
  /** Linear extrapolation to queue end; null when not computable. */
  etaMs: number | null;
  /** Cumulative capped error samples (see ERROR_SAMPLE_CAP). */
  errorSamples: readonly string[];
}

/** `2h05m` / `4m12s` / `38s` — compact duration for progress log lines. */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export interface EnrichmentRunSummary {
  /** Candidate count at run start — an estimate for progress, not a coverage promise (PRD §4.3). */
  totalCandidates: number;
  /** Listings handed to the enrichment pass. */
  processed: number;
  /** Listings that actually gained data and were written. */
  enriched: number;
  /** Failed product fetches/extracts (run keeps going; PRD §4.4). */
  failed: number;
  batches: number;
  stoppedEarly: 'rate-limited' | 'limit' | 'aborted' | 'circuit-breaker' | null;
  /** First ERROR_SAMPLE_CAP error messages, for the run's errorSummary. */
  errorSamples: string[];
  /**
   * The checkpoint to close the run with (PRD §4.2 invariant: cursor NOT NULL
   * ⇔ there is something left to continue). Null when the candidate queue was
   * exhausted — the campaign is done; the last processed id when the run
   * stopped early (--limit / rate limit) — the next run resumes from here.
   */
  finalCursor: string | null;
}

/**
 * The counter fields shared by {@link EnrichmentRunSummary} (a finished run)
 * and {@link EnrichmentBatchProgress} (the last committed batch) — everything
 * needed to close a scrape_runs row truthfully.
 */
export interface EnrichmentCounters {
  readonly totalCandidates: number;
  readonly enriched: number;
  readonly failed: number;
  readonly errorSamples: readonly string[];
}

/**
 * Map enrichment counters onto the ScrapeMetrics shape `finishScrapeRun`
 * persists (PRD §4.2 mapping for DESCRIPTION_ENRICHMENT): itemsFound =
 * candidate total, itemsUpdated = listings written. `metrics.errors` carries
 * only the failures beyond the stored samples, so mapMetricsToRunCounts
 * (errors + scrapeErrors.length) lands on exactly `failed` when the samples
 * are passed as scrapeErrors.
 *
 * Accepts null for a run that crashed before its first committed batch —
 * zeros are then the truth, not a reset. On a mid-run crash the CLI passes
 * the last onBatch progress here, so closing as FAILED PRESERVES the
 * checkpointed counters instead of wiping them back to zero.
 */
export function metricsForRunClose(state: EnrichmentCounters | null): ScrapeMetrics {
  const metrics = createMetrics();
  if (state === null) return metrics;
  metrics.scraped = state.totalCandidates;
  metrics.providerListingsUpdated = state.enriched;
  metrics.errors = state.failed - state.errorSamples.length;
  return metrics;
}

/**
 * Terminal status for an enrichment run that RAN TO A STOP (PRD §4.2 status
 * table for DESCRIPTION_ENRICHMENT): SUCCESS = queue exhausted with no
 * errors; PARTIAL = stopped early (--limit / rate limit, resumable via
 * cursor) OR queue exhausted with some failures (cursor NULL — the failed
 * rows stay candidates for the next campaign). FAILED is never derived here:
 * it marks a crash (the CLI's catch path) or a stale reap (PR4), not a run
 * that completed its loop.
 */
export function deriveEnrichmentStatus(summary: EnrichmentRunSummary): ScrapeRunStatus {
  if (summary.failed > 0 || summary.stoppedEarly !== null) {
    return ScrapeRunStatus.PARTIAL;
  }
  return ScrapeRunStatus.SUCCESS;
}

/** The slice of a scrape_runs row the resume decision needs (PRD §4.5). */
export interface ResumeCandidateRun {
  id: string;
  status: ScrapeRunStatus;
  cursor: string | null;
}

/**
 * Resume decision on CLI start — PRD §4.5 steps 1, 4, 5 (PR3 scope): given
 * the LATEST enrichment run of the provider, continue from its persisted
 * cursor when it stopped mid-campaign (PARTIAL/FAILED with cursor set),
 * otherwise start a fresh campaign from the beginning of the queue.
 *
 * A RUNNING row is NOT resumed: since PR4 `openEnrichmentRun` reaps stale
 * RUNNING rows (kill -9 leftovers → FAILED, cursor intact) BEFORE this
 * decision and refuses to start against a fresh one, so a RUNNING row seen
 * here belongs to a live process — the already-running path, never a resume.
 */
export function resolveEnrichmentResume(lastRun: ResumeCandidateRun | null): {
  startCursor: string | null;
  resumedFromRunId: string | null;
} {
  if (
    lastRun !== null &&
    lastRun.cursor !== null &&
    (lastRun.status === ScrapeRunStatus.PARTIAL || lastRun.status === ScrapeRunStatus.FAILED)
  ) {
    return { startCursor: lastRun.cursor, resumedFromRunId: lastRun.id };
  }
  return { startCursor: null, resumedFromRunId: null };
}

/** The only kind the enrichment CLI's stale reap sweeps (PRD §4.6) — never GUARDED_KINDS. */
export const ENRICHMENT_REAP_KINDS: readonly ScrapeRunKind[] = [
  ScrapeRunKind.DESCRIPTION_ENRICHMENT,
];

/**
 * Thrown by `openEnrichmentRun` when an enrichment run for the provider is
 * already RUNNING with a live heartbeat (PRD §4.5 step 2 / §4.6). `runId` and
 * `lastHeartbeatAt` are best-effort diagnostics: null only when the
 * conflicting row could not be re-read after a P2002 race.
 */
export class EnrichmentAlreadyRunningError extends Error {
  constructor(
    public readonly provider: ProviderName,
    public readonly runId: string | null,
    public readonly lastHeartbeatAt: Date | null,
  ) {
    super(
      `enrichment already running (provider=${provider}` +
        `${runId !== null ? `, run=${runId}` : ''}` +
        `${lastHeartbeatAt !== null ? `, heartbeat=${lastHeartbeatAt.toISOString()}` : ''})`,
    );
    this.name = 'EnrichmentAlreadyRunningError';
  }
}

export interface OpenEnrichmentRunOptions {
  prisma: PrismaClient;
  provider: ProviderName;
  triggeredBy: ScrapeRunTrigger;
  /** Base run metadata; `resumedFromRunId` is merged in when resuming (PRD §4.5 step 4). */
  metadata: Record<string, Prisma.InputJsonValue>;
  /** Staleness thresholds — the same env-driven values the refresh guard uses. */
  staleReap: StaleReapConfig;
  logger: Logger;
  /** Injectable clock for deterministic staleness tests. */
  now?: () => Date;
}

export interface OpenedEnrichmentRun {
  run: { id: string; startedAt: Date };
  resume: { startCursor: string | null; resumedFromRunId: string | null };
  /** Stale RUNNING enrichment rows closed to FAILED before this run started. */
  reaped: number;
  /**
   * The latest prior enrichment run (post-reap) this start inspected — the
   * predecessor whose campaign metadata this run continues (PRD §3). Null when
   * the provider has never run enrichment before. Carries only what
   * `buildCampaignMetadata` needs.
   */
  predecessor: { id: string; itemsProcessed: number; metadata: Prisma.JsonValue } | null;
}

/**
 * Open an enrichment scrape_runs row with the full PR4 start sequence
 * (PRD §4.5 steps 2–5, §4.6):
 *
 * 1. Reap stale RUNNING enrichment rows — DESCRIPTION_ENRICHMENT only, so
 *    FULL_CATALOG/WISHLIST rows are untouched. Reuses the conditional-UPDATE
 *    mutex of `reapStaleRuns`: a heartbeat landing mid-reap cancels that
 *    row's reap (its process is alive), and the reaped row keeps its cursor.
 * 2. A RUNNING row that survived the reap (fresh heartbeat) → throw
 *    `EnrichmentAlreadyRunningError` with its id and heartbeat.
 * 3. Resume decision over the latest row (`resolveEnrichmentResume`).
 * 4. Plain `startScrapeRun` INSERT. The partial unique index
 *    `scrape_runs_one_active_enrichment` makes this the real, race-free
 *    lock: a concurrent starter that passed the checks in step 2 loses here
 *    with a unique violation (P2002) — reported as the same clear error,
 *    with the winner's row re-read for diagnostics. The loser has created
 *    and modified nothing.
 */
export async function openEnrichmentRun(
  opts: OpenEnrichmentRunOptions,
): Promise<OpenedEnrichmentRun> {
  const providerEnum = mapProviderName(opts.provider);
  const kind = ScrapeRunKind.DESCRIPTION_ENRICHMENT;
  const guardDeps = opts.now !== undefined ? { now: opts.now } : undefined;

  const reap = await reapStaleRuns(opts.prisma, opts.staleReap, ENRICHMENT_REAP_KINDS, guardDeps);
  if (reap.reaped > 0) {
    opts.logger.info(
      `enrichment ${opts.provider}: reaped ${reap.reaped} stale RUNNING enrichment run(s) ` +
        `(heartbeat silent) — cursor preserved for resume`,
    );
  }

  const running = await findRunningScrapeRun(opts.prisma, { provider: providerEnum, kind });
  if (running !== null) {
    throw new EnrichmentAlreadyRunningError(opts.provider, running.id, running.lastHeartbeatAt);
  }

  const lastRun = await findLatestScrapeRun(opts.prisma, { provider: providerEnum, kind });
  const resume = resolveEnrichmentResume(lastRun);
  const predecessor =
    lastRun !== null
      ? { id: lastRun.id, itemsProcessed: lastRun.itemsProcessed, metadata: lastRun.metadata }
      : null;

  try {
    const run = await startScrapeRun(opts.prisma, {
      provider: providerEnum,
      kind,
      triggeredBy: opts.triggeredBy,
      ...(resume.startCursor !== null ? { cursor: resume.startCursor } : {}),
      metadata: {
        ...opts.metadata,
        ...(resume.resumedFromRunId !== null
          ? { resumedFromRunId: resume.resumedFromRunId }
          : {}),
      },
    });
    return { run, resume, reaped: reap.reaped, predecessor };
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const winner = await findRunningScrapeRun(opts.prisma, { provider: providerEnum, kind });
      throw new EnrichmentAlreadyRunningError(
        opts.provider,
        winner?.id ?? null,
        winner?.lastHeartbeatAt ?? null,
      );
    }
    throw err;
  }
}

/** Wrap a fetcher so every request retries transient failures, mirroring the provider's own scrape transport. */
function withRetry(fetcher: HtmlFetcher, config: ProviderEnrichmentConfig): HtmlFetcher {
  return {
    async fetch(url: string, timeoutMs: number): Promise<string> {
      const { html } = await fetchWithRetry(fetcher, url, timeoutMs, {
        maxRetries: config.maxRetries,
        baseDelayMs: config.retryBaseDelayMs,
        maxDelayMs: config.retryMaxDelayMs,
      });
      return html;
    },
  };
}

export async function runEnrichment(opts: RunEnrichmentOptions): Promise<EnrichmentRunSummary> {
  const config = opts.config ?? ENRICHMENT_PROVIDERS.get(opts.provider);
  if (config === undefined) {
    throw new Error(
      `provider '${opts.provider}' does not support background enrichment ` +
        `(supported: ${[...ENRICHMENT_PROVIDERS.keys()].join(', ')})`,
    );
  }
  const providerEnum = mapProviderName(opts.provider);
  const fetcher = withRetry(opts.fetcher ?? new FetchHtmlFetcher(), config);
  const delayMs = opts.delayMs ?? config.delayMs;
  const force = opts.force === true;
  const startCursor = opts.startCursor ?? null;
  const txRetryDelayMs = opts.txRetryDelayMs ?? BATCH_TX_RETRY_DELAY_MS;
  const circuitBreakerThreshold = opts.circuitBreakerThreshold;
  const startedAtMs = Date.now();

  // On resume the total is the REMAINDER of the campaign (candidates past the
  // inherited cursor) — that is what this run will actually walk (PRD §4.3:
  // itemsFound is a progress estimate, not a coverage promise).
  const totalCandidates = await countEnrichmentCandidates(
    opts.prisma,
    opts.provider,
    force,
    startCursor,
  );
  opts.logger.info(
    `enrichment ${opts.provider}: starting — ${totalCandidates} candidates ` +
      `(batchSize=${opts.batchSize}, delayMs=${delayMs}` +
      `${opts.limit !== undefined ? `, limit=${opts.limit}` : ''}${force ? ', force' : ''}` +
      `${startCursor !== null ? `, resume from cursor=${startCursor}` : ''})`,
  );

  const summary: EnrichmentRunSummary = {
    totalCandidates,
    processed: 0,
    enriched: 0,
    failed: 0,
    batches: 0,
    stoppedEarly: null,
    errorSamples: [],
    finalCursor: startCursor,
  };
  let cursor: string | null = startCursor;
  let queueExhausted = false;

  for (;;) {
    // Graceful shutdown between batches (PRD §4.7): the signal fired while the
    // previous batch committed — stop before starting a new one. A signal that
    // fires MID-batch is handled by the pass itself (stopReason 'aborted').
    if (opts.signal?.aborted === true) {
      summary.stoppedEarly = 'aborted';
      break;
    }
    const remaining = opts.limit !== undefined ? opts.limit - summary.processed : undefined;
    if (remaining !== undefined && remaining <= 0) {
      summary.stoppedEarly = 'limit';
      break;
    }
    const take = remaining !== undefined ? Math.min(opts.batchSize, remaining) : opts.batchSize;

    const rows: CandidateRow[] = await opts.prisma.providerListing.findMany({
      where: buildCandidateWhere(providerEnum, cursor, force),
      orderBy: { id: 'asc' },
      take,
      select: CANDIDATE_SELECT,
    });
    if (rows.length === 0) {
      queueExhausted = true;
      break;
    }
    summary.batches++;

    // The HTTP phase happens entirely outside any transaction (PRD §4.4).
    // skipListing is defeated on purpose: the candidate query is the single
    // source of "needs enrichment" — a second in-memory filter with different
    // criteria would silently skip rows the query selected.
    const listings = rows.map((row) => toRawListing(opts.provider, row));
    const batchErrors: string[] = [];
    const { processedCount, stopReason } = await enrichProductDetails(
      listings,
      fetcher,
      config.extract,
      {
        timeoutMs: config.timeoutMs,
        delayMs,
        errors: batchErrors,
        logger: { info: (message: string) => opts.logger.info(message) },
        skipListing: () => false,
        ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
        ...(circuitBreakerThreshold !== undefined
          ? { maxConsecutiveFailures: circuitBreakerThreshold }
          : {}),
      },
    );

    // The pass reports WHY it stopped and HOW FAR it got (processedCount).
    //  - rate-limit / circuit-breaker leave the batch tail unfetched: advancing
    //    the cursor past those rows would make the resumed campaign skip them
    //    (breaking §4.3), so the cursor stays at the last SAFE point — the
    //    previous batch's end. Everything gathered is still committed; on resume
    //    the enriched rows drop out of the candidate predicate, so only the
    //    genuinely unprocessed remainder is re-walked.
    //  - abort commits the fully-processed prefix and advances the cursor to its
    //    last row (a partial-batch resume point).
    //  - complete advances to the last row of the batch (processedCount === rows.length).
    const rateLimited = stopReason === 'rate-limited';
    const circuitTripped = stopReason === 'circuit-breaker';
    const aborted = stopReason === 'aborted';
    const holdCursor = rateLimited || circuitTripped;

    // Only the fully-processed prefix produced writable listings; the unfetched
    // tail (rate-limit / breaker / abort) was never mutated, so slicing keeps
    // the commit tight and correct.
    const patches: Array<{ id: string; data: Prisma.ProviderListingUpdateInput }> = [];
    rows.slice(0, processedCount).forEach((row, i) => {
      const patch = buildFillOnlyPatch(row, listings[i]!);
      if (patch !== null) {
        patches.push({ id: row.id, data: patch });
      }
    });

    // Cumulative counters as of THIS batch — computed before the commit so
    // the in-transaction checkpoint writes the post-batch truth (PRD §4.4).
    const batchCursor = holdCursor
      ? cursor
      : processedCount > 0
        ? rows[processedCount - 1]!.id
        : cursor;
    const nextProcessed = summary.processed + processedCount;
    const nextEnriched = summary.enriched + patches.length;
    const nextFailed = summary.failed + batchErrors.length;
    const nextSamples = [...summary.errorSamples];
    for (const message of batchErrors) {
      if (nextSamples.length >= ERROR_SAMPLE_CAP) break;
      nextSamples.push(message);
    }

    // One transaction per batch: listing updates and the run checkpoint
    // (cursor + counters) land atomically, so a crash leaves the batch either
    // fully committed or absent — never torn, and the persisted cursor is
    // always a safe resume point (PRD §4.4). Transient failures are retried
    // with backoff; after that the error propagates and the CLI closes the
    // run as FAILED with the previous checkpoint intact.
    const commitBatch = (): Promise<void> =>
      opts.prisma.$transaction(
        async (tx) => {
          for (const { id, data } of patches) {
            await tx.providerListing.update({ where: { id }, data });
          }
          if (opts.runId !== undefined) {
            await checkpointScrapeRunCounters(tx, opts.runId, {
              itemsFound: totalCandidates,
              itemsUpdated: nextEnriched,
              errorsCount: nextFailed,
              errorSummary: summarizeScrapeErrors(nextSamples),
              itemsProcessed: nextProcessed,
              // Null only when the very first batch was rate-limited — the
              // run row then keeps its start cursor (inherited or none).
              ...(batchCursor !== null ? { cursor: batchCursor } : {}),
            });
          }
        },
        { timeout: BATCH_TX_TIMEOUT_MS },
      );
    for (let attempt = 0; ; attempt++) {
      try {
        await commitBatch();
        break;
      } catch (err: unknown) {
        if (attempt >= BATCH_TX_RETRIES) throw err;
        const backoffMs = txRetryDelayMs * 2 ** attempt;
        opts.logger.error(
          `enrichment ${opts.provider}: batch transaction failed ` +
            `(attempt ${attempt + 1}/${BATCH_TX_RETRIES + 1}), retrying in ${backoffMs}ms — ` +
            `${err instanceof Error ? err.message : String(err)}`,
        );
        await sleep(backoffMs);
      }
    }

    summary.processed = nextProcessed;
    summary.enriched = nextEnriched;
    summary.failed = nextFailed;
    summary.errorSamples = nextSamples;
    cursor = batchCursor;
    summary.finalCursor = batchCursor;

    const elapsedMs = Date.now() - startedAtMs;
    const remainingCount = Math.max(0, totalCandidates - summary.processed);
    const etaMs =
      summary.processed > 0 && remainingCount > 0
        ? Math.round((elapsedMs / summary.processed) * remainingCount)
        : null;
    opts.logger.info(
      `enrichment ${opts.provider}: batch=${summary.batches} ` +
        `processed=${summary.processed}/${totalCandidates} ok=${summary.enriched} ` +
        `failed=${summary.failed} cursor=${cursor} elapsed=${formatDuration(elapsedMs)} ` +
        `eta=${etaMs === null ? '—' : `~${formatDuration(etaMs)}`}`,
    );

    if (opts.onBatch !== undefined) {
      await opts.onBatch({
        batch: summary.batches,
        processed: summary.processed,
        totalCandidates,
        enriched: summary.enriched,
        failed: summary.failed,
        cursor,
        elapsedMs,
        etaMs,
        errorSamples: summary.errorSamples,
      });
    }

    // The pass stopped this batch early; stop the run too and keep everything
    // committed. The next invocation picks up the rest — for rate-limit and the
    // circuit breaker the cursor deliberately did NOT advance past this batch;
    // for an abort it advanced to the last fully-processed row (see the note
    // above the commit).
    if (rateLimited) {
      summary.stoppedEarly = 'rate-limited';
      break;
    }
    if (circuitTripped) {
      summary.stoppedEarly = 'circuit-breaker';
      break;
    }
    if (aborted) {
      summary.stoppedEarly = 'aborted';
      break;
    }
  }

  if (queueExhausted) {
    // "cursor NULL ⇔ done" (PRD §4.2): the campaign covered its snapshot of
    // the queue — there is nothing to resume, even if some items failed
    // (failed rows stay candidates for the NEXT campaign by predicate).
    summary.finalCursor = null;
  }

  opts.logger.info(
    `enrichment ${opts.provider}: done — processed=${summary.processed}/${totalCandidates} ` +
      `enriched=${summary.enriched} failed=${summary.failed} batches=${summary.batches}` +
      `${summary.stoppedEarly !== null ? ` (stopped early: ${summary.stoppedEarly})` : ''}` +
      `${summary.finalCursor !== null ? ` cursor=${summary.finalCursor}` : ' cursor=NULL (done)'}`,
  );
  return summary;
}
