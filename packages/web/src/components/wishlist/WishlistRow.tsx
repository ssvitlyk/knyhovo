import { Badge } from '@/components/ds/Badge';
import { Button } from '@/components/ds/Button';
import { RemoveButton } from './RemoveButton';
import { formatMoney, providerDisplayName } from '@/lib/format';
import type { WishlistItemDto } from '@/lib/api/types';

export interface WishlistRowProps {
  readonly item: WishlistItemDto;
}

/**
 * WishlistRow — desktop grid row for a single wishlist item.
 * Visible on screens ≥768px; WishlistCard handles the mobile view.
 * Grid: cover → book info → status → price → CTA → actions.
 */
export function WishlistRow({ item }: WishlistRowProps): React.JSX.Element {
  const { book } = item;
  const isOutOfStock = book.offersCount === 0;
  const bestProvider = book.providers[0];

  return (
    <div className={`v1-row${isOutOfStock ? ' v1-row--out' : ''}`}>
      {/* Cover placeholder — coverUrl is always null from S9 API */}
      <span className="v1-cover" aria-hidden="true" />

      {/* Book info */}
      <span className="v1-row-main">
        <a className="v1-row-title" href={`/books/${book.id}`}>
          {book.title}
        </a>
        <span className="v1-row-author">{book.author}</span>
      </span>

      {/* Status */}
      <span className="v1-row-status">
        {isOutOfStock && (
          <Badge tone="neutral">Очікуємо наявності</Badge>
        )}
      </span>

      {/* Price stack */}
      <span className="v1-pricecell">
        {book.lowestPrice ? (
          <>
            <span className="v1-pricecell__price">{formatMoney(book.lowestPrice)}</span>
            {bestProvider && (
              <span className="v1-pricecell__store">
                {providerDisplayName(bestProvider.provider)}
              </span>
            )}
          </>
        ) : (
          <span className="v1-pricecell__pending">Збираємо ціни…</span>
        )}
      </span>

      {/* CTA */}
      <span className="v1-row-ctas">
        <a className="kn-btn kn-btn--secondary kn-btn--sm" href={`/books/${book.id}`}>
          Деталі книги
        </a>
        {isOutOfStock ? (
          <a className="kn-btn kn-btn--secondary kn-btn--sm" href="/search">
            Знайти схожі
          </a>
        ) : (
          bestProvider && (
            <a
              className="kn-btn kn-btn--primary kn-btn--sm"
              href={bestProvider.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              До книгарні
            </a>
          )
        )}
      </span>

      {/* Actions */}
      <span className="v1-row-actions">
        <RemoveButton bookId={book.id} />
      </span>
    </div>
  );
}
