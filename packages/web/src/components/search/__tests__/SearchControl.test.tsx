import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchControl } from '../SearchControl';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('SearchControl', () => {
  it('renders the W7a typeahead combobox field with the primary action', () => {
    render(<SearchControl initialQuery="" />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Знайти' })).toBeInTheDocument();
  });

  it('navigates to a query URL for a valid search', () => {
    render(<SearchControl initialQuery="кобзар" />);
    fireEvent.click(screen.getByRole('button', { name: 'Знайти' }));
    expect(push).toHaveBeenCalledWith('/search?q=%D0%BA%D0%BE%D0%B1%D0%B7%D0%B0%D1%80');
  });

  it('treats a whitespace-only query as empty (resets to /search)', () => {
    render(<SearchControl initialQuery="" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Знайти' }));
    expect(push).toHaveBeenCalledWith('/search');
  });

  it('clears via the inline clear button', () => {
    render(<SearchControl initialQuery="zzz" />);
    fireEvent.click(screen.getByRole('button', { name: 'Очистити запит' }));
    expect(push).toHaveBeenCalledWith('/search');
  });
});
