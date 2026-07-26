import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { clientSearch } from '@/lib/api/searchClient';
import type { SearchItemDto, SearchResponseDto } from '@/lib/api/types';
import { SUGGEST_DEBOUNCE_MS, clearSuggestionsCache } from '@/components/search/useSuggestions';
import { MobileSearchOverlay } from '../MobileSearchOverlay';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/api/searchClient', () => ({ clientSearch: vi.fn() }));

const mockClientSearch = vi.mocked(clientSearch);
const FIELD_LABEL = 'Пошук книги, автора або ISBN';

function item(id: string, title: string): SearchItemDto {
  return {
    id,
    title,
    author: 'Тарас Шевченко',
    lowestPrice: { amount: 24900, currency: 'UAH' },
    offersCount: 1,
    providers: [{ provider: 'yakaboo', price: { amount: 24900, currency: 'UAH' } }],
    coverUrl: null,
  };
}

function response(items: readonly SearchItemDto[]): SearchResponseDto {
  return { items, page: 1, pageSize: 8, totalItems: items.length, totalPages: 1 };
}

async function settle(ms: number = SUGGEST_DEBOUNCE_MS): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function field(): HTMLElement {
  return screen.getByRole('combobox', { name: FIELD_LABEL });
}

describe('MobileSearchOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
    clearSuggestionsCache();
    mockClientSearch.mockReset();
    mockClientSearch.mockResolvedValue(response([item('b1', 'Кобзар')]));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('autofocuses the field and keeps the native submit button', () => {
    render(<MobileSearchOverlay onClose={vi.fn()} />);

    expect(document.activeElement).toBe(field());
    // The mobile keyboard's Search key relies on a real submit button.
    expect(screen.getByRole('button', { name: 'Знайти' })).toHaveAttribute('type', 'submit');
  });

  it('shows live suggestions while typing', async () => {
    render(<MobileSearchOverlay onClose={vi.fn()} />);
    fireEvent.change(field(), { target: { value: 'Ко' } });
    await settle();

    expect(mockClientSearch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Кобзар')).toBeInTheDocument();
  });

  it('renders the dropdown inside the overlay panel so it cannot overflow the viewport', async () => {
    render(<MobileSearchOverlay onClose={vi.fn()} />);
    fireEvent.change(field(), { target: { value: 'Ко' } });
    await settle();

    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveClass('knh-sg--mobile');
    expect(listbox.closest('.knh-so__panel')).not.toBeNull();
    // The field row and the list are siblings in the panel column, so the list
    // is laid out in flow and never positioned over the viewport edge.
    expect(listbox.previousElementSibling).toHaveClass('knh-so__row');
  });

  it('mobile dropdown CSS cannot create horizontal overflow and stays scrollable', () => {
    // jsdom serves `import.meta.url` over http, so resolve from the vitest root
    // (packages/web) instead.
    const css = readFileSync(resolve(process.cwd(), 'src/styles/kn-header.css'), 'utf8');
    const base = /\.knh-sg \{([^}]*)\}/.exec(css)?.[1] ?? '';
    const mobile = /\.knh-sg--mobile \{([^}]*)\}/.exec(css)?.[1] ?? '';

    expect(base).toContain('overflow-x: hidden');
    expect(base).toContain('overflow-y: auto');
    // No scroll chaining into the page behind the overlay.
    expect(base).toContain('overscroll-behavior: contain');
    // The mobile variant is in flow and bounded by its container width.
    expect(mobile).toContain('position: static');
    expect(mobile).toContain('max-width: 100%');
    // Results stay reachable while the on-screen keyboard is up.
    expect(mobile).toContain('max-height: 60vh');
  });

  it('picking a suggestion navigates and closes the overlay', async () => {
    const onClose = vi.fn();
    render(<MobileSearchOverlay onClose={onClose} />);
    fireEvent.change(field(), { target: { value: 'Ко' } });
    await settle();

    fireEvent.mouseDown(screen.getByText('Кобзар'));

    expect(push).toHaveBeenCalledWith('/books/b1');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('submitting navigates to the full search page and closes the overlay', () => {
    const onClose = vi.fn();
    render(<MobileSearchOverlay onClose={onClose} />);
    const input = field();
    fireEvent.change(input, { target: { value: 'Кобзар' } });
    fireEvent.submit(input.closest('form')!);

    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('Кобзар')}`);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes the dropdown first and only then reaches the overlay handler', async () => {
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    try {
      render(<MobileSearchOverlay onClose={vi.fn()} />);
      const input = field();
      fireEvent.change(input, { target: { value: 'Ко' } });
      await settle();
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(onWindowKey).not.toHaveBeenCalled();

      // With the dropdown closed, Escape belongs to the overlay again.
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onWindowKey).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', onWindowKey);
    }
  });

  it('the backdrop still closes the overlay', () => {
    const onClose = vi.fn();
    render(<MobileSearchOverlay onClose={onClose} />);

    const dialog = screen.getByRole('dialog', { name: 'Пошук' });
    fireEvent.click(dialog.querySelector('.knh-so__backdrop')!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
