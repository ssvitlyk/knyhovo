import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type React from 'react';

import { clientSearch } from '@/lib/api/searchClient';
import type { SearchItemDto, SearchResponseDto } from '@/lib/api/types';
import { SEARCH_DEBOUNCE_MS } from '@/lib/search/config';
import { getRecentSearches } from '@/lib/search/recentSearches';
import { clearSuggestionsCache } from '../useSuggestions';
import {
  useSearchCombobox,
  type ComboboxContext,
  type ComboboxOption,
} from '../useSearchCombobox';

vi.mock('@/lib/api/searchClient', () => ({ clientSearch: vi.fn() }));

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const mockClientSearch = vi.mocked(clientSearch);

function item(id: string, title: string): SearchItemDto {
  return {
    id,
    title,
    author: 'Автор',
    lowestPrice: { amount: 24900, currency: 'UAH' },
    offersCount: 1,
    providers: [{ provider: 'yakaboo', price: { amount: 24900, currency: 'UAH' } }],
    coverUrl: null,
  };
}

function response(items: readonly SearchItemDto[]): SearchResponseDto {
  return { items, page: 1, pageSize: 8, totalItems: items.length, totalPages: 1 };
}

/** Advance past the debounce and let the resulting promise chain settle. */
async function settle(ms: number = SEARCH_DEBOUNCE_MS): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/** Same policy as the header: one option per book, plus a trailing query option. */
function buildOptions({ value, suggestions }: ComboboxContext): readonly ComboboxOption[] {
  if (suggestions.loading || suggestions.error || suggestions.items.length === 0) return [];
  return [
    ...suggestions.items.map((it): ComboboxOption => ({ kind: 'book', id: it.id })),
    { kind: 'query', query: value.trim() },
  ];
}

function keyEvent(key: string): React.KeyboardEvent<HTMLInputElement> {
  return {
    key,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLInputElement>;
}

describe('useSearchCombobox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
    clearSuggestionsCache();
    localStorage.clear();
    mockClientSearch.mockReset();
    mockClientSearch.mockResolvedValue(response([item('b1', 'Кобзар'), item('b2', 'Гайдамаки')]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── min-length gating ────────────────────────────────────────────────────

  it('stays closed below the minimum query length even after typing', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({ target: { value: 'К' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle(1000);

    expect(result.current.expanded).toBe(false);
    expect(result.current.options).toEqual([]);
    expect(mockClientSearch).not.toHaveBeenCalled();
  });

  it('opens once the query reaches the minimum length and results settle', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();

    expect(result.current.expanded).toBe(true);
    // two books + the trailing query option
    expect(result.current.options).toHaveLength(3);
  });

  // ── open / close ─────────────────────────────────────────────────────────

  it('Escape closes an open dropdown and clears the active option', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();
    act(() => {
      result.current.onKeyDown(keyEvent('ArrowDown'));
    });
    expect(result.current.activeIndex).toBe(0);

    act(() => {
      result.current.onKeyDown(keyEvent('Escape'));
    });

    expect(result.current.expanded).toBe(false);
    expect(result.current.activeIndex).toBe(-1);
  });

  it('clear empties the value and closes the dropdown', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();
    expect(result.current.expanded).toBe(true);

    act(() => {
      result.current.clear();
    });

    expect(result.current.value).toBe('');
    expect(result.current.expanded).toBe(false);
  });

  it('closes on a mousedown outside the attached root element', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    const root = document.createElement('div');
    document.body.appendChild(root);
    act(() => {
      result.current.rootRef(root);
    });

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();
    expect(result.current.expanded).toBe(true);

    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(result.current.expanded).toBe(false);

    document.body.removeChild(root);
  });

  it('does not close on a mousedown inside the attached root element', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    const root = document.createElement('div');
    document.body.appendChild(root);
    act(() => {
      result.current.rootRef(root);
    });

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();
    expect(result.current.expanded).toBe(true);

    act(() => {
      root.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(result.current.expanded).toBe(true);

    document.body.removeChild(root);
  });

  // ── keyboard: ArrowDown / ArrowUp clamping ──────────────────────────────

  it('ArrowDown moves forward and clamps at the last option', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();
    expect(result.current.options).toHaveLength(3);

    act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
    expect(result.current.activeIndex).toBe(0);
    act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
    expect(result.current.activeIndex).toBe(1);
    act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
    expect(result.current.activeIndex).toBe(2);
    act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
    expect(result.current.activeIndex).toBe(2); // clamped at the last option
  });

  it('ArrowUp moves backward and clamps at the first option', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();

    act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
    act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
    expect(result.current.activeIndex).toBe(1);

    act(() => result.current.onKeyDown(keyEvent('ArrowUp')));
    expect(result.current.activeIndex).toBe(0);
    act(() => result.current.onKeyDown(keyEvent('ArrowUp')));
    expect(result.current.activeIndex).toBe(0); // clamped at the first option
  });

  it('ArrowDown never activates an option when there are none', async () => {
    mockClientSearch.mockResolvedValue(response([]));
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();
    expect(result.current.options).toEqual([]);

    act(() => result.current.onKeyDown(keyEvent('ArrowDown')));

    expect(result.current.activeIndex).toBe(-1);
    expect(result.current.activeDescendantId).toBeUndefined();
  });

  // ── Enter with / without an active option ───────────────────────────────

  it('Enter with an active option selects it and navigates to the book', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();

    act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
    act(() => result.current.onKeyDown(keyEvent('ArrowDown')));
    expect(result.current.activeIndex).toBe(1);

    act(() => result.current.onKeyDown(keyEvent('Enter')));

    expect(push).toHaveBeenCalledWith('/books/b2');
    expect(result.current.expanded).toBe(false);
  });

  it('Enter with no active option submits the current query to /search', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();
    expect(result.current.activeIndex).toBe(-1);

    act(() => result.current.onKeyDown(keyEvent('Enter')));

    expect(push).toHaveBeenCalledWith('/search?q=%D0%9A%D0%BE');
  });

  // ── selectOption routing ─────────────────────────────────────────────────

  it('selectOption on a book option routes to /books/:id', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();

    act(() => result.current.selectOption(0));

    expect(push).toHaveBeenCalledWith('/books/b1');
  });

  it('selectOption on the trailing query option routes to /search?q=', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();

    act(() => result.current.selectOption(2));

    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('Ко')}`);
  });

  it('submitCurrent navigates to /search for the current field value', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({
        target: { value: '  Кобзар  ' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    act(() => result.current.submitCurrent());

    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('Кобзар')}`);
  });

  it('submitCurrent on an empty value navigates to plain /search', () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => result.current.submitCurrent());

    expect(push).toHaveBeenCalledWith('/search');
  });

  // ── recents recording ────────────────────────────────────────────────────

  it('records a non-empty query as a recent search on submit', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({
        target: { value: 'Кобзар' },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => result.current.submitCurrent());

    expect(getRecentSearches()).toEqual(['Кобзар']);
  });

  it('does not record anything for an empty submit', () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => result.current.submitCurrent());

    expect(getRecentSearches()).toEqual([]);
  });

  it('records the current query when a book option is picked', async () => {
    const { result } = renderHook(() => useSearchCombobox({ buildOptions }));

    act(() => {
      result.current.onChange({ target: { value: 'Ко' } } as React.ChangeEvent<HTMLInputElement>);
    });
    await settle();

    act(() => result.current.selectOption(0));

    expect(getRecentSearches()).toEqual(['Ко']);
  });

  it('calls onNavigate after a navigation, e.g. to let an overlay close itself', async () => {
    const onNavigate = vi.fn();
    const { result } = renderHook(() => useSearchCombobox({ buildOptions, onNavigate }));

    act(() => {
      result.current.onChange({
        target: { value: 'Кобзар' },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    act(() => result.current.submitCurrent());

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
