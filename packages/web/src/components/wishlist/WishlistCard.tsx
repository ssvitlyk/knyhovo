'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { RemoveButton } from './RemoveButton';
import { formatMoney, providerDisplayName } from '@/lib/format';
import type { WishlistItemDto } from '@/lib/api/types';

export interface WishlistCardProps {
  readonly item: WishlistItemDto;
}

/**
 * WishlistCard — mobile accordion card for a single wishlist item (Variant C).
 * Collapsed by default; tap the header to expand details.
 * Visible on screens <768px; WishlistRow handles the desktop view.
 */
export function WishlistCard({ item }: WishlistCardProps): React.JSX.Element {
  const { book } = item;
  const [open, setOpen] = useState(false);
  const isOutOfStock = book.offersCount === 0;
  const bestProvider = book.providers[0];

  const lastSeenAt = bestProvider
    ? new Date(bestProvider.lastSeenAt).toLocaleDateString('uk-UA', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className={`hy-mcard${isOutOfStock ? ' v1-row--out' : ''}`}>
      {/* Collapsed header — always visible */}
      <button
        type="button"
        className="hy-mcard-top"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="v1-mob-cover" aria-hidden="true" />
        <span className="hy-mcard-main">
          <span className="v1-mob-row-title">{book.title}</span>
          <span className="v1-mob-row-author">{book.author}</span>
        </span>
        <span className="hy-mcard-right">
          {book.lowestPrice ? (
            <>
              <span className="hy-mcard-price">{formatMoney(book.lowestPrice)}</span>
              {bestProvider && (
                <span className="hy-mcard-store">{providerDisplayName(bestProvider.provider)}</span>
              )}
            </>
          ) : (
            <span className="hy-mcard-price hy-mcard-price--faint">—</span>
          )}
        </span>
        <span className={`hy-mcard-chev${open ? ' hy-mcard-chev--open' : ''}`}>
          <ChevronDown size={16} aria-hidden />
        </span>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="hy-mcard-body">
          {bestProvider && (
            <div className="hy-mcard-meta">
              <span>Книгарня</span>
              <span>{providerDisplayName(bestProvider.provider)}</span>
            </div>
          )}
          {lastSeenAt && (
            <div className="hy-mcard-meta">
              <span>Остання перевірка</span>
              <span>{lastSeenAt}</span>
            </div>
          )}

          {/* CTA row in expanded body */}
          <div className="hy-mcard-cta">
            <a className="kn-btn kn-btn--secondary kn-btn--sm" href={`/books/${book.id}`}>
              Деталі книги
            </a>
            {isOutOfStock ? (
              <a className="kn-btn kn-btn--secondary kn-btn--sm" href="/search">
                Знайти схожі
              </a>
            ) : (
              bestProvider ? (
                <a
                  className="kn-btn kn-btn--primary kn-btn--sm"
                  href={bestProvider.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  До книгарні
                </a>
              ) : (
                <span />
              )
            )}
          </div>

          <div className="hy-mcard-actions">
            <RemoveButton bookId={book.id} />
          </div>
        </div>
      )}
    </div>
  );
}
