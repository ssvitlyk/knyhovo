'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  SUGGEST_MIN_LENGTH,
  normalizeQuery,
  useSuggestions,
} from '@/components/search/useSuggestions';
import { KnhIcon } from './KnhIcon';
import { SearchSuggestions } from './SearchSuggestions';

/** Props for the {@link HeaderSearchForm} combobox. */
export interface HeaderSearchFormProps {
  /** `desktop` renders the `.knh__search` capsule; `mobile` the `.knh-so__panel`. */
  readonly variant: 'desktop' | 'mobile';
  /** Called after a navigation (submit or suggestion pick) — used to close the overlay. */
  readonly onNavigate?: () => void;
  /** Focus the field on mount (mobile overlay). */
  readonly autoFocusOnMount?: boolean;
}

const PLACEHOLDER = 'Пошук книги, автора або ISBN';

/**
 * The header search field, shared by the desktop capsule and the mobile
 * overlay: an ARIA 1.2 combobox whose listbox is a compact autocomplete
 * (`SearchSuggestions`) fed by {@link useSuggestions}.
 *
 * Full-search semantics are unchanged — submitting still navigates to
 * `/search?q=…`, independently of whether suggestions have loaded, and the
 * on-page `/search` Typeahead is untouched.
 */
export function HeaderSearchForm({
  variant,
  onNavigate,
  autoFocusOnMount = false,
}: HeaderSearchFormProps): React.JSX.Element {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [rawActiveIndex, setRawActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLFormElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { enabled, items, loading, error, settled, retry } = useSuggestions(value);

  const uid = useId();
  const listboxId = `knh-sg-${uid}`;
  const optionIdPrefix = `knh-sg-opt-${uid}`;

  const showDropdown = open && enabled;
  // Selectable options: one per book, plus the trailing "show all" action.
  const total = showDropdown && !loading && !error && items.length > 0 ? items.length + 1 : 0;
  const activeIndex = total === 0 ? -1 : Math.min(rawActiveIndex, total - 1);
  const showAllIndex = items.length;

  useEffect(() => {
    if (autoFocusOnMount) inputRef.current?.focus();
  }, [autoFocusOnMount]);

  // Close on click/tap outside the search root. Options use mousedown with
  // preventDefault, so a pick is seen here as an inside event and never closes
  // the dropdown before its own handler runs.
  useEffect(() => {
    if (!showDropdown) return undefined;
    function onDocumentMouseDown(e: MouseEvent): void {
      if (rootRef.current !== null && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setRawActiveIndex(-1);
      }
    }
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
    };
  }, [showDropdown]);

  function close(): void {
    setOpen(false);
    setRawActiveIndex(-1);
  }

  /** Navigate to the full results page. Never depends on suggestion state. */
  function goToSearch(): void {
    const q = normalizeQuery(value);
    if (q === '') return;
    close();
    router.push('/search?q=' + encodeURIComponent(q));
    onNavigate?.();
  }

  function goToBook(bookId: string): void {
    close();
    router.push('/books/' + bookId);
    onNavigate?.();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    goToSearch();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const next = e.target.value;
    setValue(next);
    setRawActiveIndex(-1);
    // An empty (or cleared) field closes the dropdown; below the minimum length
    // nothing is fetched, so there is nothing to show either.
    setOpen(normalizeQuery(next).length >= SUGGEST_MIN_LENGTH);
  }

  function handleClear(): void {
    setValue('');
    close();
    inputRef.current?.focus();
  }

  function handleFocus(): void {
    // Reopen only when the current query already has fresh results — no empty
    // dropdown flash on a plain focus.
    if (enabled && settled && items.length > 0) setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (enabled) setOpen(true);
        if (total > 0) setRawActiveIndex(activeIndex < total - 1 ? activeIndex + 1 : activeIndex);
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (total > 0) setRawActiveIndex(activeIndex > 0 ? activeIndex - 1 : 0);
        break;

      case 'Enter':
        // With an active option, pick it; otherwise fall through to the native
        // form submit so the mobile keyboard's Search key keeps working.
        if (showDropdown && activeIndex >= 0) {
          e.preventDefault();
          if (activeIndex === showAllIndex) goToSearch();
          else goToBook(items[activeIndex].id);
        }
        break;

      case 'Escape':
        if (showDropdown) {
          // Swallow it so the mobile overlay stays open — Escape first closes
          // the dropdown, a second Escape closes the overlay.
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        break;
    }
  }

  const dropdown = showDropdown ? (
    <SearchSuggestions
      listboxId={listboxId}
      optionIdPrefix={optionIdPrefix}
      items={items}
      loading={loading}
      error={error}
      activeIndex={activeIndex}
      variant={variant}
      onSelectBook={goToBook}
      onShowAll={goToSearch}
      onRetry={retry}
    />
  ) : null;

  const input = (
    <input
      ref={inputRef}
      type="search"
      role="combobox"
      aria-label={PLACEHOLDER}
      placeholder={PLACEHOLDER}
      aria-expanded={showDropdown}
      aria-controls={listboxId}
      aria-autocomplete="list"
      aria-activedescendant={activeIndex >= 0 ? `${optionIdPrefix}-${activeIndex}` : undefined}
      autoComplete="off"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
    />
  );

  const clearButton =
    value.length > 0 ? (
      <button type="button" className="knh__clear" aria-label="Очистити" onClick={handleClear}>
        <KnhIcon name="x" size={variant === 'desktop' ? 16 : 18} />
      </button>
    ) : null;

  if (variant === 'mobile') {
    return (
      <form ref={rootRef} className="knh-so__panel" role="search" onSubmit={handleSubmit}>
        <div className="knh-so__row">
          <div className="knh-so__field">
            <KnhIcon name="search" size={20} />
            {input}
            {clearButton}
          </div>
          <button type="submit" className="knh-so__go">
            Знайти
          </button>
        </div>
        {dropdown}
      </form>
    );
  }

  return (
    <form ref={rootRef} className="knh__search" role="search" onSubmit={handleSubmit}>
      <KnhIcon name="search" size={18} />
      {input}
      {clearButton}
      {dropdown}
    </form>
  );
}
