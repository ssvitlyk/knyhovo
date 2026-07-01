'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mail, LogOut, AlertCircle } from 'lucide-react';
import { AlertToast } from '@/components/alerts/AlertToast';
import { updateProfile } from '@/lib/api/profile';
import { requestMagicLink, logout } from '@/lib/api/auth';
import { hardNavigate } from '@/lib/navigate';

const MAX_NAME_LENGTH = 40;

export interface ProfilePanelProps {
  readonly email: string;
  readonly displayName: string | null;
}

/**
 * ProfilePanel — client component that renders the profile settings UI.
 * Four sections: personal data (name editing), account facts, auth info,
 * and a calm danger zone (logout).
 */
export function ProfilePanel({ email, displayName }: ProfilePanelProps): React.JSX.Element {
  const [name, setName] = useState(displayName ?? '');
  // Last persisted value (trimmed/normalised) — used to skip no-op saves.
  const [savedName, setSavedName] = useState((displayName ?? '').trim());
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [magicBusy, setMagicBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  const dismissToast = useCallback(() => setToast(null), []);
  const saveErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (saveErrorTimer.current != null) clearTimeout(saveErrorTimer.current); }, []);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setName(e.target.value);
    if (nameError != null) setNameError(null);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (saving) return;
    const trimmed = name.trim();
    if (trimmed.length > MAX_NAME_LENGTH) {
      setNameError("Ім’я задовге — максимум 40 символів.");
      return;
    }
    setNameError(null);
    // Nothing changed after trimming — skip the PATCH (and the toast) entirely.
    if (trimmed === savedName) return;
    setSaving(true);
    if (saveErrorTimer.current != null) clearTimeout(saveErrorTimer.current);
    setSaveError(null);

    try {
      const updated = await updateProfile({ displayName: trimmed === '' ? null : trimmed });
      const next = updated.displayName ?? '';
      setName(next);
      setSavedName(next);
      setSaving(false);
      setToast('Профіль оновлено');
    } catch {
      setSaving(false);
      setSaveError('Не вдалося зберегти профіль. Спробуйте ще раз.');
      saveErrorTimer.current = setTimeout(() => setSaveError(null), 5000);
    }
  }

  async function handleMagicLink(): Promise<void> {
    if (magicBusy) return;
    setMagicBusy(true);
    try {
      await requestMagicLink(email);
      setToast('Посилання надіслано');
    } catch {
      // silently ignore — the user can retry
    } finally {
      setMagicBusy(false);
    }
  }

  async function handleLogout(): Promise<void> {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await logout();
    } catch {
      // Even if the network call fails, navigate away — mirror AccountMenu.
    }
    hardNavigate('/');
  }

  const showNameErr = nameError != null;

  return (
    <div className="np-content" data-screen-label="Settings · Профіль">
      <div className="np-head">
        <div className="np-head__text">
          <h1 className="np-title">Профіль</h1>
          <p className="np-subtitle">Особисті дані та доступ до облікового запису Knyhovo.</p>
        </div>
      </div>

      <div className="pf-cards">

        {/* ── Section 1 · Особисті дані ───────────────────────────────────── */}
        <section className="pf-card" data-screen-label="Особисті дані">
          <div className="pf-card__head">
            <h2 className="pf-card__title">Особисті дані</h2>
          </div>
          <form onSubmit={(e) => { void handleSave(e); }}>
            <div className="pf-field">
              <label className="pf-label" htmlFor="pf-email">Email</label>
              <input
                id="pf-email"
                type="email"
                className="kn-input"
                value={email}
                readOnly
                aria-readonly="true"
              />
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="pf-name">
                Ім&apos;я для відображення{' '}
                <span className="pf-label__opt">· необов&apos;язково</span>
              </label>
              <input
                id="pf-name"
                type="text"
                className="kn-input"
                placeholder="Як до вас звертатися"
                value={name}
                onChange={handleNameChange}
                aria-invalid={showNameErr || undefined}
                aria-describedby="pf-name-help"
              />
              {showNameErr ? (
                <div className="al-note al-note--err pf-field-err" id="pf-name-help" role="alert">
                  <span className="al-note__icon">
                    <AlertCircle size={18} aria-hidden />
                  </span>
                  <div className="al-note__body">{nameError}</div>
                </div>
              ) : (
                <p className="pf-help" id="pf-name-help">
                  Це ім&apos;я буде використовуватися лише всередині Knyhovo.
                </p>
              )}
            </div>

            {saveError != null && (
              <div className="al-note al-note--err" style={{ marginTop: 'var(--space-3)' }}>
                <span className="al-note__icon">
                  <AlertCircle size={16} aria-hidden />
                </span>
                <div className="al-note__body">{saveError}</div>
              </div>
            )}

            <div className="pf-card__foot">
              <button
                type="submit"
                className="kn-btn kn-btn--primary"
                aria-busy={saving || undefined}
                disabled={saving || name.trim() === savedName}
              >
                Зберегти
              </button>
            </div>
          </form>
        </section>

        {/* ── Section 2 · Обліковий запис (read-only facts) ───────────────── */}
        <section className="pf-card" data-screen-label="Обліковий запис">
          <div className="pf-card__head">
            <h2 className="pf-card__title">Обліковий запис</h2>
          </div>
          <div className="pf-rows">
            <div className="pf-row">
              <span className="pf-row__label">Email</span>
              <span className="pf-row__value">{email}</span>
            </div>
            <div className="pf-row">
              <span className="pf-row__label">Спосіб входу</span>
              <span className="pf-row__value">
                Magic Link{' '}
                <span className="kn-badge kn-badge--accent">Активний</span>
              </span>
            </div>
          </div>
        </section>

        {/* ── Section 3 · Авторизація ─────────────────────────────────────── */}
        <section className="pf-card" data-screen-label="Авторизація">
          <div className="pf-card__head">
            <h2 className="pf-card__title">Авторизація</h2>
          </div>
          <div className="pf-auth">
            <span className="pf-auth__icon">
              <Mail size={22} aria-hidden />
            </span>
            <div className="pf-auth__body">
              <h3 className="pf-auth__title">Magic Link</h3>
              <p className="pf-auth__text">
                Для входу ми використовуємо одноразові безпечні посилання, які надходять на вашу електронну пошту.
              </p>
              <div className="pf-card__foot" style={{ justifyContent: 'flex-start' }}>
                <button
                  type="button"
                  className="kn-btn kn-btn--primary"
                  disabled={magicBusy}
                  onClick={() => { void handleMagicLink(); }}
                >
                  Надіслати нове посилання для входу
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4 · Небезпечна дія (calm — never red) ────────────────── */}
        <div>
          <p className="pf-danger-eyebrow">Небезпечна дія</p>
          <section className="pf-card pf-card--quiet" data-screen-label="Вийти з акаунта">
            <div className="pf-quiet-row">
              <div className="pf-quiet-row__text">
                <p className="pf-quiet-row__title">Вийти з акаунта</p>
                <p className="pf-quiet-row__desc">
                  Після виходу вам потрібно буде повторно увійти за допомогою Magic Link.
                </p>
              </div>
              <button
                type="button"
                className="kn-btn kn-btn--primary"
                disabled={logoutBusy}
                onClick={() => { void handleLogout(); }}
              >
                <LogOut size={16} aria-hidden /> Вийти
              </button>
            </div>
          </section>
        </div>

      </div>

      {toast != null && (
        <AlertToast onDismiss={dismissToast} durationMs={1800} className="np-toast">
          {toast}
        </AlertToast>
      )}
    </div>
  );
}
