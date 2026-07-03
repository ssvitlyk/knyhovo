'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collectionPath } from '@/lib/collectionsPaths';
import { SortDropdown, type CollectionSort } from './SortDropdown';

export interface SortBarProps {
  readonly slug: string;
  readonly sort: CollectionSort;
}

/**
 * Sticky sort bar — the only control on the page (the backend already
 * returns books in the optimal order per collection). Selecting a sort
 * option updates the `?sort=` URL param and resets `page` to 1; the server
 * re-renders with the new order.
 */
export function SortBar({ slug, sort }: SortBarProps): React.JSX.Element {
  const router = useRouter();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    function onScroll(): void {
      setStuck(window.scrollY > 96);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function changeSort(next: CollectionSort): void {
    router.push(`${collectionPath(slug)}?sort=${next}&page=1`);
  }

  return (
    <div className={'cd-sortbar' + (stuck ? ' cd-sortbar--stuck' : '')}>
      <div className="page">
        <div className="cd-sortbar__row">
          <SortDropdown value={sort} onChange={changeSort} />
        </div>
      </div>
    </div>
  );
}
