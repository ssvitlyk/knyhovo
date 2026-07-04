import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileHeader } from '../MobileHeader';

const navigation = vi.hoisted(() => ({ pathname: '/' }));
const { openLogin } = vi.hoisted(() => ({ openLogin: vi.fn() }));
const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
const { hardNavigate } = vi.hoisted(() => ({ hardNavigate: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/api/auth', () => ({ logout }));
vi.mock('@/lib/navigate', () => ({ hardNavigate }));
vi.mock('@/components/auth/LoginModalProvider', () => ({ useLoginModal: () => ({ openLogin }) }));

function makeMatchMedia(matches: boolean): typeof window.matchMedia {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('MobileHeader', () => {
  beforeEach(() => {
    navigation.pathname = '/';
    openLogin.mockReset();
    logout.mockReset();
    hardNavigate.mockReset();
    window.matchMedia = makeMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the search overlay via the search icon button and closes it via the backdrop', () => {
    render(<MobileHeader wishlistCount={0} authenticated={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Пошук' }));
    const dialog = screen.getByRole('dialog', { name: 'Пошук' });
    expect(dialog).toBeTruthy();

    const backdrop = dialog.querySelector('.knh-so__backdrop');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(screen.queryByRole('dialog', { name: 'Пошук' })).toBeNull();
  });

  it('closes the search overlay on Escape', () => {
    render(<MobileHeader wishlistCount={0} authenticated={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Пошук' }));
    expect(screen.getByRole('dialog', { name: 'Пошук' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Пошук' })).toBeNull();
  });

  it('opens the menu drawer via the burger button', () => {
    render(<MobileHeader wishlistCount={0} authenticated={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
    expect(screen.getByRole('dialog', { name: 'Меню' })).toBeTruthy();
  });

  it('wishlist heart links to /wishlist and shows the count bubble when count > 0', () => {
    render(<MobileHeader wishlistCount={3} authenticated={false} />);
    const heart = screen.getByRole('link', { name: /Бажанки/ });
    expect(heart).toHaveAttribute('href', '/wishlist');
    expect(heart.querySelector('.knh__count')?.textContent).toBe('3');
  });

  it('wishlist heart shows no count bubble when count is 0', () => {
    render(<MobileHeader wishlistCount={0} authenticated={false} />);
    const heart = screen.getByRole('link', { name: 'Бажанки' });
    expect(heart.querySelector('.knh__count')).toBeNull();
  });
});
