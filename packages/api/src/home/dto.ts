/**
 * `GET /api/home` response contract.
 *
 * Deliberately minimal: only `key + books` per shelf, in DISPLAY order. All
 * presentation (title, eyebrow, CTA, copy) is a web concern — the backend is
 * the single source of *composition*, not of presentation.
 */
import type { HomeShelfKey } from '@knyhovo/shared';
import type { CollectionBookDto } from '../collections/dto.js';

export interface HomeShelfDto {
  /** Section key (`popular`/`novynky`/`knyhovyk`); web maps it to presentation config. */
  readonly key: HomeShelfKey;
  readonly books: readonly CollectionBookDto[];
}

export interface HomeResponseDto {
  /** Shelves in display order. Empty shelves are omitted. */
  readonly shelves: readonly HomeShelfDto[];
}
