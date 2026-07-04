'use client';

import type { CollectionDto } from '@/lib/api/types';
import { knBookWord } from '@/lib/format';
import { useIsMobile } from './useIsMobile';
import { DynIcon } from './icons';
import { SecHead } from './SecHead';

/** Dense mobile list-row — icon · title · 1-line subtitle · count → (frozen). */
function ListRow({
  href,
  icon,
  title,
  desc,
  count,
}: {
  readonly href: string;
  readonly icon: string;
  readonly title: string;
  readonly desc: string;
  readonly count: string;
}): React.JSX.Element {
  return (
    <a href={href} className="list-row">
      <span className="list-row__icon">
        <DynIcon name={icon} size={19} />
      </span>
      <div className="list-row__body">
        <div className="list-row__title">{title}</div>
        <div className="list-row__desc">{desc}</div>
      </div>
      <span className="list-row__meta">
        {count}
        <DynIcon name="chevron-right" size={14} />
      </span>
    </a>
  );
}

export interface MoodSectionProps {
  readonly moods: readonly CollectionDto[];
}

/**
 * «Що читати сьогодні» — mood editorial band (sage tint), frozen §6 item 3.
 * Tiles are real mood collections from the hub payload.
 * («Усі настрої» header link omitted — no all-moods page exists yet.)
 */
export function MoodSection({ moods }: MoodSectionProps): React.JSX.Element {
  const isMobile = useIsMobile();
  return (
    <section className="band band--sage reveal" id="nastroji">
      <SecHead
        eyebrow="За настроєм"
        title="Що читати сьогодні"
        sub="Не знаєте, чого хочеться? Оберіть настрій — Книговик підбере книги під нього."
        fresh={{ text: 'Добірки для різного настрою', ed: true }}
      />
      {isMobile ? (
        <div className="list-rows-card">
          {moods.map((m) => (
            <ListRow
              key={m.slug}
              href={`/dobirky/${m.slug}`}
              icon={m.icon ?? 'moon'}
              title={m.name}
              desc={m.description}
              count={`${m.bookCount} ${knBookWord(m.bookCount)}`}
            />
          ))}
        </div>
      ) : (
        <div className="mood-grid">
          {moods.map((m) => (
            <a key={m.slug} href={`/dobirky/${m.slug}`} className="mood-card">
              <span className="mood-card__icon">
                <DynIcon name={m.icon ?? 'moon'} size={22} />
              </span>
              <div className="mood-card__body">
                <div className="mood-card__name">{m.name}</div>
                <div className="mood-card__desc">{m.description}</div>
              </div>
              <div className="mood-card__count">
                {m.bookCount} {knBookWord(m.bookCount)}
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
