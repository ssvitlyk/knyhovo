/**
 * Argument parsing for the `genres:backfill` CLI (genres-taxonomy PRD §8.1).
 *
 * Pure function — no IO, no `process` access — so it is unit-testable exactly
 * like `scrape-env.ts`. The CLI entrypoint (`run-genre-backfill.ts`) owns all
 * side effects; this module only turns `argv` tokens into a validated options
 * object, throwing a descriptive error on anything it does not recognise
 * (an ops tool must fail loudly on a typo, not silently run a full pass with
 * a misspelled `--dry-run`).
 */

/** Default keyset page size (PRD §8.1: `--batch-size=500`). */
export const DEFAULT_BATCH_SIZE = 500;

export interface GenreBackfillArgs {
  /** Compute + report, zero writes (PRD §8.1 `--dry-run`). */
  readonly dryRun: boolean;
  /** Books per keyset page (PRD §8.1 `--batch-size`, default 500). */
  readonly batchSize: number;
  /** Resume from this canonicalBook id, exclusive (`id > cursor`). */
  readonly cursor: string | null;
  /** Only books with `genre_id IS NULL` — fast first pass. */
  readonly onlyUnassigned: boolean;
  /** Allow PROVIDER_MAPPING → null on vanished signal (§4.4). */
  readonly clearStale: boolean;
  /**
   * Unmapped + ambiguous reports (§8.3, §8.4). `null` = reports off;
   * `{ path: null }` = stdout table (the default target);
   * `{ path }` = write to that file.
   */
  readonly report: { readonly path: string | null } | null;
}

export const GENRE_BACKFILL_USAGE = `usage: pnpm --filter @knyhovo/api genres:backfill [flags]

  --dry-run              compute + report, zero writes
  --batch-size=500       books per keyset page (default ${DEFAULT_BATCH_SIZE})
  --cursor=<bookId>      resume from a canonicalBook id (keyset, exclusive)
  --only-unassigned      only books with genre_id IS NULL (fast first pass)
  --clear-stale          allow PROVIDER_MAPPING -> null on vanished signal
  --report[=path]        unmapped + ambiguous reports (default: stdout table)`;

/**
 * Parse `argv` (already stripped of the node/script prefix, i.e.
 * `process.argv.slice(2)`) into {@link GenreBackfillArgs}.
 *
 * Throws `Error` with a human-readable message on an unknown flag or an
 * invalid value. Repeated value flags follow last-one-wins.
 */
export function parseGenreBackfillArgs(argv: readonly string[]): GenreBackfillArgs {
  let dryRun = false;
  let batchSize = DEFAULT_BATCH_SIZE;
  let cursor: string | null = null;
  let onlyUnassigned = false;
  let clearStale = false;
  let report: { path: string | null } | null = null;

  for (const token of argv) {
    if (token === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (token === '--only-unassigned') {
      onlyUnassigned = true;
      continue;
    }
    if (token === '--clear-stale') {
      clearStale = true;
      continue;
    }
    if (token === '--report') {
      report = { path: null };
      continue;
    }
    if (token.startsWith('--report=')) {
      const path = token.slice('--report='.length);
      if (path === '') {
        throw new Error('genres:backfill: --report= requires a non-empty path (or use bare --report for stdout)');
      }
      report = { path };
      continue;
    }
    if (token.startsWith('--batch-size=')) {
      const raw = token.slice('--batch-size='.length);
      if (!/^[1-9]\d*$/.test(raw)) {
        throw new Error(`genres:backfill: --batch-size must be a positive integer, got "${raw}"`);
      }
      batchSize = Number(raw);
      continue;
    }
    if (token.startsWith('--cursor=')) {
      const raw = token.slice('--cursor='.length);
      if (raw === '') {
        throw new Error('genres:backfill: --cursor= requires a non-empty canonicalBook id');
      }
      cursor = raw;
      continue;
    }
    throw new Error(`genres:backfill: unknown argument "${token}"\n${GENRE_BACKFILL_USAGE}`);
  }

  return { dryRun, batchSize, cursor, onlyUnassigned, clearStale, report };
}
