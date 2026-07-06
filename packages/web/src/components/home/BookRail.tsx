import Link from 'next/link';
import { BookCard } from '@/components/ds/BookCard';
import { renderBadge } from './renderBadge';
import type { HomeBook } from './content';

export interface BookRailProps {
  readonly books: readonly HomeBook[];
}

/**
 * Horizontal scroll rail of frozen `BookCard`s (the `.hp-rail` page-level
 * layout override; the DS component itself is untouched). Shared by every
 * homepage shelf. Each card links to its Book Details page (pattern mirrors
 * `ResultsGrid`). Server component — `BookCard` → `Cover` is the client seam.
 */
export function BookRail({ books }: BookRailProps): React.JSX.Element {
  return (
    <div className="hp-rail">
      {books.map((b) => (
        <Link key={b.id} href={b.href} className="hp-rail__card-link">
          <BookCard
            title={b.title}
            author={b.author}
            price={b.price}
            oldPrice={b.oldPrice}
            store={b.store}
            cover={b.cover}
            offersCount={b.offersCount}
            badge={renderBadge(b.badge)}
          />
        </Link>
      ))}
    </div>
  );
}
