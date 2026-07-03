'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SecHead } from './SecHead';
import { ListRow } from './ListRow';
import { CollectionIcon } from './icons';
import type { MoodDto } from '@/lib/api/types';
import { collectionPath } from '@/lib/collectionsPaths';

function useIsMobile(bp = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(`(max-width: ${bp}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const handler = (e: MediaQueryListEvent): void => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [bp]);
  return isMobile;
}

export interface MoodSectionProps {
  readonly moods: readonly MoodDto[];
  readonly allHref: string;
}

/** «Що читати сьогодні» — mood tiles (desktop grid) / dense list-rows (mobile). */
export function MoodSection({ moods, allHref }: MoodSectionProps): React.JSX.Element {
  const isMobile = useIsMobile();
  return (
    <section className="band band--sage reveal" id="nastroji" data-screen-label="Що читати сьогодні">
      <div className="page">
        <SecHead
          eyebrow="За настроєм"
          title="Що читати сьогодні"
          sub="Не знаєте, чого хочеться? Оберіть настрій — Книговик підбере книги під нього."
          fresh={{ text: 'Добірки для різного настрою', editorial: true }}
          allLabel="Усі настрої"
          allHref={allHref}
        />
        {isMobile ? (
          <div className="list-rows-card">
            {moods.map((m) => (
              <ListRow
                key={m.slug}
                href={collectionPath(m.slug)}
                icon={m.icon}
                title={m.name}
                desc={m.description}
                count={`${m.bookCount} книг`}
              />
            ))}
          </div>
        ) : (
          <div className="mood-grid">
            {moods.map((m) => (
              <Link key={m.slug} href={collectionPath(m.slug)} className="mood-card">
                <span className="mood-card__icon">
                  <CollectionIcon name={m.icon} size={22} />
                </span>
                <div className="mood-card__body">
                  <div className="mood-card__name">{m.name}</div>
                  <div className="mood-card__desc">{m.description}</div>
                </div>
                <div className="mood-card__count">{m.bookCount} книг</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
