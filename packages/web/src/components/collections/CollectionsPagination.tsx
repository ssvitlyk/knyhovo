'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ds/Button';
import { getPageItems, PAGINATION_ELLIPSIS } from '@/lib/pagination';
import type { UiSort } from '@/lib/collections/sort';

export interface CollectionsPaginationProps {
  /** Route path of the collection page (e.g. `/dobirky/znyzhky`). */
  readonly basePath: string;
  readonly sort: UiSort;
  readonly page: number;
  readonly totalPages: number;
}

/**
 * Frozen numbered pagination (same algorithm + markup as Search Results v1.0,
 * reusing `getPageItems`). Page links keep the current `sort` in the URL and
 * smooth-scroll to top. Hidden when there is a single page.
 */
export function CollectionsPagination({
  basePath,
  sort,
  page,
  totalPages,
}: CollectionsPaginationProps): React.JSX.Element | null {
  const router = useRouter();
  if (totalPages <= 1) return null;

  const goTo = (next: number): void => {
    router.push(`${basePath}?sort=${sort}&page=${next}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const items = getPageItems(page, totalPages);

  return (
    <nav className="kn-pagination" aria-label="Сторінки добірки">
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
        Вперед →
      </Button>
    </nav>
  );
}
