import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Pagination } from '../Pagination';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
  vi.stubGlobal('scrollTo', vi.fn());
});

describe('Pagination', () => {
  it('renders nothing when there is a single page', () => {
    const { container } = render(<Pagination query="x" page={1} totalPages={1} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the frozen page set with an ellipsis and marks the current page', () => {
    render(<Pagination query="психологія" page={4} totalPages={24} />);
    for (const label of ['1', '2', '3', '4', '5', '24']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText('…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-current', 'page');
  });

  it('navigates preserving the query and resetting scroll', () => {
    render(<Pagination query="психологія" page={4} totalPages={24} />);
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(push).toHaveBeenCalledWith('/search?q=%D0%BF%D1%81%D0%B8%D1%85%D0%BE%D0%BB%D0%BE%D0%B3%D1%96%D1%8F&page=2');
  });

  it('disables Назад on the first page and Далі on the last', () => {
    const { rerender } = render(<Pagination query="x" page={1} totalPages={24} />);
    expect(screen.getByRole('button', { name: '← Назад' })).toBeDisabled();

    rerender(<Pagination query="x" page={24} totalPages={24} />);
    expect(screen.getByRole('button', { name: 'Далі →' })).toBeDisabled();
  });
});
