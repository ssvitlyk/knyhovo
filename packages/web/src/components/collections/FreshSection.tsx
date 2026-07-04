import type { CollectionDto } from '@/lib/api/types';
import { knBookWord } from '@/lib/format';
import { weeklyTypeLabel } from '@/lib/collections/labels';
import { DynIcon } from './icons';
import { SecHead } from './SecHead';

/** A weekly editorial card: the collection + its cover stack (first ~12 covers). */
export interface WeeklyCardData {
  readonly collection: CollectionDto;
  readonly covers: readonly { readonly url: string; readonly title: string }[];
}

export interface FreshSectionProps {
  readonly weekly: readonly WeeklyCardData[];
}

/**
 * «Добірки редакції» — rich editorial cards with cover-stack thumbnails
 * (frozen §6 item 7, a culmination not a list). Cards are the real weekly
 * editorial collections. («Архів добірок» header link omitted — no archive
 * page exists yet.)
 */
export function FreshSection({ weekly }: FreshSectionProps): React.JSX.Element | null {
  if (weekly.length === 0) return null;
  return (
    <section className="sec reveal" id="redaktsiya">
      <SecHead
        eyebrow="Кураторські добірки"
        title="Добірки редакції"
        sub="Тематичні добірки, які Книговик збирає власноруч — щотижня нові."
        fresh={{ text: 'Оновлюється щотижня', ed: true }}
      />
      <div className="fresh-grid">
        {weekly.map(({ collection, covers }) => (
          <a key={collection.slug} href={`/dobirky/${collection.slug}`} className="fresh-card">
            <div className="fresh-card__head">
              <span className="fresh-card__icon">
                <DynIcon name={collection.icon ?? 'sparkles'} size={20} />
              </span>
              <span className="fresh-card__type">{weeklyTypeLabel(collection.slug)}</span>
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
