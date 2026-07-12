import type { PrismaClient } from '@prisma/client';
import { applyGenreAssignment, decideGenreAssignment, loadEngineContext } from './assignment.js';
import type { AssignmentDecision } from './assignment.js';
import { mapBookGenre } from './mapping-engine.js';
import type { ListingSignal } from './mapping-engine.js';
import { unmapProviderName } from '../pipeline/persist-listing.js';
import { classify, createEmptyBackfillCounters } from './backfill.js';
import type { BackfillBookRow, BackfillCounters } from './backfill.js';

/**
 * Post-scrape genre assignment (genres-taxonomy PRD §10 G5).
 *
 * Assigns genres only for the canonicalBookIds a single scrape run actually
 * touched — never a full-table pass. This module adds NO mapping or
 * overwrite logic of its own: it reuses the exact same primitives as
 * `genres:backfill` (`loadEngineContext`, the mapping engine,
 * `decideGenreAssignment`, `applyGenreAssignment`, and the `classify`
 * counter rules), scoped by an explicit id list instead of keyset
 * pagination. `clearStale` is never enabled here (PRD §11: automatic
 * clearStale stays CLI/backfill-only) — a vanished signal never resets an
 * existing PROVIDER_MAPPING assignment through this path.
 */

/** Default chunk size for `WHERE id IN (...)` lookups (mirrors G4's default batch size). */
const DEFAULT_BATCH_SIZE = 500;

export interface PostScrapeAssignmentOptions {
  /** Injected clock — sampled once per pass, mirroring `genres:backfill`. */
  readonly now?: () => Date;
  /** Id-list chunk size. Default 500. */
  readonly batchSize?: number;
}

export interface PostScrapeAssignmentResult {
  readonly counters: Readonly<BackfillCounters>;
  /** Unique books this pass considered (post-dedupe). */
  readonly affectedBookCount: number;
  readonly batches: number;
  readonly durationMs: number;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Run one post-scrape assignment pass over an explicit set of canonical
 * book ids. Safe to call with an empty list (no-op, no DB access at all —
 * not even `loadEngineContext`).
 */
export async function runPostScrapeGenreAssignment(
  prisma: PrismaClient,
  canonicalBookIds: readonly string[],
  options: PostScrapeAssignmentOptions = {},
): Promise<PostScrapeAssignmentResult> {
  const startedAt = Date.now();
  const now = (options.now ?? ((): Date => new Date()))();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

  const uniqueIds = Array.from(new Set(canonicalBookIds));
  const counters = createEmptyBackfillCounters();

  if (uniqueIds.length === 0) {
    return { counters, affectedBookCount: 0, batches: 0, durationMs: Date.now() - startedAt };
  }

  // Loaded exactly once for the whole pass — never per book, never per batch.
  const ctx = await loadEngineContext(prisma);

  const chunks = chunk(uniqueIds, batchSize);
  for (const ids of chunks) {
    const books: readonly BackfillBookRow[] = await prisma.canonicalBook.findMany({
      where: { id: { in: [...ids] } },
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

    const writes: { bookId: string; decision: AssignmentDecision }[] = [];
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
        { now },
      );

      counters.processed += 1;
      classify(counters, decision, book, hasSignal, result.genreId);

      if (decision.write !== null) writes.push({ bookId: book.id, decision });
    }

    if (writes.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const write of writes) {
          await applyGenreAssignment(tx, write.bookId, write.decision);
        }
      });
    }
  }

  return {
    counters,
    affectedBookCount: uniqueIds.length,
    batches: chunks.length,
    durationMs: Date.now() - startedAt,
  };
}
