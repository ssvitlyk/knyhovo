import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Hero } from '../Hero';
import { POPULAR_QUERIES } from '../content';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// Hero now renders <HeroSearch/>, which runs the shared live-autocomplete
// engine — mock the network seam so typing never issues a real fetch.
vi.mock('@/lib/api/searchClient', () => ({ clientSearch: vi.fn() }));
import { clientSearch } from '@/lib/api/searchClient';
const mockClientSearch = vi.mocked(clientSearch);

describe('Hero', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
    mockClientSearch.mockReset();
    mockClientSearch.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 8,
      totalItems: 0,
      totalPages: 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the frozen eyebrow, headline, search field, stats and popular chips', () => {
    render(<Hero />);
    expect(screen.getByText(/Знаходимо дешевше/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Де книга дешевша?');
    expect(screen.getByRole('combobox')).toBeTruthy();
    expect(screen.getByText('12k+')).toBeTruthy();
    for (const q of POPULAR_QUERIES) {
      expect(screen.getByRole('button', { name: q })).toBeTruthy();
    }
  });

  it('typing + «Знайти» routes to the canonical /search?q=…', () => {
    render(<Hero />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Кобзар' } });
    fireEvent.click(screen.getByRole('button', { name: 'Знайти' }));
    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('Кобзар')}`);
  });

  it('trims surrounding whitespace before routing', () => {
    render(<Hero />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '   Sapiens   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Знайти' }));
    expect(push).toHaveBeenCalledWith('/search?q=Sapiens');
  });

  it('clicking a popular chip routes to /search?q=<chip>', () => {
    render(<Hero />);
    fireEvent.click(screen.getByRole('button', { name: 'Sapiens' }));
    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('Sapiens')}`);
  });

  it('empty query submit routes to bare /search', () => {
    render(<Hero />);
    fireEvent.click(screen.getByRole('button', { name: 'Знайти' }));
    expect(push).toHaveBeenCalledWith('/search');
  });
});
