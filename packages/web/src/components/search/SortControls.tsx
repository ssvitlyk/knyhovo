'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Chip } from '@/components/ds/Chip';
import { SEARCH_SORT_LABELS, SEARCH_SORT_OPTIONS, type SearchSort } from './constants';

/** Minimal inline line icons (2px stroke, round caps) — matches the frozen `DynIcon` style. */
function ChevronDownIcon(): React.JSX.Element {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function ArrowUpDownIcon(): React.JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21 16-4 4-4-4" />
      <path d="M17 20V4" />
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
    </svg>
  );
}

function CheckIcon(): React.JSX.Element {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Custom listbox styled to the DS (native-select feel) — same recipe as Collection Details' `SortDropdown`. */
function SortDropdown({
  value,
  onChange,
}: {
  readonly value: SearchSort;
  readonly onChange: (sort: SearchSort) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="cd-sort" ref={ref}>
      <button
        type="button"
        className="cd-sort__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="cd-sort__val">
          <ArrowUpDownIcon />
          {SEARCH_SORT_LABELS[value]}
        </span>
        <span className="cd-sort__caret" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      {open ? (
        <ul className="cd-sort__menu" role="listbox" aria-label="Сортування">
          {SEARCH_SORT_OPTIONS.map((id) => (
            <li key={id}>
              <button
                type="button"
                role="option"
                aria-selected={id === value}
                className={'cd-sort__opt' + (id === value ? ' cd-sort__opt--active' : '')}
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
              >
                <span className={'cd-sort__check' + (id === value ? '' : ' cd-sort__check--hidden')}>
                  <CheckIcon />
                </span>
                {SEARCH_SORT_LABELS[id]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface SortControlsProps {
  readonly query: string;
  readonly sort: SearchSort;
}

/**
 * Search Results sort toolbar (search-sort PRD, unblocks the frozen Search
 * Results v1.0 "chips return once the API gains a sort parameter" note).
 * Desktop (≥768px): three chips — Найдешевші спочатку / Найпопулярніші /
 * Новинки. Mobile (<768px): the chips are hidden in favor of the same
 * listbox-dropdown recipe used by Collection Details' `SortBar`. The URL is
 * the single source of truth: choosing a sort replaces `?sort=` (omitted for
 * the default `price_asc`) and resets `page` to 1 (frozen rule), then
 * smooth-scrolls to top like `Pagination`.
 */
export function SortControls({ query, sort }: SortControlsProps): React.JSX.Element {
  const router = useRouter();

  function changeSort(next: SearchSort): void {
    const sortParam = next === 'price_asc' ? '' : `&sort=${next}`;
    router.push(`/search?q=${encodeURIComponent(query)}${sortParam}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="results__sort" role="group" aria-label="Сортування">
      <span className="results__sort-label">Сортування:</span>
      <div className="results__sort-chips">
        {SEARCH_SORT_OPTIONS.map((id) => (
          <Chip
            key={id}
            selected={id === sort}
            aria-current={id === sort ? 'true' : undefined}
            onClick={() => changeSort(id)}
          >
            {SEARCH_SORT_LABELS[id]}
          </Chip>
        ))}
      </div>
      <div className="results__sort-dd">
        <SortDropdown value={sort} onChange={changeSort} />
      </div>
    </div>
  );
}
