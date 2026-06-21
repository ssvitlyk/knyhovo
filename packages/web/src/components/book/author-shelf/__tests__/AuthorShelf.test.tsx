import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthorShelf } from '../AuthorShelf';
import type { AuthorShelfBook } from '@/lib/author-shelf/select';

// ---- helpers -------------------------------------------------------

function makeBook(n: number, overrides: Partial<AuthorShelfBook> = {}): AuthorShelfBook {
  return {
    id: `book-${n}`,
    title: `Book Title ${n}`,
    author: 'Test Author',
    price: `${n * 100} ₴`,
    store: 'Yakaboo',
    coverUrl: null,
    ...overrides,
  };
}

function makeRoster(count: number, overrides: Partial<AuthorShelfBook> = {}): AuthorShelfBook[] {
  return Array.from({ length: count }, (_, i) => makeBook(i + 1, overrides));
}

const CURRENT_ID = 'current-book';

// ---- rendering structure ------------------------------------------

describe('AuthorShelf', () => {
  it('renders all three wrappers (.as-desktop, .as-tablet, .as-mobile) when ≥2 books', () => {
    const { container } = render(
      <AuthorShelf currentId={CURRENT_ID} author="Test Author" roster={makeRoster(3)} />,
    );
    expect(container.querySelector('.as-desktop')).not.toBeNull();
    expect(container.querySelector('.as-tablet')).not.toBeNull();
    expect(container.querySelector('.as-mobile')).not.toBeNull();
  });

  it('renders the section heading with ≥2 books', () => {
    render(<AuthorShelf currentId={CURRENT_ID} author="Test Author" roster={makeRoster(3)} />);
    // Multiple wrappers render the heading; there should be at least one
    const headings = screen.getAllByText('Інші книги автора');
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('renders book titles', () => {
    render(
      <AuthorShelf currentId={CURRENT_ID} author="Test Author" roster={makeRoster(3)} />,
    );
    expect(screen.getAllByText('Book Title 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Book Title 2').length).toBeGreaterThanOrEqual(1);
  });

  it('renders book prices', () => {
    render(
      <AuthorShelf currentId={CURRENT_ID} author="Test Author" roster={makeRoster(3)} />,
    );
    expect(screen.getAllByText('100 ₴').length).toBeGreaterThanOrEqual(1);
  });

  it('renders cover img when coverUrl is provided', () => {
    const roster: AuthorShelfBook[] = [
      makeBook(1, { coverUrl: 'https://example.com/cover1.jpg' }),
      makeBook(2, { coverUrl: null }),
      makeBook(3),
    ];
    const { container } = render(
      <AuthorShelf currentId={CURRENT_ID} author="Test Author" roster={roster} />,
    );
    const covers = container.querySelectorAll('img.kn-book__cover');
    expect(covers.length).toBeGreaterThanOrEqual(1);
    const withCover = Array.from(covers).find(img => img.getAttribute('src') === 'https://example.com/cover1.jpg');
    expect(withCover).not.toBeUndefined();
  });

  it('renders no cover img when coverUrl is null', () => {
    const roster: AuthorShelfBook[] = [makeBook(1, { coverUrl: null }), makeBook(2)];
    const { container } = render(
      <AuthorShelf currentId={CURRENT_ID} author="Test Author" roster={roster} />,
    );
    const imgs = container.querySelectorAll('img.kn-book__cover');
    expect(imgs).toHaveLength(0);
  });

  it('returns null when only 1 effective book after excluding currentId', () => {
    const roster: AuthorShelfBook[] = [
      makeBook(1, { id: CURRENT_ID }),
      makeBook(2),
    ];
    const { container } = render(
      <AuthorShelf currentId={CURRENT_ID} author="Test Author" roster={roster} />,
    );
    // Only 1 book remains → show=false → returns null → empty container
    expect(container.firstChild).toBeNull();
  });

  it('returns null when 0 effective books after exclusion', () => {
    const { container } = render(
      <AuthorShelf currentId={CURRENT_ID} author="Test Author" roster={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  // ---- see-all link ------------------------------------------------

  it('renders see-all link with correct total when hasMore (desktop: roster > 4)', () => {
    const roster = makeRoster(6); // 6 books, cap=4 → hasMore
    render(<AuthorShelf currentId={CURRENT_ID} author="Test Author" roster={roster} />);
    const seeAllLinks = screen.getAllByText(/Усі книги автора \(6\)/);
    expect(seeAllLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('renders no desktop/tablet see-all when total ≤ cap', () => {
    const roster = makeRoster(3); // 3 books ≤ cap=4 → no hasMore for desktop
    const { container } = render(
      <AuthorShelf currentId={CURRENT_ID} author="Test Author" roster={roster} />,
    );
    const seeAllLinks = container.querySelectorAll('.as-all');
    expect(seeAllLinks).toHaveLength(0);
  });

  // ---- no discount badge ----------------------------------------

  it('renders no discount badge', () => {
    render(<AuthorShelf currentId={CURRENT_ID} author="Test Author" roster={makeRoster(3)} />);
    // The frozen design suppresses discount badges; no badge text should appear
    expect(screen.queryByText(/-\d+%/)).toBeNull();
  });

  // ---- card link href -------------------------------------------

  it('card links point to /books/:id', () => {
    render(
      <AuthorShelf currentId={CURRENT_ID} author="Test Author" roster={makeRoster(2)} />,
    );
    const links = screen.getAllByRole('link', { name: /Перейти до книги/ });
    expect(links.length).toBeGreaterThanOrEqual(1);
    const hrefs = links.map(l => l.getAttribute('href'));
    expect(hrefs.some(href => href === '/books/book-1')).toBe(true);
  });
});
