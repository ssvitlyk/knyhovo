'use strict';

// ─── Knyhovo · Settings → Сповіщення (Notification Preferences) ────────────────
// Composes DS v1.0 exports ONLY. Reuses the APPROVED interior chrome verbatim
// (site-header / site-footer from Search Results · Wishlist · Book Details) and
// the established Settings sidebar. No new visual language, colours, type,
// radii or shadows. alerts.jpeg = backend/API context, NOT UI direction.

const DS = window.KnyhovoDesignSystem_9fa616;
const { Button, Badge, ThemeToggle } = DS;
const { useState, useRef } = React;

// ─── Style injection ──────────────────────────────────────────────────────────
(function injectNPStyles() {
  if (document.getElementById('np-styles')) return;
  const s = document.createElement('style');
  s.id = 'np-styles';
  s.textContent = `
    /* ════════════════════════════════════════════════════════════════════
       APPROVED INTERIOR CHROME — copied verbatim from the frozen Search
       Results / Wishlist / Book Details pages. Do NOT restyle.
       ════════════════════════════════════════════════════════════════════ */
    .np-shell { background: var(--bg); color: var(--text-body); min-height: 100%; font-family: var(--font-body); }
    .np-container { max-width: 1040px; margin: 0 auto; padding: 0 var(--space-6); }

    /* Header (reused from approved homepage / interior pages) */
    .site-header { display: flex; align-items: center; gap: var(--space-8); padding: var(--space-5) 0; }
    .site-logo { height: 44px; display: block; }
    .site-nav { display: flex; gap: var(--space-6); margin-left: auto; }
    .nav-link { font-size: var(--fs-sm); font-weight: var(--fw-medium); color: var(--text-body); text-decoration: none; transition: color var(--dur-fast) var(--ease-out); }
    .nav-link:hover { color: var(--accent); }
    .nav-link--active { color: var(--accent); font-weight: var(--fw-semibold); }
    .site-actions { display: flex; align-items: center; gap: var(--space-4); }

    /* Footer (reused from approved homepage / interior pages) */
    .site-footer {
      border-top: 1px solid var(--border);
      margin-top: var(--space-12);
      padding: var(--space-10) 0 var(--space-6);
      display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-3);
    }
    .footer-logo { height: 36px; }
    .footer-line { font-size: var(--fs-sm); color: var(--text-body); margin: 0; }
    .footer-copy { font-size: var(--fs-xs); color: var(--text-muted); margin: 0; }

    /* ════════════════════════════════════════════════════════════════════
       SETTINGS LAYOUT — page-level composition over DS tokens only.
       ════════════════════════════════════════════════════════════════════ */
    .np-main { padding: var(--space-8) 0 var(--space-4); min-height: 46vh; }
    .np-layout {
      display: grid; grid-template-columns: 196px 1fr;
      gap: var(--space-12); align-items: start;
    }
    .np-layout--single { grid-template-columns: 1fr; gap: 0; }

    /* Settings sidebar (desktop) */
    .np-sidenav { display: flex; flex-direction: column; gap: 2px; }
    .np-sidenav__label {
      font-size: var(--fs-xs); letter-spacing: var(--ls-eyebrow);
      text-transform: uppercase; color: var(--text-muted); font-weight: var(--fw-semibold);
      padding: 0 var(--space-3); margin: 0 0 var(--space-3);
    }
    .np-sidenav__item {
      display: block; padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm); font-size: var(--fs-sm);
      font-weight: var(--fw-medium); color: var(--text-muted); text-decoration: none;
      transition: color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
    }
    .np-sidenav__item:hover { color: var(--text); background: var(--surface-accent); }
    .np-sidenav__item--active { color: var(--accent); background: var(--accent-weak); font-weight: var(--fw-semibold); }

    /* Content area */
    .np-content { min-width: 0; max-width: 640px; }
    .np-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-5); margin: 0 0 var(--space-3); flex-wrap: wrap; }
    .np-head__text { min-width: 0; }
    .np-title {
      font-family: var(--font-display); font-weight: var(--fw-semibold);
      font-size: var(--fs-h2); line-height: var(--lh-tight);
      letter-spacing: var(--ls-tight); color: var(--text); margin: 0;
    }
    .np-subtitle { font-size: var(--fs-body); color: var(--text-muted); margin: var(--space-2) 0 0; text-wrap: pretty; }
    .np-status { flex: none; }
    .np-status .kn-badge { padding: 5px 11px; }

    /* Eyebrow above the toggle group */
    .np-eyebrow {
      font-size: var(--fs-xs); letter-spacing: var(--ls-eyebrow);
      text-transform: uppercase; color: var(--text-muted); font-weight: var(--fw-semibold);
      margin: 0 0 var(--space-3);
    }
    /* Unsubscribed head: muted badge sits under the title, then a short note */
    .np-head--unsub { flex-direction: column; gap: var(--space-3); }
    .np-head--unsub .np-subtitle { margin-top: 0; max-width: 52ch; }

    /* Compact error retry — trim horizontal padding ~12%, stays secondary */
    .np-retry.kn-btn { padding-left: var(--space-3); padding-right: var(--space-3); }
    /* Public unsubscribe CTA — informational, not conversion: narrower, less padding */
    .np-unsub-cta.kn-btn { padding-left: var(--space-5); padding-right: var(--space-5); }

    /* Notification cards — DS card anatomy (hairline + radius-md + shadow-sm).
       Warmth: a barely-there warm-paper wash (derived from the accent token,
       no new colour) so the cards feel editorial, not SaaS. */
    .np-cards { display: flex; flex-direction: column; gap: var(--space-4); }
    .np-card {
      display: flex; align-items: center; gap: var(--space-6);
      padding: var(--space-5);
      background: color-mix(in oklab, var(--accent) 4.5%, var(--surface));
      border: 1px solid var(--border);
      border-radius: var(--radius-md); box-shadow: var(--shadow-sm);
      transition: border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
    }
    .np-card--disabled { opacity: 0.55; }
    .np-card__info { flex: 1; min-width: 0; }
    .np-card__title { font-weight: var(--fw-semibold); font-size: var(--fs-body); color: var(--text); margin-bottom: var(--space-1); }
    .np-card__desc { font-size: var(--fs-sm); color: var(--text-muted); text-wrap: pretty; max-width: 46ch; }

    /* Toggle switch */
    .np-toggle { position: relative; width: 48px; height: 26px; flex: none; cursor: pointer; display: inline-block; }
    .np-toggle--disabled { cursor: not-allowed; }
    .np-toggle__input { position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none; }
    .np-toggle__track { position: absolute; inset: 0; border-radius: var(--radius-pill); background: var(--border-strong); transition: background var(--dur-base) var(--ease-out); }
    .np-toggle__track::after {
      content: ''; position: absolute; top: 3px; left: 3px;
      width: 20px; height: 20px; border-radius: var(--radius-pill);
      background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.20);
      transition: transform var(--dur-base) var(--ease-out);
    }
    .np-toggle--on .np-toggle__track { background: var(--accent); }
    .np-toggle--on .np-toggle__track::after { transform: translateX(22px); }
    .np-toggle:focus-within .np-toggle__track { box-shadow: var(--focus-ring); }

    /* Auto-save helper — secondary supporting text, almost invisible until sought */
    .np-helper { display: flex; align-items: center; gap: 6px; justify-content: center; margin-top: var(--space-3); font-size: var(--fs-xs); font-weight: var(--fw-regular); color: var(--text-muted); opacity: 0.58; }
    .np-helper svg { flex: none; }

    /* Unsubscribed notice (muted — never red, per DS) */
    .np-notice { display: flex; align-items: flex-start; gap: var(--space-3); margin-top: var(--space-5); padding: var(--space-4); background: var(--surface-sunk); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: var(--fs-sm); color: var(--text-muted); text-wrap: pretty; }
    .np-notice svg { flex: none; color: var(--icon-muted); margin-top: 1px; }
    .np-notice b { color: var(--text-body); font-weight: var(--fw-semibold); }

    /* Skeleton — warm surfaces only, one-shot fade (DS rule: no infinite loops on content) */
    .np-sk { display: block; background: var(--surface-accent); border-radius: var(--radius-xs); }
    @media (prefers-reduced-motion: no-preference) {
      .np-card--sk { animation: np-fade 280ms var(--ease-out) both; }
      .np-card--sk:nth-child(2) { animation-delay: 50ms; }
      @keyframes np-fade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
    }

    /* Toast — calm + minimal (macOS / GitHub / Notion-style). Low contrast:
       sunk surface, hairline border, soft small shadow, smaller text. */
    .np-toast-wrap { position: absolute; left: 0; right: 0; bottom: var(--space-6); display: flex; justify-content: center; pointer-events: none; z-index: 20; }
    .np-toast.al-toast {
      background: var(--surface-sunk); border: 1px solid var(--border);
      box-shadow: var(--shadow-sm); padding: 7px var(--space-3);
      font-size: var(--fs-xs); color: var(--text-muted); gap: 6px;
    }
    .np-toast.al-toast svg { width: 14px; height: 14px; }
    @media (prefers-reduced-motion: no-preference) { .np-toast { animation: np-toast-in 240ms var(--ease-out) both; } @keyframes np-toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } } }

    /* ════════════════════════════════════════════════════════════════════
       MOBILE (375px) — driven by the .np--mob modifier (artboards are fixed
       width, so media queries can't fire inside them).
       ════════════════════════════════════════════════════════════════════ */
    .np--mob .np-container { padding: 0 var(--space-5); }
    .np--mob .site-header { display: none; }
    .np--mob .np-header-mob {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-3); padding: var(--space-3) 0;
      border-bottom: 1px solid var(--border);
    }
    .np--mob .np-header-mob__left { display: flex; align-items: center; gap: var(--space-2); }
    .np-header-mob { display: none; }
    .np-burger { width: 44px; height: 44px; padding: 0; border: 0; background: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; }
    .np-burger span { display: block; width: 22px; height: 2px; border-radius: 2px; background: var(--text); }
    .np--mob .site-logo { height: 30px; }
    .np--mob .np-main { padding: var(--space-6) 0 var(--space-2); }
    .np--mob .np-content { max-width: none; }
    .np--mob .np-head { margin-bottom: var(--space-6); gap: var(--space-3); }
    .np--mob .np-title { font-size: var(--fs-h3); }
    .np--mob .np-cards { gap: var(--space-4); }              /* 16px between cards */
    .np--mob .np-card { padding: var(--space-3) var(--space-4); align-items: flex-start; }
    .np--mob .np-eyebrow { margin-bottom: var(--space-4); }
    .np--mob .footer-logo { height: 30px; }
    /* 44px touch target — expand the hit area, keep the 26px track centred */
    .np--mob .np-toggle { width: 52px; height: 44px; margin: calc(-1 * var(--space-2)) 0; }
    .np--mob .np-toggle__track { inset: 9px 2px; }
    .np--mob .np-toggle--on .np-toggle__track::after { transform: translateX(26px); }

    /* ════════════════════════════════════════════════════════════════════
       PUBLIC UNSUBSCRIBE — standalone minimal page (NOT settings chrome).
       ════════════════════════════════════════════════════════════════════ */
    .np-unsub-main { display: flex; align-items: center; justify-content: center; padding: var(--space-16) 0; min-height: 52vh; }
    .np-unsub { max-width: 460px; text-align: center; }
    .np-unsub__icon { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: var(--radius-pill); background: var(--surface-accent); color: var(--icon-muted); margin-bottom: var(--space-5); }
    .np-unsub__title { font-family: var(--font-display); font-weight: var(--fw-semibold); font-size: var(--fs-h3); line-height: var(--lh-tight); color: var(--text); margin: 0 0 var(--space-3); }
    .np-unsub__text { font-size: var(--fs-body); color: var(--text-muted); text-wrap: pretty; margin: 0 0 var(--space-7); }
    .np--mob .np-unsub-main { padding: var(--space-12) 0; }
  `;
  document.head.appendChild(s);
})();

// ─── SVG icons (line, ~2px, rounded — matches DS Lucide style) ─────────────────
function IconCheck({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  );
}
function IconX({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
}
function IconAlert({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  );
}
function IconMailOff({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m2 8 9.42 5.65a2 2 0 0 0 2.16 0L22 8"></path>
      <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8"></path>
      <line x1="2" y1="2" x2="22" y2="22"></line>
    </svg>
  );
}
function IconRefresh({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M21 3v5h-5"></path>
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path><path d="M3 21v-5h5"></path>
    </svg>
  );
}

// ─── Approved interior chrome ──────────────────────────────────────────────────
const NAV = [
  { label: 'Головна', href: 'Homepage v1.0.html' },
  { label: 'Каталог', href: 'Search Results Page.html' },
  { label: 'Знижки', href: '#' },
  { label: 'Про нас', href: '#' },
];

function SiteHeader({ theme, mobile }) {
  const logo = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png';
  if (mobile) {
    return (
      <header className="np-header-mob" data-screen-label="Header (mobile)">
        <div className="np-header-mob__left">
          <button type="button" className="np-burger" aria-label="Меню"><span></span><span></span><span></span></button>
          <img className="site-logo" src={logo} alt="Knyhovo" />
        </div>
        <ThemeToggle theme={theme} />
      </header>
    );
  }
  return (
    <header className="site-header" data-screen-label="Header">
      <a href="Homepage v1.0.html" aria-label="Knyhovo"><img className="site-logo" src={logo} alt="Knyhovo" /></a>
      <nav className="site-nav">
        {NAV.map((n) => <a key={n.label} href={n.href} className="nav-link">{n.label}</a>)}
      </nav>
      <div className="site-actions">
        <ThemeToggle theme={theme} />
        <Button variant="secondary" size="sm">Профіль</Button>
      </div>
    </header>
  );
}

function SiteFooter({ theme }) {
  const logo = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png';
  return (
    <footer className="site-footer" data-screen-label="Footer">
      <img className="footer-logo" src={logo} alt="Knyhovo" />
      <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
      <p className="footer-copy">© 2026 Knyhovo</p>
    </footer>
  );
}

// ─── Settings sidebar ───────────────────────────────────────────────────────────
function SettingsNav() {
  const items = [
    { id: 'profile', label: 'Профіль' },
    { id: 'notifications', label: 'Сповіщення' },
    { id: 'security', label: 'Безпека та вхід' },
  ];
  return (
    <nav className="np-sidenav" aria-label="Налаштування" data-screen-label="Settings sidebar">
      <span className="np-sidenav__label">Налаштування</span>
      {items.map((it) => (
        <a key={it.id} href="#"
          className={'np-sidenav__item' + (it.id === 'notifications' ? ' np-sidenav__item--active' : '')}
          aria-current={it.id === 'notifications' ? 'page' : undefined}>
          {it.label}
        </a>
      ))}
    </nav>
  );
}

// ─── Toggle ──────────────────────────────────────────────────────────────────────
function Toggle({ on, disabled, id, label, onChange }) {
  return (
    <label className={'np-toggle' + (on ? ' np-toggle--on' : '') + (disabled ? ' np-toggle--disabled' : '')} htmlFor={id}>
      <input type="checkbox" id={id} role="switch" aria-checked={on} aria-label={label}
        checked={on} disabled={disabled} onChange={onChange || (() => {})} className="np-toggle__input" />
      <span className="np-toggle__track" aria-hidden="true"></span>
    </label>
  );
}

function PrefCard({ title, desc, on, disabled, id, onChange }) {
  return (
    <div className={'np-card' + (disabled ? ' np-card--disabled' : '')}>
      <div className="np-card__info">
        <div className="np-card__title">{title}</div>
        <div className="np-card__desc">{desc}</div>
      </div>
      <Toggle on={on} disabled={disabled} id={id} label={title} onChange={onChange} />
    </div>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ children, onClose }) {
  return (
    <div className="al-toast np-toast" role="status">
      <IconCheck size={15} />
      {children}
      {onClose && (
        <button type="button" className="al-toast__dismiss" aria-label="Закрити" onClick={onClose}
          style={{ background: 'none', border: 'none', padding: 0, marginLeft: 4, display: 'inline-flex', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <IconX size={13} />
        </button>
      )}
    </div>
  );
}

// ─── Content: loaded (subscribed → auto-save; or unsubscribed → disabled) ──────────
function ContentLoaded({ unsubscribed = false }) {
  const [priceDrop, setPriceDrop] = useState(true);
  const [backInStock, setBackInStock] = useState(true);
  const [toast, setToast] = useState(false);
  const timer = useRef(null);

  const flash = () => {
    setToast(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(false), 1800);
  };
  const onPriceDrop = () => { setPriceDrop((v) => !v); flash(); };
  const onBackInStock = () => { setBackInStock((v) => !v); flash(); };

  if (unsubscribed) {
    // Minimal: a muted badge + one short explanation + disabled cards. Nothing more.
    return (
      <div className="np-content" data-screen-label="Notifications · unsubscribed">
        <div className="np-head np-head--unsub">
          <div className="np-head__text">
            <h1 className="np-title">Налаштування сповіщень</h1>
          </div>
          <Badge tone="neutral"><IconAlert size={13} /> Ви відписані від усіх сповіщень</Badge>
          <p className="np-subtitle">Поновити підписку можна за посиланням у будь-якому листі від Knyhovo.</p>
        </div>

        <div className="np-cards">
          <PrefCard id="pricedrop"
            title="Сповіщення про зниження ціни"
            desc="Отримайте листа, коли відстежувана книга досягне або опуститься нижче вашої цільової ціни."
            on={false} disabled />
          <PrefCard id="backinstock"
            title="Повернення в наявність"
            desc="Отримайте листа, коли відстежувана книга, якої немає в наявності, з'явиться знову."
            on={false} disabled />
        </div>
      </div>
    );
  }

  return (
    <div className="np-content" data-screen-label="Notifications settings">
      <div className="np-head">
        <div className="np-head__text">
          <h1 className="np-title">Налаштування сповіщень</h1>
          <p className="np-subtitle">Керуйте email-сповіщеннями від Knyhovo.</p>
        </div>
      </div>

      <div className="np-cards">
        <PrefCard
          id="pricedrop"
          title="Сповіщення про зниження ціни"
          desc="Отримайте листа, коли відстежувана книга досягне або опуститься нижче вашої цільової ціни."
          on={priceDrop} onChange={onPriceDrop} />
        <PrefCard
          id="backinstock"
          title="Повернення в наявність"
          desc="Отримайте листа, коли відстежувана книга, якої немає в наявності, з'явиться знову."
          on={backInStock} onChange={onBackInStock} />
      </div>

      <div className="np-helper">
        <IconCheck size={12} /> Зміни зберігаються автоматично
      </div>

      {toast && (
        <div className="np-toast-wrap"><Toast onClose={() => setToast(false)}>Налаштування збережено</Toast></div>
      )}
    </div>
  );
}

// ─── Content: loading skeleton ─────────────────────────────────────────────────
function ContentLoading() {
  return (
    <div className="np-content" aria-busy="true" data-screen-label="Notifications · loading">
      <div className="np-head">
        <div className="np-head__text">
          <span className="np-sk" style={{ height: 34, width: 280, borderRadius: 'var(--radius-sm)' }}></span>
          <span className="np-sk" style={{ height: 15, width: 220, marginTop: 'var(--space-3)', borderRadius: 'var(--radius-xs)' }}></span>
        </div>
        <span className="np-sk" style={{ height: 26, width: 150, borderRadius: 'var(--radius-pill)' }}></span>
      </div>
      <div className="np-cards">
        {[0, 1].map((i) => (
          <div key={i} className="np-card np-card--sk">
            <div className="np-card__info" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span className="np-sk" style={{ height: 17, width: '52%', maxWidth: 230 }}></span>
              <span className="np-sk" style={{ height: 13, width: '86%', maxWidth: 380 }}></span>
            </div>
            <span className="np-sk" style={{ width: 48, height: 26, borderRadius: 'var(--radius-pill)', flexShrink: 0 }}></span>
          </div>
        ))}
      </div>
      <div className="np-helper"><span className="np-sk" style={{ height: 13, width: 190, borderRadius: 'var(--radius-xs)' }}></span></div>
    </div>
  );
}

// ─── Content: error ────────────────────────────────────────────────────────────
function ContentError() {
  return (
    <div className="np-content" data-screen-label="Notifications · error">
      <div className="np-head">
        <div className="np-head__text">
          <h1 className="np-title">Налаштування сповіщень</h1>
          <p className="np-subtitle">Керуйте email-сповіщеннями від Knyhovo.</p>
        </div>
      </div>
      <div className="al-note al-note--err" style={{ maxWidth: 520 }}>
        <span className="al-note__icon"><IconAlert size={18} /></span>
        <div className="al-note__body">Не вдалося завантажити налаштування сповіщень. Перевірте з'єднання та спробуйте ще раз.</div>
        <div className="al-note__action">
          <Button variant="secondary" size="sm" className="np-retry"><IconRefresh size={14} /> Спробувати ще раз</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Full settings frame ─────────────────────────────────────────────────────────
function NP_Frame({ state = 'loaded', unsubscribed = false, mobile = false, theme = 'light' }) {
  const content =
    state === 'loading' ? <ContentLoading /> :
    state === 'error'   ? <ContentError /> :
                          <ContentLoaded unsubscribed={unsubscribed} />;
  return (
    <div data-theme={theme} className={'np-shell' + (mobile ? ' np--mob' : '')} style={{ position: 'relative' }}>
      <div className="np-container">
        <SiteHeader theme={theme} mobile={mobile} />
        <main className="np-main">
          <div className={'np-layout' + (mobile ? ' np-layout--single' : '')}>
            {!mobile && <SettingsNav />}
            {content}
          </div>
        </main>
        <SiteFooter theme={theme} />
      </div>
    </div>
  );
}

// ─── Public unsubscribe — standalone minimal page (no settings chrome) ──────────
function NP_Unsubscribe({ mobile = false, theme = 'light' }) {
  return (
    <div data-theme={theme} className={'np-shell' + (mobile ? ' np--mob' : '')}>
      <div className="np-container">
        <SiteHeader theme={theme} mobile={mobile} />
        <main className="np-unsub-main" data-screen-label="Public unsubscribe">
          <div className="np-unsub">
            <span className="np-unsub__icon"><IconMailOff size={26} /></span>
            <h1 className="np-unsub__title">Ви відписані від усіх сповіщень</h1>
            <p className="np-unsub__text">Ви більше не отримуватимете email-сповіщення від Knyhovo. Якщо це сталося помилково — підписку можна поновити в налаштуваннях акаунту.</p>
            <a href="Homepage v1.0.html" style={{ textDecoration: 'none' }}><Button variant="primary" className="np-unsub-cta">Повернутися на головну</Button></a>
          </div>
        </main>
        <SiteFooter theme={theme} />
      </div>
    </div>
  );
}

// ─── Standalone toast specimen (for the success-toast artboard) ─────────────────
function NP_ToastSpecimen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 'var(--space-6)', background: 'var(--bg)' }}>
      <Toast onClose={() => {}}>Налаштування збережено</Toast>
    </div>
  );
}

// Additive export (no redesign): expose the frozen interior chrome so other
// approved surfaces (e.g. Magic Link Login) reuse the EXACT same header/footer.
Object.assign(window, {
  NP_Frame, NP_Unsubscribe, NP_ToastSpecimen,
  NP_SiteHeader: SiteHeader, NP_SiteFooter: SiteFooter,
});
