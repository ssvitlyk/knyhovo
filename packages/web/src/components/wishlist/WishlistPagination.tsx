'use client';

import { Button } from '@/components/ds/Button';
import { getPageItems, PAGINATION_ELLIPSIS } from '@/lib/pagination';

export interface WishlistPaginationProps {
  readonly page: number;
  readonly pages: number;
  readonly onPage: (page: number) => void;
}

/**
 * «Решта бажанок» pagination — port of `WL21Pagination` (frozen `kn-pagination`
 * recipe from Search Results). Callback-driven (no URL/router — RestOfWishlist
 * owns the `page` state), unlike the router-push `Pagination` in `search/`.
 * Hidden when there is a single page.
 */
export function WishlistPagination({ page, pages, onPage }: WishlistPaginationProps): React.JSX.Element | null {
  if (pages <= 1) return null;

  const items = getPageItems(page, pages);

  return (
    <nav className="kn-pagination" aria-label="Сторінки бажанок">
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
      <Button variant="secondary" size="sm" disabled={page === pages} onClick={() => onPage(page + 1)}>
        Далі →
      </Button>
    </nav>
  );
}
