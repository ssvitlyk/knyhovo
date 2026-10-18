'use client';

import { SuggestionList } from '@/components/search/SuggestionList';
import type { SearchItemDto } from '@/lib/api/types';

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
  return (
    <SuggestionList
      classPrefix="knh-sg"
      className={'knh-sg' + (variant === 'mobile' ? ' knh-sg--mobile' : '')}
      listboxId={listboxId}
      optionId={optionId}
      items={items}
      loading={loading}
      error={error}
      activeIndex={activeIndex}
      onSelectBook={onSelectBook}
      onShowAll={onShowAll}
      onRetry={onRetry}
    />
  );
}
