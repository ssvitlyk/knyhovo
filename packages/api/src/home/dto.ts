/**
 * `GET /api/home` response contract.
 *
 * Deliberately minimal: only `key + books` per shelf, in DISPLAY order. All
 * presentation (title, eyebrow, CTA, copy) is a web concern — the backend is
 * the single source of *composition*, not of presentation.
 */
import type { CollectionBookDto } from '../collections/dto.js';

export interface HomeShelfDto {
  /** Opaque section key (e.g. `popular`, `novynky`, `knyhovyk`); web maps it to presentation config. */
  readonly key: string;
  readonly books: readonly CollectionBookDto[];
}

export interface HomeResponseDto {
  /** Shelves in display order. Empty shelves are omitted. */
  readonly shelves: readonly HomeShelfDto[];
}
