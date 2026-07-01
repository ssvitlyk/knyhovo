import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeaderAuthActions } from '../HeaderAuthActions';
import { LoginModalProvider } from '../LoginModalProvider';

// LoginForm (mounted lazily by the provider's modal) pulls the auth client.
vi.mock('@/lib/api/auth', () => ({
  requestMagicLink: vi.fn(),
  logout: vi.fn(),
  AuthError: class AuthError extends Error {},
}));

describe('HeaderAuthActions', () => {
  it('guest (user=null) → shows the «Увійти» CTA', () => {
    render(
      <LoginModalProvider>
        <HeaderAuthActions user={null} />
      </LoginModalProvider>,
    );
    expect(screen.getByRole('button', { name: 'Увійти' })).toBeInTheDocument();
  });

  it('authenticated → shows «Профіль» account button (email not in the button) and NO «Увійти»', () => {
    // This is the post-magic-link state after redirect to returnTo=/wishlist:
    // the server-rendered header resolves the session and swaps the control.
    render(<HeaderAuthActions user={{ email: 'reader@knyhovo.dev' }} />);

    expect(screen.getByRole('button', { name: 'Профіль' })).toBeInTheDocument();
    // Email must NOT be surfaced directly in the header button.
    expect(screen.queryByText('reader@knyhovo.dev')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Увійти' })).toBeNull();
  });
});
