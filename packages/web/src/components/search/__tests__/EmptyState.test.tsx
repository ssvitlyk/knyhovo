import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  push.mockClear();
});

describe('EmptyState', () => {
  it('renders the frozen "not found" copy by default', () => {
    render(<EmptyState />);
    expect(screen.getByRole('heading', { name: 'Книгу не знайдено' })).toBeInTheDocument();
    expect(screen.getByText('Спробуйте іншу назву або ISBN.')).toBeInTheDocument();
    expect(screen.getByText('Популярні запити:')).toBeInTheDocument();
  });

  it('accepts custom title/text for the initial prompt', () => {
    render(<EmptyState title="Почніть пошук книг" text="Введіть назву." />);
    expect(screen.getByRole('heading', { name: 'Почніть пошук книг' })).toBeInTheDocument();
  });

  it('navigates to a new search when a popular query chip is clicked', () => {
    render(<EmptyState />);
    fireEvent.click(screen.getByRole('button', { name: 'Sapiens' }));
    expect(push).toHaveBeenCalledWith('/search?q=Sapiens');
  });
});
