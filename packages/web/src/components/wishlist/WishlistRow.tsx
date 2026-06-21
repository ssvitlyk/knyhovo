import { Badge } from '@/components/ds/Badge';
import { Cover } from '@/components/ds/Cover';
import { RemoveButton } from './RemoveButton';
import { WishlistAlertControl } from './WishlistAlertControl';
import { AlertChip } from '@/components/alerts/AlertChip';
import { AlertTarget } from '@/components/alerts/AlertTarget';
import { alertUiState } from '@/lib/alerts';
import type { AlertChipState } from '@/components/alerts/AlertChip';
import { formatMoney, providerDisplayName } from '@/lib/format';
import type { WishlistItemDto } from '@/lib/api/types';

export interface WishlistRowProps {
  readonly item: WishlistItemDto;
}

/**
 * WishlistRow — desktop grid row for a single wishlist item.
 * Visible on screens ≥768px; WishlistCard handles the mobile view.
 * Grid: cover → book info → status → price → CTA → actions.
 *
 * Alert chip + target line render in the status cell from item.alert.
 * The WishlistAlertControl (bell + config surface) sits in the actions cell.
 * Triggered rows receive the v1-row--hot green-moment modifier.
 */
export function WishlistRow({ item }: WishlistRowProps): React.JSX.Element {
  const { book } = item;
  const isOutOfStock = book.offersCount === 0;
  const bestProvider = book.providers[0];

  const uiState = alertUiState(item.alert);
  const isTriggered = uiState === 'triggered';

  const rowClass = [
    'v1-row',
    isOutOfStock ? 'v1-row--out' : '',
    isTriggered ? 'v1-row--hot' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClass}>
      <Cover src={book.coverUrl} className="v1-cover" placeholderAs="span" />

      {/* Book info */}
      <span className="v1-row-main">
        <a className="v1-row-title" href={`/books/${book.id}`}>
          {book.title}
        </a>
        <span className="v1-row-author">{book.author}</span>
      </span>

      {/* Status — alert chip + target line take priority over out-of-stock badge */}
      <span className="v1-row-status">
        {item.alert !== null && uiState !== 'saved' ? (
          <>
            <AlertChip state={uiState as AlertChipState} />
            <AlertTarget
              state={uiState}
              intent={item.alert.intent}
              targetPrice={item.alert.targetPrice}
              currentPrice={book.lowestPrice}
            />
          </>
        ) : (
          isOutOfStock && (
            <Badge tone="neutral">Очікуємо наявності</Badge>
          )
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

      {/* Actions — remove + alert bell control */}
      <span className="v1-row-actions">
        <RemoveButton bookId={book.id} />
        <WishlistAlertControl
          bookId={book.id}
          alert={item.alert}
          currentPrice={book.lowestPrice}
          bookTitle={book.title}
          store={bestProvider ? providerDisplayName(bestProvider.provider) : undefined}
        />
      </span>
    </div>
  );
}
