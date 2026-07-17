'use client';

import { useEffect, useRef, useState } from 'react';
import { DynIcon } from '@/components/collections/icons';

export interface WishlistDropdownOption {
  readonly id: string;
  readonly label: string;
  readonly count?: number;
}

export interface WishlistDropdownProps {
  readonly value: string;
  readonly options: readonly WishlistDropdownOption[];
  readonly onChange: (id: string) => void;
  readonly icon: string;
  readonly ariaLabel: string;
  readonly valueLabel: string;
}

/**
 * Universal dropdown — port of `WL21Dropdown` (the frozen `cd-sort` recipe,
 * `collections.css`). Outside-click + Escape close, `role="listbox"`.
 */
export function WishlistDropdown({
  value,
  options,
  onChange,
  icon,
  ariaLabel,
  valueLabel,
}: WishlistDropdownProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
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
          <DynIcon name={icon} size={16} />
          {valueLabel}
        </span>
        <span className="cd-sort__caret">
          <DynIcon name="chevron-down" size={18} />
        </span>
      </button>
      {open ? (
        <ul className="cd-sort__menu" role="listbox" aria-label={ariaLabel}>
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                role="option"
                aria-selected={opt.id === value}
                className={`cd-sort__opt${opt.id === value ? ' cd-sort__opt--active' : ''}`}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
              >
                <span className={`cd-sort__check${opt.id === value ? '' : ' cd-sort__check--hidden'}`}>
                  <DynIcon name="check" size={16} />
                </span>
                {opt.label}
                {opt.count != null ? <span className="cd-sort__optcount">{opt.count}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
