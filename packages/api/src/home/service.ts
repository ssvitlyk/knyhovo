/**
 * Home Builder (Layer 3) — orchestration over the generic composer.
 *
 * Responsibilities:
 *  1. Load ranked candidate pools per feed via the collections `repository`
 *     directly (one query per feed with `candidateLimit`, no HTTP, no
 *     `per_page=24` round-trips).
 *  2. Adapt rows → internal `FeedCandidate` (candidate-adapter).
 *  3. Call the composer in ALLOCATION order with the concrete Home diversity
 *     policy.
 *  4. Map picked ids → `CollectionBookDto` and reorder into DISPLAY order
 *     (response-mapper), producing a user-agnostic payload.
 *  5. Cache that payload under a versioned key (`home:v1`, 5-min TTL).
 *  6. After the cache read, decorate `wishlistCount` (live) + `isWishlisted`
 *     (per user) — never part of the cache.
 *
 * The concrete `diversityPolicy` (`floor(take × 1/3)`) lives here, not in the
 * composer.
 */
import type { PrismaClient } from '@prisma/client';
import { getOrSet } from '../collections/cache.js';
import { resolveFeed } from '../collections/service.js';
import {
  findCollectionsBySlugs,
  findCanonicalBooksByIds,
  findWishlistCountsByIds,
  findWishlistedBookIds,
} from '../collections/repository.js';
import type { CollectionBookRow } from '../collections/repository.js';
import { compose } from '../feed-composer/index.js';
import type { SectionSpec } from '../feed-composer/index.js';
import { HOME_LAYOUT, candidateLimitFor, homeDiversityPolicy } from './layout.js';
import type { HomeLayout } from './layout.js';
import { toFeedCandidate } from './candidate-adapter.js';
import { composedToShelves } from './response-mapper.js';
import type { HomeResponseDto } from './dto.js';
import { buildHomeLog, defaultHomeLogSink } from './observability.js';
import type { HomeLogSink } from './observability.js';

/** Versioned composed-Home cache key. Bump the version when `HOME_LAYOUT` composition changes. */
export const HOME_CACHE_KEY = 'home:v1';
/** 5-min TTL — composed payload contains wishlist-derived `popular`, mirroring collections PRD §3.1. */
export const HOME_CACHE_TTL_MS = 5 * 60 * 1000;

export interface BuildHomeOptions {
  readonly layout?: HomeLayout;
  readonly now?: Date;
  readonly logSink?: HomeLogSink;
}

/**
 * Build the user-agnostic composed Home payload (no `isWishlisted`; the
 * `wishlistCount` baked here is re-read live after the cache read). Pure with
 * respect to `now`/`layout`, so it is deterministic given the same DB state.
 */
export async function buildHome(prisma: PrismaClient, options: BuildHomeOptions = {}): Promise<HomeResponseDto> {
  const layout = options.layout ?? HOME_LAYOUT;
  const now = options.now ?? new Date();
  const logSink = options.logSink ?? defaultHomeLogSink;

  const buildStart = Date.now();

  const slugs = layout.sections.map((s) => s.slug);
  const rows = await findCollectionsBySlugs(prisma, slugs);
  const rowBySlug = new Map(rows.map((r) => [r.slug, r] as const));

  // One candidate-id query per feed, with each feed's `candidateLimit`.
  const candidateLimits = new Map<string, number>();
  const fetchStart = Date.now();
  const perSection = await Promise.all(
    layout.sections.map(async (section) => {
      const limit = candidateLimitFor(section);
      candidateLimits.set(section.key, limit);
      const row = rowBySlug.get(section.slug);
      if (!row) return { section, ids: [] as string[] };
      const feed = await resolveFeed(prisma, row, now);
      const ids = await feed.getPage({}, 'relevance', 1, limit);
      return { section, ids };
    }),
  );

  // Batch-fetch canonical rows for the union of all candidate ids — one query.
  const unionIds = [...new Set(perSection.flatMap((p) => p.ids))];
  const bookRows = await findCanonicalBooksByIds(prisma, unionIds);
  const rowById = new Map(bookRows.map((r) => [r.id, r] as const));
  const candidateFetchMs = Date.now() - fetchStart;

  // Adapt rows → FeedCandidate, preserving each feed's relevance order.
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

  // Wishlist counts for the selected books only (ids unique across shelves by dedup).
  const pickedIds = composed.sections.flatMap((s) => s.picked.map((p) => p.id));
  const wishlistCounts = await findWishlistCountsByIds(prisma, pickedIds);

  const shelves = composedToShelves(composed, layout.displayOrder, rowById, wishlistCounts);

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
 * (user-agnostic, cached) composed payload — the same "decorate after the cache
 * read" pattern the collections service uses. Guests get `isWishlisted: false`.
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
 * wishlist fields after the cache read.
 */
export async function getHome(prisma: PrismaClient, userId: string | null): Promise<HomeResponseDto> {
  const cached = await getOrSet(HOME_CACHE_KEY, HOME_CACHE_TTL_MS, () => buildHome(prisma));
  return decorateHome(prisma, cached, userId);
}
