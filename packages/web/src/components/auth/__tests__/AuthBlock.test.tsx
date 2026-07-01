import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuthBlock } from '../AuthBlock';

const openLogin = vi.fn();
vi.mock('../LoginModalProvider', () => ({
  useLoginModal: () => ({ openLogin }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('AuthBlock', () => {
  it('renders the wishlist context copy and opens the login modal with returnTo', () => {
    render(<AuthBlock context="wishlist" returnTo="/wishlist" />);
    expect(screen.getByText('Увійдіть, щоб продовжити')).toBeInTheDocument();
    expect(screen.getByText(/зберігати книги/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }));
    expect(openLogin).toHaveBeenCalledWith('/wishlist');
  });

  it('renders the settings context copy and opens the modal with its returnTo', () => {
    render(<AuthBlock context="settings" returnTo="/settings/notifications" />);
    expect(screen.getByText(/керувати налаштуваннями сповіщень/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }));
    expect(openLogin).toHaveBeenCalledWith('/settings/notifications');
  });
});
