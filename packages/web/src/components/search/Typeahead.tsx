'use client';

import { useCallback } from 'react';
import { Search, X } from 'lucide-react';

import { formatMoney } from '@/lib/format';
import { SEARCH_MIN_QUERY_LENGTH } from '@/lib/search/config';
import { detectIsbn, looksLikeIsbn } from '@/lib/search/isbn';
import { normalizeSearchInput } from '@/lib/search/normalize';
import { useRecentSearches } from './useRecentSearches';
import {
  useSearchCombobox,
  useSearchNavigation,
  type ComboboxContext,
  type ComboboxOption,
} from './useSearchCombobox';

/** Props for the {@link Typeahead} combobox. */
export interface TypeaheadProps {
  readonly initialQuery: string;
}

/** Dropdown mode for the current field value — presentation only. */
type Mode = 'recent' | 'isbn' | 'too-short' | 'suggestions';

function modeOf(value: string, enabled: boolean): Mode {
  if (normalizeSearchInput(value) === '') return 'recent';
  if (looksLikeIsbn(value)) return 'isbn';
  return enabled ? 'suggestions' : 'too-short';
}

/**
 * ARIA 1.2 combobox + listbox typeahead for the `/search` field.
 *
 * The richest surface — it adds recent searches and ISBN detection on top of
 * live suggestions — but it owns no search logic: normalization, minimum query
 * length, debounce, abort, cache, stale-response protection, keyboard handling
 * and submit are the shared `useSearchCombobox` / `useSuggestions` pair, the
 * same instances the header and hero use.
 *
 * Modes: idle (recents) · ISBN ("Розпізнано ISBN") · below the minimum length
 * (hint, no request) · typing (loading / error / results).
 */
export function Typeahead({ initialQuery }: TypeaheadProps): React.JSX.Element {
  const { recent, clear: clearRecent } = useRecentSearches();
  const { goToSearch } = useSearchNavigation();

  const buildOptions = useCallback(
    ({ value, suggestions }: ComboboxContext): readonly ComboboxOption[] => {
      switch (modeOf(value, suggestions.enabled)) {
        case 'recent':
          return recent.map((query): ComboboxOption => ({ kind: 'query', query }));
        case 'isbn':
          return [{ kind: 'query', query: value }];
        case 'too-short':
          return [];
        case 'suggestions':
          if (suggestions.loading || suggestions.error) return [];
          return suggestions.items.map((item): ComboboxOption => ({ kind: 'book', id: item.id }));
      }
    },
    [recent],
  );

  const combobox = useSearchCombobox({
    initialValue: initialQuery,
    buildOptions,
    // Recents and the ISBN row are useful below the minimum query length, so
    // this surface may open whenever it is focused.
    canOpen: () => true,
    openOnFocus: () => true,
    // An ISBN is answered locally by the "Розпізнано ISBN" row — never fetched.
    shouldSuggest: (value) => !looksLikeIsbn(value),
  });

  const { value, suggestions, expanded, activeIndex, listboxId, optionId, rootRef, inputRef, selectOption } =
    combobox;
  const mode = modeOf(value, suggestions.enabled);

  /** mousedown (not click) so the field keeps focus and the pick counts as inside. */
  const pick = (index: number) => (e: React.MouseEvent): void => {
    e.preventDefault();
    selectOption(index);
  };

  const onClear = (): void => {
    combobox.clear();
    goToSearch('');
  };

  const renderDropdown = (): React.JSX.Element | null => {
    if (!expanded) return null;

    if (mode === 'recent') {
      return (
        <ul id={listboxId} role="listbox" aria-label="Підказки пошуку" className="si-ta__menu">
          <li role="presentation" className="si-ta__group">
            Нещодавні запити
          </li>
          {recent.length === 0 ? (
            <li role="presentation" className="si-ta__hint">
              Почніть вводити назву, автора або ISBN
            </li>
          ) : (
            <>
              {recent.map((q, i) => (
                <li
                  key={q}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === activeIndex}
                  data-active={i === activeIndex ? 'true' : undefined}
                  className="si-ta__row"
                  onMouseDown={pick(i)}
                >
                  {q}
                </li>
              ))}
              <li role="presentation" className="si-ta__row si-ta__row--action">
                <button
                  type="button"
                  className="si-ta__clear"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    clearRecent();
                  }}
                >
                  Очистити історію
                </button>
              </li>
            </>
          )}
        </ul>
      );
    }

    if (mode === 'isbn') {
      const detected = detectIsbn(value);
      return (
        <ul id={listboxId} role="listbox" aria-label="Підказки пошуку" className="si-ta__menu">
          <li
            id={optionId(0)}
            role="option"
            aria-selected={activeIndex === 0}
            data-active={activeIndex === 0 ? 'true' : undefined}
            className="si-ta__row si-ta__row--isbn"
            onMouseDown={pick(0)}
          >
            <span className="si-ta__row-primary">Розпізнано ISBN</span>
            {detected !== null && <span className="si-ta__row-sub">{detected.normalized}</span>}
            <span className="si-ta__row-hint">↵ щоб шукати</span>
          </li>
        </ul>
      );
    }

    if (mode === 'too-short') {
      return (
        <ul id={listboxId} role="listbox" aria-label="Підказки пошуку" className="si-ta__menu">
          <li role="presentation" className="si-ta__hint">
            Введіть щонайменше {SEARCH_MIN_QUERY_LENGTH} символи
          </li>
        </ul>
      );
    }

    return (
      <ul id={listboxId} role="listbox" aria-label="Підказки пошуку" className="si-ta__menu">
        {suggestions.loading && (
          <li role="presentation" className="si-ta__status" aria-busy="true">
            Шукаємо…
          </li>
        )}
        {!suggestions.loading && suggestions.error && (
          <li role="presentation" className="si-ta__status si-ta__status--error">
            Не вдалося завантажити підказки
            <button
              type="button"
              className="si-ta__retry"
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
          <li role="presentation" className="si-ta__status">
            Нічого не знайдено
          </li>
        )}
        {!suggestions.loading && !suggestions.error && suggestions.items.length > 0 && (
          <>
            <li role="presentation" className="si-ta__group">
              Книги
            </li>
            {suggestions.items.map((item, i) => (
              <li
                key={item.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                data-active={i === activeIndex ? 'true' : undefined}
                className="si-ta__row si-ta__row--book"
                onMouseDown={pick(i)}
              >
                <span className="si-ta__row-primary">{item.title}</span>
                <span className="si-ta__row-sub">· {item.author}</span>
                <span className="si-ta__row-price">{formatMoney(item.lowestPrice)}</span>
              </li>
            ))}
          </>
        )}
      </ul>
    );
  };

  return (
    <div className="si-typeahead" ref={rootRef}>
      <div className="kn-field">
        <span className="kn-field__icon">
          <Search aria-hidden="true" />
        </span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Назва книги, автора або ISBN…"
          placeholder="Назва книги, автора або ISBN…"
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
            onClick={onClear}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="kn-btn kn-btn--primary" onClick={combobox.submitCurrent}>
          Знайти
        </button>
      </div>

      {renderDropdown()}
    </div>
  );
}
