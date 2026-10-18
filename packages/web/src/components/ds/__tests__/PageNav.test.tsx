import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PageNav } from '../PageNav';

function setup(page: number, totalPages: number): ReturnType<typeof vi.fn> {
  const onPage = vi.fn();
  render(
    <PageNav page={page} totalPages={totalPages} onPage={onPage} ariaLabel="Сторінки X" nextLabel="Вперед →" />,
  );
  return onPage;
}

describe('PageNav', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(
      <PageNav page={1} totalPages={1} onPage={vi.fn()} ariaLabel="x" nextLabel="n" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes the aria-label, current page and custom next label', () => {
    setup(2, 5);
    expect(screen.getByRole('navigation', { name: 'Сторінки X' })).toHaveClass('kn-pagination');
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '3' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Вперед →' })).toBeInTheDocument();
  });

  it('calls onPage for prev, next and numbered buttons', () => {
    const onPage = setup(2, 5);
    fireEvent.click(screen.getByRole('button', { name: '← Назад' }));
    fireEvent.click(screen.getByRole('button', { name: 'Вперед →' }));
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(onPage.mock.calls).toEqual([[1], [3], [4]]);
  });

  it('disables prev on the first page and next on the last', () => {
    setup(1, 3);
    expect(screen.getByRole('button', { name: '← Назад' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Вперед →' })).toBeEnabled();
  });

  it('renders an ellipsis for long ranges', () => {
    setup(10, 20);
    expect(document.querySelector('.kn-pagination__ellipsis')).not.toBeNull();
  });
});
