'use client';

import { useEffect } from 'react';

import {
  useSearchCombobox,
  type ComboboxContext,
  type ComboboxOption,
} from '@/components/search/useSearchCombobox';
import { normalizeSearchInput } from '@/lib/search/normalize';
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
 * Selectable rows in the header dropdown: one per book, plus a trailing
 * "show all results" action. Nothing is selectable while loading, on error, or
 * with no hits — those rows are status text, not options.
 */
function buildHeaderOptions({ value, suggestions }: ComboboxContext): readonly ComboboxOption[] {
  if (suggestions.loading || suggestions.error || suggestions.items.length === 0) return [];
  return [
    ...suggestions.items.map((item): ComboboxOption => ({ kind: 'book', id: item.id })),
    { kind: 'query', query: normalizeSearchInput(value) },
  ];
}

/**
 * The header search field, shared by the desktop capsule and the mobile
 * overlay: an ARIA 1.2 combobox whose listbox is a compact autocomplete
 * (`SearchSuggestions`).
 *
 * Presentation only — value, debounce, abort, cache, keyboard navigation and
 * submit all come from the shared `useSearchCombobox` / `useSuggestions` pair,
 * exactly as on the homepage hero and the `/search` typeahead.
 */
export function HeaderSearchForm({
  variant,
  onNavigate,
  autoFocusOnMount = false,
}: HeaderSearchFormProps): React.JSX.Element {
  const combobox = useSearchCombobox({ buildOptions: buildHeaderOptions, onNavigate });
  const {
    value,
    suggestions,
    expanded,
    options,
    activeIndex,
    listboxId,
    optionId,
    activeDescendantId,
    rootRef,
    inputRef,
    focusInput,
    selectOption,
    clear,
  } = combobox;

  useEffect(() => {
    if (autoFocusOnMount) focusInput();
  }, [autoFocusOnMount, focusInput]);

  const dropdown = expanded ? (
    <SearchSuggestions
      listboxId={listboxId}
      optionId={optionId}
      items={suggestions.items}
      loading={suggestions.loading}
      error={suggestions.error}
      activeIndex={activeIndex}
      variant={variant}
      onSelectBook={(index) => {
        selectOption(index);
      }}
      onShowAll={() => {
        selectOption(options.length - 1);
      }}
      onRetry={suggestions.retry}
    />
  ) : null;

  const input = (
    <input
      ref={inputRef}
      type="search"
      role="combobox"
      aria-label={PLACEHOLDER}
      placeholder={PLACEHOLDER}
      aria-expanded={expanded}
      aria-controls={listboxId}
      aria-autocomplete="list"
      aria-activedescendant={activeDescendantId}
      autoComplete="off"
      value={value}
      onChange={combobox.onChange}
      onKeyDown={combobox.onKeyDown}
      onFocus={combobox.onFocus}
      onClick={combobox.onClick}
    />
  );

  const clearButton =
    value.length > 0 ? (
      <button type="button" className="knh__clear" aria-label="Очистити" onClick={clear}>
        <KnhIcon name="x" size={variant === 'desktop' ? 16 : 18} />
      </button>
    ) : null;

  if (variant === 'mobile') {
    return (
      <form ref={rootRef} className="knh-so__panel" role="search" onSubmit={combobox.onSubmit}>
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
    <form ref={rootRef} className="knh__search" role="search" onSubmit={combobox.onSubmit}>
      <KnhIcon name="search" size={18} />
      {input}
      {clearButton}
      {dropdown}
    </form>
  );
}
