import React from 'react';
import Link from 'next/link';
import { BookCard } from '@/components/ds/BookCard';
import type { AuthorShelfBook, AuthorShelfSelection } from '@/lib/author-shelf/select';
import { selectAuthorShelf } from '@/lib/author-shelf/select';

/* ---- Icons (Lucide path data, 2px stroke — DS icon spec) ---- */
const AS_ICONS: Readonly<Record<string, readonly string[]>> = {
  'arrow-right': ['M5 12h14', 'm12 5 7 7-7 7'],
  library: ['m16 6 4 14', 'M12 6v14', 'M8 8v12', 'M4 4v16'],
};

function ASIcon({ name, size = 16 }: { readonly name: string; readonly size?: number }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {AS_ICONS[name]?.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

interface ASCardProps {
  readonly book: AuthorShelfBook;
}

function ASCard({ book }: ASCardProps): React.JSX.Element {
  return (
    <Link
      className="as-link"
      href={`/books/${book.id}`}
      aria-label={`Перейти до книги «${book.title}»`}
    >
      <BookCard
        title={book.title}
        author={book.author}
        price={book.price}
        store={book.store}
        cover={book.coverUrl}
        tabIndex={-1}
      />
    </Link>
  );
}

interface ASGridProps {
  readonly sel: AuthorShelfSelection;
  readonly wrapClass: string;
  readonly screenLabel: string;
  readonly authorHref: string;
  readonly stagger?: boolean;
}

function ASGrid({ sel, wrapClass, screenLabel, authorHref, stagger = false }: ASGridProps): React.JSX.Element | null {
  if (!sel.show) return null;
  const colStyle = { ['--as-cols']: sel.cols } as React.CSSProperties;
  return (
    <section className={`bd-section ${wrapClass}`} data-screen-label={screenLabel}>
      <div className="as-head">
        <h2 className="bd-h2">Інші книги автора</h2>
        {sel.hasMore ? (
          <a className="as-all" href={authorHref}>
            Усі книги автора ({sel.total}) <ASIcon name="arrow-right" size={15} />
          </a>
        ) : null}
      </div>
      <div
        className={'as-shelf' + (stagger ? ' as-stagger' : '')}
        data-count={sel.books.length}
        style={colStyle}
      >
        {sel.books.map(book => (
          <ASCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
}

export interface AuthorShelfProps {
  readonly currentId: string;
  readonly author: string;
  readonly roster: readonly AuthorShelfBook[];
  readonly seriesIds?: readonly string[];
}

/**
 * Author shelf — «Інші книги автора». Renders all three responsive wrappers
 * (.as-desktop · .as-tablet · .as-mobile); CSS shows exactly one per breakpoint.
 * Returns null when < 2 books are available (graceful omit).
 */
export function AuthorShelf({ currentId, author, roster, seriesIds = [] }: AuthorShelfProps): React.JSX.Element | null {
  const authorHref = `/search?q=${encodeURIComponent(author)}`;

  const selD = selectAuthorShelf({ currentId, roster, seriesIds, cap: 4 });
  const selT = selectAuthorShelf({ currentId, roster, seriesIds, cap: 3 });
  const selM = selectAuthorShelf({ currentId, roster, seriesIds, cap: 8 });

  // All three share the same total count — if desktop doesn't show, none will
  if (!selD.show) return null;

  return (
    <>
      <ASGrid
        sel={selD}
        wrapClass="as-desktop"
        screenLabel="Author shelf · «Інші книги автора»"
        authorHref={authorHref}
        stagger
      />
      <ASGrid
        sel={selT}
        wrapClass="as-tablet"
        screenLabel="Author shelf · tablet"
        authorHref={authorHref}
        stagger
      />
      {/* Mobile — horizontal rail */}
      {selM.show ? (
        <section className="bd-section as-mobile" data-screen-label="Author shelf · mobile">
          <h2 className="bd-h2">Інші книги автора</h2>
          <div className="as-shelf--mob">
            {selM.books.map(book => (
              <ASCard key={book.id} book={book} />
            ))}
            {selM.hasMore ? (
              <a
                className="as-railmore"
                href={authorHref}
                aria-label={`Усі книги автора, всього ${selM.total}`}
              >
                <ASIcon name="library" size={22} />
                <span>Усі книги автора</span>
                <small>{selM.total} книг</small>
              </a>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
