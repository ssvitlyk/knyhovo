/**
 * Structured observability for the Home build (PRD §14) — no PII, no separate
 * metrics framework. Emits one structured JSON line per composed build via the
 * same `console.*` channel the collections cache already uses. The sink is
 * injectable so tests can capture (or silence) it.
 */
import type { ComposeResult } from '../feed-composer/index.js';

export interface HomeBuildLog {
  readonly event: 'home.build';
  /** Per-section candidate/selection/dedup/relaxation/provider stats. */
  readonly sections: ReadonlyArray<{
    readonly key: string;
    readonly take: number;
    readonly candidateCount: number;
    readonly candidateLimit: number;
    readonly selectedCount: number;
    readonly dedupDrops: number;
    readonly cap: number | null;
    readonly relaxationUsed: boolean;
    readonly relaxationCount: number;
    readonly underfilled: boolean;
    readonly providerDistribution: Readonly<Record<string, number>>;
    /** Largest single-provider share of the shelf (home.shelf.max_provider_share). */
    readonly maxProviderShare: number;
  }>;
  /** Count of shelves that could not reach `take` (home.shelf.underfilled_count). */
  readonly underfilledCount: number;
  readonly candidateFetchMs: number;
  /** home.compose.duration_ms */
  readonly composeMs: number;
  readonly totalBuildMs: number;
  readonly cache: 'miss';
}

export type HomeLogSink = (log: HomeBuildLog) => void;

/** Default sink: one JSON line, tagged, on stdout. */
export const defaultHomeLogSink: HomeLogSink = (log) => {
  console.info(`[home] ${JSON.stringify(log)}`);
};

function maxProviderShare(dist: Readonly<Record<string, number>>, selectedCount: number): number {
  if (selectedCount === 0) return 0;
  const max = Math.max(0, ...Object.values(dist));
  return max / selectedCount;
}

/** Assemble the structured build log from the compose result + timings + candidate-limit map. */
export function buildHomeLog(
  composed: ComposeResult,
  candidateLimits: ReadonlyMap<string, number>,
  timings: { readonly candidateFetchMs: number; readonly composeMs: number; readonly totalBuildMs: number },
): HomeBuildLog {
  const sections = composed.sections.map((s) => ({
    key: s.key,
    take: s.diagnostics.take,
    candidateCount: s.diagnostics.candidateCount,
    candidateLimit: candidateLimits.get(s.key) ?? s.diagnostics.candidateCount,
    selectedCount: s.diagnostics.selectedCount,
    dedupDrops: s.diagnostics.dedupDrops,
    cap: s.diagnostics.cap,
    relaxationUsed: s.diagnostics.relaxationUsed,
    relaxationCount: s.diagnostics.relaxationCount,
    underfilled: s.diagnostics.underfilled,
    providerDistribution: s.diagnostics.providerDistribution,
    maxProviderShare: maxProviderShare(s.diagnostics.providerDistribution, s.diagnostics.selectedCount),
  }));
  return {
    event: 'home.build',
    sections,
    underfilledCount: sections.filter((s) => s.underfilled).length,
    candidateFetchMs: timings.candidateFetchMs,
    composeMs: timings.composeMs,
    totalBuildMs: timings.totalBuildMs,
    cache: 'miss',
  };
}
