'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from './Modal';
import { LoginForm } from './LoginForm';

interface LoginModalContextValue {
  /** Open the single app-wide login modal, optionally carrying a returnTo path. */
  readonly openLogin: (returnTo?: string | null) => void;
}

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

/**
 * Access the singleton login modal. Any number of triggers (header, future
 * buttons) share the ONE modal instance mounted by LoginModalProvider.
 */
export function useLoginModal(): LoginModalContextValue {
  const ctx = useContext(LoginModalContext);
  if (ctx == null) {
    throw new Error('useLoginModal must be used within <LoginModalProvider>');
  }
  return ctx;
}

/**
 * LoginModalProvider — mounts EXACTLY ONE login Modal (and therefore one
 * backdrop/portal) for the whole app, wrapping the layout. Triggers call
 * `openLogin()`; repeated calls only toggle shared state, so no additional
 * overlays, portals, dialogs or backdrops are ever created.
 */
interface ModalState {
  readonly open: boolean;
  readonly returnTo: string | null;
}

export function LoginModalProvider({ children }: { readonly children: ReactNode }): React.JSX.Element {
  // Single state object so open+returnTo update atomically (no nested setState).
  const [state, setState] = useState<ModalState>({ open: false, returnTo: null });

  const openLogin = useCallback((rt?: string | null) => {
    // Strict no-op while already open: repeated clicks from ANY trigger never
    // reset the form nor spawn a second overlay/backdrop. The one modal stays.
    setState((prev) => (prev.open ? prev : { open: true, returnTo: rt ?? null }));
  }, []);

  const close = useCallback(() => {
    setState((prev) => (prev.open ? { open: false, returnTo: prev.returnTo } : prev));
  }, []);

  return (
    <LoginModalContext.Provider value={{ openLogin }}>
      {children}
      <Modal open={state.open} onClose={close} label="Вхід у Knyhovo">
        <LoginForm returnTo={state.returnTo} autoFocus />
      </Modal>
    </LoginModalContext.Provider>
  );
}
