import type { CollectionDto, CollectionType } from '@/lib/api/types';

/**
 * Display-label maps for the Collections surface (frozen copy from the design
 * spec — the weekly `fresh-card__type` labels and the Similar-Collections
 * eyebrow per collection type).
 */

/** `fresh-card__type` label per weekly editorial slug (fallback «Тема»). */
const WEEKLY_TYPE_LABELS: Readonly<Record<string, string>> = {
  'buker-2026': 'Свіже',
  'ukr-fentezi': 'Тема',
  'non-fikshn': 'Для розуму',
};

export function weeklyTypeLabel(slug: string): string {
  return WEEKLY_TYPE_LABELS[slug] ?? 'Тема';
}

const TYPE_EYEBROWS: Readonly<Record<CollectionType, string>> = {
  dynamic: 'ДОБІРКА',
  editorial: 'ДОБІРКА РЕДАКЦІЇ',
  taxonomic: 'ЖАНР',
};

/**
 * Eyebrow for a Similar-Collections fresh-card: weekly slugs reuse the
 * weekly-type map (uppercased); otherwise the label follows the collection type.
 */
export function similarEyebrow(collection: Pick<CollectionDto, 'slug' | 'type'>): string {
  const weekly = WEEKLY_TYPE_LABELS[collection.slug];
  if (weekly !== undefined) return weekly.toUpperCase();
  return TYPE_EYEBROWS[collection.type];
}

/** Public path for a collection: genres live under /zhanry, the rest under /dobirky. */
export function collectionPath(collection: Pick<CollectionDto, 'slug' | 'type'>): string {
  return collection.type === 'taxonomic'
    ? `/zhanry/${collection.slug}`
    : `/dobirky/${collection.slug}`;
}
