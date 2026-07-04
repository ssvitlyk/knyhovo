'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SORT_LABELS, type UiSort } from '@/lib/collections/sort';
import { DynIcon } from './icons';

/** Custom listbox styled to the DS (native-select feel) — frozen `SortDropdown`. */
function SortDropdown({
  value,
  options,
  onChange,
}: {
  readonly value: UiSort;
  readonly options: readonly UiSort[];
  readonly onChange: (sort: UiSort) => void;
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
          <DynIcon name="arrow-up-down" size={16} />
          {SORT_LABELS[value]}
        </span>
        <span className="cd-sort__caret" aria-hidden="true">
          <DynIcon name="chevron-down" size={18} />
        </span>
      </button>
      {open ? (
        <ul className="cd-sort__menu" role="listbox" aria-label="Сортування">
          {options.map((id) => (
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
                  <DynIcon name="check" size={16} />
                </span>
                {SORT_LABELS[id]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface SortBarProps {
  readonly sort: UiSort;
  readonly options: readonly UiSort[];
}

/**
 * Sticky sort bar — the single control of the Collection Details template.
 * The URL is the single source of truth: choosing a sort replaces `?sort=` and
 * resets the page to 1. Gets the stuck treatment past 96px of scroll (frozen).
 */
export function SortBar({ sort, options }: SortBarProps): React.JSX.Element {
  const [stuck, setStuck] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function onScroll(): void {
      setStuck(window.scrollY > 96);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function changeSort(next: UiSort): void {
    // Sort change → page reset to 1 (page param dropped).
    router.push(`${pathname}?sort=${next}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className={'cd-sortbar' + (stuck ? ' cd-sortbar--stuck' : '')}>
      <div className="cd-sortbar__row">
        <SortDropdown value={sort} options={options} onChange={changeSort} />
      </div>
    </div>
  );
}
