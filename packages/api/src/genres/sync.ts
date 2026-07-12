import { CollectionType, type PrismaClient } from '@prisma/client';
import { CANONICAL_GENRES } from './taxonomy.js';
import { GENRE_MAPPINGS_SEED, type GenreMappingSeed } from './mappings.seed.js';
import { normalizeCategoryKey } from './normalize.js';
import { mapProviderName } from '../pipeline/persist-listing.js';

/**
 * `genres:sync` (genres-taxonomy PRD §8.1).
 *
 * Idempotent projection of the checked-in registries onto the database:
 *
 *   1. `CANONICAL_GENRES` → `collections` rows (type=TAXONOMIC):
 *      - upserts each canonical genre by its unique `slug` (name/description/
 *        icon/displayOrder are updated; `slug` itself is never written in the
 *        update branch — it's only ever read via `where`);
 *      - any existing TAXONOMIC row whose slug has fallen out of the taxonomy
 *        is deactivated (`isActive: false`), never deleted (§6.4 — the row
 *        must keep satisfying the `genre_id` FK on `canonical_books`);
 *   2. `GENRE_MAPPINGS_SEED` → `genre_mappings` rows (G3):
 *      - upserts by unique `(provider, sourceCategory)`;
 *      - rows absent from the seed are never deleted — the DB table is the
 *        runtime source of truth and may carry ad-hoc curated rows.
 *
 * Never touches `canonical_books` or any book/listing row. Pure orchestration
 * over Prisma — no business/mapping logic lives here.
 */

/** Summary of what a `syncGenres` run did (or, for dry-run, would do). */
export interface GenreSyncResult {
  /** Number of TAXONOMIC collection rows newly created. */
  readonly created: number;
  /** Number of existing TAXONOMIC collection rows whose fields changed. */
  readonly updated: number;
  /** Number of TAXONOMIC rows deactivated because their slug left the taxonomy. */
  readonly deactivated: number;
  /** Number of `genre_mappings` rows newly created from the seed. */
  readonly mappingsCreated: number;
  /** Number of existing `genre_mappings` rows whose fields changed. */
  readonly mappingsUpdated: number;
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

/** Minimal shape of an existing `genre_mappings` row, as read for diffing. */
interface ExistingMappingRow {
  readonly provider: string;
  readonly sourceCategory: string;
  readonly genreId: string | null;
  readonly confidence: number;
  readonly notes: string | null;
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
 * Validate the seed's structural invariants before touching the DB. Throws on
 * a curation error: an unknown genre slug, a non-normalized source category,
 * or an out-of-range confidence.
 */
function validateMappingSeed(seed: readonly GenreMappingSeed[]): void {
  const knownSlugs = new Set(CANONICAL_GENRES.map((g) => g.slug));
  for (const entry of seed) {
    if (entry.genreSlug !== null && !knownSlugs.has(entry.genreSlug)) {
      throw new Error(
        `genres:sync: mapping seed (${entry.provider}, "${entry.sourceCategory}") points at unknown genre slug "${entry.genreSlug}"`,
      );
    }
    if (normalizeCategoryKey(entry.sourceCategory) !== entry.sourceCategory) {
      throw new Error(
        `genres:sync: mapping seed sourceCategory "${entry.sourceCategory}" (${entry.provider}) is not normalized`,
      );
    }
    if (!Number.isInteger(entry.confidence) || entry.confidence < 0 || entry.confidence > 100) {
      throw new Error(
        `genres:sync: mapping seed (${entry.provider}, "${entry.sourceCategory}") has invalid confidence ${entry.confidence}`,
      );
    }
  }
}

/**
 * Sync `CANONICAL_GENRES` and `GENRE_MAPPINGS_SEED` to the database.
 *
 * Idempotent: running this twice in a row with no registry changes produces
 * zero writes (or, in dry-run, an all-zero result) on the second run.
 */
export async function syncGenres(
  prisma: PrismaClient,
  options?: SyncGenresOptions,
): Promise<GenreSyncResult> {
  const dryRun = options?.dryRun ?? false;
  validateMappingSeed(GENRE_MAPPINGS_SEED);

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

  const { mappingsCreated, mappingsUpdated } = await syncMappings(prisma, dryRun);

  return { created, updated, deactivated, mappingsCreated, mappingsUpdated, dryRun };
}

/**
 * Upsert `GENRE_MAPPINGS_SEED` into `genre_mappings` (PRD §8.1, G3).
 *
 * Genre ids are resolved by re-reading TAXONOMIC rows AFTER the genre upserts
 * above, so a freshly-created genre is immediately mappable. In dry-run a
 * seed entry whose genre row does not exist yet still counts as a would-be
 * write (its `genreId` cannot match the missing row).
 */
async function syncMappings(
  prisma: PrismaClient,
  dryRun: boolean,
): Promise<{ mappingsCreated: number; mappingsUpdated: number }> {
  const genreRows = (await prisma.collection.findMany({
    where: { type: CollectionType.TAXONOMIC },
    select: { id: true, slug: true },
  })) as readonly { id: string; slug: string }[];
  const genreIdBySlug = new Map(genreRows.map((row) => [row.slug, row.id]));

  const existingMappings = (await prisma.genreMapping.findMany({
    select: { provider: true, sourceCategory: true, genreId: true, confidence: true, notes: true },
  })) as readonly ExistingMappingRow[];
  const existingByKey = new Map(
    existingMappings.map((row) => [`${row.provider} ${row.sourceCategory}`, row]),
  );

  let mappingsCreated = 0;
  let mappingsUpdated = 0;

  for (const entry of GENRE_MAPPINGS_SEED) {
    const provider = mapProviderName(entry.provider);
    const targetGenreId = entry.genreSlug === null ? null : genreIdBySlug.get(entry.genreSlug) ?? null;
    if (entry.genreSlug !== null && targetGenreId === null && !dryRun) {
      // validateMappingSeed guarantees the slug is canonical, and the genre
      // upserts above ran first — reaching this means the DB write failed.
      throw new Error(
        `genres:sync: no TAXONOMIC row for genre slug "${entry.genreSlug}" after genre sync`,
      );
    }

    const existing = existingByKey.get(`${provider} ${entry.sourceCategory}`);
    if (!existing) {
      mappingsCreated += 1;
    } else if (
      existing.genreId === targetGenreId &&
      existing.confidence === entry.confidence &&
      existing.notes === entry.notes
    ) {
      continue;
    } else {
      mappingsUpdated += 1;
    }

    if (!dryRun) {
      await prisma.genreMapping.upsert({
        where: {
          provider_sourceCategory: { provider, sourceCategory: entry.sourceCategory },
        },
        update: {
          genreId: targetGenreId,
          confidence: entry.confidence,
          notes: entry.notes,
        },
        create: {
          provider,
          sourceCategory: entry.sourceCategory,
          genreId: targetGenreId,
          confidence: entry.confidence,
          notes: entry.notes,
        },
      });
    }
  }

  return { mappingsCreated, mappingsUpdated };
}
