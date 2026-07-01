'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Link2Off, ArrowLeft } from 'lucide-react';
import { verifyMagicLink } from '@/lib/api/auth';
import { safeReturnTo } from '@/lib/returnTo';
import { hardNavigate } from '@/lib/navigate';

type Status = 'verifying' | 'invalid';

export interface VerifyClientProps {
  /** Magic-link token from the email URL (`/auth/verify?token=…`). */
  readonly token: string | null;
}

/**
 * VerifyClient — drives the magic-link verification on the dedicated page.
 * Shows the «Входимо…» redirect panel while POSTing the token; on success it
 * client-redirects to the validated returnTo (fallback `/`); on failure it
 * renders the «Посилання недійсне» panel. Runs the verify exactly once.
 */
export function VerifyClient({ token }: VerifyClientProps): React.JSX.Element {
  // Derive the initial status from the token presence so we never call setState
  // synchronously inside the effect for the missing-token case.
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'invalid');
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current || !token) return;
    ranRef.current = true;

    verifyMagicLink(token)
      .then((result) => {
        // Hard navigation (not router.replace) so the root layout + SiteHeader
        // re-render server-side with the freshly-set session cookie.
        hardNavigate(safeReturnTo(result.returnTo, '/'));
      })
      .catch(() => {
        setStatus('invalid');
      });
  }, [token]);

  if (status === 'invalid') {
    return (
      <div className="ml-panel" data-screen="invalid">
        <span className="np-unsub__icon">
          <Link2Off size={26} aria-hidden />
        </span>
        <h1 className="np-unsub__title">Посилання недійсне</h1>
        <p className="ml-lead">Це посилання вже використане або термін його дії минув.</p>
        <div className="ml-actions">
          <Link className="kn-btn kn-btn--primary ml-btn-block" href="/login">
            Отримати нове посилання
          </Link>
          <Link className="kn-btn kn-btn--secondary ml-btn-block" href="/">
            <ArrowLeft size={15} aria-hidden /> На головну
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-panel ml-redirect" data-screen="redirect" aria-busy="true">
      <img className="ml-redirect-logo ml-redirect-logo--light" src="/logo/knyhovo-logo-light.png" alt="Knyhovo" />
      <img className="ml-redirect-logo ml-redirect-logo--dark" src="/logo/knyhovo-logo-dark.png" alt="" />
      <h1 className="np-unsub__title">Входимо…</h1>
      <p className="ml-lead">Зачекайте секунду — переносимо вас назад.</p>
    </div>
  );
}
