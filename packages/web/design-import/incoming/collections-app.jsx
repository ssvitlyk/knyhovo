/* Knyhovo Collections Landing — v3.0 / Iteration 3 (2026-07-02)
   UX pass (no visual redesign): every BOOK section is now a horizontal shelf
   (wheel / shift+wheel / click-drag / swipe, never paginated) with a peek edge
   and a trailing «see all» card. Every card carries an always-visible quick
   wishlist heart (bottom-right, instant toggle, persisted). Content rhythm
   alternates editorial ▸ shelf ▸ discovery/nav; sections explain WHY they exist
   and show freshness; subtle alternating section tints. Cross-section dedup keeps
   every book on exactly one shelf.
   The «Книговик радить» featured block stays EXACTLY v1.0 (frozen).
   Composes DS v1.0 tokens/components only. Line icons only (inline Lucide-style). */

const { ThemeToggle } = window.KnyhovoDesignSystem_9fa616;
const COVER = (id) => `assets/covers/${id}.png`;

document.documentElement.classList.add('js');

/* ── BOOK CATALOG (real covers in assets/covers) ─────────────── */
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

/* ── CROSS-SECTION DEDUP ──────────────────────────────────────
   Every book lands on exactly ONE shelf. Pools are listed in RELEVANCE
   priority; each shelf greedily takes the first unused ids, so a book sits
   in its strongest category and the rest fill with the next-best candidates.
   No book repeats anywhere on the page. */
const SECTION_POOLS = [
  { key: 'gems',    take: 4, pool: ['misto', 'tini', 'lisova', 'toreadory', 'eneida'] },
  { key: 'znyzhky', take: 5, pool: ['atomni', 'majster', 'svitlo', 'dumai', 'b1984', 'feliks', 'dofamin'] },
  { key: 'obrane',  take: 5, pool: ['internat', 'dotsia', 'dveri', 'drabyna', 'perekop', 'feliks'] },
  { key: 'novynky', take: 5, pool: ['storokiv', 'tygrolovy', 'harry', 'dofamin', 'feliks', 'svitlo', 'drabyna'] },
  { key: 'popular', take: 5, pool: ['sapiens', 'tonke', 'kobzar', 'pryntz', 'eneida', 'harry', 'storokiv'] },
];
function allocate(specs) {
  const used = new Set();
  const out = {};
  for (const s of specs) {
    const picked = [];
    for (const id of s.pool) {
      if (picked.length >= s.take) break;
      if (used.has(id)) continue;
      used.add(id);
      picked.push(id);
    }
    out[s.key] = picked.map((id) => ({ id, ...CATALOG[id] }));
  }
  return out;
}
const ALLOC = allocate(SECTION_POOLS);

/* Per-section context metadata that rides on the shared card as a cover badge. */
const SAVES  = { internat: 1284, dotsia: 1147, dveri: 968, drabyna: 842, perekop: 731 };
const RATING = { misto: 4.7, tini: 4.8, lisova: 4.6, toreadory: 4.9, eneida: 4.5 };

function compactUA(n) {
  if (n < 1000) return String(n);
  const t = n / 1000;
  return (Number.isInteger(t) ? t : t.toFixed(1).replace('.', ',')) + 'к';
}
function pct(book) {
  if (!book.old) return null;
  const num = (s) => parseInt(String(s).replace(/\D/g, ''), 10);
  return Math.round((1 - num(book.price) / num(book.old)) * 100);
}

/* ── VIEWPORT ─────────────────────────────────────────────────
   Drives the mobile-first list-row layout for Mood + Collection sections
   below (structural DOM swap, not just CSS resize — see project notes). ── */
function useIsMobile(bp = 768) {
  const [isMobile, setIsMobile] = React.useState(() => window.matchMedia(`(max-width: ${bp}px)`).matches);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [bp]);
  return isMobile;
}

/* Dense mobile list-row — icon · title · 1-line subtitle · count →.
   Shared by Mood and Collection ("Щойно зібрали") sections on mobile:
   information is the hero, decoration (grids, cover stacks) drops away. */
function ListRow({ href, icon, title, desc, count }) {
  return (
    <a href={href} className="list-row">
      <span className="list-row__icon"><DynIcon name={icon} size={19} /></span>
      <div className="list-row__body">
        <div className="list-row__title">{title}</div>
        <div className="list-row__desc">{desc}</div>
      </div>
      <span className="list-row__meta">{count}<DynIcon name="chevron-right" size={14} /></span>
    </a>
  );
}

/* ── ICONS (Lucide-style line icons) ─────────────────────────── */
function DynIcon({ name, size = 20, solid = false }) {
  const paths = {
    swords: <React.Fragment><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" /><line x1="13" x2="19" y1="19" y2="13" /><line x1="16" x2="20" y1="16" y2="20" /><line x1="19" x2="21" y1="21" y2="19" /><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" /><line x1="5" x2="9" y1="14" y2="18" /><line x1="7" x2="4" y1="17" y2="20" /><line x1="3" x2="5" y1="19" y2="21" /></React.Fragment>,
    brain: <React.Fragment><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" /><path d="M6 18a4 4 0 0 1-1.967-.516" /><path d="M19.967 17.484A4 4 0 0 1 18 18" /></React.Fragment>,
    'book-open': <React.Fragment><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></React.Fragment>,
    'chart-column': <React.Fragment><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></React.Fragment>,
    rocket: <React.Fragment><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></React.Fragment>,
    landmark: <React.Fragment><line x1="3" x2="21" y1="22" y2="22" /><line x1="6" x2="6" y1="18" y2="11" /><line x1="10" x2="10" y1="18" y2="11" /><line x1="14" x2="14" y1="18" y2="11" /><line x1="18" x2="18" y1="18" y2="11" /><polygon points="12 2 20 7 4 7" /></React.Fragment>,
    palette: <React.Fragment><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" /><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /></React.Fragment>,
    microscope: <React.Fragment><path d="M6 18h8" /><path d="M3 22h18" /><path d="M14 22a7 7 0 1 0 0-14h-1" /><path d="M9 14h2" /><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" /><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" /></React.Fragment>,
    coffee: <React.Fragment><path d="M10 2v2" /><path d="M14 2v2" /><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" /><path d="M6 2v2" /></React.Fragment>,
    moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
    compass: <React.Fragment><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" /><circle cx="12" cy="12" r="10" /></React.Fragment>,
    plane: <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />,
    clock: <React.Fragment><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></React.Fragment>,
    award: <React.Fragment><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" /><circle cx="12" cy="8" r="6" /></React.Fragment>,
    lightbulb: <React.Fragment><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></React.Fragment>,
    'trending-up': <React.Fragment><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></React.Fragment>,
    eye: <React.Fragment><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></React.Fragment>,
    search: <React.Fragment><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></React.Fragment>,
    ghost: <React.Fragment><path d="M9 10h.01" /><path d="M15 10h.01" /><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" /></React.Fragment>,
    sparkles: <React.Fragment><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" /></React.Fragment>,
    feather: <React.Fragment><path d="M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z" /><path d="M16 8 2 22" /><path d="M17.5 15H9" /></React.Fragment>,
    heart: solid
      ? <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="currentColor" stroke="none" />
      : <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
    star: solid
      ? <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none" />
      : <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
    'arrow-right': <React.Fragment><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></React.Fragment>,
    'chevron-left': <polyline points="15 18 9 12 15 6" />,
    'chevron-right': <polyline points="9 18 15 12 9 6" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
}

/* ── SECTION HEADER (eyebrow · title · why-sub · freshness · see-all) ── */
function SecHead({ eyebrow, title, sub, fresh, allLabel, allHref }) {
  return (
    <div className="sec-head">
      <div className="sec-head__left">
        {eyebrow ? <div className="sec-eyebrow">{eyebrow}</div> : null}
        <div className="sec-title">{title}</div>
        {sub ? <div className="sec-sub">{sub}</div> : null}
        {fresh ? (
          <div className={'sec-fresh' + (fresh.ed ? ' sec-fresh--ed' : '')}>
            <span className="sec-fresh__dot" />{fresh.text}
          </div>
        ) : null}
      </div>
      {allLabel ? <a href={allHref || '#'} className="sec-all">{allLabel} →</a> : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UNIVERSAL BOOK CARD — one component used on EVERY shelf.
   Fixed order: cover · title · author · price. Whole card opens Book
   Details (the single primary action); the circular heart bottom-right
   is the only secondary action — quick wishlist toggle, no navigation.
   ═══════════════════════════════════════════════════════════════ */
function BookCard({ book, badge, saved, onToggle }) {
  const [pop, setPop] = React.useState(false);
  function toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    const willAdd = !saved;
    onToggle(book.id);
    if (willAdd) { setPop(true); setTimeout(() => setPop(false), 300); }
  }
  return (
    <a href={`#/knyha/${book.id}`} className="bkc">
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

/* ── HORIZONTAL SHELF INTERACTIONS ────────────────────────────
   Wheel + shift-wheel translate to horizontal (releasing to the page at the
   ends so scroll is never trapped); click-drag pans (mouse only — touch uses
   native swipe); a post-drag click is swallowed so panning never opens a book. */
function useRailInteractions(ref) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onWheel(e) {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; // native horizontal (shift/trackpad)
      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return; // let the page scroll
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }

    let down = false, moved = false, startX = 0, startS = 0;
    let lastX = 0, lastT = 0, vx = 0, flingId = 0;
    function onDown(e) {
      if (e.pointerType === 'touch') return;      // touch = native swipe
      if (e.button !== undefined && e.button !== 0) return;
      cancelAnimationFrame(flingId);
      down = true; moved = false; startX = e.clientX; startS = el.scrollLeft;
      lastX = e.clientX; lastT = performance.now(); vx = 0;
    }
    function onMove(e) {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) { moved = true; el.classList.add('is-dragging'); }
      if (moved) {
        el.scrollLeft = startS - dx;
        const now = performance.now();
        const dt = now - lastT;
        if (dt > 4) { vx = (e.clientX - lastX) / dt; lastX = e.clientX; lastT = now; }
      }
    }
    // Drag release keeps momentum — a soft exponential decay fling, like a real
    // shelf being pushed — then hands back to CSS scroll-snap once it settles.
    function onUp() {
      if (!down) return;
      down = false;
      if (!moved) return;
      let v = vx * 15;
      function step() {
        if (Math.abs(v) < 0.5) { el.classList.remove('is-dragging'); return; }
        el.scrollLeft -= v;
        v *= 0.93;
        flingId = requestAnimationFrame(step);
      }
      if (Math.abs(v) > 0.5) { flingId = requestAnimationFrame(step); }
      else el.classList.remove('is-dragging');
    }
    function onClickCapture(e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClickCapture, true);
    return () => {
      cancelAnimationFrame(flingId);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, []);
}

function Shelf({ books, badgeFor, allLabel, allHref, saved, onToggle }) {
  const railRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  const [nav, setNav] = React.useState({ left: false, right: true });
  useRailInteractions(railRef);

  // Track scroll extremes (to hide the end-stop arrow) + align the arrows to the cover mid-line.
  const sync = React.useCallback(() => {
    const el = railRef.current; if (!el) return;
    setNav({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    const cover = el.querySelector('.bkc__coverwrap');
    if (cover && wrapRef.current) wrapRef.current.style.setProperty('--cover-mid', (cover.offsetTop + cover.offsetHeight / 2) + 'px');
  }, []);

  React.useEffect(() => {
    const el = railRef.current; if (!el) return;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    el.querySelectorAll('img').forEach((im) => { if (!im.complete) im.addEventListener('load', sync, { once: true }); });
    return () => { el.removeEventListener('scroll', sync); window.removeEventListener('resize', sync); };
  }, [sync]);

  function nudge(dir) {
    const el = railRef.current; if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' });
  }

  return (
    <div className="shelf-wrap" ref={wrapRef}>
      <div className="shelf-rail" ref={railRef}>
        {books.map((bk) => (
          <BookCard key={bk.id} book={bk} badge={badgeFor ? badgeFor(bk) : null} saved={saved.has(bk.id)} onToggle={onToggle} />
        ))}
        <a className="shelf-more" href={allHref || '#'}>
          <span className="shelf-more__icon"><DynIcon name="arrow-right" size={22} /></span>
          <span className="shelf-more__label">{allLabel || 'Дивитися всі'}</span>
          <span className="shelf-more__hint">Переглянути →</span>
        </a>
      </div>
      <button type="button" className="shelf-btn shelf-btn--prev" onClick={() => nudge(-1)} disabled={!nav.left} aria-label="Прокрутити назад">
        <DynIcon name="chevron-left" size={22} />
      </button>
      <button type="button" className="shelf-btn shelf-btn--next" onClick={() => nudge(1)} disabled={!nav.right} aria-label="Прокрутити далі">
        <DynIcon name="chevron-right" size={22} />
      </button>
    </div>
  );
}

/* A book shelf — plain by default, or wrapped in a full-bleed tinted band. */
function BookSection({ id, band, eyebrow, title, sub, fresh, allLabel, allHref, books, badgeFor, saved, onToggle }) {
  const cls = 'reveal ' + (band ? `band band--${band}` : 'sec');
  return (
    <section className={cls} id={id} data-screen-label={title}>
      <div className="page">
        <SecHead eyebrow={eyebrow} title={title} sub={sub} fresh={fresh} allLabel={allLabel} allHref={allHref} />
        <Shelf books={books} badgeFor={badgeFor} allLabel={allLabel} allHref={allHref} saved={saved} onToggle={onToggle} />
      </div>
    </section>
  );
}

function SecDivider() {
  return <div className="page"><hr className="page-divider" /></div>;
}




/* ── ЩО ЧИТАТИ СЬОГОДНІ (mood tiles — editorial discovery, kept) ── */
const MOODS = [
  { slug: 'zatyshnyj-vechir', name: 'Для затишного вечора',   desc: 'Тепла проза, від якої не хочеться відриватись', count: 34, icon: 'coffee' },
  { slug: 'pered-snom',       name: 'Перед сном',             desc: 'Спокійні книги, що не тримають до ранку',       count: 22, icon: 'moon' },
  { slug: 'pryhody',          name: 'Якщо хочеться пригод',    desc: 'Сюжети, що зривають з місця',                   count: 41, icon: 'compass' },
  { slug: 'vidpustka',        name: 'Для відпустки',          desc: 'Легкі й захопливі — щоб узяти з собою',         count: 28, icon: 'plane' },
  { slug: 'natkhnennia',      name: 'Для натхнення',          desc: 'Книги, після яких хочеться діяти',              count: 19, icon: 'lightbulb' },
  { slug: 'korotki',          name: 'Короткі книги на вечір', desc: 'Прочитати за один присід',                     count: 16, icon: 'clock' },
];
function MoodSection() {
  const isMobile = useIsMobile();
  return (
    <section className="band band--sage reveal" id="nastroji" data-screen-label="Що читати сьогодні">
      <div className="page">
        <SecHead
          eyebrow="За настроєм"
          title="Що читати сьогодні"
          sub="Не знаєте, чого хочеться? Оберіть настрій — Книговик підбере книги під нього."
          fresh={{ text: 'Добірки для різного настрою', ed: true }}
          allLabel="Усі настрої" allHref="#/dobirky/nastrij"
        />
        {isMobile ? (
          <div className="list-rows-card">
            {MOODS.map((m) => (
              <ListRow key={m.slug} href={`#/dobirky/${m.slug}`} icon={m.icon} title={m.name} desc={m.desc} count={`${m.count} книг`} />
            ))}
          </div>
        ) : (
          <div className="mood-grid">
            {MOODS.map((m) => (
              <a key={m.slug} href={`#/dobirky/${m.slug}`} className="mood-card">
                <span className="mood-card__icon"><DynIcon name={m.icon} size={22} /></span>
                <div className="mood-card__body">
                  <div className="mood-card__name">{m.name}</div>
                  <div className="mood-card__desc">{m.desc}</div>
                </div>
                <div className="mood-card__count">{m.count} книг</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── ЩОЙНО ЗІБРАЛИ (weekly editorial collections — kept) ──────── */
const B = (...ids) => ids.map((id) => ({ id, ...CATALOG[id] }));
const FRESH = [
  { slug: 'buker-2026',  type: 'Свіже',      name: 'Букерівський список 2026',            desc: 'Фіналісти й лауреати цьогорічної премії — усі в одному місці.', count: 18, icon: 'award',     books: B('storokiv', 'majster', 'dumai', 'sapiens', 'b1984', 'pryntz', 'tini', 'misto', 'feliks', 'dotsia', 'internat', 'drabyna') },
  { slug: 'ukr-fentezi', type: 'Тема',       name: 'Українське фентезі, яке варто знати', desc: 'Світи, магія й міфи, написані українською.',                    count: 24, icon: 'swords',    books: B('dveri', 'drabyna', 'svitlo', 'perekop', 'tygrolovy', 'internat', 'dotsia', 'feliks', 'misto', 'tini', 'lisova', 'eneida') },
  { slug: 'nonfiction',  type: 'Для розуму', name: 'Нон-фікшн для довгих вечорів',        desc: 'Ідеї, що змінюють оптику — без поспіху й галасу.',              count: 21, icon: 'lightbulb', books: B('sapiens', 'atomni', 'dofamin', 'dumai', 'tonke', 'b1984', 'storokiv', 'harry', 'pryntz', 'kobzar', 'majster', 'feliks') },
];
function FreshSection() {
  return (
    <section className="sec reveal" id="redaktsiya" data-screen-label="Добірки редакції">
      <div className="page">
        <SecHead
          eyebrow="Кураторські добірки"
          title="Добірки редакції"
          sub="Тематичні добірки, які Книговик збирає власноруч — щотижня нові."
          fresh={{ text: 'Оновлюється щотижня', ed: true }}
          allLabel="Архів добірок" allHref="#/dobirky/arkhiv"
        />
        <div className="fresh-grid">
          {FRESH.map((f) => (
            <a key={f.slug} href={`#/dobirky/${f.slug}`} className="fresh-card">
              <div className="fresh-card__head">
                <span className="fresh-card__icon"><DynIcon name={f.icon} size={20} /></span>
                <span className="fresh-card__type">{f.type}</span>
              </div>
              <div className="fresh-card__name">{f.name}</div>
              <div className="fresh-card__desc">{f.desc}</div>
              <div className="fresh-card__covers">
                <div className="fresh-card__stack">
                  {f.books.map((bk) => <img key={bk.id} src={bk.cover} alt={bk.title} loading="lazy" />)}
                </div>
                <span className="fresh-card__count">{f.count} книг →</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── НЕДООЦІНЕНІ КНИГИ (editorial hidden-gems band — no shelf, fanned cover trio) ── */
function GemsBand() {
  const fan = B('misto', 'tygrolovy', 'perekop');
  return (
    <section className="sec reveal">
      <div className="page">
        <div className="gems-band">
          <div className="gems-band__body">
            <div className="gems-band__eyebrow"><span className="gems-band__dot" />Недооцінені книги</div>
            <h2 className="gems-band__title">Тихі книги, що варті гучної уваги</h2>
            <p className="gems-band__desc">Рейтинг 4.5+ і менш ніж 200 оцінок. Те, що ще не знайшло свого читача — але точно на нього чекає. Книговик відкладає такі окремо.</p>
            <a className="gems-band__cta" href="#/dobirky/pryhovani-skarby">Дослідити добірку <DynIcon name="arrow-right" size={18} /></a>
          </div>
          <div className="gems-band__fan" aria-hidden="true">
            {fan.map((bk, i) => (
              <img key={bk.id} className={`gems-fan__cover gems-fan__cover--${i}`} src={bk.cover} alt="" loading="lazy" draggable="false" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FROZEN v1.0 — «Книговик радить» featured block (DO NOT REDESIGN)
   ═══════════════════════════════════════════════════════════════ */
function FeaturedCard({ theme }) {
  const mascotSrc = theme === 'dark'
    ? 'assets/mascot/mascot-reading-chair-dark-final.png'
    : 'assets/mascot/mascot-reading-chair-light-hybrid.png';
  return (
    <a href="#" className="feat-card">
      <img className="feat-mascot" src={mascotSrc} alt="Книговик" />
      <div className="feat-body">
        <div className="feat-badge">Книговик радить</div>
        <div className="feat-title">Книги, що варто прочитати цього літа</div>
        <div className="feat-desc">Особиста підбірка Книговика — книги, які він перечитував, думав про них довго і нарешті рекомендує вголос.</div>
      </div>
      <div className="feat-meta">
        <div className="feat-count-block">
          <div className="feat-count"><span className="feat-count-num">47</span><span className="feat-count-unit">книг</span></div>
          <div className="feat-count-lbl">у добірці</div>
        </div>
        <div className="feat-cta">Переглянути <DynIcon name="arrow-right" size={16} /></div>
      </div>
    </a>
  );
}

/* ── CHROME (kept from v1.0) ─────────────────────────────────── */
function SiteHeader({ theme, onToggleTheme, wishCount }) {
  const logoSrc = theme === 'dark'
    ? '_ds/knyhovo-design-system-9fa6168a-5230-4cbe-8edd-23fe0c07a170/assets/logo/knyhovo-logo-dark.png'
    : '_ds/knyhovo-design-system-9fa6168a-5230-4cbe-8edd-23fe0c07a170/assets/logo/knyhovo-logo-light.png';
  return (
    <header style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 100 }}>
      <div className="page">
        <nav className="site-header">
          <div className="site-brand"><img src={logoSrc} className="site-logo" alt="Knyhovo" /></div>
          <div className="site-nav">
            <a href="#" className="nav-link">Головна</a>
            <a href="#" className="nav-link nav-link--active">Добірки</a>
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
  const logoSrc = theme === 'dark'
    ? 'assets/logo/knyhovo-logo-dark-trans.png'
    : 'assets/logo/knyhovo-logo-light-trans.png';
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

/* ── QUICK WISHLIST STORE (persisted) ────────────────────────── */
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

/* ═══ PAGE — Iteration 4: mobile-first discovery IA ═══════════════════════
   Deliberately interleaved so carousels never stack and editorial moments
   break the rhythm — the page should feel like exploring, not browsing a catalog.
   1 Книговик радить (frozen hero, editorial) · 2 Обране читачами (shelf, full header) ·
   3 Що читати сьогодні (mood, editorial break) · 4 Популярне зараз (shelf, minimal header) ·
   5 За жанром (navigation, structural break) · 6 Новинки місяця (shelf, no description) ·
   7 Добірки редакції (editorial cards) · 8 Найбільші знижки (shelf, short status) ·
   9 Недооцінені книги (editorial culmination) · Footer */
function CollectionsPage() {
  const [theme, setTheme] = React.useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  const [saved, toggleSaved] = useWishlist();
  function handleToggleTheme(t) { setTheme(t); document.documentElement.setAttribute('data-theme', t); }
  const shelf = { saved, onToggle: toggleSaved };

  return (
    <div>
      <SiteHeader theme={theme} onToggleTheme={handleToggleTheme} wishCount={saved.size} />
      {/* Collections navigation — sticky ribbon under the header, above the hero (see collections-nav.jsx) */}
      <window.CollectionsNav />
      <main>
        {/* 1 · Hero — FROZEN featured block (editorial) */}
        <section className="sec sec--hero reveal">
          <div className="page"><FeaturedCard theme={theme} /></div>
        </section>

        {/* 2 · Обране читачами — establishing discovery shelf (FULL header) */}
        <BookSection
          id="obrane"
          eyebrow={<span className="sec-eyebrow--rose"><DynIcon name="heart" size={13} solid />Найчастіше додають у бажанки</span>}
          title="Обране читачами"
          sub="Книги, які читачі Knyhovo найчастіше додають до своїх бажанок."
          fresh={{ text: 'На основі активності читачів' }}
          allLabel="Усі улюблені" allHref="#/dobirky/najbilsh-bazhani"
          books={ALLOC.obrane}
          badgeFor={(bk) => ({ tone: 'rose', icon: 'heart', text: compactUA(SAVES[bk.id] || 0) })}
          {...shelf}
        />

        {/* 3 · Що читати сьогодні — mood discovery (editorial break, sage band) */}
        <MoodSection />

        {/* 4 · Популярне зараз — trending shelf (MINIMAL header: title + live status only) */}
        <BookSection
          id="populyarne"
          title="Популярне зараз"
          fresh={{ text: 'Оновлюється щогодини' }}
          allLabel="Уся добірка" allHref="#/dobirky/populyarne-zaraz"
          books={ALLOC.popular}
          badgeFor={() => ({ tone: 'accent', icon: 'trending-up', text: 'В тренді' })}
          {...shelf}
        />

        {/* 6 · Новинки місяця — new-arrivals shelf (NO description, cool band so it reads apart from the plain sections around it) */}
        <BookSection
          id="novynky"
          band="cool"
          eyebrow="Свіже на полицях"
          title="Новинки місяця"
          fresh={{ text: 'Додано цього тижня' }}
          allLabel="Усі новинки" allHref="#/dobirky/novynky"
          books={ALLOC.novynky}
          badgeFor={() => ({ tone: 'accent', text: 'Новинка' })}
          {...shelf}
        />

        {/* 7 · Добірки редакції — weekly editorial collections (big cards) */}
        <FreshSection />

        {/* 8 · Найбільші знижки — deals shelf (SHORT status, warm band) */}
        <BookSection
          id="znyzhky"
          band="warm"
          eyebrow="Вигідно зараз"
          title="Найбільші знижки"
          fresh={{ text: 'Ціни перевірено сьогодні' }}
          allLabel="Усі знижки" allHref="#/dobirky/znyzhky"
          books={ALLOC.znyzhky}
          badgeFor={(bk) => { const p = pct(bk); return p ? { tone: 'green', text: `−${p}%` } : null; }}
          {...shelf}
        />

        {/* 9 · Недооцінені книги — hidden-gems editorial culmination (fanned cover trio) */}
        <GemsBand />
      </main>
      <SiteFooter theme={theme} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CollectionsPage />);
