import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { clientSearch } from '@/lib/api/searchClient';
import type { SearchItemDto, SearchResponseDto } from '@/lib/api/types';
import { SEARCH_DEBOUNCE_MS } from '@/lib/search/config';
import { clearSuggestionsCache } from '@/components/search/useSuggestions';
import { HeaderSearchForm } from '@/components/header/HeaderSearchForm';
import { HeroSearch } from '../HeroSearch';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api/searchClient', () => ({ clientSearch: vi.fn() }));

const mockClientSearch = vi.mocked(clientSearch);

const FIELD_LABEL = 'Назва книги, автора або ISBN…';

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
async function settle(ms: number = SEARCH_DEBOUNCE_MS): Promise<void> {
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

describe('HeroSearch', () => {
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
    render(<HeroSearch />);
    await typeAndSettle('К');

    expect(mockClientSearch).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('queries after the debounce from two characters and renders suggestions plus a "show all" row', async () => {
    render(<HeroSearch />);
    fireEvent.change(field(), { target: { value: 'Ко' } });

    expect(mockClientSearch).not.toHaveBeenCalled();
    await settle();

    expect(mockClientSearch).toHaveBeenCalledTimes(1);
    expect(mockClientSearch.mock.calls[0][0].q).toBe('Ко');

    const options = screen.getAllByRole('option');
    // two books + the "show all results" action
    expect(options).toHaveLength(3);
    expect(screen.getByText('Кобзар')).toBeInTheDocument();
    expect(screen.getByText('Гайдамаки')).toBeInTheDocument();
    expect(screen.getByText('Показати всі результати')).toBeInTheDocument();
  });

  it('shows a loading row before the first response settles', async () => {
    mockClientSearch.mockImplementation(
      () =>
        new Promise<SearchResponseDto>(() => {
          /* pending */
        }),
    );
    render(<HeroSearch />);
    fireEvent.change(field(), { target: { value: 'Ко' } });
    await settle();

    expect(screen.getByText('Шукаємо…')).toBeInTheDocument();
    expect(screen.queryByText('Нічого не знайдено')).toBeNull();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('shows the empty state only after a real empty response', async () => {
    mockClientSearch.mockResolvedValue(response([]));
    render(<HeroSearch />);
    await typeAndSettle('Ко');

    expect(screen.getByText('Нічого не знайдено')).toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('degrades softly on an autocomplete failure and can retry', async () => {
    mockClientSearch.mockRejectedValueOnce(new Error('boom'));
    render(<HeroSearch />);
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

  // ── selection & submit ───────────────────────────────────────────────────

  it('opens /books/:id when a suggestion is picked, and closes the dropdown', async () => {
    render(<HeroSearch />);
    await typeAndSettle('Ко');

    fireEvent.mouseDown(screen.getByText('Гайдамаки'));

    expect(push).toHaveBeenCalledWith('/books/b2');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('"Показати всі результати" opens the full search page', async () => {
    render(<HeroSearch />);
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
    render(<HeroSearch />);
    const input = field();
    fireEvent.change(input, { target: { value: 'Кобзар' } });
    fireEvent.submit(input.closest('form')!);

    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('Кобзар')}`);
  });

  it('empty submit routes to bare /search', () => {
    render(<HeroSearch />);
    const input = field();
    fireEvent.submit(input.closest('form')!);
    expect(push).toHaveBeenCalledWith('/search');
  });

  // ── keyboard & a11y ──────────────────────────────────────────────────────

  it('exposes combobox semantics wired to the listbox', async () => {
    render(<HeroSearch />);
    const input = field();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');

    await typeAndSettle('Ко');

    expect(input).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveClass('hp-sg');
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('ArrowDown / ArrowUp move the active option, including onto the "show all" row', async () => {
    render(<HeroSearch />);
    const input = field();
    await typeAndSettle('Ко');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(3);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const showAll = screen.getByText('Показати всі результати').closest('li')!;
    expect(showAll).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('Enter on an active suggestion opens that book instead of submitting', async () => {
    render(<HeroSearch />);
    const input = field();
    await typeAndSettle('Ко');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(push).toHaveBeenCalledWith('/books/b2');
  });

  it('Escape closes the dropdown', async () => {
    render(<HeroSearch />);
    const input = field();
    await typeAndSettle('Ко');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on a click outside the search field', async () => {
    render(<HeroSearch />);
    await typeAndSettle('Ко');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clearing the input closes the dropdown and drops the results', async () => {
    render(<HeroSearch />);
    await typeAndSettle('Ко');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Очистити запит' }));

    expect(field()).toHaveValue('');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByText('Кобзар')).toBeNull();
  });

  it('shows the clear button only when the input is non-empty', () => {
    render(<HeroSearch />);
    expect(screen.queryByRole('button', { name: 'Очистити запит' })).toBeNull();

    fireEvent.change(field(), { target: { value: 'Sapiens' } });
    expect(screen.getByRole('button', { name: 'Очистити запит' })).toBeInTheDocument();
  });

  // ── coexistence with the header search ──────────────────────────────────

  it('renders alongside the header search with no duplicate DOM ids', async () => {
    render(
      <div>
        <HeaderSearchForm variant="desktop" />
        <HeroSearch />
      </div>,
    );

    const [headerInput, heroInput] = screen.getAllByRole('combobox');
    fireEvent.change(headerInput, { target: { value: 'Ко' } });
    fireEvent.change(heroInput, { target: { value: 'Ко' } });
    await settle();

    const listboxes = screen.getAllByRole('listbox');
    expect(listboxes).toHaveLength(2);
    expect(listboxes[0].id).not.toBe(listboxes[1].id);

    const allIds = [
      ...screen.getAllByRole('combobox').map((el) => el.id),
      ...listboxes.map((el) => el.id),
      ...screen.getAllByRole('option').map((el) => el.id),
    ].filter((id) => id !== '');
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
