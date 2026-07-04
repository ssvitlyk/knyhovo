import type { ReactNode } from 'react';

export interface SecFresh {
  readonly text: string;
  readonly ed?: boolean;
}

export interface SecHeadProps {
  readonly eyebrow?: ReactNode;
  readonly title: string;
  readonly sub?: string;
  readonly fresh?: SecFresh;
  readonly allLabel?: string;
  readonly allHref?: string;
}

/**
 * Frozen section header (eyebrow · title · why-sub · freshness · see-all).
 * Header treatment deliberately varies per section (full / minimal /
 * no-description / short-status) — intentional rhythm, not inconsistency.
 */
export function SecHead({ eyebrow, title, sub, fresh, allLabel, allHref }: SecHeadProps): React.JSX.Element {
  return (
    <div className="sec-head">
      <div className="sec-head__left">
        {eyebrow != null ? <div className="sec-eyebrow">{eyebrow}</div> : null}
        <div className="sec-title">{title}</div>
        {sub != null ? <div className="sec-sub">{sub}</div> : null}
        {fresh != null ? (
          <div className={'sec-fresh' + (fresh.ed === true ? ' sec-fresh--ed' : '')}>
            <span className="sec-fresh__dot" />
            {fresh.text}
          </div>
        ) : null}
      </div>
      {allLabel != null ? (
        <a href={allHref ?? '#'} className="sec-all">
          {allLabel} →
        </a>
      ) : null}
    </div>
  );
}
