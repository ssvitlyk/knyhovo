/**
 * Generic Feed Composer (Layer 2) — pure, deterministic composition primitive.
 *
 * Given ranked candidate pools grouped into sections, produce final sections
 * via two rules, in strict priority order:
 *   1. **Strict cross-section dedup** (highest priority) — a candidate `id`
 *      lands on at most one section, ever. Sections are processed in input
 *      (= allocation) order, so earlier sections reserve first.
 *   2. **Soft per-bucket diversification** (only when `diversify`) — within a
 *      section, no `providerId` bucket exceeds the cap returned by the injected
 *      {@link DiversityPolicy}, *unless* relaxation is needed to fill the
 *      section. Relaxation never creates a duplicate and never leaves a section
 *      short while unused valid candidates remain.
 *
 * The composer knows nothing about the meaning of `id`/`providerId`/`key`, nor
 * any concrete cap value — those are all supplied by the caller. Pure: same
 * input → same output. Complexity O(Σ|candidates|).
 */
import { FeedComposerError } from './errors.js';
import type {
  ComposeOptions,
  ComposeResult,
  ComposedSection,
  FeedCandidate,
  SectionDiagnostics,
  SectionSpec,
} from './types.js';

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/** Validate section specs up front — no silent corruption (fail fast at the boundary). */
function validateSections(sections: readonly SectionSpec[]): void {
  const seenKeys = new Set<string>();
  for (const spec of sections) {
    if (seenKeys.has(spec.key)) {
      throw new FeedComposerError(`Duplicate section key: "${spec.key}".`);
    }
    seenKeys.add(spec.key);
    if (!isPositiveInteger(spec.take)) {
      throw new FeedComposerError(`Section "${spec.key}" has invalid take ${spec.take}; expected a positive integer.`);
    }
  }
}

/** Resolve + validate the diversity cap for a section. Throws on a cap < 1 or a non-integer. */
function resolveCap(spec: SectionSpec, opts: ComposeOptions): number {
  const cap = opts.diversityPolicy.bucketCapFor(spec.take);
  if (!isPositiveInteger(cap)) {
    throw new FeedComposerError(
      `diversityPolicy.bucketCapFor(${spec.take}) returned ${cap} for section "${spec.key}"; expected a positive integer.`,
    );
  }
  return cap;
}

function providerDistribution(picked: readonly FeedCandidate[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const c of picked) {
    dist[c.providerId] = (dist[c.providerId] ?? 0) + 1;
  }
  return dist;
}

/** Curated (diversify=false): take the first `take` unused candidates in order; provider ignored. */
function composeCurated(spec: SectionSpec, used: Set<string>): ComposedSection {
  const picked: FeedCandidate[] = [];
  let dedupDrops = 0;
  for (const candidate of spec.candidates) {
    if (picked.length >= spec.take) break;
    if (used.has(candidate.id)) {
      dedupDrops += 1;
      continue;
    }
    used.add(candidate.id);
    picked.push(candidate);
  }
  const diagnostics: SectionDiagnostics = {
    key: spec.key,
    take: spec.take,
    candidateCount: spec.candidates.length,
    selectedCount: picked.length,
    dedupDrops,
    diversify: false,
    cap: null,
    providerDistribution: providerDistribution(picked),
    relaxationUsed: false,
    relaxationCount: 0,
    underfilled: picked.length < spec.take,
  };
  return { key: spec.key, picked, diagnostics };
}

/** Diversified (diversify=true): soft bucket-cap pass, then relaxation from the deferred overflow. */
function composeDiversified(spec: SectionSpec, used: Set<string>, cap: number): ComposedSection {
  const picked: FeedCandidate[] = [];
  const overflow: FeedCandidate[] = [];
  const bucketCount = new Map<string, number>();
  let dedupDrops = 0;

  // Pass 1: relevance order, admit while under cap; defer over-cap candidates.
  for (const candidate of spec.candidates) {
    if (picked.length >= spec.take) break;
    if (used.has(candidate.id)) {
      dedupDrops += 1;
      continue;
    }
    const count = bucketCount.get(candidate.providerId) ?? 0;
    if (count < cap) {
      bucketCount.set(candidate.providerId, count + 1);
      used.add(candidate.id);
      picked.push(candidate);
    } else {
      overflow.push(candidate);
    }
  }

  // Pass 2 (relaxation): fill the remainder from the deferred overflow, in
  // relevance order, ignoring the cap — but never duplicating an id.
  let relaxationCount = 0;
  if (picked.length < spec.take) {
    for (const candidate of overflow) {
      if (picked.length >= spec.take) break;
      if (used.has(candidate.id)) continue;
      used.add(candidate.id);
      picked.push(candidate);
      relaxationCount += 1;
    }
  }

  const diagnostics: SectionDiagnostics = {
    key: spec.key,
    take: spec.take,
    candidateCount: spec.candidates.length,
    selectedCount: picked.length,
    dedupDrops,
    diversify: true,
    cap,
    providerDistribution: providerDistribution(picked),
    relaxationUsed: relaxationCount > 0,
    relaxationCount,
    underfilled: picked.length < spec.take,
  };
  return { key: spec.key, picked, diagnostics };
}

/**
 * Compose the given sections. `sections` order is the allocation order (who
 * reserves candidates first). Returns composed sections in that same order.
 */
export function compose(sections: readonly SectionSpec[], opts: ComposeOptions): ComposeResult {
  validateSections(sections);

  const used = new Set<string>();
  const composed: ComposedSection[] = [];
  for (const spec of sections) {
    if (spec.diversify) {
      composed.push(composeDiversified(spec, used, resolveCap(spec, opts)));
    } else {
      composed.push(composeCurated(spec, used));
    }
  }
  return { sections: composed };
}
