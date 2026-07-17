'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { WishlistItemDto } from '@/lib/api/types';
import { formatMoney, knBookWord } from '@/lib/format';
import { WishlistDropdown, type WishlistDropdownOption } from './WishlistDropdown';
import { WishlistPagination } from './WishlistPagination';

const PER_PAGE = 10;
const ALL_GENRE = 'all';

type SortId = 'added' | 'title' | 'author';

const SORTS: Readonly<Record<SortId, { label: string; compare: (a: WishlistItemDto, b: WishlistItemDto) => number }>> = {
  added: {
    label: 'Нещодавно додані',
    compare: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  },
  title: {
    label: 'За назвою',
    compare: (a, b) => a.book.title.localeCompare(b.book.title, 'uk'),
  },
  author: {
    label: 'За автором',
    compare: (a, b) =>
      a.book.author.localeCompare(b.book.author, 'uk') || a.book.title.localeCompare(b.book.title, 'uk'),
  },
};

const SORT_OPTIONS: readonly WishlistDropdownOption[] = (Object.keys(SORTS) as SortId[]).map((id) => ({
  id,
  label: SORTS[id].label,
}));

export interface RestOfWishlistProps {
  readonly items: readonly WishlistItemDto[];
}

/**
 * «Решта бажанок» — genre filter + sort + paginated grid, port of `WL21Rest`.
 * The whole card is the tappable link (no separate «Деталі» button, per the
 * 2026-07-13 `.bkc` redesign). Out-of-stock books show `bkc--out` + an em dash
 * instead of a price. Density stays the frozen `.wl21-grid` default (no
 * Tweaks panel in production).
 */
export function RestOfWishlist({ items }: RestOfWishlistProps): React.JSX.Element {
  const [genre, setGenre] = useState<string>(ALL_GENRE);
  const [sort, setSort] = useState<SortId>('added');
  const [page, setPage] = useState(1);

  const genreOptions = useMemo<WishlistDropdownOption[]>(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const item of items) {
      const g = item.book.genre;
      if (g == null) continue;
      const existing = counts.get(g.slug);
      if (existing) existing.count += 1;
      else counts.set(g.slug, { name: g.name, count: 1 });
    }
    const sorted = [...counts.entries()].sort(
      ([, a], [, b]) => b.count - a.count || a.name.localeCompare(b.name, 'uk'),
    );
    return [
      { id: ALL_GENRE, label: 'Усі жанри', count: items.length },
      ...sorted.map(([slug, { name, count }]) => ({ id: slug, label: name, count })),
    ];
  }, [items]);

  const filtered = useMemo(
    () => (genre === ALL_GENRE ? items : items.filter((item) => item.book.genre?.slug === genre)),
    [items, genre],
  );
  const sorted = useMemo(() => [...filtered].sort(SORTS[sort].compare), [filtered, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const safePage = Math.min(page, pages);
  const slice = sorted.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const currentGenreLabel =
    genre === ALL_GENRE ? 'Усі жанри' : (genreOptions.find((o) => o.id === genre)?.label ?? 'Усі жанри');

  return (
    <div className="sec" data-screen-label="Решта бажанок">
        <div className="sec-head">
          <div className="sec-head__left">
            <h2 className="sec-title">Решта бажанок</h2>
            <p className="sec-sub">
              Книговик стежить далі — щойно ціна впаде, книга підніметься нагору.
            </p>
          </div>
        </div>
        <div className="wl21-sortbar">
          <span className="wl21-count">
            {genre === ALL_GENRE
              ? `${items.length} ${knBookWord(items.length)}`
              : `${filtered.length} · ${currentGenreLabel}`}
            {pages > 1 ? ` · сторінка ${safePage} з ${pages}` : ''}
          </span>
          <div className="wl21-controls">
            <WishlistDropdown
              icon="book-open"
              ariaLabel="Фільтр за жанром"
              value={genre}
              valueLabel={currentGenreLabel}
              options={genreOptions}
              onChange={(g) => {
                setGenre(g);
                setPage(1);
              }}
            />
            <WishlistDropdown
              icon="arrow-up-down"
              ariaLabel="Сортування бажанок"
              value={sort}
              valueLabel={SORTS[sort].label}
              options={SORT_OPTIONS}
              onChange={(s) => {
                setSort(s as SortId);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="wl21-grid">
          {slice.map((item) => {
            const { book } = item;
            const out = book.lowestPrice == null;
            return (
              <Link
                className={`bkc${out ? ' bkc--out' : ''}`}
                key={book.id}
                href={`/books/${book.id}`}
                aria-label={
                  book.title +
                  ' — ' +
                  book.author +
                  (book.lowestPrice != null ? `, ${formatMoney(book.lowestPrice)}` : '')
                }
              >
                <span className="bkc__coverclip">
                  {book.coverUrl != null ? (
                    <img className="bkc__cover" src={book.coverUrl} alt="" loading="lazy" />
                  ) : null}
                </span>
                <span className="bkc__body">
                  <span className="bkc__title">{book.title}</span>
                  <span className="bkc__author">{book.author}</span>
                  {book.lowestPrice != null ? (
                    <span className="bkc__price">{formatMoney(book.lowestPrice)}</span>
                  ) : (
                    <span className="bkc__price bkc__price--none">—</span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
        <WishlistPagination page={safePage} pages={pages} onPage={setPage} />
    </div>
  );
}
