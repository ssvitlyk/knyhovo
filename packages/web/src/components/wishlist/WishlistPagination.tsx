'use client';

import { PageNav } from '@/components/ds/PageNav';

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
  return (
    <PageNav
      page={page}
      totalPages={pages}
      onPage={onPage}
      ariaLabel="Сторінки бажанок"
      nextLabel="Далі →"
    />
  );
}
