'use client';

import { User } from 'lucide-react';
import { Button } from '@/components/ds/Button';
import { useLoginModal } from './LoginModalProvider';
import { isSafeReturnTo } from '@/lib/returnTo';

/**
 * LoginButton — header «Увійти» trigger. Visually the SAME account button as the
 * authenticated «Профіль» control (shared `.kn-account__btn` accent style + user
 * icon); only the label differs, so guest → auth reads as one button changing
 * state. Opens the app's single login modal over the current page, carrying the
 * current path as returnTo. Holds no modal of its own.
 */
export function LoginButton(): React.JSX.Element {
  const { openLogin } = useLoginModal();

  function handleClick(): void {
    const path = window.location.pathname + window.location.search;
    openLogin(isSafeReturnTo(path) ? path : null);
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      className="kn-account__btn"
      onClick={handleClick}
      iconLeft={<User size={15} aria-hidden />}
    >
      Увійти
    </Button>
  );
}
