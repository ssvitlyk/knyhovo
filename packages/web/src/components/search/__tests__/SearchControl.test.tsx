import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SearchControl } from '../SearchControl';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
});

describe('SearchControl', () => {
  it('navigates to a query URL for a valid search', () => {
    render(<SearchControl initialQuery="кобзар" />);
    fireEvent.click(screen.getByRole('button', { name: 'Знайти' }));
    expect(push).toHaveBeenCalledWith('/search?q=%D0%BA%D0%BE%D0%B1%D0%B7%D0%B0%D1%80');
  });

  it('resets to the initial state (/search, no q) when the query is cleared and submitted', () => {
    render(<SearchControl initialQuery="zzz" />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Знайти' }));
    expect(push).toHaveBeenCalledWith('/search');
  });

  it('treats a whitespace-only query as empty', () => {
    render(<SearchControl initialQuery="" />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Знайти' }));
    expect(push).toHaveBeenCalledWith('/search');
  });

  it('clears via the "× Очистити запит" control', () => {
    render(<SearchControl initialQuery="zzz" />);
    fireEvent.click(screen.getByRole('button', { name: '× Очистити запит' }));
    expect(push).toHaveBeenCalledWith('/search');
  });
});
