import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { CollectionDto } from '@/lib/api/types';
import { CollectionsNav } from '../CollectionsNav';

const viewport = vi.hoisted(() => ({ isMobile: true }));

vi.mock('../useIsMobile', () => ({
  useIsMobile: () => viewport.isMobile,
}));

function genre(slug: string, name: string, icon?: string): CollectionDto {
  return {
    id: slug,
    slug,
    type: 'taxonomic' as CollectionDto['type'],
    name,
    description: '',
    bookCount: 30,
    updatedAt: '2026-07-04T00:00:00.000Z',
    isActive: true,
    icon,
  };
}

const GENRES: readonly CollectionDto[] = [
  genre('fantastyka', 'Фантастика', 'rocket'),
  genre('tryllery', 'Трилери', 'knife'),
  genre('istoriia', 'Історія', 'landmark'),
];

beforeEach(() => {
  viewport.isMobile = true;
  window.scrollTo = vi.fn();
});

describe('CollectionsNav — mobile (≤768px), 2026-07-04 dropdowns patch', () => {
  it('renders two dropdown triggers instead of the scroll row', () => {
    render(<CollectionsNav genres={GENRES} />);
    expect(screen.getByRole('button', { name: /Популярне/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Жанри/ })).toBeInTheDocument();
    expect(document.querySelector('.cnav__mobrow')).not.toBeNull();
    expect(document.querySelector('.cnav__row')).toBeNull();
    expect(document.querySelector('.cnav-sheet')).toBeNull();
  });

  it('section dropdown lists all 6 sections with the patched labels', () => {
    render(<CollectionsNav genres={GENRES} />);
    fireEvent.click(screen.getByRole('button', { name: /Популярне/ }));
    const menu = screen.getByRole('menu');
    const labels = Array.from(menu.querySelectorAll('.cnav__secmenu-item')).map((a) =>
      a.textContent?.trim(),
    );
    expect(labels).toEqual(['Популярне', 'У бажанках', 'Новинки', 'Знижки', 'Настрої', 'Колекції']);
  });

  it('opening one dropdown closes the other', () => {
    render(<CollectionsNav genres={GENRES} />);
    const secBtn = screen.getByRole('button', { name: /Популярне/ });
    const genBtn = screen.getByRole('button', { name: /Жанри/ });
    fireEvent.click(secBtn);
    expect(secBtn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(genBtn);
    expect(genBtn).toHaveAttribute('aria-expanded', 'true');
    expect(secBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('genres dropdown links straight to /zhanry/:slug and filters by search', () => {
    render(<CollectionsNav genres={GENRES} />);
    fireEvent.click(screen.getByRole('button', { name: /Жанри/ }));
    const link = screen.getByRole('menuitem', { name: /Фантастика/ });
    expect(link).toHaveAttribute('href', '/zhanry/fantastyka');

    fireEvent.change(screen.getByLabelText('Пошук жанру'), { target: { value: 'істор' } });
    expect(screen.queryByRole('menuitem', { name: /Фантастика/ })).toBeNull();
    expect(screen.getByRole('menuitem', { name: /Історія/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Пошук жанру'), { target: { value: 'ъъъ' } });
    expect(screen.getByText('Нічого не знайшли.')).toBeInTheDocument();
  });

  it('clears the genre search query when the dropdown closes', () => {
    render(<CollectionsNav genres={GENRES} />);
    const genBtn = screen.getByRole('button', { name: /Жанри/ });
    fireEvent.click(genBtn);
    fireEvent.change(screen.getByLabelText('Пошук жанру'), { target: { value: 'істор' } });
    fireEvent.click(genBtn); // close
    fireEvent.click(genBtn); // reopen
    expect(screen.getByLabelText('Пошук жанру')).toHaveValue('');
  });

  it('closes an open dropdown on Escape', () => {
    render(<CollectionsNav genres={GENRES} />);
    const secBtn = screen.getByRole('button', { name: /Популярне/ });
    fireEvent.click(secBtn);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(secBtn).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('CollectionsNav — desktop (>768px), unchanged', () => {
  it('renders the scroll row with links and the «Жанри» trigger, no mobile row', () => {
    viewport.isMobile = false;
    render(<CollectionsNav genres={GENRES} />);
    expect(document.querySelector('.cnav__row')).not.toBeNull();
    expect(document.querySelector('.cnav__mobrow')).toBeNull();
    const links = Array.from(document.querySelectorAll('.cnav__links .cnav__link')).map((a) =>
      a.textContent?.trim(),
    );
    expect(links).toEqual(['Популярне', 'У бажанках', 'Новинки', 'Знижки', 'Настрої', 'Колекції']);
    expect(screen.getByRole('button', { name: /Жанри/ })).toBeInTheDocument();
  });

  it('mega menu opens on click with text-only genre links (no icons)', () => {
    viewport.isMobile = false;
    render(<CollectionsNav genres={GENRES} />);
    fireEvent.click(screen.getByRole('button', { name: /Жанри/ }));
    const mega = document.querySelector('.cnav__mega');
    expect(mega).not.toBeNull();
    const genreLink = screen.getByRole('link', { name: 'Фантастика' });
    expect(genreLink).toHaveAttribute('href', '/zhanry/fantastyka');
    expect(genreLink.querySelector('svg')).toBeNull();
  });
});
