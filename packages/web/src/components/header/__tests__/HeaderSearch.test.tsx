import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeaderSearch } from '../HeaderSearch';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

describe('HeaderSearch', () => {
  beforeEach(() => {
    push.mockReset();
  });

  it('typing + submit routes to /search?q=…', () => {
    render(<HeaderSearch />);
    const input = screen.getByRole('searchbox', { name: 'Пошук книги, автора або ISBN' });
    fireEvent.change(input, { target: { value: 'Кобзар' } });
    fireEvent.submit(input.closest('form')!);
    expect(push).toHaveBeenCalledWith(`/search?q=${encodeURIComponent('Кобзар')}`);
  });

  it('does not push on empty or whitespace-only query submit', () => {
    render(<HeaderSearch />);
    const input = screen.getByRole('searchbox', { name: 'Пошук книги, автора або ISBN' });
    fireEvent.submit(input.closest('form')!);
    expect(push).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form')!);
    expect(push).not.toHaveBeenCalled();
  });

  it('shows the clear button only when the input is non-empty, and clears it', () => {
    render(<HeaderSearch />);
    const input = screen.getByRole('searchbox', { name: 'Пошук книги, автора або ISBN' });
    expect(screen.queryByRole('button', { name: 'Очистити' })).toBeNull();

    fireEvent.change(input, { target: { value: 'Sapiens' } });
    const clearButton = screen.getByRole('button', { name: 'Очистити' });
    expect(clearButton).toBeTruthy();

    fireEvent.click(clearButton);
    expect(input).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Очистити' })).toBeNull();
  });
});
