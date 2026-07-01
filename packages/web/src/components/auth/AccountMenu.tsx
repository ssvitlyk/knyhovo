'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ds/Button';
import { logout } from '@/lib/api/auth';
import { hardNavigate } from '@/lib/navigate';

export interface AccountMenuProps {
  /** Authenticated user's email, shown as the account button label. */
  readonly email: string;
}

/**
 * AccountMenu — the authenticated-state header control that replaces «Увійти».
 * A single DS secondary button (account) that reveals a small menu with «Вийти».
 * Logout clears the session then hard-navigates home so the server-rendered
 * header re-renders in the guest state. Reuses DS tokens only — no design change.
 */
export function AccountMenu({ email }: AccountMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent): void {
      if (ref.current != null && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleLogout(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      await logout();
    } catch {
      // Even if the network call fails, drop the user to the guest home; the
      // cookie is httpOnly and the server will re-evaluate the session there.
    }
    hardNavigate('/');
  }

  return (
    <div className="kn-account" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        className="kn-account__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Профіль"
        onClick={() => setOpen((o) => !o)}
        iconLeft={<User size={15} aria-hidden />}
      >
        Профіль
      </Button>
      {open && (
        <div className="kn-account__menu" role="menu">
          {/* Email is secondary detail — shown only inside the menu, muted. */}
          <p className="kn-account__email" title={email}>
            {email}
          </p>
          <button
            type="button"
            className="kn-account__item"
            role="menuitem"
            disabled={busy}
            onClick={() => void handleLogout()}
          >
            <LogOut size={15} aria-hidden /> Вийти
          </button>
        </div>
      )}
    </div>
  );
}
