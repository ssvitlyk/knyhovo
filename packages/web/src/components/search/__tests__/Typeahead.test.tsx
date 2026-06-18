import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Typeahead } from '../Typeahead';
import { addRecentSearch, clearRecentSearches, getRecentSearches } from '@/lib/search/recentSearches';
import { SearchError } from '@/lib/api/search';
import type { SearchResponseDto } from '@/lib/api/types';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/api/searchClient', () => ({
  clientSearch: vi.fn(),
}));

// Import the mocked function so tests can control its resolution.
import { clientSearch } from '@/lib/api/searchClient';
const mockClientSearch = vi.mocked(clientSearch);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResults(overrides: Partial<SearchResponseDto> = {}): SearchResponseDto {
  return {
    items: [
      {
        id: 'book-1',
        title: 'Кобзар',
        author: 'Тарас Шевченко',
        lowestPrice: { amount: 24500, currency: 'UAH' },
        offersCount: 2,
        providers: [],
      },
      {
        id: 'book-2',
        title: 'Тіні забутих предків',
        author: 'Михайло Коцюбинський',
        lowestPrice: { amount: 19900, currency: 'UAH' },
        offersCount: 1,
        providers: [],
      },
    ],
    page: 1,
    pageSize: 6,
    totalItems: 2,
    totalPages: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown — real timers; the debounce is short (200ms) and RTL's
// findBy* polls reliably under real timers (fake timers deadlock its waitFor).
// ---------------------------------------------------------------------------

beforeEach(() => {
  clearRecentSearches();
  push.mockClear();
  mockClientSearch.mockReset();
  // Safe default so an incidental debounce fire never calls `.then` on undefined;
  // individual tests override with their own resolved/rejected/pending value.
  mockClientSearch.mockResolvedValue(makeResults());
});

afterEach(() => {
  clearRecentSearches();
});

// ---------------------------------------------------------------------------

describe('Typeahead — idle / recent searches', () => {
  it('shows recent searches on focus when value is empty', () => {
    addRecentSearch('Кобзар');
    addRecentSearch('Тіні');

    render(<Typeahead initialQuery="" />);
    fireEvent.focus(screen.getByRole('combobox'));

    expect(screen.getByRole('option', { name: 'Тіні' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Кобзар' })).toBeInTheDocument();
  });

  it('selecting a recent option navigates to /search?q=...', () => {
    addRecentSearch('Кобзар');

    render(<Typeahead initialQuery="" />);
    fireEvent.focus(screen.getByRole('combobox'));

    fireEvent.mouseDown(screen.getByRole('option', { name: 'Кобзар' }));

    expect(push).toHaveBeenCalledWith('/search?q=%D0%9A%D0%BE%D0%B1%D0%B7%D0%B0%D1%80');
  });

  it('shows a hint when there are no recent searches', () => {
    render(<Typeahead initialQuery="" />);
    fireEvent.focus(screen.getByRole('combobox'));

    expect(screen.getByText('Почніть вводити назву, автора або ISBN')).toBeInTheDocument();
  });

  it('clears history when "Очистити історію" is clicked', () => {
    addRecentSearch('щось');

    render(<Typeahead initialQuery="" />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'щось' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Очистити історію' }));

    expect(getRecentSearches()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------

describe('Typeahead — typing / suggestions', () => {
  it('does NOT call clientSearch synchronously on a keystroke (debounced)', () => {
    mockClientSearch.mockResolvedValue(makeResults());

    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'кобзар' } });

    // Immediately after the keystroke, before the 200ms debounce elapses.
    expect(mockClientSearch).not.toHaveBeenCalled();
  });

  it('calls clientSearch once after the debounce and renders results', async () => {
    mockClientSearch.mockResolvedValue(makeResults());

    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    // Rapid keystrokes must coalesce into a single debounced call.
    fireEvent.change(input, { target: { value: 'ко' } });
    fireEvent.change(input, { target: { value: 'коб' } });
    fireEvent.change(input, { target: { value: 'кобзар' } });

    expect(await screen.findByRole('option', { name: /Кобзар/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Тіні забутих предків/ })).toBeInTheDocument();
    expect(mockClientSearch).toHaveBeenCalledTimes(1);
    expect(mockClientSearch).toHaveBeenCalledWith(expect.objectContaining({ q: 'кобзар' }));
  });

  it('ArrowDown + Enter on a book option navigates to /books/:id', async () => {
    mockClientSearch.mockResolvedValue(makeResults());

    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'кобзар' } });

    await screen.findByRole('option', { name: /Кобзар/ });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(push).toHaveBeenCalledWith('/books/book-1');
  });

  it('stores the typed value in recent searches when a book is selected', async () => {
    mockClientSearch.mockResolvedValue(makeResults());

    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'кобзар' } });

    const option = await screen.findByRole('option', { name: /Кобзар/ });
    fireEvent.mouseDown(option);

    expect(getRecentSearches()).toContain('кобзар');
  });
});

// ---------------------------------------------------------------------------

describe('Typeahead — keyboard navigation', () => {
  it('ArrowDown moves aria-activedescendant to the first option', () => {
    addRecentSearch('щось');

    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByRole('option', { name: 'щось' })).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', 'si-ta-opt-0');
  });

  it('ArrowUp stays at the first option when already at the top', () => {
    addRecentSearch('один');
    addRecentSearch('два');

    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByRole('option', { name: 'два' })).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(input).toHaveAttribute('aria-activedescendant', 'si-ta-opt-0');
  });

  it('keeps no active descendant when there are zero selectable options', () => {
    // No recent searches → the idle dropdown shows only a hint (no options).
    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByText('Почніть вводити назву, автора або ISBN')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).not.toHaveAttribute('aria-activedescendant');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('Escape closes the listbox and clears the active descendant', () => {
    addRecentSearch('щось');

    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    expect(screen.getByRole('option', { name: 'щось' })).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', 'si-ta-opt-0');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });
});

// ---------------------------------------------------------------------------

describe('Typeahead — ISBN detection', () => {
  it('shows the "Розпізнано ISBN" row for a hyphenated ISBN-13', () => {
    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '978-617-12-3456-7' } });

    expect(screen.getByRole('option', { name: /Розпізнано ISBN/ })).toBeInTheDocument();
  });

  it('shows the "Розпізнано ISBN" row for a digits-only ISBN-13', () => {
    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '9786171234567' } });

    expect(screen.getByRole('option', { name: /Розпізнано ISBN/ })).toBeInTheDocument();
  });

  it('Enter on the ISBN row submits a normal /search (no /books navigation)', () => {
    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '9786171234567' } });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('9786171234567')}`);
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining('/books/'));
  });

  it('does NOT call clientSearch for ISBN-like input', async () => {
    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '9786171234567' } });

    // Wait past the debounce window; the effect must skip ISBN values.
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(mockClientSearch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('Typeahead — loading & error states', () => {
  it('shows "Шукаємо…" while a fetch is pending', () => {
    mockClientSearch.mockImplementation(() => new Promise(() => undefined));

    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'test' } });

    // Loading is derived from the typed value, shown immediately.
    expect(screen.getByText('Шукаємо…')).toBeInTheDocument();
  });

  it('shows the error message and a Повторити button when the fetch rejects', async () => {
    mockClientSearch.mockRejectedValue(new SearchError('Помилка', 500));

    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'test' } });

    expect(await screen.findByText('Не вдалося завантажити підказки')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторити' })).toBeInTheDocument();
  });

  it('shows "Нічого не знайдено" for empty results', async () => {
    mockClientSearch.mockResolvedValue(makeResults({ items: [], totalItems: 0 }));

    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'xyzzy' } });

    expect(await screen.findByText('Нічого не знайдено')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------

describe('Typeahead — submit & recents', () => {
  it('submitting a typed query stores it in recents and navigates', async () => {
    render(<Typeahead initialQuery="" />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'нові книги' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('нові книги')}`);
    });
    expect(getRecentSearches()).toContain('нові книги');
  });

  it('"× Очистити запит" is visible while there is input', () => {
    render(<Typeahead initialQuery="щось" />);
    expect(screen.getByRole('button', { name: '× Очистити запит' })).toBeInTheDocument();
  });

  it('"× Очистити запит" is hidden when the value is empty', () => {
    render(<Typeahead initialQuery="" />);
    expect(screen.queryByRole('button', { name: '× Очистити запит' })).not.toBeInTheDocument();
  });
});
