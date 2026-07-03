import Link from 'next/link';

export interface SecHeadFresh {
  readonly text: string;
  /** Editorial (accent dot) vs algorithmic/live (green dot) freshness signal. */
  readonly editorial?: boolean;
}

export interface SecHeadProps {
  readonly eyebrow?: React.ReactNode;
  readonly title: string;
  readonly sub?: string | null;
  readonly fresh?: SecHeadFresh | null;
  readonly allLabel?: string | null;
  readonly allHref?: string;
}

/** Section header: eyebrow · title · why-sub · freshness · see-all. */
export function SecHead({ eyebrow, title, sub, fresh, allLabel, allHref }: SecHeadProps): React.JSX.Element {
  return (
    <div className="sec-head">
      <div className="sec-head__left">
        {eyebrow ? <div className="sec-eyebrow">{eyebrow}</div> : null}
        <div className="sec-title">{title}</div>
        {sub ? <div className="sec-sub">{sub}</div> : null}
        {fresh ? (
          <div className={'sec-fresh' + (fresh.editorial ? ' sec-fresh--ed' : '')}>
            <span className="sec-fresh__dot" />
            {fresh.text}
          </div>
        ) : null}
      </div>
      {allLabel ? (
        <Link href={allHref ?? '#'} className="sec-all">
          {allLabel} →
        </Link>
      ) : null}
    </div>
  );
}
