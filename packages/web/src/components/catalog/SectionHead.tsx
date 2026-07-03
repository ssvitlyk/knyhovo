import Link from 'next/link';

export interface SectionHeadProps {
  readonly eyebrow: string;
  readonly title: string;
  /** Optional «see all» link (label + href). Omit for headless sections. */
  readonly allLabel?: string;
  readonly allHref?: string;
}

/**
 * Shared section header (`.sec-head`) — eyebrow + serif title with an optional
 * «see all» link on the right. Ported from the frozen `Collections Landing
 * Page` `.sec-head` markup, reused by every catalog section.
 */
export function SectionHead({ eyebrow, title, allLabel, allHref }: SectionHeadProps): React.JSX.Element {
  return (
    <div className="sec-head">
      <div className="sec-head__left">
        <div className="sec-eyebrow">{eyebrow}</div>
        <h2 className="sec-title">{title}</h2>
      </div>
      {allLabel && allHref ? (
        <Link href={allHref} className="sec-all">
          {allLabel}
        </Link>
      ) : null}
    </div>
  );
}
