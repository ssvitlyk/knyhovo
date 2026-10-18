'use client';

import { useRouter } from 'next/navigation';
import { PageNav } from '@/components/ds/PageNav';
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

  return (
    <PageNav
      page={page}
      totalPages={totalPages}
      onPage={goTo}
      ariaLabel="Сторінки добірки"
      nextLabel="Вперед →"
    />
  );
}
