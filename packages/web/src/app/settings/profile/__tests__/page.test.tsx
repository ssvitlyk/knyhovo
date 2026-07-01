import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsAuthRequired } from '@/components/settings/SettingsAuthRequired';

// Mirror the AuthBlock test pattern — mock the LoginModalProvider hook
const openLogin = vi.fn();
vi.mock('@/components/auth/LoginModalProvider', () => ({
  useLoginModal: () => ({ openLogin }),
}));

/**
 * Page-level auth-required behaviour for the profile route.
 * Testing SettingsAuthRequired with context="profile" / returnTo="/settings/profile"
 * mirrors what ProfilePage renders when `me()` returns null, and avoids
 * the complexity of awaiting async server components in jsdom.
 */
describe('ProfilePage (unauthenticated — SettingsAuthRequired with profile context)', () => {
  it('renders the «Увійти» button and profile-specific copy when context is profile', () => {
    render(
      <SettingsAuthRequired context="profile" returnTo="/settings/profile" />,
    );
    expect(screen.getByRole('button', { name: 'Увійти' })).toBeInTheDocument();
    expect(screen.getByText(/керувати профілем/)).toBeInTheDocument();
  });

  it('clicking «Увійти» opens the login modal with the profile returnTo', () => {
    render(
      <SettingsAuthRequired context="profile" returnTo="/settings/profile" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }));
    expect(openLogin).toHaveBeenCalledWith('/settings/profile');
  });
});
