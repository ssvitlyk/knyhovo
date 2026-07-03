import Link from 'next/link';
import { CollectionIcon } from './icons';
import { collectionPath } from '@/lib/collectionsPaths';
import type { CollectionSummaryDto } from '@/lib/api/types';

export interface SimilarCollectionsProps {
  readonly collections: readonly CollectionSummaryDto[];
}

/**
 * «Схожі добірки» — reuses the exact fresh-card editorial style/markup from
 * `FreshSection` (cover-stack cards), wrapped in the `.cd-similar` section.
 * Omitted entirely when there are no similar collections.
 */
export function SimilarCollections({ collections }: SimilarCollectionsProps): React.JSX.Element | null {
  if (collections.length === 0) return null;

  return (
    <section className="cd-similar">
      <div className="page">
        <h2 className="cd-similar__title">Схожі добірки</h2>
        <div className="fresh-grid">
          {collections.map((c) => (
            <Link key={c.slug} href={collectionPath(c.slug)} className="fresh-card">
              <div className="fresh-card__head">
                <span className="fresh-card__icon">
                  <CollectionIcon name={c.icon ?? 'library'} size={20} />
                </span>
                {c.eyebrow ? <span className="fresh-card__type">{c.eyebrow}</span> : null}
              </div>
              <div className="fresh-card__name">{c.title}</div>
              {c.description ? <div className="fresh-card__desc">{c.description}</div> : null}
              <div className="fresh-card__covers">
                <div className="fresh-card__stack">
                  {c.previewBooks.map((bk) => (
                    <img key={bk.id} src={bk.coverUrl ?? ''} alt={bk.title} loading="lazy" />
                  ))}
                </div>
                <span className="fresh-card__count">{c.bookCount} книг →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
