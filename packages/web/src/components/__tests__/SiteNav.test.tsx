import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SiteNav } from '../SiteNav';

const navigation = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

describe('SiteNav', () => {
  it('renders exactly the frozen chrome items: Головна · Добірки · Бажанки · Про нас', () => {
    render(<SiteNav />);
    const labels = screen.getAllByRole('link').map((a) => a.textContent);
    expect(labels).toEqual(['Головна', 'Добірки', 'Бажанки', 'Про нас']);
  });

  it('marks Головна active on /', () => {
    navigation.pathname = '/';
    render(<SiteNav />);
    expect(screen.getByRole('link', { name: 'Головна' })).toHaveClass('nav-link--active');
    expect(screen.getByRole('link', { name: 'Добірки' })).not.toHaveClass('nav-link--active');
  });

  it('marks Добірки active on /dobirky and on genre pages', () => {
    navigation.pathname = '/dobirky/populyarne-zaraz';
    const { unmount } = render(<SiteNav />);
    expect(screen.getByRole('link', { name: 'Добірки' })).toHaveClass('nav-link--active');
    unmount();

    navigation.pathname = '/zhanry/fantastyka';
    render(<SiteNav />);
    expect(screen.getByRole('link', { name: 'Добірки' })).toHaveClass('nav-link--active');
  });

  it('marks Бажанки active on /wishlist', () => {
    navigation.pathname = '/wishlist';
    render(<SiteNav />);
    expect(screen.getByRole('link', { name: 'Бажанки' })).toHaveClass('nav-link--active');
  });

  it('links point at the real routes', () => {
    navigation.pathname = '/';
    render(<SiteNav />);
    expect(screen.getByRole('link', { name: 'Головна' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Добірки' })).toHaveAttribute('href', '/dobirky');
    expect(screen.getByRole('link', { name: 'Бажанки' })).toHaveAttribute('href', '/wishlist');
  });
});
