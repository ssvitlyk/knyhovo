/* Knyhovo Collections Navigation — 2026-07-02
   Sticky section nav that sits directly under the site header and above the
   «Книговик радить» hero (KSD-style top ribbon, evolved: Waterstones typography,
   Apple restraint, Knyhovo palette). Dark ink bar (#171411) in BOTH themes,
   gold #F7B24D accent only. Desktop: text links + «Жанри» mega menu (hover/click).
   Mobile: horizontal scroll row; «Жанри» opens an 80vh bottom sheet with search.
   Smooth-scrolls to section anchors; active item follows scroll position.
   Line icons only (inline Lucide-style) — no emoji. Exposed as window.CollectionsNav. */

const CNAV_ITEMS = [
  { id: 'populyarne', label: 'Популярне', icon: 'flame' },
  { id: 'obrane',     label: 'Обране',    icon: 'heart' },
  { id: 'novynky',    label: 'Новинки',   icon: 'sparkles' },
  { id: 'znyzhky',    label: 'Знижки',    icon: 'badge-percent' },
  { id: 'nastroji',   label: 'Настрої',   icon: 'moon' },
  { id: 'redaktsiya', label: 'Добірки',   icon: 'library' },
];

const CNAV_GENRES = [
  'Фантастика', 'Фентезі', 'Трилери', 'Детективи', 'Жахи', 'Young Adult',
  'Класика', 'Романтика', 'Саморозвиток', 'Психологія', 'Бізнес', 'Біографії',
  'Дитячі', 'Комікси', 'Історія', 'Науково-популярні', 'Художня проза',
];

function CNavIcon({ name, size = 16 }) {
  const paths = {
    flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
    heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
    sparkles: <React.Fragment><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /></React.Fragment>,
    'badge-percent': <React.Fragment><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m15 9-6 6" /><path d="M9 9h.01" /><path d="M15 15h.01" /></React.Fragment>,
    moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
    library: <React.Fragment><path d="m16 6 4 14" /><path d="M12 6v14" /><path d="M8 8v12" /><path d="M4 4v16" /></React.Fragment>,
    'book-open': <React.Fragment><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></React.Fragment>,
    'chevron-down': <path d="m6 9 6 6 6-6" />,
    'chevron-right': <polyline points="9 18 15 12 9 6" />,
    'arrow-right': <React.Fragment><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></React.Fragment>,
    search: <React.Fragment><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></React.Fragment>,
    x: <React.Fragment><path d="M18 6 6 18" /><path d="m6 6 12 12" /></React.Fragment>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
}

function cnavUseIsMobile(bp = 768) {
  const [m, setM] = React.useState(() => window.matchMedia(`(max-width: ${bp}px)`).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const h = (e) => setM(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [bp]);
  return m;
}

/* Bottom sheet (mobile «Жанри») — portaled to <body> so it escapes the nav's
   stacking context and sits above the sticky header. */
function CNavGenreSheet({ onClose }) {
  const [q, setQ] = React.useState('');
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const query = q.trim().toLowerCase();
  const list = query ? CNAV_GENRES.filter((g) => g.toLowerCase().includes(query)) : CNAV_GENRES;

  return ReactDOM.createPortal(
    <React.Fragment>
      <div className="cnav-sheet-backdrop" onClick={onClose}></div>
      <div className="cnav-sheet" role="dialog" aria-modal="true" aria-label="Жанри">
        <div className="cnav-sheet__grab"></div>
        <div className="cnav-sheet__head">
          <div className="cnav-sheet__title">Жанри</div>
          <button type="button" className="cnav-sheet__close" onClick={onClose} aria-label="Закрити">
            <CNavIcon name="x" size={18} />
          </button>
        </div>
        <label className="cnav-sheet__search">
          <CNavIcon name="search" size={17} />
          <input
            type="text"
            placeholder="Знайти жанр"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Пошук жанру"
          />
        </label>
        <div className="cnav-sheet__list">
          {list.map((g) => (
            <a key={g} href={`#/zhanry/${encodeURIComponent(g.toLowerCase())}`} className="cnav-sheet__item" onClick={onClose}>
              {g}
              <CNavIcon name="chevron-right" size={16} />
            </a>
          ))}
          {list.length === 0 ? <div className="cnav-sheet__empty">Нічого не знайшли. Спробуйте інший запит.</div> : null}
        </div>
        <div className="cnav-sheet__foot">
          <a href="#/zhanry" className="cnav-sheet__all" onClick={onClose}>Усі жанри <CNavIcon name="arrow-right" size={17} /></a>
        </div>
      </div>
    </React.Fragment>,
    document.body
  );
}

function CollectionsNav() {
  const isMobile = cnavUseIsMobile();
  const [active, setActive] = React.useState(null);
  const [stuck, setStuck] = React.useState(false);
  const [megaOpen, setMegaOpen] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const navRef = React.useRef(null);
  const closeTimer = React.useRef(0);

  /* Scroll-spy: the section whose box crosses the probe line (just under the
     sticky bar) is the active one. */
  React.useEffect(() => {
    const els = CNAV_ITEMS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!els.length) return;
    let raf = 0;
    function measure() {
      raf = 0;
      const nav = navRef.current;
      const probe = (nav ? nav.getBoundingClientRect().bottom : 130) + 80;
      let cur = null;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) { cur = el.id; break; }
      }
      setActive(cur);
      setStuck(window.scrollY > 8);
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(measure); }
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  /* Close mega on Escape / outside click. */
  React.useEffect(() => {
    if (!megaOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMegaOpen(false); };
    const onDown = (e) => { if (navRef.current && !navRef.current.contains(e.target)) setMegaOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [megaOpen]);

  function go(e, id) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const navH = navRef.current ? navRef.current.offsetHeight : 70;
    const headH = isMobile ? 56 : 72;
    const top = el.getBoundingClientRect().top + window.scrollY - headH - navH + 2;
    window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
    setMegaOpen(false);
    flashOnArrival(el);
  }

  /* After the smooth scroll settles, give the target section a short one-shot
     fade-in (CSS [data-cnav-flash], ~300ms). Uses scrollend when available. */
  function flashOnArrival(el) {
    const flash = () => {
      el.removeAttribute('data-cnav-flash');
      void el.offsetWidth; /* restart animation if re-triggered */
      el.setAttribute('data-cnav-flash', '');
      setTimeout(() => el.removeAttribute('data-cnav-flash'), 500);
    };
    if ('onscrollend' in window) {
      let to = 0;
      const onEnd = () => { clearTimeout(to); window.removeEventListener('scrollend', onEnd); flash(); };
      window.addEventListener('scrollend', onEnd, { once: true });
      to = setTimeout(onEnd, 1100); /* fallback if scrollend never fires */
    } else {
      setTimeout(flash, 650);
    }
  }

  function openMegaSoon() {
    if (isMobile) return;
    clearTimeout(closeTimer.current);
    setMegaOpen(true);
  }
  function closeMegaSoon() {
    if (isMobile) return;
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMegaOpen(false), 140);
  }

  return (
    <nav
      className={'cnav' + (stuck ? ' cnav--stuck' : '')}
      ref={navRef}
      aria-label="Розділи сторінки добірок"
      data-screen-label="Collections Navigation"
      onMouseLeave={closeMegaSoon}
      onMouseEnter={() => clearTimeout(closeTimer.current)}
    >
      <div className="page">
        <div className="cnav__row">
          {CNAV_ITEMS.map((s) => (
            <a
              key={s.id}
              href={'#' + s.id}
              className={'cnav__link' + (active === s.id ? ' cnav__link--active' : '')}
              onClick={(e) => go(e, s.id)}
            >
              <CNavIcon name={s.icon} />
              {s.label}
            </a>
          ))}
          <button
            type="button"
            className="cnav__link cnav__link--genres"
            aria-expanded={megaOpen}
            aria-haspopup="true"
            onClick={() => (isMobile ? setSheetOpen(true) : setMegaOpen((o) => !o))}
            onMouseEnter={openMegaSoon}
          >
            <CNavIcon name="book-open" />
            Жанри
            <span className="cnav__chev"><CNavIcon name="chevron-down" size={14} /></span>
          </button>
        </div>
      </div>

      {!isMobile && megaOpen ? (
        <div className="cnav__mega" data-screen-label="Genres Mega Menu">
          <div className="page">
            <div className="cnav__mega-inner">
              <div className="cnav__mega-cols">
                {CNAV_GENRES.map((g) => (
                  <a key={g} href={`#/zhanry/${encodeURIComponent(g.toLowerCase())}`} className="cnav__genre" onClick={() => setMegaOpen(false)}>{g}</a>
                ))}
              </div>
              <div className="cnav__mega-foot">
                <a href="#/zhanry" className="cnav__mega-all" onClick={() => setMegaOpen(false)}>Усі жанри <CNavIcon name="arrow-right" size={17} /></a>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isMobile && sheetOpen ? <CNavGenreSheet onClose={() => setSheetOpen(false)} /> : null}
    </nav>
  );
}

window.CollectionsNav = CollectionsNav;
