'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ds/Button';
import { getPageItems, PAGINATION_ELLIPSIS } from '@/lib/pagination';
import { collectionPath } from '@/lib/collectionsPaths';
import type { CollectionSort } from './SortDropdown';

export interface CollectionPaginationProps {
  readonly slug: string;
  readonly sort: CollectionSort;
  readonly page: number;
  readonly totalPages: number;
}

/**
 * Frozen numbered pagination (first + last + current ±1, ellipsis on gap > 1),
 * reusing the same algorithm/markup as Search Results. Page links update the
 * `page` URL param (preserving `sort`) and smooth-scroll to top. Hidden when
 * there is a single page.
 */
export function CollectionPagination({
  slug,
  sort,
  page,
  totalPages,
}: CollectionPaginationProps): React.JSX.Element | null {
  const router = useRouter();
  if (totalPages <= 1) return null;

  const goTo = (next: number): void => {
    router.push(`${collectionPath(slug)}?sort=${sort}&page=${next}`);
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
