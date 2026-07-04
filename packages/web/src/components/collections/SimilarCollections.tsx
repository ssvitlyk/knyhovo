import type { CollectionDto } from '@/lib/api/types';
import { knBookWord } from '@/lib/format';
import { collectionPath, similarEyebrow } from '@/lib/collections/labels';
import { DynIcon } from './icons';

/** One related collection + its preview covers (first 5). */
export interface SimilarItem {
  readonly collection: CollectionDto;
  readonly covers: readonly { readonly url: string; readonly title: string }[];
}

/**
 * «Схожі добірки» — exactly the frozen fresh-card style, 3 related collections
 * below the grid (related = same type first, then the rest, PRD FR-DET-08).
 */
export function SimilarCollections({ items }: { readonly items: readonly SimilarItem[] }): React.JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <section className="cd-similar">
      <h2 className="cd-similar__title">Схожі добірки</h2>
      <div className="fresh-grid">
        {items.map(({ collection, covers }) => (
          <a key={collection.slug} href={collectionPath(collection)} className="fresh-card">
            <div className="fresh-card__head">
              <span className="fresh-card__icon">
                <DynIcon name={collection.icon ?? 'sparkles'} size={20} />
              </span>
              <span className="fresh-card__type">{similarEyebrow(collection)}</span>
            </div>
            <div className="fresh-card__name">{collection.name}</div>
            <div className="fresh-card__desc">{collection.description}</div>
            <div className="fresh-card__covers">
              <div className="fresh-card__stack">
                {covers.map((cover) => (
                  <img key={cover.url} src={cover.url} alt={cover.title} loading="lazy" />
                ))}
              </div>
              <span className="fresh-card__count">
                {collection.bookCount} {knBookWord(collection.bookCount)} →
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
