import Link from 'next/link';
import { BookRail } from './BookRail';
import { Chevron } from './Chevron';
import type { HomeBook } from './content';

export interface ShelfProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly lead?: string;
  /** CTA label, e.g. «Усі →». Rendered as a ghost link (desktop) + chevron (mobile). */
  readonly cta: string;
  /** Where the CTA / chevron navigate — a canonical `/search` catalog link. */
  readonly ctaHref: string;
  readonly books: readonly HomeBook[];
  /** Subtle full-bleed zone tint to separate adjacent shelves. */
  readonly tint?: boolean;
}

/**
 * Discovery shelf («Популярне зараз» / «Новинки») — frozen Homepage v1.0
 * anatomy: heading (eyebrow + title + mobile see-all chevron), desktop ghost
 * CTA, then a horizontal `BookRail`. Empty shelf → the whole section is hidden
 * (frozen spec §7). Server component.
 */
export function Shelf({ eyebrow, title, lead, cta, ctaHref, books, tint = false }: ShelfProps): React.JSX.Element | null {
  if (books.length === 0) return null;
  const classes = ['hp-shelf', tint ? 'hp-shelf--tint' : ''].filter(Boolean).join(' ');
  return (
    <section className={classes}>
      <div className="hp-shelf__head">
        <div className="hp-shelf__heading">
          {eyebrow ? <p className="kn-eyebrow">{eyebrow}</p> : null}
          <div className="hp-shelf__titlerow">
            <h2 className="hp-shelf__title">{title}</h2>
            <Link className="hp-shelf__chev" href={ctaHref} aria-label={cta}>
              <Chevron />
            </Link>
          </div>
          {lead ? <p className="hp-shelf__lead">{lead}</p> : null}
        </div>
        <Link className="kn-btn kn-btn--ghost kn-btn--sm hp-shelf__cta" href={ctaHref}>
          {cta}
        </Link>
      </div>
      <BookRail books={books} />
    </section>
  );
}
