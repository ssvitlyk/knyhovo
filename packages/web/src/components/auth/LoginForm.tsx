'use client';

import { useId, useRef, useState } from 'react';
import { Mail, MailCheck, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ds/Button';
import { AlertNote } from '@/components/alerts/AlertNote';
import { AlertToast } from '@/components/alerts/AlertToast';
import { requestMagicLink, AuthError } from '@/lib/api/auth';

/** Phases of the login flow. Mirrors the frozen design states. */
type Phase = 'idle' | 'sending' | 'success' | 'error';

/** Error flavour — same visual state, different copy so the user can act on it. */
type ErrorKind = 'generic' | 'forbidden' | 'rate-limited';

const ERROR_MESSAGES: Record<ErrorKind, string> = {
  generic: 'Не вдалося надіслати посилання. Перевірте email і спробуйте ще раз.',
  forbidden: 'Вхід на цьому середовищі обмежено. Ця адреса не має доступу.',
  'rate-limited': 'Забагато спроб. Зачекайте приблизно 15 хвилин і спробуйте ще раз.',
};

function toErrorKind(err: unknown): ErrorKind {
  if (err instanceof AuthError) {
    if (err.status === 403) return 'forbidden';
    if (err.status === 429) return 'rate-limited';
  }
  return 'generic';
}

/** Basic client-side email shape check (matches the design's validation). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Resend confirmation toast lifetime (ms) — per the frozen design. */
const RESEND_TOAST_MS = 2400;

export interface LoginFormProps {
  /** Validated internal path to return to after login; forwarded to the API. */
  readonly returnTo?: string | null;
  /** Autofocus the email field on mount (true on the dedicated page). */
  readonly autoFocus?: boolean;
}

/**
 * LoginForm — the single shared Magic Link login component used by both the
 * `/login` page and the header login modal. Implements idle → sending →
 * success | error, plus resend (with toast) and change-email on the success
 * screen. Composes only DS primitives and the existing alert note/toast.
 */
export function LoginForm({ returnTo = null, autoFocus = false }: LoginFormProps): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('idle');
  const [errorKind, setErrorKind] = useState<ErrorKind>('generic');
  const [email, setEmail] = useState('');
  const [resentToast, setResentToast] = useState(false);
  const resendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailId = useId();

  const valid = EMAIL_RE.test(email.trim());

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!valid || phase === 'sending') return;
    setPhase('sending');
    try {
      await requestMagicLink(email.trim(), returnTo);
      setPhase('success');
    } catch (err) {
      // Same calm error state per design; only the copy varies (403/429/generic).
      setErrorKind(toErrorKind(err));
      setPhase('error');
    }
  }

  async function resend(): Promise<void> {
    try {
      await requestMagicLink(email.trim(), returnTo);
      setResentToast(true);
      if (resendTimer.current) clearTimeout(resendTimer.current);
      resendTimer.current = setTimeout(() => setResentToast(false), RESEND_TOAST_MS);
    } catch (err) {
      setErrorKind(toErrorKind(err));
      setPhase('error');
    }
  }

  if (phase === 'success') {
    return (
      <div className="ml-panel" data-screen="success">
        <span className="np-unsub__icon">
          <MailCheck size={26} aria-hidden />
        </span>
        <h1 className="np-unsub__title">Перевірте пошту</h1>
        <p className="ml-lead ml-lead--inline">Ми надіслали посилання для входу на:</p>
        <p className="ml-email">{email.trim()}</p>

        <div className="ml-actions">
          <Button
            variant="secondary"
            className="ml-btn-block"
            onClick={() => void resend()}
            iconLeft={<RefreshCw size={15} aria-hidden />}
          >
            Надіслати ще раз
          </Button>
          <button type="button" className="ml-link" onClick={() => setPhase('idle')}>
            Змінити email
          </button>
        </div>

        <p className="ml-sub">Посилання діє обмежений час.</p>
        <p className="ml-spam">Не отримали лист? Перевірте папку «Спам».</p>

        {resentToast && (
          <AlertToast
            className="np-toast"
            durationMs={RESEND_TOAST_MS}
            onDismiss={() => setResentToast(false)}
          >
            Посилання надіслано
          </AlertToast>
        )}
      </div>
    );
  }

  const sending = phase === 'sending';
  return (
    <div className="ml-panel" data-screen={phase}>
      <span className="np-unsub__icon">
        <Mail size={26} aria-hidden />
      </span>
      <h1 className="np-unsub__title">Увійти в Knyhovo</h1>
      <p className="ml-lead">Ми надішлемо безпечне посилання для входу на вашу пошту.</p>

      {phase === 'error' && (
        <div className="ml-error">
          <AlertNote kind="err">{ERROR_MESSAGES[errorKind]}</AlertNote>
        </div>
      )}

      <form className="ml-form" onSubmit={(e) => void submit(e)}>
        <div className="ml-field">
          <label className="ml-label" htmlFor={emailId}>
            Email
          </label>
          <input
            id={emailId}
            type="email"
            inputMode="email"
            autoComplete="email"
            className="kn-input"
            placeholder="your@email.com"
            value={email}
            disabled={sending}
            autoFocus={autoFocus}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="ml-actions">
          <Button
            variant="primary"
            type="submit"
            className="ml-btn-block"
            disabled={sending || !valid}
            iconLeft={sending ? <span className="ml-spin" aria-hidden="true" /> : null}
          >
            {sending
              ? 'Надсилаємо посилання…'
              : phase === 'error'
                ? 'Надіслати ще раз'
                : 'Надіслати посилання'}
          </Button>
        </div>
      </form>

      <p className="ml-trust">
        <Shield size={14} aria-hidden /> Без паролів. Ми надсилаємо лише безпечне посилання для входу.
      </p>
    </div>
  );
}
