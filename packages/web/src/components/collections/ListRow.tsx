import Link from 'next/link';
import { CollectionIcon } from './icons';

export interface ListRowProps {
  readonly href: string;
  readonly icon: string;
  readonly title: string;
  readonly desc: string;
  readonly count: string;
}

/**
 * Dense mobile list-row — icon · title · 1-line subtitle · count →. Shared by
 * the Mood section on mobile: information is the hero, decoration drops away.
 */
export function ListRow({ href, icon, title, desc, count }: ListRowProps): React.JSX.Element {
  return (
    <Link href={href} className="list-row">
      <span className="list-row__icon">
        <CollectionIcon name={icon} size={19} />
      </span>
      <div className="list-row__body">
        <div className="list-row__title">{title}</div>
        <div className="list-row__desc">{desc}</div>
      </div>
      <span className="list-row__meta">
        {count}
        <CollectionIcon name="chevron-right" size={14} />
      </span>
    </Link>
  );
}
