import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecommendsShelf } from '../RecommendsShelf';
import type { HomeBook } from '../content';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const BOOKS: readonly HomeBook[] = [
  { title: 'Кобзар', author: 'Тарас Шевченко', price: '165 ₴', store: 'Книгарня «Є»', badge: null, cover: '/covers/kobzar.png' },
  { title: 'Маленький принц', author: 'А. де Сент-Екзюпері', price: '185 ₴', store: 'Yakaboo', badge: 'green', cover: '/covers/pryntz.png' },
];

describe('RecommendsShelf', () => {
  it('renders the framed «Книговик радить» shelf with the mascot and cards', () => {
    const { container } = render(<RecommendsShelf books={BOOKS} ctaHref="/search" />);
    expect(screen.getByRole('heading', { name: 'Книговик радить' })).toBeTruthy();
    expect(screen.getByAltText('Книговик')).toBeTruthy();
    expect(container.querySelector('.hp-recommends--framed')).toBeTruthy();
    expect(container.querySelectorAll('.kn-book')).toHaveLength(BOOKS.length);
  });

  it('empty → the whole section is hidden', () => {
    const { container } = render(<RecommendsShelf books={[]} ctaHref="/search" />);
    expect(container.firstChild).toBeNull();
  });
});
