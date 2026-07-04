/* ═══════════════════════════════════════════════════════════════════════
   kn-header.jsx — Knyhovo GLOBAL SITE HEADER · v1.0 · 2026-07-04
   window.KnHeader = { Header, useAuth }

   One header component for every Knyhovo page (UX reference: ksd.ua;
   visuals: Knyhovo DS only). Load order (all after React + Babel + DS bundle):
     <link rel="stylesheet" href="kn-header.css">
     <script type="text/babel" src="tweaks-panel.jsx"></script>   (optional, for the auth tweak)
     <script type="text/babel" src="kn-header.jsx"></script>
     <script type="text/babel" src="<page>.jsx"></script>

   Usage:
     <window.KnHeader.Header theme={theme} onToggleTheme={setTheme}
       active="dobirky" wishCount={saved.size} />
     · active: 'home' | 'dobirky' | 'bazhanky' | 'about' | undefined
     · wishCount: optional — if omitted, reads localStorage 'kn_wishlist'
     · auth state is shared across pages: window.KnHeader.useAuth() →
       [loggedIn, setLoggedIn], persisted in localStorage 'kn-logged-in'.
       Bind a TweakToggle to it in each page's Tweaks panel.
   ═══════════════════════════════════════════════════════════════════════ */

const KNH_DS = window.KnyhovoDesignSystem_9fa616;

/* Lucide outline paths (2px stroke, round caps) — inline so the header has
   no runtime icon dependency. Same icon language as the Collections DynIcon. */
const KNH_PATHS = {
  search: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z"></path>',
  menu: '<path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path>',
  x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
  'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" x2="9" y1="12" y2="12"></line>',
};

function KnhIcon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: KNH_PATHS[name] || '' }} />
  );
}

/* ── Shared auth state — prototype-wide (localStorage + event), so flipping
     the «Користувач увійшов» tweak on one page applies to every page. ── */
function useKnAuth() {
  const read = () => { try { return localStorage.getItem('kn-logged-in') === '1'; } catch (e) { return false; } };
  const [loggedIn, setState] = React.useState(read);
  React.useEffect(() => {
    const sync = () => setState(read());
    window.addEventListener('kn-auth-change', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('kn-auth-change', sync); window.removeEventListener('storage', sync); };
  }, []);
  const setLoggedIn = React.useCallback((v) => {
    try { localStorage.setItem('kn-logged-in', v ? '1' : '0'); } catch (e) {}
    window.dispatchEvent(new Event('kn-auth-change'));
  }, []);
  return [loggedIn, setLoggedIn];
}

/* Wishlist count: explicit prop wins (pages with a live wishlist store);
   otherwise read the shared 'kn_wishlist' localStorage list. */
function useKnWishCount(external) {
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    if (typeof external === 'number') return undefined;
    const read = () => { try { setN((JSON.parse(localStorage.getItem('kn_wishlist') || '[]') || []).length); } catch (e) { setN(0); } };
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, [external]);
  return typeof external === 'number' ? external : n;
}

const KNH_LINKS = [
  { id: 'home', label: 'Головна', href: 'Homepage v1.0.html' },
  { id: 'dobirky', label: 'Добірки', href: 'Collections Landing Page.html' },
  { id: 'bazhanky', label: 'Бажанки', href: '#' },
  { id: 'about', label: 'Про нас', href: '#' },
];

function knhSubmitSearch(q) {
  const query = (q || '').trim();
  if (!query) return;
  window.location.href = 'Search Results Page.html?q=' + encodeURIComponent(query);
}

/* ── Mobile search overlay (ksd.ua pattern: dim page, big input on top) ── */
function KnhSearchOverlay({ q, setQ, onClose }) {
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  return (
    <div className="knh-so" role="dialog" aria-modal="true" aria-label="Пошук">
      <div className="knh-so__backdrop" onClick={onClose}></div>
      <form className="knh-so__panel" role="search"
        onSubmit={(e) => { e.preventDefault(); knhSubmitSearch(q); }}>
        <div className="knh-so__field">
          <KnhIcon name="search" size={20} />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Пошук книги, автора або ISBN" aria-label="Пошук книги, автора або ISBN" />
          {q.length > 0 && (
            <button type="button" className="knh__clear" aria-label="Очистити"
              onClick={() => { setQ(''); if (ref.current) ref.current.focus(); }}>
              <KnhIcon name="x" size={18} />
            </button>
          )}
        </div>
        <button type="submit" className="knh-so__go">Знайти</button>
      </form>
    </div>
  );
}

/* ── Mobile drawer: nav · auth · theme toggle. Logged-out hides «Бажанки»,
     shows «Увійти»; logged-in adds Профіль + Вийти. ── */
function KnhDrawer({ active, count, loggedIn, setLoggedIn, theme, onToggleTheme, onClose }) {
  const ThemeToggle = KNH_DS.ThemeToggle;
  const links = KNH_LINKS.filter((l) => loggedIn || l.id !== 'bazhanky');
  return (
    <div className="knh-dr" role="dialog" aria-modal="true" aria-label="Меню">
      <div className="knh-dr__backdrop" onClick={onClose}></div>
      <div className="knh-dr__panel">
        <div className="knh-dr__head">
          <span className="knh-dr__title">Меню</span>
          <button type="button" className="knh__iconbtn" aria-label="Закрити меню" onClick={onClose}>
            <KnhIcon name="x" size={22} />
          </button>
        </div>
        <nav className="knh-dr__nav" aria-label="Основна навігація">
          {links.map((l) => (
            <a key={l.id} href={l.href} onClick={onClose}
              className={'knh-dr__item' + (active === l.id ? ' knh-dr__item--active' : '')}>
              {l.label}
              {l.id === 'bazhanky' && count > 0 ? <span className="knh__badge">{count}</span> : null}
            </a>
          ))}
          {loggedIn ? (
            <React.Fragment>
              <a href="#" className="knh-dr__item" onClick={onClose}>
                <KnhIcon name="user" size={18} />Профіль
              </a>
              {/* Prototype behaviour: actually flips the shared auth state. */}
              <button type="button" className="knh-dr__item knh-dr__item--muted"
                onClick={() => { setLoggedIn(false); onClose(); }}>
                <KnhIcon name="log-out" size={18} />Вийти
              </button>
            </React.Fragment>
          ) : null}
        </nav>
        {!loggedIn ? (
          <div className="knh-dr__auth">
            {/* Prototype behaviour: flips the shared auth state (real app opens the Magic Link modal). */}
            <button type="button" className="kn-btn kn-btn--secondary"
              onClick={() => { setLoggedIn(true); onClose(); }}>Увійти</button>
          </div>
        ) : null}
        <div className="knh-dr__theme">
          <span>Тема</span>
          <ThemeToggle theme={theme} onChange={onToggleTheme} />
        </div>
      </div>
    </div>
  );
}

/* ── The header ── */
function KnSiteHeader({ theme, onToggleTheme, active, wishCount }) {
  const ThemeToggle = KNH_DS.ThemeToggle;
  const [loggedIn, setLoggedIn] = useKnAuth();
  const count = useKnWishCount(wishCount);
  const [q, setQ] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const anyOpen = searchOpen || drawerOpen;

  const logoSrc = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png';

  /* Lock page scroll while an overlay is open. */
  React.useEffect(() => {
    if (!anyOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [anyOpen]);

  /* Escape closes; switching to desktop closes both. */
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setSearchOpen(false); setDrawerOpen(false); } };
    const mq = window.matchMedia('(min-width: 769px)');
    const onMq = () => { if (mq.matches) { setSearchOpen(false); setDrawerOpen(false); } };
    window.addEventListener('keydown', onKey);
    mq.addEventListener('change', onMq);
    return () => { window.removeEventListener('keydown', onKey); mq.removeEventListener('change', onMq); };
  }, []);

  return (
    <header className="knh" data-screen-label="Header">
      <div className="knh__page">
        <div className="knh__row">
          <a className="knh__brand" href="Homepage v1.0.html" aria-label="Knyhovo — на головну">
            <img className="knh__logo" src={logoSrc} alt="Knyhovo" />
          </a>

          {/* Desktop search — submits to the Search Results page (?q=…). */}
          <form className="knh__search" role="search"
            onSubmit={(e) => { e.preventDefault(); knhSubmitSearch(q); }}>
            <KnhIcon name="search" size={18} />
            <input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Пошук книги, автора або ISBN" aria-label="Пошук книги, автора або ISBN" />
            {q.length > 0 && (
              <button type="button" className="knh__clear" aria-label="Очистити"
                onClick={() => setQ('')}><KnhIcon name="x" size={16} /></button>
            )}
          </form>

          <nav className="knh__nav" aria-label="Основна навігація">
            {KNH_LINKS.map((l) => (
              <a key={l.id} href={l.href}
                className={'knh__link' + (active === l.id ? ' knh__link--active' : '')}>
                {l.label}
                {l.id === 'bazhanky' && count > 0 ? <span className="knh__badge">{count}</span> : null}
              </a>
            ))}
          </nav>

          <div className="knh__actions">
            <ThemeToggle theme={theme} onChange={onToggleTheme} />
            {loggedIn ? (
              <button type="button" className="kn-btn kn-btn--secondary knh__auth">
                <KnhIcon name="user" size={16} />Профіль
              </button>
            ) : (
              <button type="button" className="kn-btn kn-btn--secondary">Увійти</button>
            )}
          </div>

          {/* Mobile icon cluster: wishlist · search · menu (44px targets). */}
          <div className="knh__mob">
            <a className="knh__iconbtn" href="#" aria-label={'Бажанки' + (count ? ` (${count})` : '')}>
              <KnhIcon name="heart" size={21} />
              {count > 0 ? <span className="knh__count">{count}</span> : null}
            </a>
            <button type="button" className="knh__iconbtn" aria-label="Пошук"
              onClick={() => setSearchOpen(true)}><KnhIcon name="search" size={21} /></button>
            <button type="button" className="knh__iconbtn" aria-label="Меню" aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}><KnhIcon name="menu" size={22} /></button>
          </div>
        </div>
      </div>

      {searchOpen ? (
        <KnhSearchOverlay q={q} setQ={setQ} onClose={() => setSearchOpen(false)} />
      ) : null}
      {drawerOpen ? (
        <KnhDrawer active={active} count={count} loggedIn={loggedIn} setLoggedIn={setLoggedIn}
          theme={theme} onToggleTheme={onToggleTheme} onClose={() => setDrawerOpen(false)} />
      ) : null}
    </header>
  );
}

window.KnHeader = { Header: KnSiteHeader, useAuth: useKnAuth };
