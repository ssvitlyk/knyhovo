'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ds/Button';
import { getPageItems, PAGINATION_ELLIPSIS } from '@/lib/pagination';

export interface PaginationProps {
  readonly query: string;
  readonly page: number;
  readonly totalPages: number;
}

/**
 * Frozen pagination control. Page links update the `page` URL param (preserving
 * `q`) and smooth-scroll to top. Prev/next are `secondary sm`, page numbers
 * `ghost sm`, the current page `primary sm` with `aria-current="page"`. Hidden
 * when there is a single page.
 */
export function Pagination({ query, page, totalPages }: PaginationProps): React.JSX.Element | null {
  const router = useRouter();
  if (totalPages <= 1) return null;

  const goTo = (next: number): void => {
    router.push(`/search?q=${encodeURIComponent(query)}&page=${next}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const items = getPageItems(page, totalPages);

  return (
    <nav className="kn-pagination" aria-label="Сторінки результатів">
      <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => goTo(page - 1)}>
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
              onClick={() => goTo(item)}
            >
              {item}
            </Button>
          ),
        )}
      </div>
      <Button variant="secondary" size="sm" disabled={page === totalPages} onClick={() => goTo(page + 1)}>
        Далі →
      </Button>
    </nav>
  );
}
