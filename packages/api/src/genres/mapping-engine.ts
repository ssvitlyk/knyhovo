import type { ProviderName } from '@knyhovo/shared';
import type { CanonicalGenre } from './taxonomy.js';
import { CANONICAL_GENRES } from './taxonomy.js';
import { normalizeCategoryKey, leafFirst } from './normalize.js';

/**
 * Genre mapping engine (genres-taxonomy PRD §4.3, §4.6).
 *
 * Pure functions only — no IO, no clock, no randomness. Given a canonical
 * book's listing signals (`provider_listings.raw_categories`) and a prebuilt
 * `EngineContext` (mapping rules + taxonomy aliases), computes the winning
 * canonical genre, its confidence score, a human-readable explanation, the
 * full ranked candidate list (consumed by the ambiguous report §8.4 and by
 * future multi-genre evolution §15), and every unmapped `(provider, key)`
 * pair (consumed by the unmapped report §8.3).
 *
 * Persistence rules (what may overwrite what) intentionally do NOT live here —
 * see `assignment.ts` (§4.4). The engine never sees `genre_source`.
 */

/**
 * Provider priority by genre-signal quality (PRD §4.3). Lower index wins
 * tie-breaks. Same shape as `METADATA_PROVIDER_PRIORITY`
 * (`discovery/metadata-selection.ts`) but a deliberately different order —
 * genre signal quality ranks providers differently than display metadata.
 */
export const GENRE_PROVIDER_PRIORITY: readonly ProviderName[] = [
  'book-club',
  'bookchef',
  'laboratory',
  'knigoland',
  'vivat',
  'yakaboo',
  'book-ye',
];

/** Confidence assigned to a provider-agnostic taxonomy-alias hit (PRD §4.3 step 1). */
export const ALIAS_CONFIDENCE = 70;

/** Score bonus per agreeing provider beyond the first (PRD §4.3 step 2). */
export const AGREEMENT_BONUS = 25;

/** Scores are capped here (PRD §4.3 step 2). */
export const MAX_SCORE = 100;

/** Human display names used in runtime explanations (PRD §4.6 examples). */
const PROVIDER_DISPLAY: Record<ProviderName, string> = {
  'book-club': 'KSD',
  bookchef: 'BookChef',
  laboratory: 'Laboratory',
  knigoland: 'Knigoland',
  vivat: 'Vivat',
  yakaboo: 'Yakaboo',
  'book-ye': 'Book-Ye',
};

/**
 * Providers whose `raw_categories` is an UNORDERED category set rather than a
 * root→leaf breadcrumb path (PRD §5.1). For these, every mapped element is an
 * independent candidate — the "deepest mapped element" rule (§4.3 step 1)
 * only applies to breadcrumb paths, where element order encodes specificity.
 * KSD (`book-club`) returns GraphQL `categories[]` in arbitrary API order.
 */
const UNORDERED_SET_PROVIDERS: ReadonlySet<ProviderName> = new Set(['book-club']);

/** One mapping rule as consumed by the engine (`genre_mappings` row or seed entry). */
export interface MappingRuleInput {
  readonly provider: ProviderName;
  /** Normalized key (`normalizeCategoryKey`); the engine re-normalizes defensively. */
  readonly sourceCategory: string;
  /** Target genre (collection id) or null for an explicit "ignore" rule. */
  readonly genreId: string | null;
  /** 0–100 (PRD §5.1: leaf/specific 90–100, broad roots 40–60). */
  readonly confidence: number;
}

/** A TAXONOMIC collection row, as the engine needs it (id ↔ slug). */
export interface GenreRow {
  readonly id: string;
  readonly slug: string;
}

/** The subset of a `CanonicalGenre` the alias index needs. */
export type AliasSource = Pick<CanonicalGenre, 'slug' | 'aliases'>;

interface RuleTarget {
  readonly genreId: string | null;
  readonly confidence: number;
}

/** Prebuilt lookup indexes for `mapBookGenre` (PRD §4.3 step 1). */
export interface EngineContext {
  /** `Map<provider, Map<normalizedKey, {genreId|null, confidence}>>`. */
  readonly rulesByProvider: ReadonlyMap<ProviderName, ReadonlyMap<string, RuleTarget>>;
  /** Provider-agnostic fallback: normalized alias → genre id. */
  readonly aliasToGenreId: ReadonlyMap<string, string>;
  /** Reverse lookup for tie-breaks and reporting. */
  readonly slugByGenreId: ReadonlyMap<string, string>;
}

/**
 * Build the engine's lookup indexes from mapping rules and TAXONOMIC rows.
 *
 * Fails loudly (throws) on curation errors rather than resolving them
 * silently: a duplicate normalized rule key per provider, a rule pointing at
 * a genre id absent from `genres`, or one alias claimed by two genres would
 * all make assignment non-deterministic or wrong.
 *
 * `taxonomy` defaults to the checked-in registry; aliases of taxonomy entries
 * whose slug has no DB row yet are skipped (sync not run — alias cannot
 * resolve to an id, provider rules still work).
 */
export function buildEngineContext(args: {
  readonly mappingRules: readonly MappingRuleInput[];
  readonly genres: readonly GenreRow[];
  readonly taxonomy?: readonly AliasSource[];
}): EngineContext {
  const taxonomy = args.taxonomy ?? CANONICAL_GENRES;

  const slugByGenreId = new Map<string, string>();
  const genreIdBySlug = new Map<string, string>();
  for (const genre of args.genres) {
    slugByGenreId.set(genre.id, genre.slug);
    genreIdBySlug.set(genre.slug, genre.id);
  }

  const rulesByProvider = new Map<ProviderName, Map<string, RuleTarget>>();
  for (const rule of args.mappingRules) {
    const key = normalizeCategoryKey(rule.sourceCategory);
    let forProvider = rulesByProvider.get(rule.provider);
    if (!forProvider) {
      forProvider = new Map<string, RuleTarget>();
      rulesByProvider.set(rule.provider, forProvider);
    }
    if (forProvider.has(key)) {
      throw new Error(
        `buildEngineContext: duplicate mapping rule for (${rule.provider}, "${key}") after normalization`,
      );
    }
    if (rule.genreId !== null && !slugByGenreId.has(rule.genreId)) {
      throw new Error(
        `buildEngineContext: mapping rule (${rule.provider}, "${key}") points at unknown genre id "${rule.genreId}"`,
      );
    }
    forProvider.set(key, { genreId: rule.genreId, confidence: rule.confidence });
  }

  const aliasToGenreId = new Map<string, string>();
  const aliasOwner = new Map<string, string>();
  for (const genre of taxonomy) {
    const genreId = genreIdBySlug.get(genre.slug);
    if (genreId === undefined) continue;
    for (const alias of genre.aliases) {
      const key = normalizeCategoryKey(alias);
      if (key === '') continue;
      const owner = aliasOwner.get(key);
      if (owner !== undefined && owner !== genre.slug) {
        throw new Error(
          `buildEngineContext: alias "${key}" is claimed by both "${owner}" and "${genre.slug}"`,
        );
      }
      aliasOwner.set(key, genre.slug);
      aliasToGenreId.set(key, genreId);
    }
  }

  return { rulesByProvider, aliasToGenreId, slugByGenreId };
}

/** One listing's genre signal, as the engine consumes it. */
export interface ListingSignal {
  readonly provider: ProviderName;
  /** Provider-native categories: root→leaf path, or unordered set for KSD. */
  readonly rawCategories: readonly string[];
  /** Listing URL — surfaces as `exampleUrl` in the unmapped report (§8.1). */
  readonly url?: string | null;
}

/** An unmapped `(provider, normalizedKey)` pair, observable via reports (§8.3). */
export interface UnmappedCategory {
  readonly provider: ProviderName;
  /** Provider-native text as stored in `raw_categories`. */
  readonly rawCategory: string;
  readonly normalizedKey: string;
  readonly exampleUrl: string | null;
}

/** One ranked genre candidate (full list is exposed — PRD §8.4, §15). */
export interface GenreCandidate {
  readonly genreId: string;
  readonly slug: string;
  /** Monotone score (§4.3 step 2): max confidence + agreement bonus, capped. */
  readonly score: number;
  /** Distinct supporting providers, in `GENRE_PROVIDER_PRIORITY` order. */
  readonly providers: readonly ProviderName[];
  /** Runtime explanation (§4.6) — logs/reports only, never persisted. */
  readonly explanation: string;
}

/** The engine's result for one canonical book. */
export interface GenreMappingResult {
  /** Winning genre id, or null when there are no candidates (§4.3 step 4). */
  readonly genreId: string | null;
  /** Winner's score (0–100), or null when unassigned. */
  readonly confidence: number | null;
  /** Winner's explanation (§4.6), or null when unassigned. */
  readonly explanation: string | null;
  /** All candidates, ranked by the deterministic §4.3 ordering. */
  readonly candidates: readonly GenreCandidate[];
  /** Every category element that resolved to neither a rule nor an alias. */
  readonly unmapped: readonly UnmappedCategory[];
}

function priorityIndex(provider: ProviderName): number {
  const index = GENRE_PROVIDER_PRIORITY.indexOf(provider);
  return index === -1 ? GENRE_PROVIDER_PRIORITY.length : index;
}

/** A resolved (mapped-to-a-genre) element of one listing's categories. */
interface ElementCandidate {
  readonly genreId: string;
  readonly confidence: number;
  readonly provider: ProviderName;
  readonly providerIndex: number;
  /** 0-based element index; for breadcrumb paths, larger = deeper/more specific. */
  readonly depth: number;
  readonly explanation: string;
}

type ElementResolution =
  | { readonly kind: 'genre'; readonly genreId: string; readonly confidence: number; readonly viaAlias: boolean }
  | { readonly kind: 'ignore' }
  | { readonly kind: 'unmapped' };

/**
 * Resolve one normalized element: provider rule first (an explicit rule —
 * including an ignore rule — always beats the generic alias fallback), then
 * the taxonomy alias dictionary at `ALIAS_CONFIDENCE`.
 */
function resolveElement(
  key: string,
  providerRules: ReadonlyMap<string, RuleTarget> | undefined,
  ctx: EngineContext,
): ElementResolution {
  const rule = providerRules?.get(key);
  if (rule) {
    if (rule.genreId === null) return { kind: 'ignore' };
    return { kind: 'genre', genreId: rule.genreId, confidence: rule.confidence, viaAlias: false };
  }
  const aliasGenreId = ctx.aliasToGenreId.get(key);
  if (aliasGenreId !== undefined) {
    return { kind: 'genre', genreId: aliasGenreId, confidence: ALIAS_CONFIDENCE, viaAlias: true };
  }
  return { kind: 'unmapped' };
}

function explanationFor(
  listing: ListingSignal,
  rawElement: string,
  viaAlias: boolean,
): string {
  if (viaAlias) return `Alias "${rawElement}"`;
  const display = PROVIDER_DISPLAY[listing.provider];
  if (UNORDERED_SET_PROVIDERS.has(listing.provider)) {
    return `${display} category "${rawElement}"`;
  }
  return `${display} breadcrumb "${listing.rawCategories.join(' → ')}"`;
}

/**
 * Compute the genre assignment for one canonical book (PRD §4.3).
 *
 * 1. Per-listing candidates: each element is normalized and resolved (rule →
 *    alias → unmapped). Ignore rules drop the element. Breadcrumb providers
 *    contribute only the deepest resolved element of the path; unordered-set
 *    providers (KSD) contribute every resolved element.
 * 2. Cross-provider per-genre scoring:
 *    `min(100, max(confidence) + 25 × (distinct agreeing providers − 1))`.
 * 3. Tie-break: score desc → best provider priority asc → depth desc →
 *    slug asc.
 * 4. No candidates → `genreId: null`; unmapped pairs are always returned.
 *
 * Deterministic: same inputs → same output, regardless of listing order.
 */
export function mapBookGenre(
  listings: readonly ListingSignal[],
  ctx: EngineContext,
): GenreMappingResult {
  const elementCandidates: ElementCandidate[] = [];
  const unmapped: UnmappedCategory[] = [];

  for (const listing of listings) {
    const providerRules = ctx.rulesByProvider.get(listing.provider);
    const seenUnmappedKeys = new Set<string>();
    const resolvedElements: ElementCandidate[] = [];

    listing.rawCategories.forEach((rawElement, depth) => {
      const key = normalizeCategoryKey(rawElement);
      if (key === '') return;
      const resolution = resolveElement(key, providerRules, ctx);
      if (resolution.kind === 'ignore') return;
      if (resolution.kind === 'unmapped') {
        if (!seenUnmappedKeys.has(key)) {
          seenUnmappedKeys.add(key);
          unmapped.push({
            provider: listing.provider,
            rawCategory: rawElement,
            normalizedKey: key,
            exampleUrl: listing.url ?? null,
          });
        }
        return;
      }
      resolvedElements.push({
        genreId: resolution.genreId,
        confidence: resolution.confidence,
        provider: listing.provider,
        providerIndex: priorityIndex(listing.provider),
        depth,
        explanation: explanationFor(listing, rawElement, resolution.viaAlias),
      });
    });

    if (resolvedElements.length === 0) continue;

    if (UNORDERED_SET_PROVIDERS.has(listing.provider)) {
      elementCandidates.push(...resolvedElements);
    } else {
      // Breadcrumb path: only the deepest resolved element counts —
      // «Фентезі» beats «Художня література» (§4.3 step 1).
      const [deepest] = leafFirst(resolvedElements);
      elementCandidates.push(deepest!);
    }
  }

  const candidates = rankCandidates(elementCandidates, ctx);
  const winner = candidates[0] ?? null;

  return {
    genreId: winner?.genreId ?? null,
    confidence: winner?.score ?? null,
    explanation: winner?.explanation ?? null,
    candidates,
    unmapped,
  };
}

interface GenreGroup {
  readonly genreId: string;
  readonly slug: string;
  providers: Set<ProviderName>;
  maxConfidence: number;
  bestProviderIndex: number;
  maxDepth: number;
  best: ElementCandidate;
}

function isBetterOrigin(a: ElementCandidate, b: ElementCandidate): boolean {
  if (a.confidence !== b.confidence) return a.confidence > b.confidence;
  if (a.providerIndex !== b.providerIndex) return a.providerIndex < b.providerIndex;
  return a.depth > b.depth;
}

/** Group per-genre, score (§4.3 step 2) and order (§4.3 step 3) candidates. */
function rankCandidates(
  elementCandidates: readonly ElementCandidate[],
  ctx: EngineContext,
): readonly GenreCandidate[] {
  const groups = new Map<string, GenreGroup>();
  for (const candidate of elementCandidates) {
    const existing = groups.get(candidate.genreId);
    if (!existing) {
      groups.set(candidate.genreId, {
        genreId: candidate.genreId,
        slug: ctx.slugByGenreId.get(candidate.genreId) ?? '',
        providers: new Set([candidate.provider]),
        maxConfidence: candidate.confidence,
        bestProviderIndex: candidate.providerIndex,
        maxDepth: candidate.depth,
        best: candidate,
      });
      continue;
    }
    existing.providers.add(candidate.provider);
    existing.maxConfidence = Math.max(existing.maxConfidence, candidate.confidence);
    existing.bestProviderIndex = Math.min(existing.bestProviderIndex, candidate.providerIndex);
    existing.maxDepth = Math.max(existing.maxDepth, candidate.depth);
    if (isBetterOrigin(candidate, existing.best)) existing.best = candidate;
  }

  const scored = [...groups.values()].map((group) => {
    const score = Math.min(
      MAX_SCORE,
      group.maxConfidence + AGREEMENT_BONUS * (group.providers.size - 1),
    );
    const providers = [...group.providers].sort((a, b) => priorityIndex(a) - priorityIndex(b));
    const explanation =
      providers.length >= 2
        ? `Agreement: ${providers.map((p) => PROVIDER_DISPLAY[p]).join(' + ')}`
        : group.best.explanation;
    return { group, score, providers, explanation };
  });

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.group.bestProviderIndex !== b.group.bestProviderIndex) {
      return a.group.bestProviderIndex - b.group.bestProviderIndex;
    }
    if (a.group.maxDepth !== b.group.maxDepth) return b.group.maxDepth - a.group.maxDepth;
    return a.group.slug < b.group.slug ? -1 : a.group.slug > b.group.slug ? 1 : 0;
  });

  return scored.map(({ group, score, providers, explanation }) => ({
    genreId: group.genreId,
    slug: group.slug,
    score,
    providers,
    explanation,
  }));
}
