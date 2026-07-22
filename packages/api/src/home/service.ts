/**
 * Home Builder (Layer 3) — orchestration over the generic composer.
 *
 * Responsibilities:
 *  1. Load ranked candidate pools per feed via the collections `repository`
 *     directly (one query per feed with `candidateLimit`, no HTTP, no
 *     `per_page=24` round-trips). Each feed fetch is independently fault-tolerant.
 *  2. Keep only VALID candidates (priced books) — the backend is the sole owner
 *     of Home candidate validity; unpriced books never enter composition.
 *  3. Adapt rows → internal `FeedCandidate` (candidate-adapter).
 *  4. Call the composer in ALLOCATION order with the concrete Home diversity
 *     policy.
 *  5. Map picked ids → `CollectionBookDto` and reorder into DISPLAY order
 *     (response-mapper), producing a user-agnostic payload.
 *  6. Cache that payload under a versioned, layout-fingerprinted key.
 *  7. After the cache read, decorate `wishlistCount` (live) + `isWishlisted`
 *     (per user) — the SOLE source of those fields; never cached.
 *
 * The concrete `diversityPolicy` (`floor(take × 1/3)`) lives here, not in the
 * composer. A single `now` (from an injected `Clock`) is pinned for the whole
 * build so composition is deterministic and testable.
 */
import type { PrismaClient } from '@prisma/client';
import { getOrSet } from '../collections/cache.js';
import { loadFeedCandidateIds } from '../collections/service.js';
import {
  findCollectionsBySlugs,
  findCanonicalBooksByIds,
  findWishlistCountsByIds,
  findWishlistedBookIds,
} from '../collections/repository.js';
import type { CollectionBookRow } from '../collections/repository.js';
import { hasPricedListing } from '../collections/mapper.js';
import { compose } from '../feed-composer/index.js';
import type { SectionSpec } from '../feed-composer/index.js';
import type { Clock } from '../clock.js';
import { systemClock } from '../clock.js';
import { HOME_LAYOUT, candidateLimitFor, homeDiversityPolicy, layoutFingerprint } from './layout.js';
import type { HomeLayout, HomeSectionConfig } from './layout.js';
import { toFeedCandidate } from './candidate-adapter.js';
import { composedToShelves } from './response-mapper.js';
import type { HomeResponseDto } from './dto.js';
import { buildHomeLog, defaultHomeLogSink } from './observability.js';
import type { HomeLogSink } from './observability.js';

/**
 * Composed-Home cache version. Bump for a semantic composition change not
 * captured by the layout fingerprint (e.g. an algorithm change). The layout's
 * own composition fields are folded in via {@link layoutFingerprint}, so a
 * `HOME_LAYOUT` tweak invalidates the cache automatically (PRD §13).
 */
export const HOME_CACHE_VERSION = 1;
/** 5-min TTL — composed payload reflects wishlist-derived `popular`, mirroring collections PRD §3.1. */
export const HOME_CACHE_TTL_MS = 5 * 60 * 1000;

/** Versioned + layout-fingerprinted cache key. */
export function homeCacheKey(layout: HomeLayout): string {
  return `home:v${HOME_CACHE_VERSION}:${layoutFingerprint(layout)}`;
}

/** Empty counts for the user-agnostic build — wishlistCount is decorated live post-cache, never baked. */
const EMPTY_WISHLIST_COUNTS: ReadonlyMap<string, number> = new Map();

export interface BuildHomeOptions {
  readonly layout?: HomeLayout;
  readonly clock?: Clock;
  readonly logSink?: HomeLogSink;
}

/** Structured, PII-free log of a single feed's fetch failure (partial resilience). */
function logFeedFetchFailure(section: HomeSectionConfig, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `[home] ${JSON.stringify({ event: 'home.feed_fetch_failed', key: section.key, slug: section.slug, message })}`,
  );
}

/**
 * Build the user-agnostic composed Home payload (no `wishlistCount`/
 * `isWishlisted` — both are decorated live after the cache read). Deterministic
 * given the same DB state and the same pinned `now`.
 */
export async function buildHome(prisma: PrismaClient, options: BuildHomeOptions = {}): Promise<HomeResponseDto> {
  const layout = options.layout ?? HOME_LAYOUT;
  const clock = options.clock ?? systemClock;
  const now = clock.now(); // one pinned instant for the whole build
  const logSink = options.logSink ?? defaultHomeLogSink;

  const buildStart = Date.now();

  const slugs = layout.sections.map((s) => s.slug);
  const rows = await findCollectionsBySlugs(prisma, slugs);
  const rowBySlug = new Map(rows.map((r) => [r.slug, r] as const));

  // One candidate-id query per feed, with each feed's `candidateLimit`. Each
  // fetch is independently fault-tolerant: a single rejected feed yields an
  // empty pool for that section only — the other shelves still compose. The
  // catch is scoped to the feed fetch, so composer/mapper bugs are NOT swallowed.
  const candidateLimits = new Map<string, number>();
  const fetchStart = Date.now();
  const perSection = await Promise.all(
    layout.sections.map(async (section) => {
      const limit = candidateLimitFor(section);
      candidateLimits.set(section.key, limit);
      const row = rowBySlug.get(section.slug);
      if (!row) return { section, ids: [] as string[] };
      try {
        return { section, ids: await loadFeedCandidateIds(prisma, row, limit, now) };
      } catch (error) {
        logFeedFetchFailure(section, error);
        return { section, ids: [] as string[] };
      }
    }),
  );

  // Batch-fetch canonical rows for the union of all candidate ids — one query.
  // Backend is the SOLE owner of candidate validity: only priced books may enter
  // composition (occupy a slot / reserve a canonicalBookId). Editorial's LEFT-join
  // pool can carry unpriced books — drop them here, before `compose()`.
  const unionIds = [...new Set(perSection.flatMap((p) => p.ids))];
  const bookRows = await findCanonicalBooksByIds(prisma, unionIds);
  const rowById = new Map(bookRows.filter(hasPricedListing).map((r) => [r.id, r] as const));
  const candidateFetchMs = Date.now() - fetchStart;

  // Adapt valid rows → FeedCandidate, preserving each feed's relevance order.
  // Ids without a priced row (unpriced/absent) are filtered out here.
  const specs: SectionSpec[] = perSection.map(({ section, ids }) => ({
    key: section.key,
    take: section.take,
    diversify: section.diversify,
    candidates: ids
      .map((id) => rowById.get(id))
      .filter((row): row is CollectionBookRow => row !== undefined)
      .map(toFeedCandidate),
  }));

  const composeStart = Date.now();
  const composed = compose(specs, { diversityPolicy: homeDiversityPolicy(layout.providerShareLimit) });
  const composeMs = Date.now() - composeStart;

  // No wishlist query at build time — wishlistCount is decorated live post-cache.
  const shelves = composedToShelves(composed, layout.displayOrder, rowById, EMPTY_WISHLIST_COUNTS);

  logSink(
    buildHomeLog(composed, candidateLimits, {
      candidateFetchMs,
      composeMs,
      totalBuildMs: Date.now() - buildStart,
    }),
  );

  return { shelves };
}

/**
 * Re-read `wishlistCount` live and decorate per-user `isWishlisted` onto the
 * (user-agnostic, cached) composed payload — the SOLE source of both fields
 * (the cached DTO carries neutral defaults). Guests get `isWishlisted: false`
 * and live `wishlistCount`. Same "decorate after the cache read" pattern the
 * collections service uses.
 */
async function decorateHome(prisma: PrismaClient, home: HomeResponseDto, userId: string | null): Promise<HomeResponseDto> {
  const allIds = home.shelves.flatMap((s) => s.books.map((b) => b.id));
  if (allIds.length === 0) return home;

  const counts = await findWishlistCountsByIds(prisma, allIds);
  const saved = userId ? await findWishlistedBookIds(prisma, userId) : null;

  return {
    shelves: home.shelves.map((shelf) => ({
      key: shelf.key,
      books: shelf.books.map((book) => ({
        ...book,
        wishlistCount: counts.get(book.id) ?? 0,
        isWishlisted: saved ? saved.has(book.id) : false,
      })),
    })),
  };
}

/**
 * `GET /api/home` service entry point. Serves the cached, user-agnostic
 * composition (guest and auth get the SAME composition), then decorates
 * wishlist fields after the cache read. `clock` is injectable for deterministic
 * tests; production uses {@link systemClock}.
 */
export async function getHome(prisma: PrismaClient, userId: string | null, clock: Clock = systemClock): Promise<HomeResponseDto> {
  const cached = await getOrSet(homeCacheKey(HOME_LAYOUT), HOME_CACHE_TTL_MS, () => buildHome(prisma, { clock }));
  return decorateHome(prisma, cached, userId);
}
