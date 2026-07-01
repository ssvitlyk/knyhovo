import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccountMenu } from '../AccountMenu';
import { logout } from '@/lib/api/auth';
import { hardNavigate } from '@/lib/navigate';

vi.mock('@/lib/api/auth', () => ({
  logout: vi.fn().mockResolvedValue(undefined),
  AuthError: class AuthError extends Error {},
}));
vi.mock('@/lib/navigate', () => ({ hardNavigate: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
});

describe('AccountMenu', () => {
  it('shows a «Профіль» button (no email in the button) and reveals email + «Вийти» only in the menu', () => {
    render(<AccountMenu email="reader@knyhovo.dev" />);

    // Button reads «Профіль»; email is not surfaced until the menu opens.
    expect(screen.getByRole('button', { name: 'Профіль' })).toBeInTheDocument();
    expect(screen.queryByText('reader@knyhovo.dev')).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /Вийти/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Профіль' }));
    // Email now visible inside the dropdown as secondary detail.
    expect(screen.getByText('reader@knyhovo.dev')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Вийти/ })).toBeInTheDocument();
  });

  it('logout clears the session then hard-navigates home', async () => {
    render(<AccountMenu email="reader@knyhovo.dev" />);
    fireEvent.click(screen.getByRole('button', { name: 'Профіль' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Вийти/ }));

    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    expect(hardNavigate).toHaveBeenCalledWith('/');
  });
});
