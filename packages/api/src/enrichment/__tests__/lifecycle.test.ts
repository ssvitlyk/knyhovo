import { describe, it, expect } from 'vitest';
import { ScrapeRunStatus } from '@prisma/client';
import {
  buildCampaignMetadata,
  countLeadingNoProgressRuns,
  exitCodeForReason,
  reasonForSummary,
  shouldBlockForNoProgress,
  type EnrichmentExitReason,
} from '../lifecycle.js';
import type { EnrichmentRunSummary } from '../engine.js';

// ── Exit-code contract (PRD §4.7; test-matrix rows 12, 16) ────────────────────

describe('exitCodeForReason', () => {
  const cases: Array<[EnrichmentExitReason, 0 | 1 | 75]> = [
    ['success', 0],
    ['partial-exhausted', 0],
    ['stopped-limit', 0],
    ['stopped-rate-limit', 0],
    ['signal-sigint', 0],
    ['no-progress-guard', 0],
    ['signal-sigterm', 75],
    ['stopped-circuit-breaker', 75],
    ['crash-resumable', 75],
    ['already-running', 1],
    ['config-error', 1],
  ];

  it.each(cases)('maps %s → %i', (reason, code) => {
    expect(exitCodeForReason(reason)).toBe(code);
  });

  it('SIGINT stays (0) while SIGTERM restarts (75) — the whole point of splitting them', () => {
    expect(exitCodeForReason('signal-sigint')).toBe(0);
    expect(exitCodeForReason('signal-sigterm')).toBe(75);
  });
});

describe('reasonForSummary', () => {
  const base: Pick<EnrichmentRunSummary, 'stoppedEarly' | 'failed'> = {
    stoppedEarly: null,
    failed: 0,
  };

  it('clean queue exhaustion → success', () => {
    expect(reasonForSummary(base, null)).toBe('success');
  });

  it('queue exhausted with failures (cursor NULL) → partial-exhausted', () => {
    expect(reasonForSummary({ stoppedEarly: null, failed: 3 }, null)).toBe('partial-exhausted');
  });

  it('--limit stop → stopped-limit', () => {
    expect(reasonForSummary({ ...base, stoppedEarly: 'limit' }, null)).toBe('stopped-limit');
  });

  it('rate-limit stop → stopped-rate-limit (exit 0, no restart)', () => {
    expect(reasonForSummary({ ...base, stoppedEarly: 'rate-limited' }, null)).toBe(
      'stopped-rate-limit',
    );
  });

  it('circuit-breaker stop → stopped-circuit-breaker (exit 75)', () => {
    expect(reasonForSummary({ ...base, stoppedEarly: 'circuit-breaker' }, null)).toBe(
      'stopped-circuit-breaker',
    );
  });

  it('abort by SIGINT → signal-sigint; abort by SIGTERM → signal-sigterm', () => {
    expect(reasonForSummary({ ...base, stoppedEarly: 'aborted' }, 'SIGINT')).toBe('signal-sigint');
    expect(reasonForSummary({ ...base, stoppedEarly: 'aborted' }, 'SIGTERM')).toBe('signal-sigterm');
  });

  it('abort with an unknown source defaults to the safer SIGINT (no auto-restart)', () => {
    expect(reasonForSummary({ ...base, stoppedEarly: 'aborted' }, null)).toBe('signal-sigint');
  });

  it('the full aborted matrix maps to the right exit code end-to-end', () => {
    expect(exitCodeForReason(reasonForSummary({ ...base, stoppedEarly: 'aborted' }, 'SIGINT'))).toBe(0);
    expect(exitCodeForReason(reasonForSummary({ ...base, stoppedEarly: 'aborted' }, 'SIGTERM'))).toBe(
      75,
    );
  });
});

// ── No-progress restart-loop guard (test-matrix row 15) ───────────────────────

describe('countLeadingNoProgressRuns', () => {
  it('counts leading FAILED/PARTIAL runs with items_processed=0', () => {
    expect(
      countLeadingNoProgressRuns([
        { status: ScrapeRunStatus.FAILED, itemsProcessed: 0 },
        { status: ScrapeRunStatus.PARTIAL, itemsProcessed: 0 },
        { status: ScrapeRunStatus.FAILED, itemsProcessed: 0 },
      ]),
    ).toBe(3);
  });

  it('a run that made progress breaks (resets) the streak', () => {
    expect(
      countLeadingNoProgressRuns([
        { status: ScrapeRunStatus.FAILED, itemsProcessed: 0 },
        { status: ScrapeRunStatus.PARTIAL, itemsProcessed: 120 }, // progress → streak ends here
        { status: ScrapeRunStatus.FAILED, itemsProcessed: 0 },
      ]),
    ).toBe(1);
  });

  it('a SUCCESS breaks the streak even at items_processed=0', () => {
    expect(
      countLeadingNoProgressRuns([
        { status: ScrapeRunStatus.SUCCESS, itemsProcessed: 0 },
        { status: ScrapeRunStatus.FAILED, itemsProcessed: 0 },
      ]),
    ).toBe(0);
  });

  it('a RUNNING row breaks the streak (a live process is progress, not a loop)', () => {
    expect(
      countLeadingNoProgressRuns([{ status: ScrapeRunStatus.RUNNING, itemsProcessed: 0 }]),
    ).toBe(0);
  });

  it('empty history → 0', () => {
    expect(countLeadingNoProgressRuns([])).toBe(0);
  });
});

describe('shouldBlockForNoProgress', () => {
  it('blocks once the streak reaches the threshold', () => {
    expect(shouldBlockForNoProgress(3, 3)).toBe(true);
    expect(shouldBlockForNoProgress(4, 3)).toBe(true);
  });

  it('does not block below the threshold', () => {
    expect(shouldBlockForNoProgress(2, 3)).toBe(false);
    expect(shouldBlockForNoProgress(0, 3)).toBe(false);
  });
});

// ── Campaign metadata chain (PRD §3) ──────────────────────────────────────────

describe('buildCampaignMetadata', () => {
  it('a fresh campaign roots at its own run id, resumeAttempt 0', () => {
    expect(
      buildCampaignMetadata({
        runId: 'run-1',
        startCursor: null,
        resumedFromRunId: null,
        predecessor: null,
      }),
    ).toEqual({
      campaignRootRunId: 'run-1',
      resumeAttempt: 0,
      startCursor: null,
      startItemsProcessed: 0,
    });
  });

  it('a resume inherits the root, bumps the attempt, and accumulates processed', () => {
    expect(
      buildCampaignMetadata({
        runId: 'run-2',
        startCursor: 'cur-42',
        resumedFromRunId: 'run-1',
        predecessor: {
          id: 'run-1',
          itemsProcessed: 500,
          metadata: { campaignRootRunId: 'run-1', resumeAttempt: 0, startItemsProcessed: 0 },
        },
      }),
    ).toEqual({
      campaignRootRunId: 'run-1',
      resumeAttempt: 1,
      startCursor: 'cur-42',
      startItemsProcessed: 500,
    });
  });

  it('a third-generation resume keeps the original root and cumulative total', () => {
    expect(
      buildCampaignMetadata({
        runId: 'run-3',
        startCursor: 'cur-99',
        resumedFromRunId: 'run-2',
        predecessor: {
          id: 'run-2',
          itemsProcessed: 300,
          metadata: { campaignRootRunId: 'run-1', resumeAttempt: 1, startItemsProcessed: 500 },
        },
      }),
    ).toEqual({
      campaignRootRunId: 'run-1',
      resumeAttempt: 2,
      startCursor: 'cur-99',
      startItemsProcessed: 800,
    });
  });

  it('a predecessor hard-killed without campaign metadata re-roots gracefully', () => {
    expect(
      buildCampaignMetadata({
        runId: 'run-2',
        startCursor: 'cur-7',
        resumedFromRunId: 'run-1',
        predecessor: { id: 'run-1', itemsProcessed: 40, metadata: null },
      }),
    ).toEqual({
      campaignRootRunId: 'run-1', // falls back to resumedFromRunId
      resumeAttempt: 1,
      startCursor: 'cur-7',
      startItemsProcessed: 40,
    });
  });

  it('ignores a stale predecessor whose id does not match resumedFromRunId (treats as fresh)', () => {
    expect(
      buildCampaignMetadata({
        runId: 'run-9',
        startCursor: null,
        resumedFromRunId: null,
        predecessor: { id: 'other', itemsProcessed: 999, metadata: null },
      }),
    ).toEqual({
      campaignRootRunId: 'run-9',
      resumeAttempt: 0,
      startCursor: null,
      startItemsProcessed: 0,
    });
  });
});
