import Link from 'next/link';
import { Badge } from '@/components/ds/Badge';
import { BookCard } from '@/components/ds/BookCard';
import { formatMoney, providerDisplayName } from '@/lib/format';
import type { SearchItemDto } from '@/lib/api/types';

/**
 * Results grid (frozen 2-col / mobile 1-col). Each item maps to a BookCard:
 *  - price  = formatted lowest price (large, accent),
 *  - store  = the lowest-price provider (`providers[0]`),
 *  - offers = `offersCount` (shown as a muted "ще N" note when > 1),
 *  - badge  = "Найкраща ціна" on the cheapest item(s) on the page.
 * Fields the S8a contract does not provide (old price / "-N%" / "Новинка") are
 * intentionally absent.
 */
export function ResultsGrid({ items }: { readonly items: readonly SearchItemDto[] }): React.JSX.Element {
  const cheapest = items.reduce(
    (min, item) => (item.lowestPrice.amount < min ? item.lowestPrice.amount : min),
    Number.POSITIVE_INFINITY,
  );

  return (
    <div className="results__grid">
      {items.map((item) => {
        const lowestProvider = item.providers[0];
        const isCheapest = item.lowestPrice.amount === cheapest;
        return (
          <Link key={item.id} href={`/books/${item.id}`} className="results__card-link">
            <BookCard
              title={item.title}
              author={item.author}
              price={formatMoney(item.lowestPrice)}
              store={lowestProvider ? providerDisplayName(lowestProvider.provider) : null}
              cover={item.coverUrl}
              offersCount={item.offersCount}
              badge={isCheapest ? <Badge tone="green">Найкраща ціна</Badge> : null}
            />
          </Link>
        );
      })}
    </div>
  );
}
