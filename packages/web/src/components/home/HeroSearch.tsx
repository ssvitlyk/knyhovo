'use client';

import { Search, X } from 'lucide-react';

import { Cover } from '@/components/ds/Cover';
import {
  useSearchCombobox,
  type ComboboxContext,
  type ComboboxOption,
} from '@/components/search/useSearchCombobox';
import { formatMoney, providerDisplayName } from '@/lib/format';
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

  /** mousedown (not click) so the field keeps focus and the pick counts as inside. */
  const pick = (index: number) => (e: React.MouseEvent): void => {
    e.preventDefault();
    selectOption(index);
  };

  const showAllIndex = options.length - 1;

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
        <ul id={listboxId} role="listbox" aria-label="Підказки пошуку" className="hp-sg">
          {suggestions.loading && (
            <li role="presentation" className="hp-sg__status" aria-busy="true">
              <span className="hp-sg__spinner" aria-hidden="true" />
              Шукаємо…
            </li>
          )}

          {!suggestions.loading && suggestions.error && (
            <li role="presentation" className="hp-sg__status hp-sg__status--error">
              Не вдалося завантажити підказки
              <button
                type="button"
                className="hp-sg__retry"
                onMouseDown={(e) => {
                  e.preventDefault();
                  suggestions.retry();
                }}
              >
                Повторити
              </button>
            </li>
          )}

          {!suggestions.loading && !suggestions.error && suggestions.items.length === 0 && (
            <li role="presentation" className="hp-sg__status">
              Нічого не знайдено
            </li>
          )}

          {!suggestions.loading &&
            !suggestions.error &&
            suggestions.items.map((item, i) => {
              const store = item.providers[0];
              return (
                <li
                  key={item.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === activeIndex}
                  data-active={i === activeIndex ? 'true' : undefined}
                  className="hp-sg__row"
                  onMouseDown={pick(i)}
                >
                  <Cover src={item.coverUrl} alt="" className="hp-sg__cover" placeholderAs="span" />
                  <span className="hp-sg__text">
                    <span className="hp-sg__title">{item.title}</span>
                    {item.author ? <span className="hp-sg__author">{item.author}</span> : null}
                  </span>
                  <span className="hp-sg__meta">
                    <span className="hp-sg__price">{formatMoney(item.lowestPrice)}</span>
                    {store ? (
                      <span className="hp-sg__store">{providerDisplayName(store.provider)}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}

          {!suggestions.loading && !suggestions.error && suggestions.items.length > 0 && (
            <li
              id={optionId(showAllIndex)}
              role="option"
              aria-selected={showAllIndex === activeIndex}
              data-active={showAllIndex === activeIndex ? 'true' : undefined}
              className="hp-sg__row hp-sg__row--action"
              onMouseDown={pick(showAllIndex)}
            >
              Показати всі результати
            </li>
          )}
        </ul>
      )}
    </form>
  );
}
