import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthorJump } from '../AuthorJump';

describe('AuthorJump', () => {
  it('renders the author name', () => {
    render(<AuthorJump author="Ліна Костенко" />);
    expect(screen.getByText('Ліна Костенко')).toBeInTheDocument();
  });

  it('links to /search with the encoded author query', () => {
    render(<AuthorJump author="Ліна Костенко" />);
    const link = screen.getByRole('link', { name: /Усі книги автора Ліна Костенко/ });
    expect(link.getAttribute('href')).toBe(
      `/search?q=${encodeURIComponent('Ліна Костенко')}`,
    );
  });

  it('renders the "Автор" badge label', () => {
    render(<AuthorJump author="Ліна Костенко" />);
    expect(screen.getByText('Автор')).toBeInTheDocument();
  });

  it('encodes special characters in the author name', () => {
    render(<AuthorJump author="O'Brien" />);
    const link = screen.getByRole('link', { name: /Усі книги автора O'Brien/ });
    expect(link.getAttribute('href')).toBe(
      `/search?q=${encodeURIComponent("O'Brien")}`,
    );
  });
});
