import type { GenreSource, PrismaClient, Provider } from '@prisma/client';
import {
  applyGenreAssignment,
  decideGenreAssignment,
  loadEngineContext,
  type AssignmentDecision,
} from './assignment.js';
import { mapBookGenre, type ListingSignal } from './mapping-engine.js';
import { unmapProviderName } from '../pipeline/persist-listing.js';
import { AmbiguousReportAccumulator, UnmappedReportAccumulator } from './report.js';

/**
 * Genre backfill pass (genres-taxonomy PRD §8.1): the assignment
 * orchestration that `genres:backfill` runs over every canonical book.
 *
 * Pure orchestration on top of G3 — this module adds NO mapping or overwrite
 * logic of its own: the engine (`mapping-engine.ts`) computes the result, the
 * assignment layer (`assignment.ts`) decides whether it may be written
 * (including the §4.5 MANUAL absolute lock and the graceful "never overwrite
 * known with empty" default), and this module only walks the books, batches
 * the writes and accumulates observability.
 *
 * PRD §8.1 flow, verbatim:
 *   1. load the mapping index + aliases once (`loadEngineContext`);
 *   2. keyset-paginate `canonical_books` by `id > cursor` with listing
 *      signals;
 *   3. engine → diff against `(genreId, genreSource, genreConfidence)`,
 *      MANUAL skipped;
 *   4. one `$transaction` per batch containing only the changed updates;
 *   5. a progress line per batch — the logged cursor IS the resume mechanism;
 *      the pass is fully idempotent, so a complete restart is always safe;
 *   6. final unmapped (§8.3) and ambiguous (§8.4) reports.
 *
 * Rollback (PRD §8.2) — engine-made assignments only, MANUAL/SEED untouched:
 *
 *   UPDATE canonical_books
 *   SET genre_id = NULL, genre_source = NULL,
 *       genre_confidence = NULL, genre_updated_at = NULL
 *   WHERE genre_source = 'provider-mapping';
 */

/**
 * Per-batch transaction timeout. A batch is up to `batchSize` single-row
 * UPDATEs by primary key; the Prisma interactive-transaction default (5s) is
 * too tight for a 500-row batch over a WAN link to staging.
 */
export const BATCH_TRANSACTION_TIMEOUT_MS = 60_000;

/** Running totals across the whole pass. Disjoint per book; they sum to `processed`. */
export interface BackfillCounters {
  /** Books examined. */
  processed: number;
  /** Unassigned book got a genre (`assign` on `genre_id IS NULL`). */
  assigned: number;
  /** Existing assignment overwritten (`assign` on a non-null `genre_id`). */
  changed: number;
  /** PROVIDER_MAPPING reset to all-null (`clear-stale`, only with the flag). */
  cleared: number;
  /** Kept as-is: idempotent match, sub-threshold seed overwrite, or graceful keep. */
  unchanged: number;
  /** MANUAL absolute lock (§4.5). */
  manualSkipped: number;
  /** No listing carried any raw category at all. */
  noSignal: number;
  /** Signal present but nothing mapped — the unmapped-report feed (§8.3). */
  unmappedBooks: number;
}

/** Coverage metrics for the final summary (PRD §13). */
export interface BackfillCoverage {
  /** Books with ≥1 listing carrying a non-empty `raw_categories`. */
  booksWithSignal: number;
  /** Books whose (post-decision) `genre_id` is non-null. */
  booksWithGenre: number;
  /** Of the books with signal, how many end the pass with a genre. */
  booksWithSignalAndGenre: number;
}

/** One batch's progress snapshot, emitted after the batch is committed. */
export interface BackfillBatchProgress {
  /** 1-based batch number. */
  readonly batch: number;
  /** Books in this batch. */
  readonly batchBooks: number;
  /** Rows actually written in this batch (0 in dry-run). */
  readonly batchWrites: number;
  /**
   * Last processed canonicalBook id — pass it back as `--cursor` to resume.
   * The batch this snapshot describes is already committed (or skipped, in
   * dry-run), so resuming from here never re-processes uncommitted work.
   */
  readonly cursor: string;
  /** Running totals up to and including this batch. */
  readonly counters: Readonly<BackfillCounters>;
}

export interface GenreBackfillOptions {
  /** Compute + report, zero writes. Default false. */
  readonly dryRun?: boolean;
  /** Keyset page size. Default 500 (PRD §8.1). */
  readonly batchSize?: number;
  /** Resume after this canonicalBook id (exclusive). Default: from the start. */
  readonly cursor?: string | null;
  /** Only books with `genre_id IS NULL`. Default false. */
  readonly onlyUnassigned?: boolean;
  /** Allow PROVIDER_MAPPING → null on vanished signal (§4.4). Default false. */
  readonly clearStale?: boolean;
  /** Accumulate unmapped/ambiguous reports (§8.3, §8.4). Default false. */
  readonly collectReports?: boolean;
  /**
   * Injected clock for `genre_updated_at` — sampled once per pass so a run is
   * deterministic under test and uniformly timestamped in production.
   */
  readonly now?: () => Date;
  /** Called after each batch commits — the CLI's progress line (§8.1 step 5). */
  readonly onBatch?: (progress: BackfillBatchProgress) => void;
}

export interface GenreBackfillResult {
  readonly counters: Readonly<BackfillCounters>;
  readonly coverage: Readonly<BackfillCoverage>;
  readonly batches: number;
  /** Cursor of the last processed book; null when no book matched. */
  readonly lastCursor: string | null;
  readonly dryRun: boolean;
  /** Populated only when `collectReports` was set. */
  readonly unmappedReport: UnmappedReportAccumulator | null;
  /** Populated only when `collectReports` was set. */
  readonly ambiguousReport: AmbiguousReportAccumulator | null;
}

/** The book row shape the pass selects (PRD §8.1 step 2). Reused by the G5 post-scrape hook. */
export interface BackfillBookRow {
  readonly id: string;
  readonly title: string;
  readonly isbn: string | null;
  readonly genreId: string | null;
  readonly genreSource: GenreSource | null;
  readonly genreConfidence: number | null;
  readonly listings: readonly {
    readonly provider: Provider;
    readonly rawCategories: readonly string[];
    readonly url: string;
  }[];
}

interface PendingWrite {
  readonly bookId: string;
  readonly decision: AssignmentDecision;
}

/** Fresh zero-valued counters. Shared with the G5 post-scrape hook. */
export function createEmptyBackfillCounters(): BackfillCounters {
  return {
    processed: 0,
    assigned: 0,
    changed: 0,
    cleared: 0,
    unchanged: 0,
    manualSkipped: 0,
    noSignal: 0,
    unmappedBooks: 0,
  };
}

/**
 * Bucket one book's decision into the running counters. Exported so the G5
 * post-scrape hook reports the exact same counter semantics without
 * reimplementing the classification rules.
 */
export function classify(
  counters: BackfillCounters,
  decision: AssignmentDecision,
  book: BackfillBookRow,
  hasSignal: boolean,
  resultGenreId: string | null,
): void {
  switch (decision.action) {
    case 'manual-locked':
      counters.manualSkipped += 1;
      return;
    case 'clear-stale':
      counters.cleared += 1;
      return;
    case 'assign':
      if (book.genreId === null) counters.assigned += 1;
      else counters.changed += 1;
      return;
    case 'keep':
      if (resultGenreId !== null) {
        counters.unchanged += 1;
      } else if (!hasSignal) {
        counters.noSignal += 1;
      } else {
        counters.unmappedBooks += 1;
      }
  }
}

/**
 * Run one backfill pass. Fully idempotent: a second run over the same data
 * produces zero writes (the assignment layer returns `keep` for exact
 * matches), so restarting after an interruption — with or without `--cursor` —
 * is always safe.
 */
export async function runGenreBackfill(
  prisma: PrismaClient,
  options: GenreBackfillOptions = {},
): Promise<GenreBackfillResult> {
  const dryRun = options.dryRun ?? false;
  const batchSize = options.batchSize ?? 500;
  const onlyUnassigned = options.onlyUnassigned ?? false;
  const clearStale = options.clearStale ?? false;
  const now = (options.now ?? ((): Date => new Date()))();

  // PRD §8.1 step 1: mapping index + aliases are loaded exactly once.
  const ctx = await loadEngineContext(prisma);

  const unmappedReport = options.collectReports === true ? new UnmappedReportAccumulator() : null;
  const ambiguousReport = options.collectReports === true ? new AmbiguousReportAccumulator() : null;

  const counters: BackfillCounters = createEmptyBackfillCounters();
  const coverage: BackfillCoverage = {
    booksWithSignal: 0,
    booksWithGenre: 0,
    booksWithSignalAndGenre: 0,
  };

  let cursor: string | null = options.cursor ?? null;
  let lastCursor: string | null = null;
  let batches = 0;

  for (;;) {
    // PRD §8.1 step 2: keyset pagination by `id > cursor` — stable under
    // concurrent inserts and under our own writes (an --only-unassigned run
    // assigns genres only to rows already behind the cursor).
    const books: readonly BackfillBookRow[] = await prisma.canonicalBook.findMany({
      where: {
        ...(cursor !== null ? { id: { gt: cursor } } : {}),
        ...(onlyUnassigned ? { genreId: null } : {}),
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: {
        id: true,
        title: true,
        isbn: true,
        genreId: true,
        genreSource: true,
        genreConfidence: true,
        listings: { select: { provider: true, rawCategories: true, url: true } },
      },
    });
    if (books.length === 0) break;

    const writes: PendingWrite[] = [];
    for (const book of books) {
      const signals: ListingSignal[] = book.listings.map((listing) => ({
        provider: unmapProviderName(listing.provider),
        rawCategories: listing.rawCategories,
        url: listing.url,
      }));
      const hasSignal = signals.some((signal) => signal.rawCategories.length > 0);

      const result = mapBookGenre(signals, ctx);
      const decision = decideGenreAssignment(
        { genreId: book.genreId, genreSource: book.genreSource, genreConfidence: book.genreConfidence },
        result,
        { clearStale, now },
      );

      counters.processed += 1;
      classify(counters, decision, book, hasSignal, result.genreId);

      const genreAfter = decision.write !== null ? decision.write.genreId : book.genreId;
      if (hasSignal) coverage.booksWithSignal += 1;
      if (genreAfter !== null) coverage.booksWithGenre += 1;
      if (hasSignal && genreAfter !== null) coverage.booksWithSignalAndGenre += 1;

      unmappedReport?.add(result.unmapped);
      ambiguousReport?.add({ title: book.title, isbn: book.isbn }, result);

      if (decision.write !== null) writes.push({ bookId: book.id, decision });
    }

    // PRD §8.1 step 4: one transaction per batch, changed rows only. A crash
    // leaves whole batches either committed or absent — never a torn batch —
    // which is exactly what makes the logged cursor a safe resume point.
    if (!dryRun && writes.length > 0) {
      await prisma.$transaction(
        async (tx) => {
          for (const write of writes) {
            await applyGenreAssignment(tx, write.bookId, write.decision);
          }
        },
        { timeout: BATCH_TRANSACTION_TIMEOUT_MS },
      );
    }

    batches += 1;
    const lastBook = books[books.length - 1]!;
    cursor = lastBook.id;
    lastCursor = lastBook.id;
    options.onBatch?.({
      batch: batches,
      batchBooks: books.length,
      batchWrites: dryRun ? 0 : writes.length,
      cursor: lastBook.id,
      counters: { ...counters },
    });

    if (books.length < batchSize) break;
  }

  return {
    counters,
    coverage,
    batches,
    lastCursor,
    dryRun,
    unmappedReport,
    ambiguousReport,
  };
}

/** Format the §8.1 progress line for one batch (used by the CLI, unit-tested). */
export function formatBatchProgress(progress: BackfillBatchProgress): string {
  const { counters } = progress;
  return (
    `batch ${progress.batch}: books=${progress.batchBooks} writes=${progress.batchWrites} | ` +
    `assigned=${counters.assigned} changed=${counters.changed} cleared=${counters.cleared} ` +
    `unchanged=${counters.unchanged} manual-skipped=${counters.manualSkipped} ` +
    `no-signal=${counters.noSignal} unmapped=${counters.unmappedBooks} | ` +
    `cursor=${progress.cursor}`
  );
}

/** Format the final summary (PRD §13 metrics), one line for the CLI log. */
export function formatBackfillSummary(result: GenreBackfillResult): string {
  const { counters, coverage } = result;
  const mappingCoverage =
    coverage.booksWithSignal === 0
      ? 'n/a'
      : `${((coverage.booksWithSignalAndGenre / coverage.booksWithSignal) * 100).toFixed(1)}%`;
  return (
    `processed=${counters.processed} assigned=${counters.assigned} changed=${counters.changed} ` +
    `cleared=${counters.cleared} unchanged=${counters.unchanged} ` +
    `manual-skipped=${counters.manualSkipped} no-signal=${counters.noSignal} ` +
    `unmapped-books=${counters.unmappedBooks} | ` +
    `with-signal=${coverage.booksWithSignal} with-genre=${coverage.booksWithGenre} ` +
    `mapping-coverage=${mappingCoverage} | ` +
    `batches=${result.batches} lastCursor=${result.lastCursor ?? '—'} dryRun=${result.dryRun}`
  );
}
