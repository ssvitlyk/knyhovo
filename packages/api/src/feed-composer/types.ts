/**
 * Generic Feed Composer — public types (Layer 2).
 *
 * This module is a domain- and framework-independent primitive. It knows
 * nothing about Home, Collections, providers, `1/3`, `floor`, Fastify, Prisma,
 * HTTP, cache, wishlist, slugs, display order, or the UI. It operates purely
 * on opaque `FeedCandidate`s grouped into `SectionSpec`s and consults an
 * injected {@link DiversityPolicy} for its (equally opaque) bucket cap.
 */

/**
 * One candidate in a section's relevance-ordered pool. Both fields are opaque
 * to the composer:
 * - `id` — cross-section dedup key (highest priority; a candidate lands on at
 *   most one section).
 * - `providerId` — diversity bucket key. The composer never interprets it
 *   (not "provider", not `UNKNOWN`); it is just a string bucket.
 */
export interface FeedCandidate {
  readonly id: string;
  readonly providerId: string;
}

/** A section to compose: an opaque `key`, how many to `take`, its relevance-ordered pool, and whether diversity applies. */
export interface SectionSpec {
  readonly key: string;
  readonly take: number;
  /** Candidates in the caller's relevance order. */
  readonly candidates: readonly FeedCandidate[];
  /** `false` → dedup + order only (curated section); `true` → soft bucket-cap diversification + relaxation. */
  readonly diversify: boolean;
}

/**
 * Abstract diversity strategy. The composer asks only "how many candidates may
 * share a bucket in a section of size `sectionTake` before the overflow is
 * deferred?" — it embeds no concrete business policy of its own.
 */
export interface DiversityPolicy {
  readonly bucketCapFor: (sectionTake: number) => number;
}

export interface ComposeOptions {
  readonly diversityPolicy: DiversityPolicy;
}

/** Per-section diagnostics — surfaced for observability; carries no domain meaning. */
export interface SectionDiagnostics {
  readonly key: string;
  readonly take: number;
  /** Size of the section's candidate pool (before dedup). */
  readonly candidateCount: number;
  /** How many candidates ended up in the section. */
  readonly selectedCount: number;
  /** Candidates skipped because their `id` was already used by an earlier (or same) section. */
  readonly dedupDrops: number;
  readonly diversify: boolean;
  /** Effective bucket cap consulted for this section; `null` when `diversify` is false. */
  readonly cap: number | null;
  /** `providerId` → count among the selected candidates. */
  readonly providerDistribution: Readonly<Record<string, number>>;
  /** Whether any overflow candidate had to be pulled in to fill the section (cap relaxed). */
  readonly relaxationUsed: boolean;
  /** How many candidates were admitted via relaxation. */
  readonly relaxationCount: number;
  /** `true` when the section could not reach `take` even after relaxation. */
  readonly underfilled: boolean;
}

/** One composed section: its key, the picked candidates (in output order), and diagnostics. */
export interface ComposedSection {
  readonly key: string;
  readonly picked: readonly FeedCandidate[];
  readonly diagnostics: SectionDiagnostics;
}

/**
 * Result of {@link compose}: composed sections in the same order as the input
 * `SectionSpec[]` (= allocation order). Callers reorder for display themselves.
 */
export interface ComposeResult {
  readonly sections: readonly ComposedSection[];
}
