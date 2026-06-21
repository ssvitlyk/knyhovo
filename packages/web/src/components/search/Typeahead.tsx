'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';

import { clientSearch } from '@/lib/api/searchClient';
import type { SearchItemDto } from '@/lib/api/types';
import { formatMoney } from '@/lib/format';
import { detectIsbn, looksLikeIsbn } from '@/lib/search/isbn';
import { addRecentSearch } from '@/lib/search/recentSearches';
import { useDebouncedValue } from './useDebouncedValue';
import { useRecentSearches } from './useRecentSearches';

/** Props for the {@link Typeahead} combobox. */
export interface TypeaheadProps {
  readonly initialQuery: string;
}

/**
 * ARIA 1.2 combobox + listbox typeahead for the search field.
 *
 * State machine:
 * - idle (empty value) → shows recent searches
 * - ISBN input         → shows a single "Розпізнано ISBN" option
 * - typing (≥1 char)  → debounced fetch; renders loading / error / results
 */
export function Typeahead({ initialQuery }: TypeaheadProps): React.JSX.Element {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // --- async search state, keyed by the query the data belongs to, so that
  // loading / error / items are DERIVED during render rather than synchronised
  // via setState in the effect body ---
  const [result, setResult] = useState<{ readonly query: string; readonly items: readonly SearchItemDto[] } | null>(
    null,
  );
  const [errorQuery, setErrorQuery] = useState<string | null>(null);
  // Bump to re-trigger a fetch for the same debounced value (retry).
  const [retryKey, setRetryKey] = useState(0);

  const { recent, clear: clearRecent } = useRecentSearches();
  const debouncedValue = useDebouncedValue(value, 200);

  // Derived suggestion view-state for the CURRENT typed value. Results carry the
  // query they belong to; while the typed value differs (debounce gap or fetch
  // in flight) we are "loading"; an error matching the value shows the error row.
  const valueFetchable = value !== '' && !looksLikeIsbn(value);
  const suggestionsReady = result !== null && result.query === value;
  const items: readonly SearchItemDto[] = suggestionsReady ? result.items : [];
  const hasError = valueFetchable && errorQuery === value;
  const loading = valueFetchable && !suggestionsReady && !hasError;

  // Blur timeout ref so click on option can cancel the blur.
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Navigate to a search URL; optionally record the query in recents. */
  const submit = useCallback(
    (query: string): void => {
      const q = query.trim();
      setOpen(false);
      setActiveIndex(-1);
      if (q === '') {
        router.push('/search');
      } else {
        addRecentSearch(q);
        router.push(`/search?q=${encodeURIComponent(q)}`);
      }
    },
    [router],
  );

  /** Navigate to a book page and store the current typed value in recents. */
  const selectBookItem = useCallback(
    (id: string): void => {
      const q = value.trim();
      setOpen(false);
      setActiveIndex(-1);
      if (q !== '') addRecentSearch(q);
      router.push(`/books/${id}`);
    },
    [router, value],
  );

  // -----------------------------------------------------------------------
  // Determine selectable option descriptors for the current mode.
  // Presentation rows (headings, status, hints) are NOT included here.
  // -----------------------------------------------------------------------

  type OptionDescriptor =
    | { kind: 'recent'; query: string }
    | { kind: 'isbn' }
    | { kind: 'book'; item: SearchItemDto };

  const buildOptions = (): readonly OptionDescriptor[] => {
    if (value === '') {
      return recent.map((q) => ({ kind: 'recent' as const, query: q }));
    }
    if (looksLikeIsbn(value)) {
      return [{ kind: 'isbn' as const }];
    }
    return items.map((item) => ({ kind: 'book' as const, item }));
  };

  const options = buildOptions();

  // -----------------------------------------------------------------------
  // Fetch effect — keyed on debounced value + retryKey
  // -----------------------------------------------------------------------

  useEffect(() => {
    // Idle / ISBN modes render their own branches (recents / "Розпізнано ISBN"),
    // so no fetch runs and any prior items/error stay gated behind the loading
    // check below — no state reset needed here (which would be a pure
    // state-sync effect). Just skip fetching.
    if (debouncedValue === '' || looksLikeIsbn(debouncedValue)) {
      return;
    }

    const controller = new AbortController();

    void clientSearch({ q: debouncedValue, signal: controller.signal, pageSize: 6 })
      .then((res) => {
        // State is set only from async callbacks (never the effect body), so the
        // effect stays a real data-sync effect; loading/error are derived above.
        setResult({ query: debouncedValue, items: res.items });
        setErrorQuery(null);
        setActiveIndex(-1);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setErrorQuery(debouncedValue);
        setActiveIndex(-1);
      });

    return () => {
      controller.abort();
    };
  }, [debouncedValue, retryKey]);

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setValue(e.target.value);
    setOpen(true);
    setActiveIndex(-1);
  };

  const handleFocus = (): void => {
    if (blurTimerRef.current !== null) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setOpen(true);
  };

  const handleBlur = (): void => {
    blurTimerRef.current = setTimeout(() => {
      setOpen(false);
      setActiveIndex(-1);
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const total = options.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setOpen(true);
        // No selectable options → keep nothing active.
        setActiveIndex((prev) => (total === 0 ? -1 : prev < total - 1 ? prev + 1 : prev));
        break;

      case 'ArrowUp':
        e.preventDefault();
        // No selectable options → keep nothing active (never snap to index 0).
        setActiveIndex((prev) => (total === 0 ? -1 : prev > 0 ? prev - 1 : 0));
        break;

      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < total) {
          const opt = options[activeIndex];
          if (opt.kind === 'recent') {
            submit(opt.query);
          } else if (opt.kind === 'isbn') {
            submit(value);
          } else {
            selectBookItem(opt.item.id);
          }
        } else {
          submit(value);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        break;
    }
  };

  const activeId = activeIndex >= 0 ? `si-ta-opt-${activeIndex}` : null;

  // -----------------------------------------------------------------------
  // Clear button
  // -----------------------------------------------------------------------

  const handleClear = (): void => {
    setValue('');
    router.push('/search');
    setOpen(false);
    inputRef.current?.focus();
  };

  // -----------------------------------------------------------------------
  // Option select handlers (mousedown to preserve focus)
  // -----------------------------------------------------------------------

  const handleSelectRecent = (query: string) => (e: React.MouseEvent): void => {
    e.preventDefault();
    if (blurTimerRef.current !== null) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    submit(query);
  };

  const handleSelectIsbn = (e: React.MouseEvent): void => {
    e.preventDefault();
    if (blurTimerRef.current !== null) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    submit(value);
  };

  const handleSelectBook = (id: string) => (e: React.MouseEvent): void => {
    e.preventDefault();
    if (blurTimerRef.current !== null) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    selectBookItem(id);
  };

  const handleClearHistory = (e: React.MouseEvent): void => {
    e.preventDefault();
    if (blurTimerRef.current !== null) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    clearRecent();
  };

  const handleRetry = (e: React.MouseEvent): void => {
    e.preventDefault();
    if (blurTimerRef.current !== null) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setErrorQuery(null);
    setRetryKey((k) => k + 1);
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const renderDropdown = (): React.JSX.Element | null => {
    if (!open) return null;

    // --- idle: recent searches ---
    if (value === '') {
      return (
        <ul id="si-ta-listbox" role="listbox" className="si-ta__menu">
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
                  id={`si-ta-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  data-active={i === activeIndex ? 'true' : undefined}
                  className="si-ta__row"
                  onMouseDown={handleSelectRecent(q)}
                >
                  {q}
                </li>
              ))}
              <li role="presentation" className="si-ta__row si-ta__row--action">
                <button
                  type="button"
                  className="si-ta__clear"
                  onMouseDown={handleClearHistory}
                >
                  Очистити історію
                </button>
              </li>
            </>
          )}
        </ul>
      );
    }

    // --- ISBN detected ---
    if (looksLikeIsbn(value)) {
      const detected = detectIsbn(value);
      return (
        <ul id="si-ta-listbox" role="listbox" className="si-ta__menu">
          <li
            id="si-ta-opt-0"
            role="option"
            aria-selected={activeIndex === 0}
            data-active={activeIndex === 0 ? 'true' : undefined}
            className="si-ta__row si-ta__row--isbn"
            onMouseDown={handleSelectIsbn}
          >
            <span className="si-ta__row-primary">Розпізнано ISBN</span>
            {detected !== null && (
              <span className="si-ta__row-sub">{detected.normalized}</span>
            )}
            <span className="si-ta__row-hint">↵ щоб шукати</span>
          </li>
        </ul>
      );
    }

    // --- typing / suggestions ---
    return (
      <ul id="si-ta-listbox" role="listbox" className="si-ta__menu">
        {loading && (
          <li role="presentation" className="si-ta__status" aria-busy="true">
            Шукаємо…
          </li>
        )}
        {!loading && hasError && (
          <li role="presentation" className="si-ta__status si-ta__status--error">
            Не вдалося завантажити підказки
            <button
              type="button"
              className="si-ta__retry"
              onMouseDown={handleRetry}
            >
              Повторити
            </button>
          </li>
        )}
        {!loading && !hasError && items.length === 0 && (
          <li role="presentation" className="si-ta__status">
            Нічого не знайдено
          </li>
        )}
        {!loading && !hasError && items.length > 0 && (
          <>
            <li role="presentation" className="si-ta__group">
              Книги
            </li>
            {items.map((item, i) => (
              <li
                key={item.id}
                id={`si-ta-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                data-active={i === activeIndex ? 'true' : undefined}
                className="si-ta__row si-ta__row--book"
                onMouseDown={handleSelectBook(item.id)}
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

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="si-typeahead">
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
          aria-expanded={open}
          aria-controls="si-ta-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeId ?? undefined}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
        {value.length > 0 && (
          <button
            type="button"
            className="kn-field__clear"
            aria-label="Очистити запит"
            onClick={handleClear}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="kn-btn kn-btn--primary"
          onClick={() => submit(value)}
        >
          Знайти
        </button>
      </div>

      {renderDropdown()}
    </div>
  );
}
