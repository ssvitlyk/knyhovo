import { SKELETON_CARD_COUNT } from './constants';

/** BookCard skeleton — mirrors the full card anatomy (frozen, warm surfaces). */
export function SkeletonCard(): React.JSX.Element {
  return (
    <div className="kn-skeleton" aria-hidden="true">
      <div className="kn-skeleton__cover" />
      <div className="kn-skeleton__body">
        <div className="kn-skeleton__line kn-skeleton__line--badge" />
        <div className="kn-skeleton__line kn-skeleton__line--title" />
        <div className="kn-skeleton__line kn-skeleton__line--author" />
        <div className="kn-skeleton__row">
          <div className="kn-skeleton__line kn-skeleton__line--price" />
          <div className="kn-skeleton__line kn-skeleton__line--store" />
        </div>
      </div>
    </div>
  );
}

/** SearchBar skeleton — reuses the exact `.kn-field` capsule (frozen). */
export function SearchBarSkeleton(): React.JSX.Element {
  return (
    <div className="kn-field kn-skeleton-search" aria-hidden="true">
      <span className="kn-skeleton__line kn-skeleton-search__icon" />
      <span className="kn-skeleton__line kn-skeleton-search__query" />
      <span className="kn-skeleton__line kn-skeleton-search__button" />
    </div>
  );
}

/** Grid of skeleton cards used as the loading fallback. */
export function SkeletonGrid(): React.JSX.Element {
  return (
    <div className="results__grid">
      {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
