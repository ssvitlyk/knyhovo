'use strict';

// ─── Knyhovo · Magic Link Login (Auth) ─────────────────────────────────────────
// Natural continuation of the FROZEN Knyhovo surfaces (Settings → Сповіщення,
// Public unsubscribe). Composes DS v1.0 exports ONLY and reuses the approved
// interior chrome verbatim (NP_SiteHeader / NP_SiteFooter from np-shared).
// No new visual language, colours, type, radii or shadows. No password, no
// social login, no registration. Light + Dark · Desktop + Mobile (375px).

const DS = window.KnyhovoDesignSystem_9fa616;
const { Button, Badge } = DS;
const { NP_SiteHeader, NP_SiteFooter } = window;
const { useState, useRef } = React;

// ─── Style injection ───────────────────────────────────────────────────────────
(function injectMLStyles() {
  if (document.getElementById('ml-styles')) return;
  const s = document.createElement('style');
  s.id = 'ml-styles';
  s.textContent = `
    /* The chrome (.np-shell / .np-container / .site-header / .site-footer /
       .np-header-mob / .np--mob / .np-unsub__icon|title) is injected by
       np-shared.jsx and reused unchanged. ml-* only adds the auth-panel layout. */

    /* Centred single-panel main — same rhythm as the public unsubscribe page */
    .ml-main { display: flex; align-items: center; justify-content: center; padding: var(--space-16) 0; min-height: 56vh; }
    /* Mobile: more breathing room below the header (+48px) */
    .np--mob .ml-main { padding: calc(var(--space-10) + 48px) 0 var(--space-10); min-height: 60vh; }

    /* Auth panel wrapped in a DS card (surface + hairline + radius-md + shadow-sm) —
       same container language as the rest of the product. ~440px, 48px padding. */
    .ml-panel {
      width: 100%; max-width: 440px; text-align: center;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
      padding: var(--space-12);
    }
    .np--mob .ml-panel { max-width: none; padding: var(--space-8) var(--space-5); }

    /* Icon medallion — reuses .np-unsub__icon recipe (muted, never coloured) */
    .ml-panel .np-unsub__icon { margin-bottom: var(--space-5); }
    .ml-panel .np-unsub__title { margin: 0 0 var(--space-3); }

    /* Lead / helper line under the title */
    .ml-lead { font-size: var(--fs-body); color: var(--text-muted); text-wrap: pretty; margin: 0 0 var(--space-6); }
    .ml-lead b { color: var(--text-body); font-weight: var(--fw-semibold); }
    .ml-lead--inline { margin-bottom: var(--space-2); }

    /* Success — recipient email as the primary visual anchor (serif accent) */
    .ml-email {
      font-family: var(--font-display); font-weight: var(--fw-semibold);
      font-size: var(--fs-title); line-height: var(--lh-snug);
      letter-spacing: var(--ls-tight); color: var(--accent);
      margin: 0 0 var(--space-6); word-break: break-word;
    }

    /* Success — «Спам» helper (muted, never dominant) */
    .ml-spam { font-size: var(--fs-sm); color: var(--text-muted); text-wrap: pretty; margin: var(--space-6) 0 0; opacity: 0.82; }

    /* Form — left-aligned inside the centred panel */
    .ml-form { display: flex; flex-direction: column; gap: var(--space-3); text-align: left; }
    .ml-field { display: flex; flex-direction: column; gap: var(--space-2); }
    .ml-label { font-size: var(--fs-sm); font-weight: var(--fw-medium); color: var(--text-body); }
    .ml-form .kn-input { width: 100%; }
    .ml-form .kn-input:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Block actions */
    .ml-actions { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-1); }
    .ml-btn-block.kn-btn { width: 100%; }

    /* Secondary supporting line (e.g. «Посилання діє обмежений час.») */
    .ml-sub { font-size: var(--fs-sm); color: var(--text-muted); text-wrap: pretty; margin: var(--space-4) 0 0; }

    /* Quiet text link (e.g. «Змінити email», «На головну») — matches al-link */
    .ml-link {
      display: inline-flex; align-items: center; justify-content: center; gap: 5px;
      background: none; border: none; padding: var(--space-2); cursor: pointer;
      font-family: var(--font-body); font-size: var(--fs-sm); font-weight: var(--fw-medium);
      color: var(--text-muted); text-decoration: none;
      transition: color var(--dur-fast) var(--ease-out);
    }
    .ml-link:hover { color: var(--accent); }

    /* Privacy / trust micro-note under the form */
    .ml-trust { display: flex; align-items: flex-start; gap: var(--space-2); justify-content: center; margin-top: var(--space-5); font-size: var(--fs-xs); color: var(--text-muted); opacity: 0.7; text-wrap: pretty; }
    .ml-trust svg { flex: none; margin-top: 1px; color: var(--icon-muted); }

    /* Inline error card — reuses the frozen .al-note--err language */
    .ml-error { margin: 0 0 var(--space-5); text-align: left; }

    /* Resend confirmation — a quiet inline note on the success screen
       (so the toast never has to duplicate the whole screen) */
    .ml-resent { display: inline-flex; align-items: center; gap: 6px; margin-top: var(--space-4); font-size: var(--fs-sm); color: var(--brand-green); font-weight: var(--fw-medium); }
    .ml-resent svg { flex: none; }

    /* Spinner — transient progress only (an in-flight action, NOT decorative
       looping content). Static glyph under reduced-motion. */
    .ml-spin { display: inline-block; width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; border-top-color: transparent; vertical-align: -3px; }
    @media (prefers-reduced-motion: no-preference) { .ml-spin { animation: ml-rot 0.7s linear infinite; } }
    @keyframes ml-rot { to { transform: rotate(360deg); } }
    .ml-spin--lg { width: 26px; height: 26px; border-width: 2.5px; }

    /* Redirect / "Входимо…" — subtle animated DS logo (transient loading,
       not a decorative loop). Static (full opacity) under reduced-motion. */
    .ml-redirect .np-unsub__icon { color: var(--accent); }
    .ml-redirect-logo { height: 40px; display: block; margin: 0 auto var(--space-5); opacity: 1; }
    @media (prefers-reduced-motion: no-preference) {
      .ml-redirect-logo { animation: ml-logo-pulse 1.4s var(--ease-out) infinite; }
      @keyframes ml-logo-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
    }

    /* ── Auth-required reusable block ──────────────────────────────────────
       Neutral empty/auth state (NOT an error). Same panel rhythm. Used both
       standalone and as a page's main content. */
    .ml-authblock { width: 100%; max-width: 440px; margin: 0 auto; text-align: center; }
    .ml-authblock .np-unsub__icon { margin-bottom: var(--space-5); }
    .ml-authblock__title { font-family: var(--font-display); font-weight: var(--fw-semibold); font-size: var(--fs-h3); line-height: var(--lh-tight); color: var(--text); margin: 0 0 var(--space-3); }
    .ml-authblock__text { font-size: var(--fs-body); color: var(--text-muted); text-wrap: pretty; margin: 0 0 var(--space-6); }
    .ml-authblock .kn-btn { min-width: 200px; }

    /* When the auth block is shown as a standalone specimen card */
    .ml-spec-surface { background: var(--bg); padding: var(--space-10) var(--space-6); display: flex; align-items: center; justify-content: center; height: 100%; }

    /* Mobile (375px) — 44px touch targets, full-width controls */
    .np--mob .ml-actions .kn-btn { min-height: 48px; }
    .np--mob .ml-form .kn-input { min-height: 48px; }
    .np--mob .ml-link { min-height: 44px; }
    .np--mob .ml-authblock .kn-btn { width: 100%; min-height: 48px; }
  `;
  document.head.appendChild(s);
})();

// ─── Icons (line, ~2px, rounded — DS Lucide style) ──────────────────────────────
function I(props, paths) {
  const { size = 24 } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg>
  );
}
const IconMail = (p) => I(p, [<rect key="r" x="2" y="4" width="20" height="16" rx="2"></rect>, <path key="p" d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>]);
const IconMailCheck = (p) => I(p, [<path key="a" d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8"></path>, <path key="b" d="m2 7 8.97 5.7a1.94 1.94 0 0 0 2.06 0L22 7"></path>, <path key="c" d="m16 19 2 2 4-4"></path>]);
const IconLinkOff = (p) => I(p, [<path key="a" d="m2 2 20 20"></path>, <path key="b" d="M8.5 8.5 7 10a3.5 3.5 0 0 0 0 5 3.5 3.5 0 0 0 5 0"></path>, <path key="c" d="M14 11a3.5 3.5 0 0 0 0-5"></path>, <path key="d" d="m16 8 1-1a3.5 3.5 0 0 0-5-5"></path>]);
const IconLock = (p) => I(p, [<rect key="r" x="3" y="11" width="18" height="11" rx="2"></rect>, <path key="p" d="M7 11V7a5 5 0 0 1 10 0v4"></path>]);
const IconShield = (p) => I(p, [<path key="p" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"></path>]);
const IconCheck = (p) => { const { size = 16 } = p; return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>); };
const IconAlert = (p) => I({ size: 18, ...p }, [<circle key="c" cx="12" cy="12" r="10"></circle>, <line key="a" x1="12" y1="8" x2="12" y2="12"></line>, <line key="b" x1="12" y1="16" x2="12.01" y2="16"></line>]);
const IconRefresh = (p) => I({ size: 16, ...p }, [<path key="a" d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>, <path key="b" d="M21 3v5h-5"></path>, <path key="c" d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>, <path key="d" d="M3 21v-5h5"></path>]);
const IconArrowLeft = (p) => I({ size: 16, ...p }, [<path key="a" d="m12 19-7-7 7-7"></path>, <path key="b" d="M19 12H5"></path>]);

// ─── Trust micro-note ────────────────────────────────────────────────────────
function TrustNote() {
  return (
    <p className="ml-trust">
      <IconShield size={14} /> Без паролів. Ми надсилаємо лише безпечне посилання для входу.
    </p>
  );
}

// ─── Panel states ──────────────────────────────────────────────────────────────
const SAMPLE_EMAIL = 'reader@knyhovo.ua';

// 1. Login form  ·  2. Sending  ·  4. Error (form + inline note)
function LoginPanel({ phase = 'idle', email = '', interactive = false }) {
  // phase: idle | sending | error
  const [val, setVal] = useState(email);
  const v = interactive ? val : email;
  const sending = phase === 'sending';

  return (
    <div className="ml-panel" data-screen-label={'Login · ' + phase}>
      <span className="np-unsub__icon"><IconMail size={26} /></span>
      <h1 className="np-unsub__title">Увійти в Knyhovo</h1>
      <p className="ml-lead">Ми надішлемо безпечне посилання для входу на вашу пошту.</p>

      {phase === 'error' && (
        <div className="al-note al-note--err ml-error">
          <span className="al-note__icon"><IconAlert size={18} /></span>
          <div className="al-note__body">Не вдалося надіслати посилання. Перевірте email і спробуйте ще раз.</div>
        </div>
      )}

      <form className="ml-form" onSubmit={(e) => e.preventDefault()}>
        <div className="ml-field">
          <label className="ml-label" htmlFor="ml-email">Email</label>
          <input id="ml-email" type="email" inputMode="email" autoComplete="email"
            className="kn-input" placeholder="your@email.com"
            value={v} disabled={sending}
            onChange={interactive ? (e) => setVal(e.target.value) : undefined}
            readOnly={!interactive} />
        </div>
        <div className="ml-actions">
          <Button variant="primary" type="submit" className="ml-btn-block" disabled={sending}
            iconLeft={sending ? <span className="ml-spin" aria-hidden="true"></span> : null}>
            {sending ? 'Надсилаємо посилання…' : (phase === 'error' ? 'Надіслати ще раз' : 'Надіслати посилання')}
          </Button>
        </div>
      </form>

      <TrustNote />
    </div>
  );
}

// 3. Success — «Перевірте пошту»
function SuccessPanel({ email = SAMPLE_EMAIL, resent = false }) {
  const [showResent, setShowResent] = useState(resent);
  const timer = useRef(null);
  const resend = () => { setShowResent(true); clearTimeout(timer.current); timer.current = setTimeout(() => setShowResent(false), 2400); };
  return (
    <div className="ml-panel" data-screen-label="Login · success (check email)">
      <span className="np-unsub__icon"><IconMailCheck size={26} /></span>
      <h1 className="np-unsub__title">Перевірте пошту</h1>
      <p className="ml-lead ml-lead--inline">Ми надіслали посилання для входу на:</p>
      <p className="ml-email">{email}</p>

      <div className="ml-actions">
        <Button variant="secondary" className="ml-btn-block"
          onClick={resend}
          iconLeft={<IconRefresh size={15} />}>Надіслати ще раз</Button>
        <a className="ml-link" href="#">Змінити email</a>
      </div>

      <p className="ml-sub">Посилання діє обмежений час.</p>
      <p className="ml-spam">Не отримали лист? Перевірте папку «Спам».</p>

      {showResent && (
        <div className="np-toast-wrap">
          <div className="al-toast np-toast" role="status"><IconCheck size={15} /> Посилання надіслано</div>
        </div>
      )}
    </div>
  );
}

// 5. Invalid / expired magic link
function InvalidPanel() {
  return (
    <div className="ml-panel" data-screen-label="Magic link · invalid/expired">
      <span className="np-unsub__icon"><IconLinkOff size={26} /></span>
      <h1 className="np-unsub__title">Посилання недійсне</h1>
      <p className="ml-lead">Це посилання вже використане або термін його дії минув.</p>

      <div className="ml-actions">
        <Button variant="primary" className="ml-btn-block">Отримати нове посилання</Button>
        <a href="Homepage v1.0.html" style={{ textDecoration: 'none' }}>
          <Button variant="secondary" className="ml-btn-block" iconLeft={<IconArrowLeft size={15} />}>На головну</Button>
        </a>
      </div>
    </div>
  );
}

// 6. Login success / redirect loading — «Входимо…» (subtle animated DS logo)
function RedirectPanel({ theme = 'light' }) {
  const logo = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png';
  return (
    <div className="ml-panel ml-redirect" data-screen-label="Magic link · signing in (redirect)" aria-busy="true">
      <img className="ml-redirect-logo" src={logo} alt="Knyhovo" />
      <h1 className="np-unsub__title">Входимо…</h1>
      <p className="ml-lead">Зачекайте секунду — переносимо вас назад.</p>
    </div>
  );
}

// 7. Auth-required reusable block (Variant A — Wishlist · Variant B — Settings)
const AUTH_COPY = {
  wishlist: 'Увійдіть, щоб зберігати книги та отримувати сповіщення про ціни.',
  settings: 'Увійдіть, щоб керувати налаштуваннями сповіщень.',
};
function AuthBlock({ context = 'wishlist' }) {
  return (
    <div className="ml-authblock" data-screen-label={'Auth-required · ' + context}>
      <span className="np-unsub__icon"><IconLock size={26} /></span>
      <h2 className="ml-authblock__title">Увійдіть, щоб продовжити</h2>
      <p className="ml-authblock__text">{AUTH_COPY[context]}</p>
      <Button variant="primary">Увійти</Button>
    </div>
  );
}

// ─── Toast specimen — «Посилання надіслано» (resend confirmation only) ──────────
function ML_Toast() {
  return (
    <div className="al-toast" role="status">
      <IconCheck size={15} /> Посилання надіслано
    </div>
  );
}
function ML_ToastSpecimen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 'var(--space-6)', background: 'var(--bg)' }}>
      <ML_Toast />
    </div>
  );
}

// ─── Full page frame (chrome + centred panel) ───────────────────────────────────
// variant: login | sending | error | success | invalid | redirect | auth
function ML_Frame({ variant = 'login', mobile = false, theme = 'light', context = 'wishlist', interactive = false }) {
  let body;
  if (variant === 'login')        body = <LoginPanel phase="idle" interactive={interactive} />;
  else if (variant === 'sending') body = <LoginPanel phase="sending" email={SAMPLE_EMAIL} />;
  else if (variant === 'error')   body = <LoginPanel phase="error" email={SAMPLE_EMAIL} />;
  else if (variant === 'success') body = <SuccessPanel />;
  else if (variant === 'invalid') body = <InvalidPanel />;
  else if (variant === 'redirect')body = <RedirectPanel theme={theme} />;
  else if (variant === 'auth')    body = <AuthBlock context={context} />;

  return (
    <div data-theme={theme} className={'np-shell' + (mobile ? ' np--mob' : '')} style={{ position: 'relative' }}>
      <div className="np-container">
        <NP_SiteHeader theme={theme} mobile={mobile} />
        <main className="ml-main">{body}</main>
        <NP_SiteFooter theme={theme} />
      </div>
    </div>
  );
}

// ─── Interactive flow (for the standalone /login page) ──────────────────────────
// idle → sending → success | error. Email is carried into the success screen.
function ML_LoginFlow({ mobile = false, theme = 'light' }) {
  const [phase, setPhase] = useState('idle'); // idle | sending | success | error
  const [email, setEmail] = useState('');
  const timer = useRef(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const submit = (e) => {
    e.preventDefault();
    if (!valid || phase === 'sending') return;
    setPhase('sending');
    clearTimeout(timer.current);
    // Demo transport: most attempts succeed; an obvious typo domain → error.
    timer.current = setTimeout(() => {
      setPhase(/@(test|error)\./i.test(email) ? 'error' : 'success');
    }, 1400);
  };

  let body;
  if (phase === 'success') {
    body = <SuccessPanelLive email={email.trim()} onChangeEmail={() => setPhase('idle')} />;
  } else {
    body = (
      <div className="ml-panel" data-screen-label={'Login · ' + phase}>
        <span className="np-unsub__icon"><IconMail size={26} /></span>
        <h1 className="np-unsub__title">Увійти в Knyhovo</h1>
        <p className="ml-lead">Ми надішлемо безпечне посилання для входу на вашу пошту.</p>

        {phase === 'error' && (
          <div className="al-note al-note--err ml-error">
            <span className="al-note__icon"><IconAlert size={18} /></span>
            <div className="al-note__body">Не вдалося надіслати посилання. Перевірте email і спробуйте ще раз.</div>
          </div>
        )}

        <form className="ml-form" onSubmit={submit}>
          <div className="ml-field">
            <label className="ml-label" htmlFor="ml-email-live">Email</label>
            <input id="ml-email-live" type="email" inputMode="email" autoComplete="email"
              className="kn-input" placeholder="your@email.com"
              value={email} disabled={phase === 'sending'}
              onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="ml-actions">
            <Button variant="primary" type="submit" className="ml-btn-block" disabled={phase === 'sending' || !valid}
              iconLeft={phase === 'sending' ? <span className="ml-spin" aria-hidden="true"></span> : null}>
              {phase === 'sending' ? 'Надсилаємо посилання…' : (phase === 'error' ? 'Надіслати ще раз' : 'Надіслати посилання')}
            </Button>
          </div>
        </form>

        <TrustNote />
      </div>
    );
  }

  return (
    <div data-theme={theme} className={'np-shell' + (mobile ? ' np--mob' : '')} style={{ position: 'relative' }}>
      <div className="np-container">
        <NP_SiteHeader theme={theme} mobile={mobile} />
        <main className="ml-main">{body}</main>
        <NP_SiteFooter theme={theme} />
      </div>
    </div>
  );
}

// Success panel with live "change email" callback (resend → quiet inline confirm)
function SuccessPanelLive({ email, onChangeEmail }) {
  const [resent, setResent] = useState(false);
  const timer = useRef(null);
  const resend = () => { setResent(true); clearTimeout(timer.current); timer.current = setTimeout(() => setResent(false), 2400); };
  return (
    <div className="ml-panel" data-screen-label="Login · success (check email)">
      <span className="np-unsub__icon"><IconMailCheck size={26} /></span>
      <h1 className="np-unsub__title">Перевірте пошту</h1>
      <p className="ml-lead ml-lead--inline">Ми надіслали посилання для входу на:</p>
      <p className="ml-email">{email}</p>
      <div className="ml-actions">
        <Button variant="secondary" className="ml-btn-block" onClick={resend} iconLeft={<IconRefresh size={15} />}>Надіслати ще раз</Button>
        <button type="button" className="ml-link" onClick={onChangeEmail}>Змінити email</button>
      </div>
      <p className="ml-sub">Посилання діє обмежений час.</p>
      <p className="ml-spam">Не отримали лист? Перевірте папку «Спам».</p>
      {resent && (
        <div className="np-toast-wrap">
          <div className="al-toast np-toast" role="status"><IconCheck size={15} /> Посилання надіслано</div>
        </div>
      )}
    </div>
  );
}

// Standalone auth-block specimen (no chrome) — for the block-variant artboards
function ML_AuthSpecimen({ context = 'wishlist', theme = 'light' }) {
  return (
    <div data-theme={theme} className="ml-spec-surface">
      <AuthBlock context={context} />
    </div>
  );
}

Object.assign(window, { ML_Frame, ML_AuthSpecimen, ML_Toast, ML_ToastSpecimen, ML_LoginPanel: LoginPanel, ML_LoginFlow });
