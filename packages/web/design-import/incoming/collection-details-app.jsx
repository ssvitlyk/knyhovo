/* Knyhovo — Collection Details v1.0 (2026-07-03)
   One reusable template for every collection opened from Collections Landing.
   Content page: books are the focus from the first viewport — no mascot, no hero
   illustration. Compact info header → sticky sort/filter (Chip language reused from
   the frozen Search Results pattern) → book grid (exact .bkc card, reused verbatim)
   → frozen numbered pagination → Similar Collections (exact fresh-card style).
   Composes window.KnyhovoDesignSystem_9fa616 (Button, Badge, Chip, ThemeToggle) only. */

const { Button, Badge, Chip, ThemeToggle } = window.KnyhovoDesignSystem_9fa616;
const COVER = (id) => `assets/covers/${id}.png`;

/* ── CATALOG — identical source data to Collections Landing (same covers/prices) ── */
const CATALOG = {
  atomni:    { cover: COVER('atomni'),    title: 'Атомні звички',                 author: 'Джеймс Клір',            price: '285 ₴', old: '380 ₴', store: 'Yakaboo' },
  sapiens:   { cover: COVER('sapiens'),   title: 'Sapiens',                        author: 'Юваль Ноа Гарарі',       price: '320 ₴',               store: 'BookChef' },
  dumai:     { cover: COVER('dumai'),     title: 'Думай повільно, вирішуй швидко', author: 'Деніел Канеман',         price: '340 ₴', old: '420 ₴', store: 'Yakaboo' },
  tonke:     { cover: COVER('tonke'),     title: 'Тонке мистецтво забивати',       author: 'Марк Менсон',            price: '240 ₴',               store: 'Rozetka' },
  dofamin:   { cover: COVER('dofamin'),   title: 'Дофамінове покоління',           author: 'Анна Лембке',            price: '265 ₴', old: '310 ₴', store: 'Наш Формат' },
  internat:  { cover: COVER('internat'),  title: 'Інтернат',                       author: 'Сергій Жадан',           price: '220 ₴',               store: 'КСД' },
  dotsia:    { cover: COVER('dotsia'),    title: 'Доця',                           author: 'Тамара Горіха Зерня',    price: '210 ₴',               store: 'Yakaboo' },
  feliks:    { cover: COVER('feliks'),    title: 'Фелікс Австрія',                 author: 'Софія Андрухович',       price: '230 ₴', old: '290 ₴', store: 'Yakaboo' },
  drabyna:   { cover: COVER('drabyna'),   title: 'Драбина',                        author: 'Євгенія Кузнєцова',      price: '250 ₴',               store: 'Vivat' },
  dveri:     { cover: COVER('dveri'),     title: 'Той, хто відчиняє двері',        author: 'Ілларіон Павлюк',        price: '295 ₴',               store: 'Vivat' },
  svitlo:    { cover: COVER('svitlo'),    title: 'Доки світло не згасне',          author: 'Макс Кідрук',            price: '310 ₴', old: '390 ₴', store: 'КСД' },
  perekop:   { cover: COVER('perekop'),   title: 'За Перекопом є земля',           author: 'Анастасія Левкова',      price: '280 ₴',               store: 'Лабораторія' },
  majster:   { cover: COVER('majster'),   title: 'Майстер і Маргарита',            author: 'Михайло Булгаков',       price: '195 ₴', old: '260 ₴', store: 'Наш Формат' },
  storokiv:  { cover: COVER('sto-rokiv'), title: 'Сто років самотності',           author: 'Ґ. Ґарсіа Маркес',       price: '305 ₴',               store: 'BookChef' },
  harry:     { cover: COVER('harry'),     title: 'Гаррі Поттер',                   author: 'Дж. К. Роулінг',         price: '340 ₴',               store: 'Rozetka' },
  b1984:     { cover: COVER('b1984'),     title: '1984',                           author: 'Джордж Орвелл',          price: '180 ₴', old: '240 ₴', store: 'КСД' },
  pryntz:    { cover: COVER('pryntz'),    title: 'Маленький принц',                author: 'А. де Сент-Екзюпері',    price: '150 ₴',               store: 'Yakaboo' },
  tygrolovy: { cover: COVER('tygrolovy'), title: 'Тигролови',                      author: 'Іван Багряний',          price: '170 ₴',               store: 'Vivat' },
  misto:     { cover: COVER('misto'),     title: 'Місто',                          author: 'Валер’ян Підмогильний',  price: '160 ₴',               store: 'Основи' },
  tini:      { cover: COVER('tini'),      title: 'Тіні забутих предків',           author: 'Михайло Коцюбинський',   price: '110 ₴',               store: 'Наш Формат' },
  lisova:    { cover: COVER('lisova'),    title: 'Лісова пісня',                   author: 'Леся Українка',          price: '120 ₴',               store: 'Основи' },
  kobzar:    { cover: COVER('kobzar'),    title: 'Кобзар',                         author: 'Тарас Шевченко',         price: '240 ₴',               store: 'А-ба-ба-га-ла-ма-га' },
  eneida:    { cover: COVER('eneida'),    title: 'Енеїда',                         author: 'Іван Котляревський',     price: '190 ₴',               store: 'Основи' },
  toreadory: { cover: COVER('toreadory'), title: 'Тореадори з Васюківки',          author: 'Всеволод Нестайко',      price: '200 ₴',               store: 'А-ба-ба-га-ла-ма-га' },
};
const CATALOG_KEYS = Object.keys(CATALOG);

/* ── ICONS (Lucide-style line icons — subset needed here) ────── */
function DynIcon({ name, size = 20, solid = false }) {
  const paths = {
    heart: solid
      ? <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="currentColor" stroke="none" />
      : <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
    'chevron-right': <polyline points="9 18 15 12 9 6" />,
    'book-open': <React.Fragment><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></React.Fragment>,
    clock: <React.Fragment><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></React.Fragment>,
    user: <React.Fragment><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></React.Fragment>,
    tag: <React.Fragment><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42Z" /><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" /></React.Fragment>,
    'trending-up': <React.Fragment><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></React.Fragment>,
    sparkles: <React.Fragment><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /></React.Fragment>,
    award: <React.Fragment><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" /><circle cx="12" cy="8" r="6" /></React.Fragment>,
    moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
    swords: <React.Fragment><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /><line x1="13" x2="19" y1="19" y2="13" /><line x1="16" x2="20" y1="16" y2="20" /><line x1="19" x2="21" y1="21" y2="19" /><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" /><line x1="5" x2="9" y1="14" y2="18" /><line x1="7" x2="4" y1="17" y2="20" /><line x1="3" x2="5" y1="19" y2="21" /></React.Fragment>,
    'badge-percent': <React.Fragment><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m15 9-6 6" /><path d="M9 9h.01" /><path d="M15 15h.01" /></React.Fragment>,
    'sliders-horizontal': <React.Fragment><line x1="21" x2="14" y1="4" y2="4" /><line x1="10" x2="3" y1="4" y2="4" /><line x1="21" x2="12" y1="12" y2="12" /><line x1="8" x2="3" y1="12" y2="12" /><line x1="21" x2="16" y1="20" y2="20" /><line x1="12" x2="3" y1="20" y2="20" /><line x1="14" x2="14" y1="2" y2="6" /><line x1="8" x2="8" y1="10" y2="14" /><line x1="16" x2="16" y1="18" y2="22" /></React.Fragment>,
    'arrow-up-down': <React.Fragment><path d="m21 16-4 4-4-4" /><path d="M17 20V4" /><path d="m3 8 4-4 4 4" /><path d="M7 4v16" /></React.Fragment>,
    'chevron-down': <polyline points="6 9 12 15 18 9" />,
    check: <polyline points="20 6 9 17 4 12" />,
    x: <React.Fragment><path d="M18 6 6 18" /><path d="m6 6 12 12" /></React.Fragment>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
}

/* ── QUICK WISHLIST STORE — same localStorage key as Collections Landing,
   so a heart toggled here stays saved when the reader goes back. ────── */
function useWishlist() {
  const [saved, setSaved] = React.useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('kn_wishlist') || '[]')); }
    catch (e) { return new Set(); }
  });
  const toggle = React.useCallback((id) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('kn_wishlist', JSON.stringify([...next])); } catch (e) {}
      return next;
    });
  }, []);
  return [saved, toggle];
}

function pct(book) {
  if (!book.old) return null;
  const num = (s) => parseInt(String(s).replace(/\D/g, ''), 10);
  return Math.round((1 - num(book.price) / num(book.old)) * 100);
}
function priceNum(s) { return parseInt(String(s).replace(/\D/g, ''), 10); }

/* ═══ COLLECTION REGISTRY — only this data changes per collection type;
   the layout/components below never do. ═══════════════════════════ */
const COLLECTIONS = {
  knyhovyk: {
    eyebrow: 'КНИГОВИК РАДИТЬ', kind: 'curator',
    title: 'Книги, що варто прочитати цього літа',
    desc: 'Особиста добірка Книговика — книги, які він перечитував, довго думав про них і нарешті рекомендує вголос.',
    updated: '2 липня 2026', frequency: 'Оновлюється щотижня',
    curator: { name: 'Книговик', role: 'Персональний гід Knyhovo' },
    tags: ['Нон-фікшн', 'Проза', 'Улюблене'],
    count: 20, offset: 0,
  },
  znyzhky: {
    eyebrow: 'ЗНИЖКИ', kind: 'deal',
    title: 'Книги зі знижкою понад 30%',
    desc: 'Найбільші цінові падіння цього тижня — перевірено сьогодні у 5 книгарнях.',
    updated: '3 липня 2026', frequency: 'Оновлюється щодня',
    curator: null,
    tags: ['Знижки', 'Вигідно'],
    count: 24, offset: 4,
  },
  novynky: {
    eyebrow: 'НОВИНКИ', kind: 'fresh',
    title: 'Новинки червня',
    desc: 'Щойно з друку — нові видання, які з’явилися в українських книгарнях цього місяця.',
    updated: '1 липня 2026', frequency: 'Оновлюється щотижня',
    curator: null,
    tags: ['Новинки'],
    count: 16, offset: 9,
  },
  nastrij: {
    eyebrow: 'НАСТРІЙ', kind: 'mood',
    title: 'Книги для затишного вечора',
    desc: 'Тепла проза, від якої не хочеться відриватись — для вечора під пледом.',
    updated: '28 червня 2026', frequency: 'Оновлюється щомісяця',
    curator: null,
    tags: ['Затишок', 'Проза'],
    count: 18, offset: 14,
  },
  zhanr: {
    eyebrow: 'ЖАНР', kind: 'genre',
    title: 'Найкращі українські трилери',
    desc: 'Динамічні сюжети та несподівані фінали від українських авторів.',
    updated: '30 червня 2026', frequency: 'Оновлюється щомісяця',
    curator: null,
    tags: ['Трилери', 'Українське'],
    count: 22, offset: 2,
  },
  redaktsiya: {
    eyebrow: 'ДОБІРКА РЕДАКЦІЇ', kind: 'editorial',
    title: 'Букерівський список 2026',
    desc: 'Фіналісти й лауреати цьогорічної премії — усі в одному місці.',
    updated: '25 червня 2026', frequency: 'Оновлюється щороку',
    curator: { name: 'Редакція Knyhovo', role: 'Кураторська добірка' },
    tags: ['Премії', 'Букер'],
    count: 14, offset: 6,
  },
};
const COLLECTION_ORDER = ['knyhovyk', 'znyzhky', 'novynky', 'nastrij', 'zhanr', 'redaktsiya'];
const SWITCH_LABEL = { knyhovyk: 'Книговик радить', znyzhky: 'Знижки', novynky: 'Новинки', nastrij: 'Настрій', zhanr: 'Жанр', redaktsiya: 'Добірка редакції' };

/* Expand a collection's book list from the shared catalog — deterministic
   rotation from `offset` so different collections surface different books,
   plus synthetic pop/inStock fields the sort & filter controls operate on. */
function buildBooks(spec) {
  const out = [];
  for (let i = 0; i < spec.count; i++) {
    const key = CATALOG_KEYS[(spec.offset + i) % CATALOG_KEYS.length];
    const base = CATALOG[key];
    out.push({
      id: `${key}-${i}`,
      ...base,
      pop: 100 - ((i * 7 + spec.offset * 3) % 97),
      inStock: (i % 9) !== 8,
      addedIdx: spec.count - i,
    });
  }
  return out;
}

function badgeFor(book) {
  const p = pct(book);
  if (p) return { tone: 'green', text: `−${p}%` };
  if (book.pop >= 90) return { tone: 'accent', icon: 'trending-up', text: 'В тренді' };
  if (!book.inStock) return { tone: 'neutral', text: 'Немає в наявності' };
  return null;
}

/* ═══ BOOK CARD — exact recreation of the frozen Collections Landing .bkc ═══ */
function BookCard({ book, saved, onToggle }) {
  const [pop, setPop] = React.useState(false);
  const badge = badgeFor(book);
  function toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    const willAdd = !saved;
    onToggle(book.id);
    if (willAdd) { setPop(true); setTimeout(() => setPop(false), 300); }
  }
  return (
    <a href={`#/knyha/${book.id}`} className={'bkc' + (!book.inStock ? ' bkc--out' : '')}>
      <div className="bkc__coverwrap">
        <div className="bkc__coverclip">
          <img className="bkc__cover" src={book.cover} alt={book.title} loading="lazy" draggable="false" />
          {badge ? (
            <span className={`bkc__badge bkc__badge--${badge.tone}`}>
              {badge.icon ? <DynIcon name={badge.icon} size={12} solid /> : null}
              {badge.text}
            </span>
          ) : null}
        </div>
      </div>
      <div className="bkc__body">
        <div className="bkc__title">{book.title}</div>
        <div className="bkc__author">{book.author}</div>
        <div className="bkc__foot">
          <span className="bkc__price">{book.price}</span>
          {book.old ? <span className="bkc__old">{book.old}</span> : null}
        </div>
      </div>
      <button
        type="button"
        className={'bkc__wish' + (saved ? ' bkc__wish--on' : '') + (pop ? ' bkc__wish--pop' : '')}
        onClick={toggle}
        aria-pressed={saved}
        aria-label={saved ? 'У бажанках' : 'Додати в бажанки'}
        title={saved ? 'У бажанках' : 'Додати в бажанки'}
      >
        <DynIcon name="heart" size={18} solid={saved} />
      </button>
    </a>
  );
}

/* ── CHROME — frozen header/footer, verbatim from Collections Landing ── */
function SiteHeader({ theme, onToggleTheme, wishCount }) {
  const logoSrc = theme === 'dark'
    ? '_ds/knyhovo-design-system-9fa6168a-5230-4cbe-8edd-23fe0c07a170/assets/logo/knyhovo-logo-dark.png'
    : '_ds/knyhovo-design-system-9fa6168a-5230-4cbe-8edd-23fe0c07a170/assets/logo/knyhovo-logo-light.png';
  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
      <div className="page">
        <nav className="site-header">
          <div className="site-brand"><img src={logoSrc} className="site-logo" alt="Knyhovo" /></div>
          <div className="site-nav">
            <a href="#" className="nav-link">Головна</a>
            <a href="Collections Landing Page.html" className="nav-link nav-link--active">Добірки</a>
            <a href="#" className="nav-link">Бажанки{wishCount ? <span className="nav-badge">{wishCount}</span> : null}</a>
            <a href="#" className="nav-link">Про нас</a>
          </div>
          <div className="site-actions">
            <ThemeToggle onChange={onToggleTheme} />
            <button className="kn-btn kn-btn--secondary">Увійти</button>
          </div>
        </nav>
      </div>
    </header>
  );
}
function SiteFooter({ theme }) {
  const logoSrc = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark-trans.png' : 'assets/logo/knyhovo-logo-light-trans.png';
  return (
    <footer className="site-footer" style={{ background: 'var(--surface)' }}>
      <div className="page">
        <div className="footer-row">
          <img src={logoSrc} className="footer-logo" alt="Knyhovo" />
          <nav className="footer-links">
            <a href="#">Про нас</a>
            <a href="#">Книгарні</a>
            <a href="#">Контакти</a>
          </nav>
          <span className="footer-copy">© 2026 Knyhovo</span>
        </div>
      </div>
    </footer>
  );
}

/* ── BREADCRUMB + COMPACT INFO HEADER (replaces the hero) ────── */
function Breadcrumb({ title }) {
  return (
    <nav className="cd-crumbs" aria-label="Хлібні крихти">
      <a href="#">Головна</a>
      <span className="cd-crumbs__sep">/</span>
      <a href="Collections Landing Page.html">Добірки</a>
      <span className="cd-crumbs__sep">/</span>
      <span className="cd-crumbs__current">{title}</span>
    </nav>
  );
}

function InfoHeader({ spec, count }) {
  const [open, setOpen] = React.useState(false);
  const [overflow, setOverflow] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    setOpen(false);
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      setOverflow(el.scrollHeight - el.clientHeight > 2);
    });
    return () => cancelAnimationFrame(id);
  }, [spec]);
  return (
    <div className="cd-info">
      <div className="cd-titlerow">
        <h1 className="cd-title">{spec.title}</h1>
        <span className="cd-count"><b>{count}</b> {bookWord(count)}</span>
      </div>
      <p ref={ref} className={'cd-desc' + (open ? ' cd-desc--open' : '')}>{spec.desc}</p>
      {overflow ? (
        <button type="button" className="cd-desc-toggle" onClick={() => setOpen((o) => !o)}>
          {open ? 'Згорнути' : 'Показати більше'}
        </button>
      ) : null}
    </div>
  );
}

/* ── SORT — one dropdown, KSD-style. The only control on the page.
   The backend already returns books in the optimal order per collection, so the
   default option simply mirrors that ordering; sort just lets the reader re-order.
   No filters are exposed in the default layout (see UX brief). ── */
const SORT_LABELS = {
  popular:    'За популярністю',
  newest:     'Від нових до старих',
  oldest:     'Від старих до нових',
  price_asc:  'За зростанням ціни',
  price_desc: 'За спаданням ціни',
};
// Sort options depend on collection type; only one is active at a time.
const SORT_CONFIG = {
  deal:     { default: 'popular', options: ['popular', 'price_asc', 'price_desc', 'newest'] },
  fresh:    { default: 'newest',  options: ['newest', 'oldest', 'popular', 'price_asc', 'price_desc'] },
  _default: { default: 'popular', options: ['popular', 'newest', 'price_asc', 'price_desc'] },
};
function sortConfigFor(spec) { return SORT_CONFIG[spec.kind] || SORT_CONFIG._default; }

function bookWord(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'книга';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'книги';
  return 'книг';
}

/* ── SORT DROPDOWN — custom listbox styled to the DS (native-select feel) ── */
function SortDropdown({ value, options, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="cd-sort" ref={ref}>
      <button type="button" className="cd-sort__btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="cd-sort__val"><DynIcon name="arrow-up-down" size={16} />{SORT_LABELS[value]}</span>
        <span className="cd-sort__caret" aria-hidden="true"><DynIcon name="chevron-down" size={18} /></span>
      </button>
      {open ? (
        <ul className="cd-sort__menu" role="listbox" aria-label="Сортування">
          {options.map((id) => (
            <li key={id}>
              <button
                type="button" role="option" aria-selected={id === value}
                className={'cd-sort__opt' + (id === value ? ' cd-sort__opt--active' : '')}
                onClick={() => { onChange(id); setOpen(false); }}
              >
                <span className={'cd-sort__check' + (id === value ? '' : ' cd-sort__check--hidden')}><DynIcon name="check" size={16} /></span>
                {SORT_LABELS[id]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ── SORT BAR — sticky; the single sort dropdown only (count now sits by the title) ── */
function SortBar({ sort, setSort, options, stuck }) {
  return (
    <div className={'cd-sortbar' + (stuck ? ' cd-sortbar--stuck' : '')}>
      <div className="page">
        <div className="cd-sortbar__row">
          <SortDropdown value={sort} options={options} onChange={setSort} />
        </div>
      </div>
    </div>
  );
}

/* ── PAGINATION — frozen algorithm + markup, verbatim from Search Results ── */
function getPageItems(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const vis = new Set([1, total, current]);
  if (current - 1 >= 1) vis.add(current - 1);
  if (current + 1 <= total) vis.add(current + 1);
  const sorted = [...vis].sort((a, b) => a - b);
  const items = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap === 2) items.push(sorted[i - 1] + 1);
      else if (gap > 2) items.push('\u2026');
    }
    items.push(sorted[i]);
  }
  return items;
}
function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const items = getPageItems(page, pages);
  return (
    <nav className="kn-pagination" aria-label="Сторінки добірки">
      <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => onPage(page - 1)}>← Назад</Button>
      <div className="kn-pagination__pages">
        {items.map((item, i) =>
          item === '\u2026'
            ? <span key={'e' + i} className="kn-pagination__ellipsis">…</span>
            : <Button key={item} variant={item === page ? 'primary' : 'ghost'} size="sm"
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPage(item)}>{item}</Button>
        )}
      </div>
      <Button variant="secondary" size="sm" disabled={page === pages} onClick={() => onPage(page + 1)}>Вперед →</Button>
    </nav>
  );
}

/* ── SIMILAR COLLECTIONS — exact fresh-card style, verbatim ──── */
const SIMILAR_ICON = { knyhovyk: 'sparkles', znyzhky: 'badge-percent', novynky: 'award', nastrij: 'moon', zhanr: 'swords', redaktsiya: 'award' };
function SimilarCollections({ currentSlug, onPick }) {
  const others = COLLECTION_ORDER.filter((s) => s !== currentSlug).slice(0, 3);
  return (
    <section className="cd-similar">
      <div className="page">
        <h2 className="cd-similar__title">Схожі добірки</h2>
        <div className="fresh-grid">
          {others.map((slug) => {
            const spec = COLLECTIONS[slug];
            const preview = buildBooks(spec).slice(0, 5);
            return (
              <a key={slug} href="#" className="fresh-card" onClick={(e) => { e.preventDefault(); onPick(slug); }}>
                <div className="fresh-card__head">
                  <span className="fresh-card__icon"><DynIcon name={SIMILAR_ICON[slug]} size={20} /></span>
                  <span className="fresh-card__type">{spec.eyebrow}</span>
                </div>
                <div className="fresh-card__name">{spec.title}</div>
                <div className="fresh-card__desc">{spec.desc}</div>
                <div className="fresh-card__covers">
                  <div className="fresh-card__stack">
                    {preview.map((bk) => <img key={bk.id} src={bk.cover} alt={bk.title} loading="lazy" />)}
                  </div>
                  <span className="fresh-card__count">{spec.count} книг →</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── DEV PREVIEW SWITCHER (review scaffolding — swaps data only, layout never changes) ── */
function DevSwitch({ current, onPick }) {
  return (
    <div className="dev-switch">
      <div className="page">
        <div className="dev-switch__row">
          <span className="dev-switch__label">Приклад добірки:</span>
          {COLLECTION_ORDER.map((slug) => (
            <button
              key={slug}
              type="button"
              className={'dev-switch__btn' + (current === slug ? ' dev-switch__btn--active' : '')}
              onClick={() => onPick(slug)}
            >
              {SWITCH_LABEL[slug]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 15;

function CollectionDetailsPage() {
  const [theme, setTheme] = React.useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  const [slug, setSlug] = React.useState('knyhovyk');
  const [sort, setSort] = React.useState(() => sortConfigFor(COLLECTIONS['knyhovyk']).default);
  const [page, setPage] = React.useState(1);
  const [saved, toggleSaved] = useWishlist();
  const [stuck, setStuck] = React.useState(false);

  function handleToggleTheme(t) { setTheme(t); document.documentElement.setAttribute('data-theme', t); }

  const spec = COLLECTIONS[slug];
  const cfg = sortConfigFor(spec);
  const allBooks = React.useMemo(() => buildBooks(spec), [slug]);

  function pickCollection(s) {
    setSlug(s); setSort(sortConfigFor(COLLECTIONS[s]).default); setPage(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function changeSort(s) { setSort(s); setPage(1); }

  // Backend returns the optimal order; the dropdown just re-orders. Out-of-stock
  // books settle at the end of the list (no «only available» filter needed).
  const sorted = React.useMemo(() => {
    const copy = [...allBooks];
    if (sort === 'popular')    copy.sort((a, b) => b.pop - a.pop);
    if (sort === 'newest')     copy.sort((a, b) => b.addedIdx - a.addedIdx);
    if (sort === 'oldest')     copy.sort((a, b) => a.addedIdx - b.addedIdx);
    if (sort === 'price_asc')  copy.sort((a, b) => priceNum(a.price) - priceNum(b.price));
    if (sort === 'price_desc') copy.sort((a, b) => priceNum(b.price) - priceNum(a.price));
    copy.sort((a, b) => (b.inStock ? 1 : 0) - (a.inStock ? 1 : 0)); // stable: out-of-stock last
    return copy;
  }, [allBooks, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageBooks = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  React.useEffect(() => {
    function onScroll() { setStuck(window.scrollY > 96); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function onPage(p) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div>
      <DevSwitch current={slug} onPick={pickCollection} />
      <SiteHeader theme={theme} onToggleTheme={handleToggleTheme} wishCount={saved.size} />
      <main>
        <div className="page">
          <Breadcrumb title={spec.title} />
          <InfoHeader spec={spec} count={sorted.length} />
        </div>

        <SortBar
          sort={sort} setSort={changeSort}
          options={cfg.options} stuck={stuck}
        />

        <div className="page">
          <div className="cd-grid-wrap reveal">
            {pageBooks.length ? (
              <div className="cd-grid">
                {pageBooks.map((bk) => (
                  <BookCard key={bk.id} book={bk} saved={saved.has(bk.id)} onToggle={toggleSaved} />
                ))}
              </div>
            ) : (
              <div className="cd-empty">У цій добірці поки немає книг.</div>
            )}
          </div>
          <Pagination page={safePage} pages={pages} onPage={onPage} />
        </div>

        <SimilarCollections currentSlug={slug} onPick={pickCollection} />
      </main>
      <SiteFooter theme={theme} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CollectionDetailsPage />);
