'use client';

import { useEffect, useRef, useState } from 'react';
import { CollectionIcon } from './icons';
import { SORT_OPTIONS, SORT_LABELS, type CollectionSort } from './sortOptions';

export { SORT_OPTIONS, SORT_LABELS, type CollectionSort };

export interface SortDropdownProps {
  readonly value: CollectionSort;
  readonly onChange: (next: CollectionSort) => void;
}

/**
 * Custom listbox styled to the DS (native-select feel), ported verbatim from
 * the frozen `SortDropdown`. Closes on outside click or Escape.
 */
export function SortDropdown({ value, onChange }: SortDropdownProps): React.JSX.Element {
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
          <CollectionIcon name="arrow-up-down" size={16} />
          {SORT_LABELS[value]}
        </span>
        <span className="cd-sort__caret" aria-hidden="true">
          <CollectionIcon name="chevron-down" size={18} />
        </span>
      </button>
      {open ? (
        <ul className="cd-sort__menu" role="listbox" aria-label="Сортування">
          {SORT_OPTIONS.map((id) => (
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
                  <CollectionIcon name="check" size={16} />
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
