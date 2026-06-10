'use client';

import type { KeyboardEvent } from 'react';
import { Search } from 'lucide-react';

export interface SearchBarProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSearch: (value: string) => void;
  readonly placeholder?: string;
  readonly buttonLabel?: string;
  readonly className?: string;
}

/**
 * Knyhovo DS SearchBar — the frozen `.kn-field` capsule (icon + input + primary
 * button). Mirrors the reference `components/forms/SearchBar.jsx`; the lucide
 * `search` glyph is rendered via `lucide-react` to keep the visual language.
 */
export function SearchBar({
  value,
  onChange,
  onSearch,
  placeholder = 'Назва книги, автора або ISBN…',
  buttonLabel = 'Знайти',
  className = '',
}: SearchBarProps): React.JSX.Element {
  const handleKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') onSearch(value);
  };
  const classes = ['kn-field', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <span className="kn-field__icon">
        <Search aria-hidden="true" />
      </span>
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        aria-label={placeholder}
      />
      <button type="button" className="kn-btn kn-btn--primary" onClick={() => onSearch(value)}>
        {buttonLabel}
      </button>
    </div>
  );
}
