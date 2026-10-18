'use client';

import { Search, X } from 'lucide-react';

import {
  useSearchCombobox,
  type ComboboxContext,
  type ComboboxOption,
} from '@/components/search/useSearchCombobox';
import { SuggestionList } from '@/components/search/SuggestionList';
import { normalizeSearchInput } from '@/lib/search/normalize';

const PLACEHOLDER = 'Назва книги, автора або ISBN…';

/**
 * Selectable rows in the hero dropdown: one per book plus the trailing
 * "show all results" action — the same option shape the header uses, so both
 * behave identically under the keyboard.
 */
function buildHeroOptions({ value, suggestions }: ComboboxContext): readonly ComboboxOption[] {
  if (suggestions.loading || suggestions.error || suggestions.items.length === 0) return [];
  return [
    ...suggestions.items.map((item): ComboboxOption => ({ kind: 'book', id: item.id })),
    { kind: 'query', query: normalizeSearchInput(value) },
  ];
}

/**
 * Homepage hero search — the frozen `.kn-field` capsule plus a live
 * autocomplete panel (`.hp-sg`) with its own, roomier design: bigger covers and
 * a two-line book row, sized for the hero rather than the header strip.
 *
 * The *design* is the only thing this file owns. Query normalization, minimum
 * length, debounce, abort, cache, stale-response protection, loading/empty/
 * error states, keyboard navigation and submit are the shared
 * `useSearchCombobox` / `useSuggestions` pair — byte-for-byte the same logic as
 * the header capsule, the mobile overlay and the `/search` typeahead.
 */
export function HeroSearch(): React.JSX.Element {
  const combobox = useSearchCombobox({ buildOptions: buildHeroOptions });
  const {
    value,
    suggestions,
    expanded,
    options,
    activeIndex,
    listboxId,
    optionId,
    rootRef,
    inputRef,
    selectOption,
    clear,
  } = combobox;

  return (
    <form className="hero__search" role="search" ref={rootRef} onSubmit={combobox.onSubmit}>
      <div className="kn-field">
        <span className="kn-field__icon">
          <Search aria-hidden="true" />
        </span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={PLACEHOLDER}
          placeholder={PLACEHOLDER}
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={combobox.activeDescendantId}
          autoComplete="off"
          value={value}
          onChange={combobox.onChange}
          onKeyDown={combobox.onKeyDown}
          onFocus={combobox.onFocus}
          onClick={combobox.onClick}
        />
        {value.length > 0 && (
          <button
            type="button"
            className="kn-field__clear"
            aria-label="Очистити запит"
            onClick={clear}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
        <button type="submit" className="kn-btn kn-btn--primary">
          Знайти
        </button>
      </div>

      {expanded && (
        <SuggestionList
          classPrefix="hp-sg"
          className="hp-sg"
          listboxId={listboxId}
          optionId={optionId}
          items={suggestions.items}
          loading={suggestions.loading}
          error={suggestions.error}
          activeIndex={activeIndex}
          onSelectBook={selectOption}
          onShowAll={() => selectOption(options.length - 1)}
          onRetry={suggestions.retry}
        />
      )}
    </form>
  );
}
