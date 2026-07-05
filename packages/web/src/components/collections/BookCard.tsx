'use client';

import { useState } from 'react';
import type { CollectionBookDto } from '@/lib/api/types';
import type { CardBadge } from '@/lib/collections/badges';
import { formatMoney } from '@/lib/format';
import { DynIcon } from './icons';

export interface CollectionBookCardProps {
  readonly book: CollectionBookDto;
  readonly badge: CardBadge | null;
  readonly saved: boolean;
  readonly onToggle: (bookId: string) => void;
}

/**
 * Universal frozen `.bkc` book card — one component for every shelf AND the
 * Collection Details grid (markup ported 1:1 from the frozen mocks). The whole
 * card opens Book Details; the circular heart bottom-right is the only
 * secondary action — quick wishlist toggle, no navigation.
 */
export function BookCard({ book, badge, saved, onToggle }: CollectionBookCardProps): React.JSX.Element {
  const [pop, setPop] = useState(false);

  function toggle(e: React.MouseEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const willAdd = !saved;
    onToggle(book.id);
    if (willAdd) {
      setPop(true);
      setTimeout(() => setPop(false), 300);
    }
  }

  return (
    <a href={book.url} className={'bkc' + (!book.inStock ? ' bkc--out' : '')}>
      <div className="bkc__coverwrap">
        {badge !== null ? (
          <span className={`bkc__badge bkc__badge--${badge.tone}`}>
            {badge.icon !== undefined ? <DynIcon name={badge.icon} size={12} /> : null}
            {badge.text}
          </span>
        ) : null}
        <div className="bkc__coverclip">
          <img className="bkc__cover" src={book.coverUrl} alt={book.title} loading="lazy" draggable="false" />
        </div>
      </div>
      <div className="bkc__body">
        <div className="bkc__title">{book.title}</div>
        <div className="bkc__author">{book.author}</div>
        <div className="bkc__foot">
          {book.minPrice !== null ? (
            <span className="bkc__price">{formatMoney(book.minPrice)}</span>
          ) : (
            <span className="bkc__price" style={{ color: 'var(--text-muted)' }}>
              —
            </span>
          )}
          {book.oldPrice !== null ? (
            <span className="bkc__old">{formatMoney(book.oldPrice)}</span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        className={'bkc__wish' + (saved ? ' bkc__wish--on' : '') + (pop ? ' bkc__wish--pop' : '')}
        onClick={toggle}
        aria-pressed={saved}
        aria-label={saved ? 'У бажанках' : 'Додати в бажанки'}
        title={saved ? 'У бажанках' : 'Додати в бажанки'}
      >
        <DynIcon name="heart" size={18} solid={saved} />
      </button>
    </a>
  );
}
