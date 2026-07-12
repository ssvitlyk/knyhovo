import { CollectionType, type PrismaClient } from '@prisma/client';
import { CANONICAL_GENRES } from './taxonomy.js';

/**
 * `genres:sync` (genres-taxonomy PRD §8.1).
 *
 * Idempotent projection of the checked-in `CANONICAL_GENRES` registry onto
 * `collections` rows (type=TAXONOMIC). This — not `prisma/seed.ts` and not a
 * one-off data migration — is what delivers the 17 genres to staging/production:
 *
 *   - upserts each canonical genre by its unique `slug` (name/description/icon/
 *     displayOrder are updated; `slug` itself is never written in the update
 *     branch — it's only ever read via `where`);
 *   - any existing TAXONOMIC row whose slug has fallen out of the taxonomy is
 *     deactivated (`isActive: false`), never deleted (§6.4 — the row must keep
 *     satisfying the `genre_id` FK on `canonical_books`);
 *   - never touches `canonical_books`, `genre_mappings`, or any book/listing row.
 *
 * Pure orchestration over Prisma — no business/mapping logic lives here.
 */

/** Summary of what a `syncGenres` run did (or, for dry-run, would do). */
export interface GenreSyncResult {
  /** Number of TAXONOMIC collection rows newly created. */
  readonly created: number;
  /** Number of existing TAXONOMIC collection rows whose fields changed. */
  readonly updated: number;
  /** Number of TAXONOMIC rows deactivated because their slug left the taxonomy. */
  readonly deactivated: number;
  /** Whether this result reflects a dry run (no writes performed). */
  readonly dryRun: boolean;
}

export interface SyncGenresOptions {
  /** When true, compute the result without writing anything. */
  readonly dryRun?: boolean;
}

/** Minimal shape of an existing TAXONOMIC collection row, as read for diffing. */
interface ExistingGenreRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string | null;
  readonly displayOrder: number;
  readonly isActive: boolean;
}

function needsUpdate(existing: ExistingGenreRow, genre: (typeof CANONICAL_GENRES)[number]): boolean {
  return (
    existing.name !== genre.name ||
    existing.description !== genre.description ||
    existing.icon !== genre.icon ||
    existing.displayOrder !== genre.displayOrder ||
    !existing.isActive
  );
}

/**
 * Sync `CANONICAL_GENRES` to the `collections` table.
 *
 * Idempotent: running this twice in a row with no taxonomy changes produces
 * zero writes (or, in dry-run, an all-zero result) on the second run.
 */
export async function syncGenres(
  prisma: PrismaClient,
  options?: SyncGenresOptions,
): Promise<GenreSyncResult> {
  const dryRun = options?.dryRun ?? false;

  const existingRows = (await prisma.collection.findMany({
    where: { type: CollectionType.TAXONOMIC },
  })) as ExistingGenreRow[];
  const existingBySlug = new Map(existingRows.map((row) => [row.slug, row]));
  const canonicalSlugs = new Set(CANONICAL_GENRES.map((g) => g.slug));

  let created = 0;
  let updated = 0;
  let deactivated = 0;

  for (const genre of CANONICAL_GENRES) {
    const existing = existingBySlug.get(genre.slug);
    if (!existing) {
      created += 1;
      if (!dryRun) {
        await prisma.collection.upsert({
          where: { slug: genre.slug },
          update: {
            name: genre.name,
            description: genre.description,
            icon: genre.icon,
            displayOrder: genre.displayOrder,
            type: CollectionType.TAXONOMIC,
            isActive: true,
          },
          create: {
            slug: genre.slug,
            type: CollectionType.TAXONOMIC,
            name: genre.name,
            description: genre.description,
            icon: genre.icon,
            displayOrder: genre.displayOrder,
            isActive: true,
          },
        });
      }
      continue;
    }

    if (needsUpdate(existing, genre)) {
      updated += 1;
      if (!dryRun) {
        await prisma.collection.upsert({
          where: { slug: genre.slug },
          update: {
            name: genre.name,
            description: genre.description,
            icon: genre.icon,
            displayOrder: genre.displayOrder,
            type: CollectionType.TAXONOMIC,
            isActive: true,
          },
          create: {
            slug: genre.slug,
            type: CollectionType.TAXONOMIC,
            name: genre.name,
            description: genre.description,
            icon: genre.icon,
            displayOrder: genre.displayOrder,
            isActive: true,
          },
        });
      }
    }
  }

  // Deactivate (never delete) any TAXONOMIC row whose slug has left the taxonomy.
  for (const existing of existingRows) {
    if (!canonicalSlugs.has(existing.slug) && existing.isActive) {
      deactivated += 1;
      if (!dryRun) {
        await prisma.collection.update({
          where: { slug: existing.slug },
          data: { isActive: false },
        });
      }
    }
  }

  return { created, updated, deactivated, dryRun };
}
