import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GenreGrid } from '../GenreGrid';
import { GENRES } from '../content';

// next/link → a plain anchor so the grid renders deterministically in jsdom.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('GenreGrid', () => {
  it('renders the section header and one card per genre', () => {
    const { container } = render(<GenreGrid />);
    expect(screen.getByRole('heading', { name: 'За жанром' })).toBeTruthy();
    expect(container.querySelectorAll('.genre-card')).toHaveLength(GENRES.length);
  });

  it('each genre card links to its /search?q=<name> seam', () => {
    const { container } = render(<GenreGrid />);
    const hrefs = Array.from(container.querySelectorAll('a.genre-card')).map((a) => a.getAttribute('href'));
    for (const g of GENRES) {
      expect(hrefs).toContain(`/search?q=${encodeURIComponent(g.name)}`);
    }
  });

  it('exposes the «Усі жанри →» see-all link', () => {
    render(<GenreGrid />);
    expect(screen.getByRole('link', { name: /Усі жанри/ })).toBeTruthy();
  });
});
