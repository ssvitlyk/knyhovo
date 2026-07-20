import type { Prisma, ScrapeRunStatus } from '@prisma/client';
import { ScrapeRunStatus as ScrapeRunStatusEnum } from '@prisma/client';
import type { EnrichmentRunSummary } from './engine.js';

/**
 * Process lifecycle for the `scrape:enrich` CLI (megakniga-resumable-enrichment
 * PRD §4.7, §3) — all pure, side-effect-free, so the exit-code contract, the
 * restart-loop guard, and the campaign-metadata chain are unit-tested without a
 * process, a DB, or real OS signals. The CLI (`run-enrichment.ts`) owns every
 * side effect and just calls these to decide.
 */

// ---------------------------------------------------------------------------
// Exit-code contract (PRD §4.7)
// ---------------------------------------------------------------------------

/**
 * Every terminal outcome of an enrichment invocation, tagged by its cause so
 * the exit code is derived by ONE pure function instead of scattered
 * `process.exitCode = …` assignments.
 */
export type EnrichmentExitReason =
  /** Candidate queue exhausted with no errors. */
  | 'success'
  /** Queue exhausted but some items failed — cursor NULL, failures re-queued next campaign. */
  | 'partial-exhausted'
  /** `--limit` reached (smoke/canary) — resumable. */
  | 'stopped-limit'
  /** Controlled 429/503 rate-limit stop — resumable; NOT restarted (would hammer the site). */
  | 'stopped-rate-limit'
  /** Circuit breaker tripped on a mass infrastructure outage — resumable temporary stop. */
  | 'stopped-circuit-breaker'
  /** SIGINT — operator Ctrl-C: a deliberate manual stop, no auto-restart wanted. */
  | 'signal-sigint'
  /** SIGTERM — platform stop (Railway redeploy/restart/host migration): resume after restart. */
  | 'signal-sigterm'
  /** Batch-transaction retries exhausted / other transient crash — cursor intact, restart may help. */
  | 'crash-resumable'
  /** Another enrichment run holds the exclusive lock — this process created nothing. */
  | 'already-running'
  /** Bad args/env, unknown provider, provider without background mode, missing DATABASE_URL. */
  | 'config-error'
  /** Restart-loop guard tripped: consecutive prior runs made zero progress. */
  | 'no-progress-guard';

/** The three exit codes the contract emits (sysexits: 75 = EX_TEMPFAIL). */
export type EnrichmentExitCode = 0 | 1 | 75;

/**
 * THE exit-code contract (PRD §4.7). Single source of truth mapping a terminal
 * reason to a process exit code under Railway's `On Failure` restart policy:
 *
 *   0  — nothing to auto-restart: clean finish, an operator-chosen stop
 *        (SIGINT), a controlled rate-limit/`--limit` stop, or the no-progress
 *        guard (deliberately 0 so it breaks the loop even under a misconfigured
 *        `Always` policy).
 *   75 — resumable temporary stop worth an automatic restart with a fresh
 *        process: SIGTERM, the circuit breaker, or a transient DB crash. The
 *        cursor is intact, so the restarted run resumes from the checkpoint.
 *   1  — a restart would not help: another run already holds the lock, or the
 *        invocation is misconfigured.
 */
export function exitCodeForReason(reason: EnrichmentExitReason): EnrichmentExitCode {
  switch (reason) {
    case 'success':
    case 'partial-exhausted':
    case 'stopped-limit':
    case 'stopped-rate-limit':
    case 'signal-sigint':
    case 'no-progress-guard':
      return 0;
    case 'signal-sigterm':
    case 'stopped-circuit-breaker':
    case 'crash-resumable':
      return 75;
    case 'already-running':
    case 'config-error':
      return 1;
  }
}

/**
 * Classify a completed engine run (one that returned an
 * {@link EnrichmentRunSummary}) into an {@link EnrichmentExitReason}. Both
 * signals abort the engine identically (`stoppedEarly='aborted'`); only the
 * SOURCE — captured by the CLI's signal handler and passed as `abortedBy` —
 * decides SIGINT (manual, exit 0) vs SIGTERM (platform, exit 75). A completed
 * run is never a crash: the crash path is the CLI's `catch`, classified
 * separately as `crash-resumable`.
 */
export function reasonForSummary(
  summary: Pick<EnrichmentRunSummary, 'stoppedEarly' | 'failed'>,
  abortedBy: 'SIGINT' | 'SIGTERM' | null,
): EnrichmentExitReason {
  switch (summary.stoppedEarly) {
    case 'aborted':
      // Default to SIGINT if the source is somehow unknown — the safer,
      // no-auto-restart interpretation of a graceful stop.
      return abortedBy === 'SIGTERM' ? 'signal-sigterm' : 'signal-sigint';
    case 'circuit-breaker':
      return 'stopped-circuit-breaker';
    case 'rate-limited':
      return 'stopped-rate-limit';
    case 'limit':
      return 'stopped-limit';
    case null:
      return summary.failed > 0 ? 'partial-exhausted' : 'success';
  }
}

// ---------------------------------------------------------------------------
// No-progress restart-loop guard (PRD §4.7 layer 2, §3)
// ---------------------------------------------------------------------------

/**
 * Count the leading (most-recent-first) enrichment runs that made NO progress —
 * FAILED or PARTIAL with `items_processed = 0` (the cursor never advanced). The
 * streak stops at the first run that broke it: a SUCCESS, a still-RUNNING row,
 * or any run that processed at least one item. A run with progress therefore
 * resets the counter (PRD §4.7 / test-matrix row 15).
 *
 * `runs` MUST be ordered newest-first (what `findRecentScrapeRuns` returns).
 */
export function countLeadingNoProgressRuns(
  runs: readonly { status: ScrapeRunStatus; itemsProcessed: number }[],
): number {
  let count = 0;
  for (const run of runs) {
    const noProgress =
      (run.status === ScrapeRunStatusEnum.FAILED || run.status === ScrapeRunStatusEnum.PARTIAL) &&
      run.itemsProcessed === 0;
    if (!noProgress) break;
    count++;
  }
  return count;
}

/**
 * Restart-loop guard decision (PRD §4.7): block a fresh start when at least
 * `maxNoProgressRestarts` consecutive prior runs each made zero progress. A
 * non-resumable or repeatedly-failing cause (transient crash at batch 1,
 * unreadable page tail) is thus bounded even under a misconfigured `Always`
 * policy — the guard exits 0, which breaks the loop.
 */
export function shouldBlockForNoProgress(
  leadingNoProgress: number,
  maxNoProgressRestarts: number,
): boolean {
  return leadingNoProgress >= maxNoProgressRestarts;
}

// ---------------------------------------------------------------------------
// Campaign metadata chain (PRD §3)
// ---------------------------------------------------------------------------

/** The predecessor facts `buildCampaignMetadata` reads to chain a campaign. */
export interface PredecessorRunFacts {
  readonly id: string;
  readonly itemsProcessed: number;
  readonly metadata: Prisma.JsonValue | null;
}

/**
 * Campaign-scoped metadata stamped on every enrichment run row (PRD §3), so a
 * chain of resumed runs is traceable and the restart-loop guard is auditable.
 * `stopReason` is filled in at close by the CLI.
 */
export interface CampaignMetadata {
  /** The first run of the resume chain — stable across every resume of a campaign. */
  readonly campaignRootRunId: string;
  /** 0 for the root run, +1 for each subsequent resume. */
  readonly resumeAttempt: number;
  /** The cursor this run inherited (null ⇒ started from the head of the queue). */
  readonly startCursor: string | null;
  /** The campaign's cumulative processed count BEFORE this run (root ⇒ 0). */
  readonly startItemsProcessed: number;
}

function readNumber(metadata: Prisma.JsonValue | null, key: string): number | null {
  if (metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function readString(metadata: Prisma.JsonValue | null, key: string): string | null {
  if (metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return null;
}

/**
 * Derive this run's {@link CampaignMetadata} (PRD §3). A run that resumes a
 * predecessor inherits the campaign's root id and cumulative progress and
 * bumps `resumeAttempt`; a fresh campaign becomes its own root at
 * `resumeAttempt = 0`.
 *
 * Chaining is best-effort on the predecessor's stored metadata: if a
 * predecessor was hard-killed before it could write campaign metadata (only
 * later stale-reaped), its root/attempt fields are absent — the chain then
 * re-roots at `resumedFromRunId` and re-derives the attempt from the
 * predecessor's own processed count. Observability degrades gracefully; the
 * cursor-based resume itself never depends on this.
 */
export function buildCampaignMetadata(params: {
  runId: string;
  startCursor: string | null;
  resumedFromRunId: string | null;
  predecessor: PredecessorRunFacts | null;
}): CampaignMetadata {
  const { runId, startCursor, resumedFromRunId, predecessor } = params;

  const resuming =
    resumedFromRunId !== null && predecessor !== null && predecessor.id === resumedFromRunId;

  if (!resuming) {
    return {
      campaignRootRunId: runId,
      resumeAttempt: 0,
      startCursor,
      startItemsProcessed: 0,
    };
  }

  const priorRoot = readString(predecessor.metadata, 'campaignRootRunId') ?? resumedFromRunId;
  const priorAttempt = readNumber(predecessor.metadata, 'resumeAttempt') ?? 0;
  const priorStartProcessed = readNumber(predecessor.metadata, 'startItemsProcessed') ?? 0;

  return {
    campaignRootRunId: priorRoot,
    resumeAttempt: priorAttempt + 1,
    startCursor,
    // Cumulative campaign progress before this run = predecessor's own baseline
    // plus what the predecessor itself processed.
    startItemsProcessed: priorStartProcessed + predecessor.itemsProcessed,
  };
}
