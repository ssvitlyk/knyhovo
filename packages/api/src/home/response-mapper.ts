/**
 * Response-mapper (Layer 3 output seam): composed candidate ids → Home DTO.
 *
 * The second distinct Home Builder responsibility. It knows the public
 * presentation contract (`CollectionBookDto`, display order) but nothing about
 * provider buckets or the composer. Kept separate from the candidate-adapter so
 * either can move to its own module (or serve a different builder) without
 * touching the composer.
 */
import { toCollectionBookDto } from '../collections/mapper.js';
import type { CollectionBookRow } from '../collections/repository.js';
import type { ComposeResult } from '../feed-composer/index.js';
import type { HomeShelfDto } from './dto.js';

/**
 * Map a compose result to Home shelves in `displayOrder`, resolving each picked
 * id back to a `CollectionBookDto` via the already-fetched `rowById`. Empty
 * shelves are omitted (an empty section is hidden — PRD §10). No new queries:
 * both `rowById` and `wishlistCounts` are fetched once by the caller.
 */
export function composedToShelves(
  composed: ComposeResult,
  displayOrder: readonly string[],
  rowById: ReadonlyMap<string, CollectionBookRow>,
  wishlistCounts: ReadonlyMap<string, number>,
): HomeShelfDto[] {
  const pickedByKey = new Map(composed.sections.map((s) => [s.key, s.picked] as const));
  const shelves: HomeShelfDto[] = [];
  for (const key of displayOrder) {
    const picked = pickedByKey.get(key) ?? [];
    const books = picked
      .map((candidate) => rowById.get(candidate.id))
      .filter((row): row is CollectionBookRow => row !== undefined)
      .map((row) => toCollectionBookDto(row, { wishlistCounts }));
    if (books.length > 0) shelves.push({ key, books });
  }
  return shelves;
}
