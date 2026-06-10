import type { HTMLAttributes, ReactNode } from 'react';

export interface BookCardProps extends HTMLAttributes<HTMLElement> {
  readonly title: string;
  readonly author: string;
  /** Pre-formatted price string, e.g. `"245 ₴"`. */
  readonly price: string;
  /** Pre-formatted old price (strikethrough). Unused by the live API (no field). */
  readonly oldPrice?: string | null;
  /** Store / provider display name shown in the muted tertiary slot. */
  readonly store?: string | null;
  /** Optional cover image URL; falls back to the frozen gradient placeholder. */
  readonly cover?: string | null;
  readonly badge?: ReactNode;
  /** Number of provider offers; when > 1 a muted "ще N" note is shown. */
  readonly offersCount?: number;
}

/**
 * Knyhovo DS BookCard — emits the frozen `.kn-book` anatomy.
 * Mirrors the reference `components/display/BookCard.jsx`: cover (img or gradient
 * placeholder) + body with badge, title, author, and a baseline price row whose
 * hierarchy is price (large, accent) > old price (muted) > store (muted).
 */
export function BookCard({
  title,
  author,
  price,
  oldPrice = null,
  store = null,
  cover = null,
  badge = null,
  offersCount,
  className = '',
  ...rest
}: BookCardProps): React.JSX.Element {
  const classes = ['kn-book', className].filter(Boolean).join(' ');
  const extraOffers = typeof offersCount === 'number' && offersCount > 1 ? offersCount - 1 : 0;
  return (
    <article className={classes} {...rest}>
      {cover ? (
        <img className="kn-book__cover" src={cover} alt="" />
      ) : (
        <div className="kn-book__cover" aria-hidden="true" />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
        {badge ? <div>{badge}</div> : null}
        <h3 className="kn-book__title">{title}</h3>
        <p className="kn-book__author">{author}</p>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span className="kn-book__price">{price}</span>
          {oldPrice ? (
            <span style={{ textDecoration: 'line-through', color: 'var(--text-faint)', fontSize: 'var(--fs-sm)' }}>
              {oldPrice}
            </span>
          ) : null}
          {store ? <span className="kn-book__store">{`· ${store}`}</span> : null}
          {extraOffers > 0 ? (
            <span className="kn-book__store">{`· ще ${extraOffers}`}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
