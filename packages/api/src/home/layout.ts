/**
 * Home layout/config (Layer 3) — the single source of truth for Home's
 * composition parameters. This is where all Home-specific business policy
 * lives: which feeds back which sections, how large a candidate pool to
 * over-fetch, allocation vs. display order, and the concrete diversity policy.
 * The generic composer (Layer 2) knows none of this.
 */
import type { HomeShelfKey } from '@knyhovo/shared';
import type { DiversityPolicy } from '../feed-composer/index.js';

/** Final size of every Home shelf. */
export const HOME_TAKE = 12;

/** Home business policy: no single provider should hold more than this share of a diversified shelf. */
export const PROVIDER_SHARE_LIMIT = 1 / 3;

export interface HomeSectionConfig {
  /** Section key returned to the client (presentation copy is a web concern). */
  readonly key: HomeShelfKey;
  /** Collection slug whose ranked feed backs this section's candidate pool. */
  readonly slug: string;
  readonly take: number;
  /** `candidateLimit = take × candidateMultiplier` — how deep to over-fetch. */
  readonly candidateMultiplier: number;
  /** Whether provider diversification applies (curated sections opt out). */
  readonly diversify: boolean;
}

export interface HomeLayout {
  readonly take: number;
  readonly providerShareLimit: number;
  /** Sections in ALLOCATION order (who reserves candidates first). */
  readonly sections: readonly HomeSectionConfig[];
  /** Section keys in DISPLAY order (what the user sees). */
  readonly displayOrder: readonly HomeShelfKey[];
}

/** Thrown when `HOME_LAYOUT` is internally inconsistent — fails fast at module load, never per-request. */
export class HomeLayoutError extends Error {
  readonly code = 'HOME_LAYOUT_ERROR';

  constructor(message: string) {
    super(message);
    this.name = 'HomeLayoutError';
  }
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

/**
 * Fail-fast structural validation of a layout. Run once when the layout is
 * created (see the `HOME_LAYOUT` assignment below), NOT per candidate/request.
 * Guarantees the composer + response-mapper never silently drop a section from
 * a typo or a mismatched allocation/display key set.
 */
export function validateHomeLayout(layout: HomeLayout): HomeLayout {
  const seen = new Set<string>();
  for (const section of layout.sections) {
    if (seen.has(section.key)) {
      throw new HomeLayoutError(`Duplicate section key: "${section.key}".`);
    }
    seen.add(section.key);
    if (!isPositiveInteger(section.take)) {
      throw new HomeLayoutError(`Section "${section.key}" has invalid take ${section.take}; expected a positive integer.`);
    }
    if (!isPositiveInteger(section.candidateMultiplier)) {
      throw new HomeLayoutError(
        `Section "${section.key}" has invalid candidateMultiplier ${section.candidateMultiplier}; expected a positive integer.`,
      );
    }
  }

  const displaySeen = new Set<string>();
  for (const key of layout.displayOrder) {
    if (displaySeen.has(key)) {
      throw new HomeLayoutError(`displayOrder lists key "${key}" more than once.`);
    }
    displaySeen.add(key);
    if (!seen.has(key)) {
      throw new HomeLayoutError(`displayOrder references unknown section key "${key}".`);
    }
  }
  // Same set both ways: every section must appear in displayOrder exactly once.
  for (const key of seen) {
    if (!displaySeen.has(key)) {
      throw new HomeLayoutError(`Section "${key}" is missing from displayOrder.`);
    }
  }

  return layout;
}

/**
 * Home v1 layout.
 *
 * - Allocation order (reserve first): knyhovyk → novynky → popular. Narrow/
 *   curated feeds reserve scarce candidates first; the broad `popular` feed
 *   (`WHERE TRUE`) always backfills with the remainder.
 * - Display order (what the user sees): popular → novynky → knyhovyk.
 * - Candidate multipliers: editorial ×3, novynky ×5, popular ×10 (→ 36/60/120
 *   as a consequence of `take=12`, never hardcoded).
 * - Editorial (`knyhovyk`) opts out of diversity — curated `sort_order` stays
 *   intact; only strict dedup applies.
 */
export const HOME_LAYOUT: HomeLayout = validateHomeLayout({
  take: HOME_TAKE,
  providerShareLimit: PROVIDER_SHARE_LIMIT,
  sections: [
    { key: 'knyhovyk', slug: 'knyhovyk-radyt', take: HOME_TAKE, candidateMultiplier: 3, diversify: false },
    { key: 'novynky', slug: 'novynky', take: HOME_TAKE, candidateMultiplier: 5, diversify: true },
    { key: 'popular', slug: 'populyarne-zaraz', take: HOME_TAKE, candidateMultiplier: 10, diversify: true },
  ],
  displayOrder: ['popular', 'novynky', 'knyhovyk'],
});

/** Candidate pool depth for a section: `take × candidateMultiplier`. */
export function candidateLimitFor(section: HomeSectionConfig): number {
  return section.take * section.candidateMultiplier;
}

/**
 * The concrete Home diversity policy, injected into the generic composer.
 * `bucketCapFor(take) = max(1, floor(take × providerShareLimit))` — for
 * `take=12`, `providerShareLimit=1/3` this is 4. The `max(1, …)` guard keeps
 * the cap valid (>= 1) for small `take` values.
 */
export function homeDiversityPolicy(providerShareLimit: number): DiversityPolicy {
  return { bucketCapFor: (sectionTake) => Math.max(1, Math.floor(sectionTake * providerShareLimit)) };
}

/**
 * A stable fingerprint of the layout's composition-affecting fields. Folded
 * into the composed-Home cache key so that changing multipliers/share-limit/
 * order/section-set invalidates the cache automatically, without a manual
 * version bump (PRD §13). Presentation is not part of this — the backend has none.
 */
export function layoutFingerprint(layout: HomeLayout): string {
  const sections = layout.sections.map((s) => `${s.key}:${s.slug}:${s.take}:${s.candidateMultiplier}:${s.diversify ? 1 : 0}`);
  return `t${layout.take}|p${layout.providerShareLimit}|s${sections.join(',')}|d${layout.displayOrder.join(',')}`;
}
