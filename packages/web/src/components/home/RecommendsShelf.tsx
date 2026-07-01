import Link from 'next/link';
import { BookRail } from './BookRail';
import { Chevron } from './Chevron';
import type { HomeBook } from './content';

export interface RecommendsShelfProps {
  readonly books: readonly HomeBook[];
  /** Where the CTA / chevron navigate — a canonical `/search` catalog link. */
  readonly ctaHref: string;
}

/**
 * «Книговик радить» — editorial curated shelf (books only). Set apart by the
 * approved Wishlist visual language (framed `--surface-accent` panel + green
 * hairline) with Книговик's avatar inline next to the title. Reuses the same
 * frozen `BookCard` rail as the other shelves. Empty → hidden (frozen spec §7).
 * Server component.
 */
export function RecommendsShelf({ books, ctaHref }: RecommendsShelfProps): React.JSX.Element | null {
  if (books.length === 0) return null;
  return (
    <section className="hp-recommends hp-recommends--framed">
      <div className="hp-recommends__head">
        <div className="hp-recommends__heading">
          <div className="hp-recommends__titlerow">
            <h2 className="hp-recommends__title">Книговик радить</h2>
            <img className="hp-recommends__mascot" src="/mascot/avatarAtention.png" alt="Книговик" />
            <Link className="hp-recommends__chev" href={ctaHref} aria-label="Уся добірка">
              <Chevron />
            </Link>
          </div>
        </div>
        <Link className="kn-btn kn-btn--ghost kn-btn--sm hp-recommends__all" href={ctaHref}>
          Усі →
        </Link>
      </div>
      <BookRail books={books} />
    </section>
  );
}
