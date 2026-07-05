'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { CollectionBookDto } from '@/lib/api/types';
import type { CardBadge } from '@/lib/collections/badges';
import { Button } from '@/components/ds/Button';
import { BookCard } from './BookCard';
import { useWishlistHearts } from './useWishlistHearts';

export interface GridItem {
  readonly book: CollectionBookDto;
  readonly badge: CardBadge | null;
}

/** The paginated `.cd-grid` of frozen `.bkc` cards (badges precomputed server-side). */
export function BooksGrid({ items }: { readonly items: readonly GridItem[] }): React.JSX.Element {
  const initialSavedIds = useMemo(
    () => items.filter(({ book }) => book.isWishlisted).map(({ book }) => book.id),
    [items],
  );
  const { saved, toggle } = useWishlistHearts(initialSavedIds);

  if (items.length === 0) {
    return <div className="cd-empty">У цій добірці поки немає книг.</div>;
  }

  return (
    <div className="cd-grid">
      {items.map(({ book, badge }) => (
        <BookCard key={book.id} book={book} badge={badge} saved={saved.has(book.id)} onToggle={toggle} />
      ))}
    </div>
  );
}

/**
 * Local error state for the books grid only — the breadcrumb, info head and
 * footer stay rendered; «Спробувати ще раз» re-runs the server render.
 */
export function BooksGridRetry(): React.JSX.Element {
  const router = useRouter();
  return (
    <div className="col-retry" role="alert">
      <p>Не вдалося завантажити книги добірки.</p>
      <Button variant="secondary" size="sm" onClick={() => router.refresh()}>
        Спробувати ще раз
      </Button>
    </div>
  );
}
