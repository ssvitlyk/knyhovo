'use strict';

// ─── Knyhovo · Settings → Профіль (Account / Profile) ──────────────────────────
// The last missing MVP screen. A natural continuation of the FROZEN Knyhovo
// surfaces (Settings → Сповіщення, Magic Link Login, Wishlist). Composes DS v1.0
// exports ONLY and reuses the approved interior chrome + Settings layout verbatim
// (NP_SiteHeader / NP_SiteFooter + the .np-shell/.np-container/.np-main/.np-layout/
// .np-sidenav/.np-card recipes injected by np-shared.jsx). No new visual language,
// colours, type, radii or shadows. No password, no avatar, no social login.

const DS = window.KnyhovoDesignSystem_9fa616;
const { Button, Badge } = DS;
const { NP_SiteHeader, NP_SiteFooter } = window;
const { useState, useRef } = React;

// ─── Style injection (pf-* only — extends the np-* chrome, never restyles it) ───
(function injectPFStyles() {
  if (document.getElementById('pf-styles')) return;
  const s = document.createElement('style');
  s.id = 'pf-styles';
  s.textContent = `
    /* The chrome (.np-shell / .np-container / .np-main / .np-layout / .np-sidenav /
       .site-header / .site-footer / .np-header-mob / .np--mob / .np-toast-wrap /
       .np-toast) is injected by np-shared.jsx and reused unchanged. pf-* only adds
       the account-card layouts on top of the SAME tokens. */

    /* Card stack — same rhythm as the Notifications card list (.np-cards) */
    .pf-cards { display: flex; flex-direction: column; gap: var(--space-5); }

    /* Account card — DS card anatomy + the SAME warm-paper wash as .np-card
       (derived from the accent token, no new colour) so Profile reads as the
       same family as Settings → Сповіщення. */
    .pf-card {
      background: color-mix(in oklab, var(--accent) 4.5%, var(--surface));
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      padding: var(--space-6);
    }
    .pf-card__head { margin: 0 0 var(--space-5); }
    .pf-card__title {
      font-family: var(--font-display); font-weight: var(--fw-semibold);
      font-size: var(--fs-title); line-height: var(--lh-snug);
      letter-spacing: var(--ls-tight); color: var(--text); margin: 0;
    }
    .pf-card__desc { font-size: var(--fs-sm); color: var(--text-muted); text-wrap: pretty; margin: var(--space-2) 0 0; max-width: 52ch; }

    /* Form field */
    .pf-field { display: flex; flex-direction: column; gap: var(--space-2); }
    .pf-field + .pf-field { margin-top: var(--space-5); }
    .pf-label { font-size: var(--fs-sm); font-weight: var(--fw-medium); color: var(--text-body); }
    .pf-label__opt { color: var(--text-muted); font-weight: var(--fw-regular); }
    .pf-card .kn-input { width: 100%; }
    .pf-card .kn-input:read-only,
    .pf-card .kn-input:disabled { background: var(--surface-sunk); color: var(--text-muted); cursor: default; }
    .pf-card .kn-input:read-only:focus { border-color: var(--border); box-shadow: none; }
    .pf-help { font-size: var(--fs-sm); color: var(--text-muted); text-wrap: pretty; margin: 0; }

    /* Inline validation note — reuses the frozen .al-note--err language (never red) */
    .pf-field-err { margin-top: var(--space-2); }

    /* Card footer — action row (button right on desktop) */
    .pf-card__foot { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-6); }
    .pf-card__foot--between { justify-content: space-between; }

    /* Definition rows (read-only account facts) — quiet label/value list */
    .pf-rows { display: flex; flex-direction: column; }
    .pf-row {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-5); padding: var(--space-4) 0;
      border-bottom: 1px solid var(--border);
    }
    .pf-row:first-child { padding-top: 0; }
    .pf-row:last-child { padding-bottom: 0; border-bottom: none; }
    .pf-row__label { font-size: var(--fs-sm); color: var(--text-muted); flex: none; }
    .pf-row__value { display: flex; align-items: center; gap: var(--space-3); font-size: var(--fs-body); font-weight: var(--fw-medium); color: var(--text-body); text-align: right; min-width: 0; word-break: break-word; }
    .pf-row__value .kn-badge { flex: none; }

    /* Auth info block (Section 3) — icon medallion reuses .np-unsub__icon recipe */
    .pf-auth { display: flex; gap: var(--space-5); align-items: flex-start; }
    .pf-auth__icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: var(--radius-pill); background: var(--surface-accent); color: var(--icon-muted); flex: none; }
    .pf-auth__body { min-width: 0; flex: 1; }
    .pf-auth__title { font-family: var(--font-display); font-weight: var(--fw-semibold); font-size: var(--fs-title); line-height: var(--lh-snug); color: var(--text); margin: 0 0 var(--space-2); }
    .pf-auth__text { font-size: var(--fs-sm); color: var(--text-muted); text-wrap: pretty; margin: 0; max-width: 54ch; }

    /* Danger zone (Section 4) — VERY calm. Never red, no destructive styling.
       A recessed surface sets it apart without alarm. */
    .pf-danger-eyebrow {
      font-size: var(--fs-xs); letter-spacing: var(--ls-eyebrow);
      text-transform: uppercase; color: var(--text-muted); font-weight: var(--fw-semibold);
      margin: var(--space-3) 0 var(--space-3);
    }
    .pf-card--quiet { background: var(--surface-sunk); }
    .pf-card--quiet .pf-card__title { font-size: var(--fs-body); font-family: var(--font-body); }
    .pf-quiet-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); flex-wrap: wrap; }
    .pf-quiet-row__text { min-width: 0; flex: 1 1 280px; }
    .pf-quiet-row__title { font-weight: var(--fw-semibold); font-size: var(--fs-body); color: var(--text); margin: 0 0 var(--space-1); }
    .pf-quiet-row__desc { font-size: var(--fs-sm); color: var(--text-muted); text-wrap: pretty; margin: 0; max-width: 52ch; }

    /* ── Mobile (375px) — single column, full-width cards, 44px+ touch targets ── */
    .np--mob .pf-cards { gap: var(--space-4); }
    .np--mob .pf-card { padding: var(--space-5) var(--space-4); }
    .np--mob .pf-card__title { font-size: var(--fs-body); }
    .np--mob .pf-auth { flex-direction: column; gap: var(--space-3); }
    .np--mob .pf-card__foot { margin-top: var(--space-5); }
    .np--mob .pf-card__foot .kn-btn { width: 100%; min-height: 48px; }
    .np--mob .pf-card .kn-input { min-height: 48px; }
    .np--mob .pf-row { flex-direction: column; align-items: flex-start; gap: var(--space-1); }
    .np--mob .pf-row__value { text-align: left; }
    .np--mob .pf-quiet-row { flex-direction: column; align-items: stretch; gap: var(--space-4); }
    .np--mob .pf-quiet-row .kn-btn { width: 100%; min-height: 48px; }
    .np--mob .pf-auth__body .kn-btn { width: 100%; min-height: 48px; }
  `;
  document.head.appendChild(s);
})();

// ─── Icons (line, ~2px, rounded — DS Lucide style) ──────────────────────────────
function PFIcon(props, paths) {
  const { size = 24 } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
  );
}
const IconMail = (p) => PFIcon(p, [<rect key="r" x="2" y="4" width="20" height="16" rx="2"></rect>, <path key="p" d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>]);
const IconLogOut = (p) => PFIcon(p, [<path key="a" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>, <polyline key="b" points="16 17 21 12 16 7"></polyline>, <line key="c" x1="21" y1="12" x2="9" y2="12"></line>]);
const IconCheck = (p) => { const { size = 15 } = p; return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>); };
const IconAlert = (p) => PFIcon({ size: 18, ...p }, [<circle key="c" cx="12" cy="12" r="10"></circle>, <line key="a" x1="12" y1="8" x2="12" y2="12"></line>, <line key="b" x1="12" y1="16" x2="12.01" y2="16"></line>]);

// ─── Settings sidebar (Профіль active) — same component as np-shared, profile on ─
function SettingsNav() {
  const items = [
    { id: 'profile', label: 'Профіль', href: 'Settings Profile.html' },
    { id: 'notifications', label: 'Сповіщення', href: 'Notification Preferences.html' },
    { id: 'security', label: 'Безпека та вхід', href: '#' },
  ];
  return (
    <nav className="np-sidenav" aria-label="Налаштування" data-screen-label="Settings sidebar">
      <span className="np-sidenav__label">Налаштування</span>
      {items.map((it) => (
        <a key={it.id} href={it.href}
          className={'np-sidenav__item' + (it.id === 'profile' ? ' np-sidenav__item--active' : '')}
          aria-current={it.id === 'profile' ? 'page' : undefined}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}

// ─── Toast — calm, low-contrast (reuses .al-toast + .np-toast language) ──────────
function Toast({ children }) {
  return (
    <div className="al-toast np-toast" role="status">
      <IconCheck size={15} /> {children}
    </div>
  );
}

const ACCOUNT_EMAIL = 'reader@knyhovo.ua';

// ─── Profile content ────────────────────────────────────────────────────────────
// interactive: live display-name editing + «Зберегти» → toast.
function ProfileContent({ interactive = false, presetName = '', presetToast = false, presetError = false }) {
  const [name, setName] = useState(presetName);
  const [toast, setToast] = useState(presetToast);
  const [err, setErr] = useState(presetError);
  const timer = useRef(null);

  const flash = () => { setToast(true); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(false), 1900); };
  const save = (e) => {
    e.preventDefault();
    // Inline validation (optional field) — only guard an over-long name.
    if (name.trim().length > 40) { setErr(true); return; }
    setErr(false); flash();
  };

  const onName = interactive ? (e) => { setName(e.target.value); if (err) setErr(false); } : undefined;
  const showErr = err;

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
          <form onSubmit={save}>
            <div className="pf-field">
              <label className="pf-label" htmlFor="pf-email">Email</label>
              <input id="pf-email" type="email" className="kn-input" value={ACCOUNT_EMAIL} readOnly aria-readonly="true" />
            </div>
            <div className="pf-field">
              <label className="pf-label" htmlFor="pf-name">Ім'я для відображення <span className="pf-label__opt">· необов'язково</span></label>
              <input id="pf-name" type="text" className="kn-input" placeholder="Як до вас звертатися"
                value={name} onChange={onName} readOnly={!interactive} maxLength={interactive ? undefined : 60}
                aria-invalid={showErr || undefined} aria-describedby="pf-name-help" />
              {showErr ? (
                <div className="al-note al-note--err pf-field-err" id="pf-name-help">
                  <span className="al-note__icon"><IconAlert size={18} /></span>
                  <div className="al-note__body">Ім'я задовге — максимум 40 символів.</div>
                </div>
              ) : (
                <p className="pf-help" id="pf-name-help">Це ім'я буде використовуватися лише всередині Knyhovo.</p>
              )}
            </div>
            <div className="pf-card__foot">
              <Button variant="primary" type="submit">Зберегти</Button>
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
              <span className="pf-row__value">{ACCOUNT_EMAIL}</span>
            </div>
            <div className="pf-row">
              <span className="pf-row__label">Спосіб входу</span>
              <span className="pf-row__value">Magic Link <Badge tone="accent">Активний</Badge></span>
            </div>
          </div>
        </section>

        {/* ── Section 3 · Авторизація ─────────────────────────────────────── */}
        <section className="pf-card" data-screen-label="Авторизація">
          <div className="pf-card__head">
            <h2 className="pf-card__title">Авторизація</h2>
          </div>
          <div className="pf-auth">
            <span className="pf-auth__icon"><IconMail size={22} /></span>
            <div className="pf-auth__body">
              <h3 className="pf-auth__title">Magic Link</h3>
              <p className="pf-auth__text">Для входу ми використовуємо одноразові безпечні посилання, які надходять на вашу електронну пошту.</p>
              <div className="pf-card__foot" style={{ justifyContent: 'flex-start' }}>
                <Button variant="primary">Надіслати нове посилання для входу</Button>
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
                <p className="pf-quiet-row__desc">Після виходу вам потрібно буде повторно увійти за допомогою Magic Link.</p>
              </div>
              <Button variant="primary" iconLeft={<IconLogOut size={16} />}>Вийти</Button>
            </div>
          </section>
        </div>

      </div>

      {toast && (
        <div className="np-toast-wrap"><Toast>Профіль оновлено</Toast></div>
      )}
    </div>
  );
}

// ─── Full settings frame (chrome + Settings layout + Profile content) ────────────
function PF_Frame({ mobile = false, theme = 'light', interactive = false, presetName = '', presetToast = false, presetError = false }) {
  return (
    <div data-theme={theme} className={'np-shell' + (mobile ? ' np--mob' : '')} style={{ position: 'relative' }}>
      <div className="np-container">
        <NP_SiteHeader theme={theme} mobile={mobile} />
        <main className="np-main">
          <div className={'np-layout' + (mobile ? ' np-layout--single' : '')}>
            {!mobile && <SettingsNav />}
            <ProfileContent interactive={interactive} presetName={presetName} presetToast={presetToast} presetError={presetError} />
          </div>
        </main>
        <NP_SiteFooter theme={theme} />
      </div>
    </div>
  );
}

// ─── Toast specimen ─────────────────────────────────────────────────────────────
function PF_ToastSpecimen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 'var(--space-6)', background: 'var(--bg)' }}>
      <Toast>Профіль оновлено</Toast>
    </div>
  );
}

Object.assign(window, { PF_Frame, PF_ToastSpecimen, PF_ProfileContent: ProfileContent });
