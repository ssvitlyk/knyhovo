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
import { mapProviderName } from '../pipeline/persist-listing.js';
import type { Logger } from '../pipeline/types.js';
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
 */
export function buildCandidateWhere(
  provider: ReturnType<typeof mapProviderName>,
  cursor: string | null,
): Prisma.ProviderListingWhereInput {
  return {
    provider,
    ...(cursor !== null ? { id: { gt: cursor } } : {}),
    OR: [
      { isbn: null },
      { description: null },
      { publisher: null },
      { format: null },
      { rawCategories: { isEmpty: true } },
    ],
  };
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
  logger: Logger;
  /** Injectable transport for tests; production defaults to FetchHtmlFetcher + retry. */
  fetcher?: HtmlFetcher;
  /** Override the provider's default inter-request delay (SCRAPE_ENRICH_DELAY_MS). */
  delayMs?: number;
  /** Injectable wiring for tests (fake extractor, zero delays); production resolves from ENRICHMENT_PROVIDERS. */
  config?: ProviderEnrichmentConfig;
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
  const startedAtMs = Date.now();

  const totalCandidates = await opts.prisma.providerListing.count({
    where: buildCandidateWhere(providerEnum, null),
  });
  opts.logger.info(
    `enrichment ${opts.provider}: starting — ${totalCandidates} candidates ` +
      `(batchSize=${opts.batchSize}, delayMs=${delayMs}` +
      `${opts.limit !== undefined ? `, limit=${opts.limit}` : ''})`,
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
      where: buildCandidateWhere(providerEnum, cursor),
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

    const elapsedSec = Math.round((Date.now() - startedAtMs) / 1000);
    opts.logger.info(
      `enrichment ${opts.provider}: batch=${summary.batches} ` +
        `processed=${summary.processed}/${totalCandidates} ok=${summary.enriched} ` +
        `failed=${summary.failed} cursor=${cursor} elapsed=${elapsedSec}s`,
    );

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
