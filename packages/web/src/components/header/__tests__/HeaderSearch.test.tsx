import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { clientSearch } from '@/lib/api/searchClient';
import type { SearchItemDto, SearchResponseDto } from '@/lib/api/types';
import { SUGGEST_DEBOUNCE_MS, clearSuggestionsCache } from '@/components/search/useSuggestions';
import { HeaderSearch } from '../HeaderSearch';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api/searchClient', () => ({ clientSearch: vi.fn() }));

const mockClientSearch = vi.mocked(clientSearch);

const FIELD_LABEL = 'Пошук книги, автора або ISBN';

function item(id: string, title: string, author = 'Тарас Шевченко'): SearchItemDto {
  return {
    id,
    title,
    author,
    lowestPrice: { amount: 24900, currency: 'UAH' },
    offersCount: 2,
    providers: [
      { provider: 'yakaboo', price: { amount: 24900, currency: 'UAH' } },
      { provider: 'vivat', price: { amount: 27900, currency: 'UAH' } },
    ],
    coverUrl: 'https://example.test/cover.jpg',
  };
}

function response(items: readonly SearchItemDto[]): SearchResponseDto {
  return { items, page: 1, pageSize: 8, totalItems: items.length, totalPages: 1 };
}

/** Advance the debounce (and any pending promise chain) inside `act`. */
async function settle(ms: number = SUGGEST_DEBOUNCE_MS): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function field(): HTMLElement {
  return screen.getByRole('combobox', { name: FIELD_LABEL });
}

async function typeAndSettle(value: string): Promise<void> {
  fireEvent.change(field(), { target: { value } });
  await settle();
}

describe('HeaderSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
    clearSuggestionsCache();
    mockClientSearch.mockReset();
    mockClientSearch.mockResolvedValue(response([item('b1', 'Кобзар'), item('b2', 'Гайдамаки')]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── live autocomplete ────────────────────────────────────────────────────

  it('does not query the API for a single character', async () => {
    render(<HeaderSearch />);
    await typeAndSettle('К');

    expect(mockClientSearch).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('does not query the API for whitespace only', async () => {
    render(<HeaderSearch />);
    await typeAndSettle('   ');

    expect(mockClientSearch).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('queries after the debounce from two characters and renders suggestions', async () => {
    render(<HeaderSearch />);
    fireEvent.change(field(), { target: { value: 'Ко' } });

    expect(mockClientSearch).not.toHaveBeenCalled();
    await settle();

    expect(mockClientSearch).toHaveBeenCalledTimes(1);
    expect(mockClientSearch.mock.calls[0][0].q).toBe('Ко');

    const options = screen.getAllByRole('option');
    // two books + the "show all" action
    expect(options).toHaveLength(3);
    expect(screen.getByText('Кобзар')).toBeInTheDocument();
    expect(screen.getByText('Гайдамаки')).toBeInTheDocument();
    expect(screen.getAllByText('Тарас Шевченко')).toHaveLength(2);
    expect(screen.getAllByText('249 ₴')).toHaveLength(2);
    // cheapest provider is shown as the store
    expect(screen.getAllByText('Yakaboo')).toHaveLength(2);
  });

  it('shows a loading row and no empty state before the first response settles', async () => {
    mockClientSearch.mockImplementation(
      () =>
        new Promise<SearchResponseDto>(() => {
          /* pending */
        }),
    );
    render(<HeaderSearch />);
    fireEvent.change(field(), { target: { value: 'Ко' } });
    await settle();

    expect(screen.getByText('Шукаємо…')).toBeInTheDocument();
    expect(screen.queryByText('Нічого не знайдено')).toBeNull();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('shows the empty state only after a real empty response', async () => {
    mockClientSearch.mockResolvedValue(response([]));
    render(<HeaderSearch />);
    await typeAndSettle('Ко');

    expect(screen.getByText('Нічого не знайдено')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('degrades softly on an autocomplete failure and can retry', async () => {
    mockClientSearch.mockRejectedValueOnce(new Error('boom'));
    render(<HeaderSearch />);
    await typeAndSettle('Ко');

    expect(screen.getByText('Не вдалося завантажити підказки')).toBeInTheDocument();

    mockClientSearch.mockResolvedValueOnce(response([item('b1', 'Кобзар')]));
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('button', { name: 'Повторити' }));
    });
    await settle();

    expect(screen.queryByText('Не вдалося завантажити підказки')).toBeNull();
    expect(screen.getByText('Кобзар')).toBeInTheDocument();
  });

  it('issues only the final request while typing quickly', async () => {
    render(<HeaderSearch />);
    const input = field();
    fireEvent.change(input, { target: { value: 'Ко' } });
    await settle(80);
    fireEvent.change(input, { target: { value: 'Коб' } });
    await settle(80);
    fireEvent.change(input, { target: { value: 'Кобзар' } });
    await settle();

    expect(mockClientSearch).toHaveBeenCalledTimes(1);
    expect(mockClientSearch.mock.calls[0][0].q).toBe('Кобзар');
  });

  // ── selection & submit ───────────────────────────────────────────────────

  it('opens /books/:id when a suggestion is picked, and closes the dropdown', async () => {
    render(<HeaderSearch />);
    await typeAndSettle('Ко');

    fireEvent.mouseDown(screen.getByText('Гайдамаки'));

    expect(push).toHaveBeenCalledWith('/books/b2');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('"Показати всі результати" opens the full search page', async () => {
    render(<HeaderSearch />);
    await typeAndSettle('Кобзар');

    fireEvent.mouseDown(screen.getByText('Показати всі результати'));

    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('Кобзар')}`);
  });

  it('Enter submits to the full search page without waiting for suggestions', () => {
    mockClientSearch.mockImplementation(
      () =>
        new Promise<SearchResponseDto>(() => {
          /* never settles */
        }),
    );
    render(<HeaderSearch />);
    const input = field();
    fireEvent.change(input, { target: { value: 'Кобзар' } });
    fireEvent.submit(input.closest('form')!);

    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('Кобзар')}`);
  });

  it('submit trims the query and ignores an empty or whitespace-only one', () => {
    render(<HeaderSearch />);
    const input = field();
    const form = input.closest('form')!;

    fireEvent.submit(form);
    expect(push).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(form);
    expect(push).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '  Кобзар  ' } });
    fireEvent.submit(form);
    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('Кобзар')}`);
  });

  // ── keyboard & a11y ──────────────────────────────────────────────────────

  it('exposes combobox semantics wired to the listbox', async () => {
    render(<HeaderSearch />);
    const input = field();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');

    await typeAndSettle('Ко');

    expect(input).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('ArrowDown / ArrowUp move the active option and keep focus in the input', async () => {
    render(<HeaderSearch />);
    const input = field();
    input.focus();
    await typeAndSettle('Ко');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(input);
  });

  it('Enter on an active suggestion opens that book instead of submitting', async () => {
    render(<HeaderSearch />);
    const input = field();
    await typeAndSettle('Ко');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(push).toHaveBeenCalledWith('/books/b2');
  });

  it('ArrowDown never activates an option when there are none', async () => {
    mockClientSearch.mockResolvedValue(response([]));
    render(<HeaderSearch />);
    const input = field();
    await typeAndSettle('Ко');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('Escape closes the dropdown', async () => {
    render(<HeaderSearch />);
    const input = field();
    await typeAndSettle('Ко');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on a click outside the search field', async () => {
    render(<HeaderSearch />);
    await typeAndSettle('Ко');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clearing the input closes the dropdown and drops the results', async () => {
    render(<HeaderSearch />);
    await typeAndSettle('Ко');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Очистити' }));

    expect(field()).toHaveValue('');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByText('Кобзар')).toBeNull();
  });

  it('reopens on focus when the current query already has results, without a new request', async () => {
    render(<HeaderSearch />);
    const input = field();
    await typeAndSettle('Ко');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();

    fireEvent.focus(input);

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(mockClientSearch).toHaveBeenCalledTimes(1);
  });

  it('shows the clear button only when the input is non-empty', async () => {
    render(<HeaderSearch />);
    expect(screen.queryByRole('button', { name: 'Очистити' })).toBeNull();

    fireEvent.change(field(), { target: { value: 'Sapiens' } });
    expect(screen.getByRole('button', { name: 'Очистити' })).toBeInTheDocument();
  });
});
