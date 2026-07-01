'use client';

import { Lock } from 'lucide-react';
import { useLoginModal } from './LoginModalProvider';

/** Context-specific copy for the auth-required block (frozen design). */
const AUTH_COPY = {
  wishlist: 'Увійдіть, щоб зберігати книги та отримувати сповіщення про ціни.',
  settings: 'Увійдіть, щоб керувати налаштуваннями сповіщень.',
} as const;

export type AuthBlockContext = keyof typeof AUTH_COPY;

export interface AuthBlockProps {
  /** Which gated surface this block guards — selects the supporting copy. */
  readonly context: AuthBlockContext;
  /** Internal path to return to after login (e.g. `/wishlist`). */
  readonly returnTo: string;
}

/**
 * AuthBlock — neutral auth-required state (NOT an error) for gated pages.
 * Its CTA opens the app's single login modal (same singleton the header uses),
 * so it never spawns a second overlay and repeated clicks are a no-op.
 */
export function AuthBlock({ context, returnTo }: AuthBlockProps): React.JSX.Element {
  const { openLogin } = useLoginModal();
  return (
    <div className="ml-authblock" data-context={context}>
      <span className="np-unsub__icon">
        <Lock size={26} aria-hidden />
      </span>
      <h2 className="ml-authblock__title">Увійдіть, щоб продовжити</h2>
      <p className="ml-authblock__text">{AUTH_COPY[context]}</p>
      <button type="button" className="kn-btn kn-btn--primary" onClick={() => openLogin(returnTo)}>
        Увійти
      </button>
    </div>
  );
}
