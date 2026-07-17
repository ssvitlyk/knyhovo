import Link from 'next/link';
import { formatMoney, providerDisplayName } from '@/lib/format';
import type { WishlistOpportunityItem } from '@/lib/wishlist/opportunities';
import { DynIcon } from '@/components/collections/icons';
import { reasonMeta } from './reason-meta';

export interface SaleCardProps {
  readonly item: WishlistOpportunityItem;
}

/**
 * Desktop «Зараз вигідно купити» card — port of `WL21SaleCard`. Old price
 * only renders when it's real (`prevPrice > price`), per the frozen rule.
 */
export function SaleCard({ item }: SaleCardProps): React.JSX.Element {
  const meta = reasonMeta(item.reason);
  const oldPrice = item.prevPrice != null && item.prevPrice > item.price ? item.prevPrice : null;
  const store = providerDisplayName(item.store);
  const detailsHref = `/books/${item.bookId}`;

  return (
    <article className="wl21-sale">
      <Link className="wl21-sale__coverlink" href={detailsHref} tabIndex={-1} aria-hidden="true">
        <span className="wl21-sale__coverclip">
          {item.coverUrl != null ? <img src={item.coverUrl} alt="" /> : null}
        </span>
      </Link>
      <div className="wl21-sale__body">
        <span className="wl21-sale__disc">
          <DynIcon name={meta.icon} size={12} />
          {meta.label}
        </span>
        <h3 className="wl21-sale__title">
          <Link href={detailsHref}>{item.title}</Link>
        </h3>
        <p className="wl21-sale__author">{item.author}</p>
        <div className="wl21-sale__foot">
          <div className="wl21-sale__pricecol">
            <span className="wl21-sale__priceline">
              <b className="wl21-sale__price">{formatMoney({ amount: item.price, currency: item.currency })}</b>
              {oldPrice != null ? (
                <s className="wl21-sale__old">
                  {formatMoney({ amount: oldPrice, currency: item.currency })}
                </s>
              ) : null}
            </span>
            <span className="wl21-sale__store">
              {store}
              {item.savingsAmount > 0
                ? ` · економія ${formatMoney({ amount: item.savingsAmount, currency: item.currency })}`
                : ''}
            </span>
          </div>
          <a
            className="wl-btn wl-btn--primary wl21-sale__buy"
            href={item.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            До книгарні
          </a>
        </div>
      </div>
    </article>
  );
}
