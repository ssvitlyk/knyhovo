import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeaderNav } from '../HeaderNav';

const navigation = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

describe('HeaderNav', () => {
  it('renders exactly the frozen chrome items: Головна · Добірки · Бажанки · Про нас', () => {
    navigation.pathname = '/';
    render(<HeaderNav wishlistCount={0} />);
    const labels = screen.getAllByRole('link').map((a) => a.textContent);
    expect(labels).toEqual(['Головна', 'Добірки', 'Бажанки', 'Про нас']);
  });

  it('marks Головна active on /', () => {
    navigation.pathname = '/';
    render(<HeaderNav wishlistCount={0} />);
    expect(screen.getByRole('link', { name: 'Головна' })).toHaveClass('knh__link--active');
    expect(screen.getByRole('link', { name: 'Добірки' })).not.toHaveClass('knh__link--active');
  });

  it('marks Добірки active on /dobirky and on genre pages', () => {
    navigation.pathname = '/dobirky/populyarne-zaraz';
    const { unmount } = render(<HeaderNav wishlistCount={0} />);
    expect(screen.getByRole('link', { name: 'Добірки' })).toHaveClass('knh__link--active');
    unmount();

    navigation.pathname = '/zhanry/fantastyka';
    render(<HeaderNav wishlistCount={0} />);
    expect(screen.getByRole('link', { name: 'Добірки' })).toHaveClass('knh__link--active');
  });

  it('marks Бажанки active on /wishlist', () => {
    navigation.pathname = '/wishlist';
    render(<HeaderNav wishlistCount={0} />);
    expect(screen.getByRole('link', { name: 'Бажанки' })).toHaveClass('knh__link--active');
  });

  it('links point at the real routes', () => {
    navigation.pathname = '/';
    render(<HeaderNav wishlistCount={0} />);
    expect(screen.getByRole('link', { name: 'Головна' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Добірки' })).toHaveAttribute('href', '/dobirky');
    expect(screen.getByRole('link', { name: 'Бажанки' })).toHaveAttribute('href', '/wishlist');
  });

  it('shows the badge inside Бажанки when wishlistCount > 0', () => {
    navigation.pathname = '/';
    render(<HeaderNav wishlistCount={19} />);
    const link = screen.getByRole('link', { name: /Бажанки/ });
    expect(link.querySelector('.knh__badge')?.textContent).toBe('19');
  });

  it('shows no badge when wishlistCount is 0', () => {
    navigation.pathname = '/';
    render(<HeaderNav wishlistCount={0} />);
    const link = screen.getByRole('link', { name: 'Бажанки' });
    expect(link.querySelector('.knh__badge')).toBeNull();
  });
});
