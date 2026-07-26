'use client';

import { Cover } from '@/components/ds/Cover';
import type { SearchItemDto } from '@/lib/api/types';
import { formatMoney, providerDisplayName } from '@/lib/format';

/** Props for the {@link SearchSuggestions} listbox. */
export interface SearchSuggestionsProps {
  /** DOM id referenced by the combobox `aria-controls`. */
  readonly listboxId: string;
  /** Per-instance option id builder from the shared combobox hook. */
  readonly optionId: (index: number) => string;
  readonly items: readonly SearchItemDto[];
  readonly loading: boolean;
  readonly error: boolean;
  /** Index of the keyboard-active option, or -1 when none. */
  readonly activeIndex: number;
  /** `desktop` floats under the capsule; `mobile` flows inside the overlay panel. */
  readonly variant: 'desktop' | 'mobile';
  /** Activate the book row at `index` (index matches the shared option list). */
  readonly onSelectBook: (index: number) => void;
  readonly onShowAll: () => void;
  readonly onRetry: () => void;
}

/**
 * Compact autocomplete listbox rendered under the header search field.
 *
 * Deliberately NOT a copy of the `/search` results page: one line per book
 * (cover · title · author · lowest price · store) plus a "show all" action that
 * hands off to `/search?q=…`. Selectable rows are `role="option"`; loading,
 * error and empty states are `role="presentation"` so they never become
 * keyboard targets.
 */
export function SearchSuggestions({
  listboxId,
  optionId,
  items,
  loading,
  error,
  activeIndex,
  variant,
  onSelectBook,
  onShowAll,
  onRetry,
}: SearchSuggestionsProps): React.JSX.Element {
  const showAllIndex = items.length;

  // mousedown (not click) so the input keeps focus and the outside-click
  // listener sees the event as originating inside the search root.
  const select = (fn: () => void) => (e: React.MouseEvent): void => {
    e.preventDefault();
    fn();
  };

  return (
    <ul
      id={listboxId}
      role="listbox"
      aria-label="Підказки пошуку"
      className={'knh-sg' + (variant === 'mobile' ? ' knh-sg--mobile' : '')}
    >
      {loading && (
        <li role="presentation" className="knh-sg__status" aria-busy="true">
          <span className="knh-sg__spinner" aria-hidden="true" />
          Шукаємо…
        </li>
      )}

      {!loading && error && (
        <li role="presentation" className="knh-sg__status knh-sg__status--error">
          Не вдалося завантажити підказки
          <button type="button" className="knh-sg__retry" onMouseDown={select(onRetry)}>
            Повторити
          </button>
        </li>
      )}

      {!loading && !error && items.length === 0 && (
        <li role="presentation" className="knh-sg__status">
          Нічого не знайдено
        </li>
      )}

      {!loading &&
        !error &&
        items.map((item, i) => {
          const store = item.providers[0];
          return (
            <li
              key={item.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              data-active={i === activeIndex ? 'true' : undefined}
              className="knh-sg__row"
              onMouseDown={select(() => onSelectBook(i))}
            >
              <Cover
                src={item.coverUrl}
                alt=""
                className="knh-sg__cover"
                placeholderAs="span"
              />
              <span className="knh-sg__text">
                <span className="knh-sg__title">{item.title}</span>
                {item.author ? <span className="knh-sg__author">{item.author}</span> : null}
              </span>
              <span className="knh-sg__meta">
                <span className="knh-sg__price">{formatMoney(item.lowestPrice)}</span>
                {store ? (
                  <span className="knh-sg__store">{providerDisplayName(store.provider)}</span>
                ) : null}
              </span>
            </li>
          );
        })}

      {!loading && !error && items.length > 0 && (
        <li
          id={optionId(showAllIndex)}
          role="option"
          aria-selected={showAllIndex === activeIndex}
          data-active={showAllIndex === activeIndex ? 'true' : undefined}
          className="knh-sg__row knh-sg__row--action"
          onMouseDown={select(onShowAll)}
        >
          Показати всі результати
        </li>
      )}
    </ul>
  );
}
