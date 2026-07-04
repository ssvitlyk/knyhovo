import type { ReactNode } from 'react';
import { SecHead, type SecFresh } from './SecHead';
import { Shelf, type ShelfItem } from './Shelf';

export interface BookSectionProps {
  readonly id?: string;
  readonly band?: 'warm' | 'sage' | 'cool' | 'rose' | 'green';
  readonly eyebrow?: ReactNode;
  readonly title: string;
  readonly sub?: string;
  readonly fresh?: SecFresh;
  readonly allLabel?: string;
  readonly allHref?: string;
  readonly items: readonly ShelfItem[];
}

/** A book shelf section — plain by default, or wrapped in a full-bleed tinted band. */
export function BookSection({
  id,
  band,
  eyebrow,
  title,
  sub,
  fresh,
  allLabel,
  allHref,
  items,
}: BookSectionProps): React.JSX.Element {
  const cls = 'reveal ' + (band !== undefined ? `band band--${band}` : 'sec');
  return (
    <section className={cls} id={id}>
      <SecHead eyebrow={eyebrow} title={title} sub={sub} fresh={fresh} allLabel={allLabel} allHref={allHref} />
      <Shelf items={items} allLabel={allLabel} allHref={allHref} />
    </section>
  );
}

/** Structural divider between hub sections (frozen §6 rhythm). */
export function SecDivider(): React.JSX.Element {
  return <hr className="page-divider" />;
}
