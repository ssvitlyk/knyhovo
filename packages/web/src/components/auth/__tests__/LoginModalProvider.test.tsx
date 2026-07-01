import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LoginModalProvider } from '../LoginModalProvider';
import { LoginButton } from '../LoginButton';
import { AuthBlock } from '../AuthBlock';

// LoginForm hits the auth API on submit; stub it so the modal renders in isolation.
vi.mock('@/lib/api/auth', () => ({
  requestMagicLink: vi.fn().mockResolvedValue(undefined),
  AuthError: class AuthError extends Error {},
}));

afterEach(() => {
  vi.clearAllMocks();
});

/** Count of live modal overlays/backdrops in the DOM. */
function overlayCount(): number {
  return document.querySelectorAll('.ml-modal-overlay').length;
}

describe('LoginModalProvider (singleton login modal)', () => {
  it('renders no modal until a trigger is clicked', () => {
    render(
      <LoginModalProvider>
        <LoginButton />
      </LoginModalProvider>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(overlayCount()).toBe(0);
  });

  it('keeps exactly one modal + backdrop across many triggers and repeated clicks', () => {
    render(
      <LoginModalProvider>
        <LoginButton />
        <LoginButton />
      </LoginModalProvider>,
    );

    const [first, second] = screen.getAllByRole('button', { name: 'Увійти' });

    // Open from the first trigger.
    fireEvent.click(first!);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(overlayCount()).toBe(1);

    // Click the OTHER trigger while already open — still one overlay.
    fireEvent.click(second!);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(overlayCount()).toBe(1);

    // Hammer the same trigger — no additional overlays/portals/backdrops.
    fireEvent.click(first!);
    fireEvent.click(first!);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(overlayCount()).toBe(1);
  });

  it('AuthBlock CTA + header trigger share ONE overlay (no grey double-overlay)', () => {
    // Reproduces the reported bug: open from the AuthBlock CTA, then click the
    // header «Увійти» without closing — there must still be a single overlay.
    render(
      <LoginModalProvider>
        <LoginButton />
        <AuthBlock context="wishlist" returnTo="/wishlist" />
      </LoginModalProvider>,
    );

    const triggers = screen.getAllByRole('button', { name: 'Увійти' });
    // triggers[0] = header LoginButton, triggers[1] = AuthBlock CTA.
    fireEvent.click(triggers[1]!); // AuthBlock «Увійти»
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(overlayCount()).toBe(1);

    fireEvent.click(triggers[0]!); // header «Увійти» while already open → no-op
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(overlayCount()).toBe(1);
  });

  it('closing clears the overlay AND the body scroll-lock; reopening works', () => {
    render(
      <LoginModalProvider>
        <LoginButton />
      </LoginModalProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByRole('button', { name: 'Закрити' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(overlayCount()).toBe(0);
    // No leftover body scroll-lock after close.
    expect(document.body.style.overflow).toBe('');

    // Reopening produces a normal single overlay again.
    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(overlayCount()).toBe(1);
  });
});
