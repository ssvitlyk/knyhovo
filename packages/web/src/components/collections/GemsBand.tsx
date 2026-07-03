import Link from 'next/link';
import { CollectionIcon } from './icons';
import type { CollectionBookDto } from '@/lib/api/types';

export interface GemsBandProps {
  readonly title: string;
  readonly description: string | null;
  readonly items: readonly CollectionBookDto[];
  readonly href: string;
}

/** «Недооцінені книги» — editorial hidden-gems band, fanned cover trio, no shelf. */
export function GemsBand({ title, description, items, href }: GemsBandProps): React.JSX.Element {
  const fan = items.slice(0, 3);
  return (
    <section className="sec reveal">
      <div className="page">
        <div className="gems-band">
          <div className="gems-band__body">
            <div className="gems-band__eyebrow">
              <span className="gems-band__dot" />
              Недооцінені книги
            </div>
            <h2 className="gems-band__title">{title}</h2>
            {description ? <p className="gems-band__desc">{description}</p> : null}
            <Link className="gems-band__cta" href={href}>
              Дослідити добірку <CollectionIcon name="arrow-right" size={18} />
            </Link>
          </div>
          <div className="gems-band__fan" aria-hidden="true">
            {fan.map((bk, i) => (
              <img
                key={bk.id}
                className={`gems-fan__cover gems-fan__cover--${i}`}
                src={bk.coverUrl ?? ''}
                alt=""
                loading="lazy"
                draggable="false"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
