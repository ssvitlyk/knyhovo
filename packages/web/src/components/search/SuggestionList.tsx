'use client';

import { Cover } from '@/components/ds/Cover';
import type { SearchItemDto } from '@/lib/api/types';
import { formatMoney, providerDisplayName } from '@/lib/format';

/** Props for the {@link SuggestionList} listbox. */
export interface SuggestionListProps {
  /** BEM block prefix of the visual design (`knh-sg` header, `hp-sg` hero). */
  readonly classPrefix: string;
  /** Full `className` of the `<ul>` (the prefix plus any modifier). */
  readonly className: string;
  /** DOM id referenced by the combobox `aria-controls`. */
  readonly listboxId: string;
  /** Per-instance option id builder from the shared combobox hook. */
  readonly optionId: (index: number) => string;
  readonly items: readonly SearchItemDto[];
  readonly loading: boolean;
  readonly error: boolean;
  /** Index of the keyboard-active option, or -1 when none. */
  readonly activeIndex: number;
  /** Activate the book row at `index` (index matches the shared option list). */
  readonly onSelectBook: (index: number) => void;
  readonly onShowAll: () => void;
  readonly onRetry: () => void;
}

/**
 * Autocomplete listbox markup shared by the header capsule (`knh-sg`) and the
 * homepage hero (`hp-sg`): one line per book (cover · title · author · lowest
 * price · store) plus a trailing "show all" action. Selectable rows are
 * `role="option"`; loading, error and empty states are `role="presentation"` so
 * they never become keyboard targets. Only the class prefix differs between the
 * two surfaces — the design itself lives in CSS.
 */
export function SuggestionList({
  classPrefix: p,
  className,
  listboxId,
  optionId,
  items,
  loading,
  error,
  activeIndex,
  onSelectBook,
  onShowAll,
  onRetry,
}: SuggestionListProps): React.JSX.Element {
  const showAllIndex = items.length;

  // mousedown (not click) so the input keeps focus and the outside-click
  // listener sees the event as originating inside the search root.
  const select = (fn: () => void) => (e: React.MouseEvent): void => {
    e.preventDefault();
    fn();
  };

  return (
    <ul id={listboxId} role="listbox" aria-label="Підказки пошуку" className={className}>
      {loading && (
        <li role="presentation" className={`${p}__status`} aria-busy="true">
          <span className={`${p}__spinner`} aria-hidden="true" />
          Шукаємо…
        </li>
      )}

      {!loading && error && (
        <li role="presentation" className={`${p}__status ${p}__status--error`}>
          Не вдалося завантажити підказки
          <button type="button" className={`${p}__retry`} onMouseDown={select(onRetry)}>
            Повторити
          </button>
        </li>
      )}

      {!loading && !error && items.length === 0 && (
        <li role="presentation" className={`${p}__status`}>
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
              className={`${p}__row`}
              onMouseDown={select(() => onSelectBook(i))}
            >
              <Cover src={item.coverUrl} alt="" className={`${p}__cover`} placeholderAs="span" />
              <span className={`${p}__text`}>
                <span className={`${p}__title`}>{item.title}</span>
                {item.author ? <span className={`${p}__author`}>{item.author}</span> : null}
              </span>
              <span className={`${p}__meta`}>
                <span className={`${p}__price`}>{formatMoney(item.lowestPrice)}</span>
                {store ? (
                  <span className={`${p}__store`}>{providerDisplayName(store.provider)}</span>
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
          className={`${p}__row ${p}__row--action`}
          onMouseDown={select(onShowAll)}
        >
          Показати всі результати
        </li>
      )}
    </ul>
  );
}
