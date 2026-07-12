import { CollectionType, GenreSource, type Prisma, type PrismaClient } from '@prisma/client';
import { unmapProviderName } from '../pipeline/persist-listing.js';
import {
  buildEngineContext,
  type EngineContext,
  type GenreMappingResult,
} from './mapping-engine.js';

/**
 * Genre assignment layer (genres-taxonomy PRD §4.4, §4.5).
 *
 * The mapping engine (`mapping-engine.ts`) computes WHAT genre a book's
 * signals point at; this module decides WHETHER that result may overwrite the
 * book's current assignment, and applies the decision. Runs as a separate
 * pass — never inside the scrape transaction (`persistListing` only stores
 * `raw_categories`) — so mapping edits stay re-runnable at any time.
 *
 * §4.4 overwrite rules, verbatim:
 *
 * | current `genre_source`            | engine action                        |
 * |-----------------------------------|--------------------------------------|
 * | MANUAL                            | never touched (§4.5 absolute lock)   |
 * | PROVIDER_MAPPING                  | overwritten when the result differs; |
 * |                                   | reset to null on vanished signal     |
 * |                                   | only with `clearStale`               |
 * | SEED / legacy null-source with    | overwritten only at confidence ≥ 70  |
 * |   non-null genre_id               |                                      |
 * | unassigned (genre_id = null)      | assigned on any result               |
 */

/** SEED / legacy assignments are overwritten only at or above this confidence (§4.4). */
export const SEED_OVERWRITE_MIN_CONFIDENCE = 70;

/** The book's current assignment state, as read from `canonical_books`. */
export interface CurrentGenreAssignment {
  readonly genreId: string | null;
  readonly genreSource: GenreSource | null;
  readonly genreConfidence: number | null;
}

export type AssignmentAction = 'manual-locked' | 'assign' | 'keep' | 'clear-stale';

/** The exact column values a decision writes (all-null for `clear-stale`, §8.2 parity). */
export interface GenreAssignmentWrite {
  readonly genreId: string | null;
  readonly genreSource: GenreSource | null;
  readonly genreConfidence: number | null;
  readonly genreUpdatedAt: Date | null;
}

/**
 * A single book's assignment decision. `write === null` means "no DB write".
 * `reason` is explainability output (PRD §4.6): dry-run/backfill logs only,
 * never persisted, never serialized into any API DTO.
 */
export interface AssignmentDecision {
  readonly action: AssignmentAction;
  readonly write: GenreAssignmentWrite | null;
  readonly reason: string;
}

export interface AssignmentOptions {
  /**
   * Allow PROVIDER_MAPPING → null when the signal has vanished (§4.4).
   * Default false: an existing assignment is never overwritten with empty —
   * mirrors the graceful-enrichment rule of `persist-listing.ts`.
   */
  readonly clearStale?: boolean;
  /** Injected clock — the decision itself stays deterministic and testable. */
  readonly now: Date;
}

function describeResult(result: GenreMappingResult): string {
  return `${result.genreId} (confidence ${result.confidence}) — ${result.explanation}`;
}

/**
 * Decide whether (and with what values) an engine result may overwrite the
 * book's current assignment. Pure — no IO, no clock beyond `options.now`.
 */
export function decideGenreAssignment(
  current: CurrentGenreAssignment,
  result: GenreMappingResult,
  options: AssignmentOptions,
): AssignmentDecision {
  // §4.5: MANUAL is an absolute lock — checked before anything else, no
  // exceptions (not for clearStale, not for confidence, not for agreement).
  if (current.genreSource === GenreSource.MANUAL) {
    return {
      action: 'manual-locked',
      write: null,
      reason: 'MANUAL assignment is an absolute lock (PRD §4.5) — engine never touches it',
    };
  }

  if (result.genreId === null || result.confidence === null) {
    if (
      current.genreId !== null &&
      current.genreSource === GenreSource.PROVIDER_MAPPING &&
      options.clearStale === true
    ) {
      return {
        action: 'clear-stale',
        write: { genreId: null, genreSource: null, genreConfidence: null, genreUpdatedAt: null },
        reason: 'signal vanished and clearStale is set — resetting PROVIDER_MAPPING assignment',
      };
    }
    return {
      action: 'keep',
      write: null,
      reason:
        current.genreId === null
          ? 'no mapping result and book is unassigned — nothing to do'
          : 'no mapping result — keeping existing assignment (never overwrite known with empty)',
    };
  }

  const write: GenreAssignmentWrite = {
    genreId: result.genreId,
    genreSource: GenreSource.PROVIDER_MAPPING,
    genreConfidence: result.confidence,
    genreUpdatedAt: options.now,
  };

  if (current.genreId === null) {
    return {
      action: 'assign',
      write,
      reason: `unassigned book — assigning ${describeResult(result)}`,
    };
  }

  if (current.genreSource === GenreSource.PROVIDER_MAPPING) {
    if (current.genreId === result.genreId && current.genreConfidence === result.confidence) {
      return {
        action: 'keep',
        write: null,
        reason: 'result matches current PROVIDER_MAPPING assignment — idempotent no-op',
      };
    }
    return {
      action: 'assign',
      write,
      reason: `re-mapping is authoritative for its own records (§4.4) — assigning ${describeResult(result)}`,
    };
  }

  // SEED or legacy null-source with a non-null genre_id.
  if (result.confidence >= SEED_OVERWRITE_MIN_CONFIDENCE) {
    return {
      action: 'assign',
      write,
      reason: `seed/legacy assignment overwritten at confidence ≥ ${SEED_OVERWRITE_MIN_CONFIDENCE} — assigning ${describeResult(result)}`,
    };
  }
  return {
    action: 'keep',
    write: null,
    reason: `seed/legacy assignment kept — confidence ${result.confidence} < ${SEED_OVERWRITE_MIN_CONFIDENCE}`,
  };
}

/**
 * Apply a decision to `canonical_books`. Returns true when a row was written.
 * Accepts a transaction client so callers can batch updates (PRD §8.1).
 */
export async function applyGenreAssignment(
  prisma: PrismaClient | Prisma.TransactionClient,
  canonicalBookId: string,
  decision: AssignmentDecision,
): Promise<boolean> {
  if (decision.write === null) return false;
  await prisma.canonicalBook.update({
    where: { id: canonicalBookId },
    data: {
      genreId: decision.write.genreId,
      genreSource: decision.write.genreSource,
      genreConfidence: decision.write.genreConfidence,
      genreUpdatedAt: decision.write.genreUpdatedAt,
    },
  });
  return true;
}

/**
 * Load the engine's lookup indexes from the database: all `genre_mappings`
 * rows plus all TAXONOMIC collection rows (active AND inactive — a mapping
 * may legitimately point at a deactivated genre, which stays hidden by the
 * hub threshold). Loaded once per pass (PRD §8.1 step 1), then reused for
 * every book.
 */
export async function loadEngineContext(
  prisma: PrismaClient | Prisma.TransactionClient,
): Promise<EngineContext> {
  const [mappingRows, genreRows] = await Promise.all([
    prisma.genreMapping.findMany({
      select: { provider: true, sourceCategory: true, genreId: true, confidence: true },
    }),
    prisma.collection.findMany({
      where: { type: CollectionType.TAXONOMIC },
      select: { id: true, slug: true },
    }),
  ]);

  return buildEngineContext({
    mappingRules: mappingRows.map((row) => ({
      provider: unmapProviderName(row.provider),
      sourceCategory: row.sourceCategory,
      genreId: row.genreId,
      confidence: row.confidence,
    })),
    genres: genreRows,
  });
}
