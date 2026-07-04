import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileDrawer } from '../MobileDrawer';

const navigation = vi.hoisted(() => ({ pathname: '/' }));
const { openLogin } = vi.hoisted(() => ({ openLogin: vi.fn() }));
const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
const { hardNavigate } = vi.hoisted(() => ({ hardNavigate: vi.fn() }));

vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));
vi.mock('@/lib/api/auth', () => ({ logout }));
vi.mock('@/lib/navigate', () => ({ hardNavigate }));
vi.mock('@/components/auth/LoginModalProvider', () => ({ useLoginModal: () => ({ openLogin }) }));

describe('MobileDrawer', () => {
  beforeEach(() => {
    navigation.pathname = '/';
    openLogin.mockReset();
    logout.mockReset().mockResolvedValue(undefined);
    hardNavigate.mockReset();
  });

  it('guest: shows Головна/Добірки/Про нас, hides Бажанки, shows Увійти not Вийти', () => {
    const onClose = vi.fn();
    render(<MobileDrawer authenticated={false} wishlistCount={0} onClose={onClose} />);
    expect(screen.getByText('Головна')).toBeTruthy();
    expect(screen.getByText('Добірки')).toBeTruthy();
    expect(screen.getByText('Про нас')).toBeTruthy();
    expect(screen.queryByText('Бажанки')).toBeNull();
    expect(screen.getByRole('button', { name: 'Увійти' })).toBeTruthy();
    expect(screen.queryByText('Вийти')).toBeNull();
  });

  it('guest: clicking Увійти calls openLogin and onClose', () => {
    const onClose = vi.fn();
    render(<MobileDrawer authenticated={false} wishlistCount={0} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }));
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('authenticated: shows Бажанки with badge, Профіль link, Вийти, no Увійти', () => {
    const onClose = vi.fn();
    render(<MobileDrawer authenticated={true} wishlistCount={5} onClose={onClose} />);
    const wishRow = screen.getByText('Бажанки').closest('a');
    expect(wishRow).toHaveAttribute('href', '/wishlist');
    expect(wishRow?.querySelector('.knh__badge')?.textContent).toBe('5');

    const profileLink = screen.getByText('Профіль').closest('a');
    expect(profileLink).toHaveAttribute('href', '/settings/profile');

    expect(screen.getByText('Вийти')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Увійти' })).toBeNull();
  });

  it('authenticated: clicking Вийти calls logout then hardNavigate("/")', async () => {
    const onClose = vi.fn();
    render(<MobileDrawer authenticated={true} wishlistCount={0} onClose={onClose} />);
    fireEvent.click(screen.getByText('Вийти').closest('button')!);
    await vi.waitFor(() => expect(hardNavigate).toHaveBeenCalledWith('/'));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
