import { Button } from '@/components/ds/Button';
import { getPageItems, PAGINATION_ELLIPSIS } from '@/lib/pagination';

export interface PageNavProps {
  readonly page: number;
  readonly totalPages: number;
  readonly onPage: (page: number) => void;
  /** Accessible name of the `<nav>` landmark. */
  readonly ariaLabel: string;
  /** Label of the «next» button (copy differs per surface: «Далі →» / «Вперед →»). */
  readonly nextLabel: string;
}

/**
 * Presentational numbered pagination (frozen `kn-pagination` recipe from Search
 * Results v1.0): prev/next `secondary sm`, page numbers `ghost sm`, current page
 * `primary sm` with `aria-current="page"`. Navigation is the caller's concern
 * (`onPage`). Hidden when there is a single page.
 */
export function PageNav({
  page,
  totalPages,
  onPage,
  ariaLabel,
  nextLabel,
}: PageNavProps): React.JSX.Element | null {
  if (totalPages <= 1) return null;

  const items = getPageItems(page, totalPages);

  return (
    <nav className="kn-pagination" aria-label={ariaLabel}>
      <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => onPage(page - 1)}>
        ← Назад
      </Button>
      <div className="kn-pagination__pages">
        {items.map((item, i) =>
          item === PAGINATION_ELLIPSIS ? (
            <span key={`ellipsis-${i}`} className="kn-pagination__ellipsis">
              {PAGINATION_ELLIPSIS}
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? 'primary' : 'ghost'}
              size="sm"
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onPage(item)}
            >
              {item}
            </Button>
          ),
        )}
      </div>
      <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => onPage(page + 1)}>
        {nextLabel}
      </Button>
    </nav>
  );
}
