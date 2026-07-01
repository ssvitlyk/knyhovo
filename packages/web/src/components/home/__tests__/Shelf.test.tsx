import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Shelf } from '../Shelf';
import type { HomeBook } from '../content';

// next/link → a plain anchor so the shelf renders deterministically in jsdom.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const BOOKS: readonly HomeBook[] = [
  { title: 'Атомні звички', author: 'Джеймс Клір', price: '245 ₴', oldPrice: '320 ₴', store: 'Yakaboo', badge: 'green', cover: '/covers/atomni.png' },
  { title: 'Sapiens', author: 'Ю. Н. Харарі', price: '380 ₴', oldPrice: '450 ₴', store: 'Rozetka', badge: 'solid:-16%', cover: '/covers/sapiens.png' },
  { title: 'Інтернат', author: 'Сергій Жадан', price: '210 ₴', store: 'Книгарня «Є»', badge: 'accent:Новинка', cover: '/covers/internat.png' },
];

function renderShelf(books: readonly HomeBook[]): HTMLElement {
  const { container } = render(
    <Shelf eyebrow="Найчастіше шукають" title="Популярне зараз" cta="Усі →" ctaHref="/search" books={books} />,
  );
  return container;
}

describe('Shelf', () => {
  it('renders eyebrow, title, CTA and one card per book', () => {
    const container = renderShelf(BOOKS);
    expect(screen.getByText('Найчастіше шукають')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Популярне зараз' })).toBeTruthy();
    expect(screen.getByText('Усі →')).toBeTruthy();
    expect(container.querySelectorAll('.kn-book')).toHaveLength(BOOKS.length);
  });

  it('renders the frozen badge vocabulary (green / solid / accent)', () => {
    renderShelf(BOOKS);
    expect(screen.getByText('Найкраща ціна')).toBeTruthy();
    expect(screen.getByText('-16%')).toBeTruthy();
    expect(screen.getByText('Новинка')).toBeTruthy();
  });

  it('CTA and mobile chevron point at the canonical catalog href', () => {
    const container = renderShelf(BOOKS);
    const links = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links.every((href) => href === '/search')).toBe(true);
  });

  it('empty shelf → the whole section is hidden', () => {
    const { container } = render(<Shelf title="Порожньо" cta="Усі →" ctaHref="/search" books={[]} />);
    expect(container.querySelector('.hp-shelf')).toBeNull();
    expect(container.firstChild).toBeNull();
  });
});
