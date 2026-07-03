import Link from 'next/link';
import { SecHead } from './SecHead';
import { CollectionIcon } from './icons';
import { collectionPath } from '@/lib/collectionsPaths';
import type { CollectionSummaryDto } from '@/lib/api/types';

export interface FreshSectionProps {
  readonly editorial: readonly CollectionSummaryDto[];
  readonly allHref: string;
}

/** «Добірки редакції» — weekly editorial collections, cover-stack cards. */
export function FreshSection({ editorial, allHref }: FreshSectionProps): React.JSX.Element {
  return (
    <section className="sec reveal" id="redaktsiya" data-screen-label="Добірки редакції">
      <div className="page">
        <SecHead
          eyebrow="Кураторські добірки"
          title="Добірки редакції"
          sub="Тематичні добірки, які Книговик збирає власноруч — щотижня нові."
          fresh={{ text: 'Оновлюється щотижня', editorial: true }}
          allLabel="Архів добірок"
          allHref={allHref}
        />
        <div className="fresh-grid">
          {editorial.map((f) => (
            <Link key={f.slug} href={collectionPath(f.slug)} className="fresh-card">
              <div className="fresh-card__head">
                <span className="fresh-card__icon">
                  <CollectionIcon name={f.icon ?? 'library'} size={20} />
                </span>
                {f.eyebrow ? <span className="fresh-card__type">{f.eyebrow}</span> : null}
              </div>
              <div className="fresh-card__name">{f.title}</div>
              {f.description ? <div className="fresh-card__desc">{f.description}</div> : null}
              <div className="fresh-card__covers">
                <div className="fresh-card__stack">
                  {f.previewBooks.map((bk) => (
                    <img key={bk.id} src={bk.coverUrl ?? ''} alt={bk.title} loading="lazy" />
                  ))}
                </div>
                <span className="fresh-card__count">{f.bookCount} книг →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
