import { SecHead, type SecHeadFresh } from './SecHead';
import { Shelf } from './Shelf';
import type { CollectionBookDto } from '@/lib/api/types';
import type { BadgeKind } from './badges';

export interface BookSectionProps {
  readonly id: string;
  readonly band?: 'rose' | 'green' | 'warm' | 'sage' | 'cool';
  readonly eyebrow?: React.ReactNode;
  readonly title: string;
  readonly sub?: string | null;
  readonly fresh?: SecHeadFresh | null;
  readonly allLabel?: string;
  readonly allHref: string;
  readonly books: readonly CollectionBookDto[];
  readonly badgeKind: BadgeKind;
  readonly bestPriceId?: string;
  readonly returnTo?: string;
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
  books,
  badgeKind,
  bestPriceId,
  returnTo,
}: BookSectionProps): React.JSX.Element {
  const cls = 'reveal ' + (band ? `band band--${band}` : 'sec');
  return (
    <section className={cls} id={id}>
      <div className="page">
        <SecHead eyebrow={eyebrow} title={title} sub={sub} fresh={fresh} allLabel={allLabel} allHref={allHref} />
        <Shelf books={books} badgeKind={badgeKind} bestPriceId={bestPriceId} allLabel={allLabel} allHref={allHref} returnTo={returnTo} />
      </div>
    </section>
  );
}
