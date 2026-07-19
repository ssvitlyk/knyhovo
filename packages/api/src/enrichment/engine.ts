import {
  FetchHtmlFetcher,
  enrichProductDetails,
  fetchWithRetry,
  isRateLimited,
} from '@knyhovo/scrapers';
import type { HtmlFetcher } from '@knyhovo/scrapers';
import type { Availability, ProviderName, RawProviderListing } from '@knyhovo/shared';
import type { PrismaClient } from '@prisma/client';
import { Prisma, ScrapeRunStatus } from '@prisma/client';
import { createMetrics } from '../pipeline/metrics.js';
import { mapProviderName } from '../pipeline/persist-listing.js';
import type { Logger, ScrapeMetrics } from '../pipeline/types.js';
import { ENRICHMENT_PROVIDERS, type ProviderEnrichmentConfig } from './providers.js';

/**
 * Background enrichment engine (megakniga-resumable-enrichment PRD §4.4, PR1).
 *
 * Walks already-persisted `provider_listings` in stable-`id` keyset batches,
 * fetches each product page through the shared `enrichProductDetails` pass
 * (throttle, sanitization, rate-limit stop — all reused, not reimplemented),
 * and commits every batch in ONE transaction before moving on. A kill at any
 * point loses at most the current batch; everything committed stays.
 *
 * PR1 keeps the keyset cursor in memory only — cross-process resume works
 * through the candidate predicate itself (enriched rows drop out of the
 * queue). The persisted cursor + resume-from-run arrive in PR3.
 */

/** Cap on stored error samples — enough for an errorSummary, no memory growth. */
const ERROR_SAMPLE_CAP = 20;

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
): Promise<number> {
  return prisma.providerListing.count({
    where: buildCandidateWhere(mapProviderName(provider), null, force),
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
  logger: Logger;
  /** Injectable transport for tests; production defaults to FetchHtmlFetcher + retry. */
  fetcher?: HtmlFetcher;
  /** Override the provider's default inter-request delay (SCRAPE_ENRICH_DELAY_MS). */
  delayMs?: number;
  /** Injectable wiring for tests (fake extractor, zero delays); production resolves from ENRICHMENT_PROVIDERS. */
  config?: ProviderEnrichmentConfig;
  /**
   * Fires after each batch has COMMITTED (genres:backfill idiom) — the safe
   * place to persist live progress (PRD §7 PR2: per-batch scrape_runs counter
   * checkpoint). Errors thrown here are the callback's own problem; keep it
   * best-effort so a failed progress write never kills the run.
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
  /** Last processed provider_listings.id — the in-process keyset position. */
  cursor: string;
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
  stoppedEarly: 'rate-limited' | 'limit' | null;
  /** First ERROR_SAMPLE_CAP error messages, for the run's errorSummary. */
  errorSamples: string[];
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
 * Terminal status for an enrichment run (PRD §4.2 semantics for
 * DESCRIPTION_ENRICHMENT): SUCCESS = queue exhausted cleanly; FAILED = total
 * failure (errors and not a single listing written); PARTIAL = everything
 * else (some failures, or stopped early by --limit / rate limit).
 */
export function deriveEnrichmentStatus(summary: EnrichmentRunSummary): ScrapeRunStatus {
  if (summary.failed > 0 && summary.enriched === 0) {
    return ScrapeRunStatus.FAILED;
  }
  if (summary.failed > 0 || summary.stoppedEarly !== null) {
    return ScrapeRunStatus.PARTIAL;
  }
  return ScrapeRunStatus.SUCCESS;
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
  const startedAtMs = Date.now();

  const totalCandidates = await countEnrichmentCandidates(opts.prisma, opts.provider, force);
  opts.logger.info(
    `enrichment ${opts.provider}: starting — ${totalCandidates} candidates ` +
      `(batchSize=${opts.batchSize}, delayMs=${delayMs}` +
      `${opts.limit !== undefined ? `, limit=${opts.limit}` : ''}${force ? ', force' : ''})`,
  );

  const summary: EnrichmentRunSummary = {
    totalCandidates,
    processed: 0,
    enriched: 0,
    failed: 0,
    batches: 0,
    stoppedEarly: null,
    errorSamples: [],
  };
  let cursor: string | null = null;

  for (;;) {
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
    if (rows.length === 0) break;
    summary.batches++;

    // The HTTP phase happens entirely outside any transaction (PRD §4.4).
    // skipListing is defeated on purpose: the candidate query is the single
    // source of "needs enrichment" — a second in-memory filter with different
    // criteria would silently skip rows the query selected.
    const listings = rows.map((row) => toRawListing(opts.provider, row));
    const batchErrors: string[] = [];
    await enrichProductDetails(listings, fetcher, config.extract, {
      timeoutMs: config.timeoutMs,
      delayMs,
      errors: batchErrors,
      logger: { info: (message: string) => opts.logger.info(message) },
      skipListing: () => false,
    });

    const updates: Prisma.PrismaPromise<unknown>[] = [];
    rows.forEach((row, i) => {
      const patch = buildFillOnlyPatch(row, listings[i]!);
      if (patch !== null) {
        updates.push(
          opts.prisma.providerListing.update({ where: { id: row.id }, data: patch }),
        );
      }
    });
    if (updates.length > 0) {
      // One transaction per batch: a crash leaves the batch either fully
      // committed or absent — never torn (PRD §4.4).
      await opts.prisma.$transaction(updates);
    }

    summary.processed += rows.length;
    summary.enriched += updates.length;
    summary.failed += batchErrors.length;
    for (const message of batchErrors) {
      if (summary.errorSamples.length >= ERROR_SAMPLE_CAP) break;
      summary.errorSamples.push(message);
    }
    cursor = rows[rows.length - 1]!.id;

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

    if (batchErrors.some((message) => isRateLimited(message))) {
      // enrichProductDetails already stopped its pass; stop the run too and
      // keep everything committed. The next invocation picks up the rest.
      summary.stoppedEarly = 'rate-limited';
      break;
    }
  }

  opts.logger.info(
    `enrichment ${opts.provider}: done — processed=${summary.processed}/${totalCandidates} ` +
      `enriched=${summary.enriched} failed=${summary.failed} batches=${summary.batches}` +
      `${summary.stoppedEarly !== null ? ` (stopped early: ${summary.stoppedEarly})` : ''}`,
  );
  return summary;
}
