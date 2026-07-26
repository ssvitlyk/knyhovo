'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { searchResultsHref } from '@/lib/search/config';
import { normalizeSearchInput } from '@/lib/search/normalize';
import { addRecentSearch } from '@/lib/search/recentSearches';
import { useSuggestions, type SuggestionsState } from './useSuggestions';

/**
 * A selectable row in any search dropdown. Only two outcomes exist app-wide:
 * open a book, or run a query on `/search`. Recents, the ISBN row and the
 * "show all results" action are all `query` options.
 */
export type ComboboxOption =
  | { readonly kind: 'book'; readonly id: string }
  | { readonly kind: 'query'; readonly query: string };

/** Snapshot handed to the per-surface policies below. */
export interface ComboboxContext {
  /** Raw, unnormalized field value. */
  readonly value: string;
  readonly suggestions: SuggestionsState;
}

export interface UseSearchComboboxArgs {
  /** Initial field value (e.g. `?q=` on `/search`). */
  readonly initialValue?: string;
  /** Selectable options for the current state, in DOM order. */
  readonly buildOptions: (ctx: ComboboxContext) => readonly ComboboxOption[];
  /**
   * May the dropdown be shown at all for this state? Default: only once the
   * query is long enough to be searched. `/search` overrides it because it also
   * shows recents and the ISBN row below the minimum length.
   */
  readonly canOpen?: (ctx: ComboboxContext) => boolean;
  /**
   * Should focusing the field open the dropdown? Default: only when the current
   * query already has settled results, so a plain focus never flashes an empty
   * or loading panel.
   */
  readonly openOnFocus?: (ctx: ComboboxContext) => boolean;
  /**
   * May this value be sent to the suggestion API at all? Default: yes. `/search`
   * returns `false` for ISBN-shaped input, which it answers locally with a
   * "Розпізнано ISBN" row — so no request is wasted on it.
   */
  readonly shouldSuggest?: (value: string) => boolean;
  /** Called after any navigation — used by the mobile overlay to close itself. */
  readonly onNavigate?: () => void;
}

/** Everything a presentation wrapper needs; no surface owns search state itself. */
export interface SearchCombobox {
  readonly value: string;
  readonly setValue: (next: string) => void;
  readonly suggestions: SuggestionsState;
  /** Dropdown visibility: user intent AND the surface's `canOpen` policy. */
  readonly expanded: boolean;
  readonly options: readonly ComboboxOption[];
  /** Index of the keyboard-active option, or -1. Always within `options`. */
  readonly activeIndex: number;
  readonly listboxId: string;
  /** Stable per-instance option id — unique even with several comboboxes mounted. */
  readonly optionId: (index: number) => string;
  readonly activeDescendantId: string | undefined;
  /** Attach to the element that wraps field + dropdown (outside-click detection). */
  readonly rootRef: (node: HTMLElement | null) => void;
  /** Attach to the `<input>` itself. */
  readonly inputRef: (node: HTMLInputElement | null) => void;
  /** Move focus into the field (mobile overlay autofocus). */
  readonly focusInput: () => void;
  readonly onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readonly onFocus: () => void;
  /** Same as `onFocus`; needed because a click on an already-focused field fires no focus event. */
  readonly onClick: () => void;
  readonly onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  readonly onSubmit: (e: React.FormEvent) => void;
  /** Clear the field, close the dropdown, keep focus. */
  readonly clear: () => void;
  readonly close: () => void;
  /** Activate option `index` (used by pointer handlers). */
  readonly selectOption: (index: number) => void;
  /** Navigate to `/search` for the current field value. */
  readonly submitCurrent: () => void;
}

const defaultCanOpen = (ctx: ComboboxContext): boolean => ctx.suggestions.enabled;

const defaultOpenOnFocus = (ctx: ComboboxContext): boolean =>
  ctx.suggestions.enabled && ctx.suggestions.settled && ctx.suggestions.items.length > 0;

/**
 * Shared navigation for everything that starts a search — the combobox itself
 * and non-field entry points such as the hero's "популярне" chips. Keeps one
 * URL shape, one normalization and one recents policy.
 */
export function useSearchNavigation(onNavigate?: () => void): {
  readonly goToSearch: (rawQuery: string) => void;
  readonly goToBook: (bookId: string, rawQuery?: string) => void;
} {
  const router = useRouter();

  const goToSearch = useCallback(
    (rawQuery: string): void => {
      const q = normalizeSearchInput(rawQuery);
      if (q !== '') addRecentSearch(q);
      router.push(searchResultsHref(q));
      onNavigate?.();
    },
    [router, onNavigate],
  );

  const goToBook = useCallback(
    (bookId: string, rawQuery = ''): void => {
      const q = normalizeSearchInput(rawQuery);
      if (q !== '') addRecentSearch(q);
      router.push(`/books/${bookId}`);
      onNavigate?.();
    },
    [router, onNavigate],
  );

  return { goToSearch, goToBook };
}

/**
 * The single combobox behaviour engine: field value, open/close, keyboard
 * navigation, ARIA wiring and submit. All data (debounce, abort, cache, stale
 * protection, loading/error) comes from {@link useSuggestions}; this hook adds
 * no fetching of its own.
 *
 * Surfaces supply only presentation and two small policies (`canOpen`,
 * `openOnFocus`) — they never re-implement any of the behaviour below.
 */
export function useSearchCombobox({
  initialValue = '',
  buildOptions,
  canOpen = defaultCanOpen,
  openOnFocus = defaultOpenOnFocus,
  shouldSuggest = () => true,
  onNavigate,
}: UseSearchComboboxArgs): SearchCombobox {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [rawActiveIndex, setRawActiveIndex] = useState(-1);
  // Nothing is fetched for a pre-filled field until the user actually touches
  // it — `/search` already rendered those results server-side.
  const [engaged, setEngaged] = useState(false);

  // Callback refs: the hook keeps the nodes to itself so no ref object leaks
  // into a caller's render (and every surface skips the wiring boilerplate).
  const rootNode = useRef<HTMLElement | null>(null);
  const inputNode = useRef<HTMLInputElement | null>(null);
  const rootRef = useCallback((node: HTMLElement | null): void => {
    rootNode.current = node;
  }, []);
  const inputRef = useCallback((node: HTMLInputElement | null): void => {
    inputNode.current = node;
  }, []);
  const focusInput = useCallback((): void => {
    inputNode.current?.focus();
  }, []);

  const suggestions = useSuggestions(value, undefined, engaged && shouldSuggest(value));
  const { goToSearch, goToBook } = useSearchNavigation(onNavigate);

  const uid = useId();
  const listboxId = `kn-sg-${uid}`;
  const optionId = useCallback((index: number): string => `kn-sg-${uid}-opt-${index}`, [uid]);

  const ctx: ComboboxContext = { value, suggestions };
  const expanded = open && canOpen(ctx);
  const options = useMemo(
    () => (expanded ? buildOptions(ctx) : []),
    // `ctx` is rebuilt every render; its two fields are the real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expanded, buildOptions, value, suggestions],
  );

  // Clamp rather than reset: a shrinking list must not leave a dangling
  // aria-activedescendant pointing at a removed option.
  const activeIndex = options.length === 0 ? -1 : Math.min(rawActiveIndex, options.length - 1);

  const close = useCallback((): void => {
    setOpen(false);
    setRawActiveIndex(-1);
  }, []);

  // Close on pointer-down outside the search root. Options use mousedown with
  // preventDefault, so a pick is seen here as an inside event and never closes
  // the dropdown before its own handler runs.
  useEffect(() => {
    if (!expanded) return undefined;
    function onDocumentMouseDown(e: MouseEvent): void {
      if (rootNode.current !== null && !rootNode.current.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
    };
  }, [expanded, close]);

  /** Navigate to the full results page. Never depends on suggestion state. */
  const submitCurrent = useCallback((): void => {
    close();
    goToSearch(value);
  }, [close, goToSearch, value]);

  const selectOption = useCallback(
    (index: number): void => {
      const option = options[index];
      if (option === undefined) return;
      close();
      if (option.kind === 'book') goToBook(option.id, value);
      else goToSearch(option.query);
    },
    [options, close, goToBook, goToSearch, value],
  );

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    setValue(e.target.value);
    setRawActiveIndex(-1);
    setEngaged(true);
    setOpen(true);
  }, []);

  // Also bound to `click`: a click on an already-focused field fires no focus
  // event, and re-opening a dropdown the user just dismissed must still work.
  const onFocus = useCallback((): void => {
    setEngaged(true);
    if (openOnFocus(ctx)) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openOnFocus, value, suggestions]);

  const clear = useCallback((): void => {
    setValue('');
    close();
    focusInput();
  }, [close, focusInput]);

  const onSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault();
      submitCurrent();
    },
    [submitCurrent],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      const total = options.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setOpen(true);
          if (total > 0) {
            setRawActiveIndex(activeIndex < total - 1 ? activeIndex + 1 : activeIndex);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (total > 0) setRawActiveIndex(activeIndex > 0 ? activeIndex - 1 : 0);
          break;

        case 'Enter':
          e.preventDefault();
          if (expanded && activeIndex >= 0) selectOption(activeIndex);
          else submitCurrent();
          break;

        case 'Escape':
          if (expanded) {
            // Swallow it so a host overlay stays open — Escape first closes the
            // dropdown, a second Escape closes the overlay.
            e.preventDefault();
            e.stopPropagation();
            close();
          }
          break;
      }
    },
    [options.length, activeIndex, expanded, selectOption, submitCurrent, close],
  );

  return {
    value,
    setValue,
    suggestions,
    expanded,
    options,
    activeIndex,
    listboxId,
    optionId,
    activeDescendantId: activeIndex >= 0 ? optionId(activeIndex) : undefined,
    rootRef,
    inputRef,
    focusInput,
    onChange,
    onFocus,
    onClick: onFocus,
    onKeyDown,
    onSubmit,
    clear,
    close,
    selectOption,
    submitCurrent,
  };
}
