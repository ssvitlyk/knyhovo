/* Knyhovo Collections Landing — v3.0 / Iteration 2 (2026-07-02)
   Goal: one universal Book Card everywhere, calmer premium rhythm, alternating tinted
   bands for visual separation, «Обране читачами» moved directly below the hero, the
   «Актуальні добірки» metrics section removed, and cross-section dedup so no book
   repeats between sections.
   The «Книговик радить» featured block is kept EXACTLY as v1.0 (frozen).
   Composes DS v1.0 tokens/components only. Line icons only (inline Lucide-style). */

const { Badge, ThemeToggle } = window.KnyhovoDesignSystem_9fa616;
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
   Every book is shown in exactly ONE section. We list candidate pools in
   RELEVANCE priority (not display order): each section greedily takes the first
   unused ids from its pool, so a book lands in its most relevant section and the
   others fill with the next-best candidates. No book repeats across the page. */
const SECTION_POOLS = [
  { key: 'znyzhky', take: 4, pool: ['atomni', 'majster', 'svitlo', 'dumai', 'feliks', 'b1984', 'dofamin'] },
  { key: 'obrane',  take: 4, pool: ['internat', 'dotsia', 'feliks', 'dveri', 'drabyna', 'perekop'] },
  { key: 'novynky', take: 4, pool: ['perekop', 'drabyna', 'storokiv', 'tygrolovy', 'dofamin', 'harry'] },
  { key: 'gems',    take: 4, pool: ['misto', 'tini', 'lisova', 'toreadory', 'eneida'] },
  { key: 'popular', take: 4, pool: ['sapiens', 'harry', 'tonke', 'kobzar', 'storokiv', 'eneida', 'pryntz'] },
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

/* Per-section metadata that rides on the shared card as a cover badge. */
const SAVES  = { internat: 968, dotsia: 1147, feliks: 842, dveri: 731, drabyna: 690, perekop: 604 };
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
    heart: solid
      ? <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="currentColor" stroke="none" />
      : <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
    star: solid
      ? <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none" />
      : <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
    'arrow-right': <React.Fragment><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></React.Fragment>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || null}
    </svg>
  );
}

/* ── SECTION HEADER ──────────────────────────────────────────── */
function SecHead({ eyebrow, title, sub, allLabel, allHref }) {
  return (
    <div className="sec-head">
      <div className="sec-head__left">
        {eyebrow ? <div className="sec-eyebrow">{eyebrow}</div> : null}
        <div className="sec-title">{title}</div>
        {sub ? <div className="sec-sub">{sub}</div> : null}
      </div>
      {allLabel ? <a href={allHref || '#'} className="sec-all">{allLabel} →</a> : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   UNIVERSAL BOOK CARD — one component used in EVERY book section.
   White card · 18px radius · cover on top · title · author · price.
   Only the optional cover badge/metadata changes between sections.
   Entire card is a single clickable object with a calm lift on hover.
   ═══════════════════════════════════════════════════════════════ */
function BookCard({ book, badge }) {
  return (
    <a href={`#/knyha/${book.id}`} className="bkc">
      <div className="bkc__coverwrap">
        <img className="bkc__cover" src={book.cover} alt={book.title} loading="lazy" />
        {badge ? (
          <span className={`bkc__badge bkc__badge--${badge.tone}`}>
            {badge.icon ? <DynIcon name={badge.icon} size={12} solid /> : null}
            {badge.text}
          </span>
        ) : null}
      </div>
      <div className="bkc__body">
        <div className="bkc__title">{book.title}</div>
        <div className="bkc__author">{book.author}</div>
        <div className="bkc__foot">
          <span className="bkc__price">{book.price}</span>
          {book.old ? <span className="bkc__old">{book.old}</span> : null}
        </div>
      </div>
    </a>
  );
}

function BookGrid({ books, badgeFor }) {
  return (
    <div className="book-grid">
      {books.map((bk) => <BookCard key={bk.id} book={bk} badge={badgeFor ? badgeFor(bk) : null} />)}
    </div>
  );
}

/* A book section — plain by default, or wrapped in a full-bleed tinted band. */
function BookSection({ band, eyebrow, title, sub, allLabel, allHref, books, badgeFor }) {
  const cls = 'reveal ' + (band ? `band band--${band}` : 'sec');
  return (
    <section className={cls}>
      <div className="page">
        <SecHead eyebrow={eyebrow} title={title} sub={sub} allLabel={allLabel} allHref={allHref} />
        <BookGrid books={books} badgeFor={badgeFor} />
      </div>
    </section>
  );
}

function SecDivider() {
  return <div className="page"><hr className="page-divider" /></div>;
}

/* ── ЗА ЖАНРОМ (navigation tiles — kept) ─────────────────────── */
const GENRES = [
  { slug: 'fentezi',            name: 'Фентезі',            count: 612,  icon: 'swords' },
  { slug: 'psykholohiia',       name: 'Психологія',         count: 438,  icon: 'brain' },
  { slug: 'khudozhnia-proza',   name: 'Художня проза',      count: 1840, icon: 'book-open' },
  { slug: 'biznes',             name: 'Бізнес',             count: 327,  icon: 'chart-column' },
  { slug: 'naukova-fantastyka', name: 'Наукова фантастика', count: 289,  icon: 'rocket' },
  { slug: 'istoriya',           name: 'Історія',            count: 514,  icon: 'landmark' },
  { slug: 'dytiachi',           name: 'Дитячі',             count: 921,  icon: 'palette' },
  { slug: 'nauka',              name: 'Наука',              count: 196,  icon: 'microscope' },
];
function GenreSection() {
  return (
    <section className="sec reveal">
      <div className="page">
        <SecHead eyebrow="Навігація" title="За жанром" allLabel="Усі жанри" allHref="#/dobirky/zhanry" />
        <div className="genre-grid">
          {GENRES.map((g) => (
            <a key={g.slug} href={`#/dobirky/${g.slug}`} className="genre-card">
              <div className="genre-card__icon" style={{ color: 'var(--accent)' }}><DynIcon name={g.icon} size={20} /></div>
              <div className="genre-card__body">
                <div className="genre-card__name">{g.name}</div>
                <div className="genre-card__count">{g.count.toLocaleString('uk-UA')} книг</div>
              </div>
              <div className="genre-card__arrow">›</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── ЩО ЧИТАТИ СЬОГОДНІ (mood tiles — kept) ──────────────────── */
const MOODS = [
  { slug: 'zatyshnyj-vechir', name: 'Для затишного вечора',   desc: 'Тепла проза, від якої не хочеться відриватись', count: 34, icon: 'coffee' },
  { slug: 'pered-snom',       name: 'Перед сном',             desc: 'Спокійні книги, що не тримають до ранку',       count: 22, icon: 'moon' },
  { slug: 'pryhody',          name: 'Якщо хочеться пригод',    desc: 'Сюжети, що зривають з місця',                   count: 41, icon: 'compass' },
  { slug: 'vidpustka',        name: 'Для відпустки',          desc: 'Легкі й захопливі — щоб узяти з собою',         count: 28, icon: 'plane' },
  { slug: 'natkhnennia',      name: 'Для натхнення',          desc: 'Книги, після яких хочеться діяти',              count: 19, icon: 'lightbulb' },
  { slug: 'korotki',          name: 'Короткі книги на вечір', desc: 'Прочитати за один присід',                     count: 16, icon: 'clock' },
];
function MoodSection() {
  return (
    <section className="sec reveal">
      <div className="page">
        <SecHead eyebrow="За настроєм" title="Що читати сьогодні" allLabel="Усі настрої" allHref="#/dobirky/nastrij" />
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
      </div>
    </section>
  );
}

/* ── ЩОЙНО ЗІБРАЛИ (weekly editorial collections — kept) ──────── */
const B = (...ids) => ids.map((id) => ({ id, ...CATALOG[id] }));
const FRESH = [
  { slug: 'buker-2026',  type: 'Свіже',      name: 'Букерівський список 2026',            desc: 'Фіналісти й лауреати цьогорічної премії — усі в одному місці.', count: 8,  icon: 'award',     books: B('storokiv', 'majster', 'dumai') },
  { slug: 'ukr-fentezi', type: 'Тема',       name: 'Українське фентезі, яке варто знати', desc: 'Світи, магія й міфи, написані українською.',                    count: 14, icon: 'swords',    books: B('dveri', 'drabyna', 'svitlo') },
  { slug: 'nonfiction',  type: 'Для розуму', name: 'Нон-фікшн для довгих вечорів',        desc: 'Ідеї, що змінюють оптику — без поспіху й галасу.',              count: 11, icon: 'lightbulb', books: B('sapiens', 'atomni', 'dofamin') },
];
function FreshSection() {
  return (
    <section className="sec reveal">
      <div className="page">
        <SecHead eyebrow="Нові добірки цього тижня" title="Щойно зібрали" allLabel="Архів добірок" allHref="#/dobirky/arkhiv" />
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
                {f.books.map((bk) => <img key={bk.id} src={bk.cover} alt={bk.title} loading="lazy" />)}
                <span className="fresh-card__count">{f.count} книг →</span>
              </div>
            </a>
          ))}
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
        <div className="feat-count">47</div>
        <div className="feat-count-lbl">книг<br />у добірці</div>
        <div className="kn-btn kn-btn--primary" style={{ marginTop: 8, fontSize: 14, padding: '8px 18px', borderRadius: 10 }}>Переглянути →</div>
      </div>
    </a>
  );
}

/* ── CHROME (kept from v1.0) ─────────────────────────────────── */
function SiteHeader({ theme, onToggleTheme }) {
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
            <a href="#" className="nav-link">Бажанки</a>
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
    <footer className="site-footer" style={{ background: 'var(--surface)', marginTop: 0 }}>
      <div className="page">
        <div className="footer-inner">
          <div className="footer-brand">
            <img src={logoSrc} className="footer-logo" alt="Knyhovo" />
            <div className="footer-tagline">Порівнюємо ціни у 5 книгарнях.<br />Щодня знаходимо найнижчу.</div>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <div className="footer-col__title">Добірки</div>
              <ul>
                <li><a href="#">Популярне зараз</a></li>
                <li><a href="#">Новинки</a></li>
                <li><a href="#">Найбільші знижки</a></li>
                <li><a href="#">Книговик радить</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col__title">Жанри</div>
              <ul>
                <li><a href="#">Фентезі</a></li>
                <li><a href="#">Психологія</a></li>
                <li><a href="#">Бізнес</a></li>
                <li><a href="#">Дитячі</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col__title">Knyhovo</div>
              <ul>
                <li><a href="#">Про нас</a></li>
                <li><a href="#">Книгарні</a></li>
                <li><a href="#">API</a></li>
                <li><a href="#">Контакти</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Knyhovo · Порівняння цін на книги</span>
          <span style={{ display: 'flex', gap: 16 }}>
            <a href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Конфіденційність</a>
            <a href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Умови</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ═══ PAGE — final content order (Iteration 2) ═══
   1 Книговик радить (frozen) · 2 Обране читачами (rose band) · 3 Популярне зараз ·
   4 Новинки місяця · 5 Найбільші знижки (warm band) · 6 За жанром · 7 Що читати сьогодні ·
   8 Недооцінені книги (green band) · 9 Щойно зібрали · Footer */
function CollectionsPage() {
  const [theme, setTheme] = React.useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  function handleToggleTheme(t) { setTheme(t); document.documentElement.setAttribute('data-theme', t); }

  return (
    <div>
      <SiteHeader theme={theme} onToggleTheme={handleToggleTheme} />
      <main>
        {/* 1 · Hero — FROZEN featured block */}
        <section className="sec sec--hero reveal">
          <div className="page"><FeaturedCard theme={theme} /></div>
        </section>

        {/* 2 · Обране читачами — social proof, directly below the hero (rose band) */}
        <BookSection
          band="rose"
          eyebrow={<span className="sec-eyebrow--rose"><DynIcon name="heart" size={13} solid />Найчастіше додають у бажанки</span>}
          title="Обране читачами"
          sub="Книги, які читачі Knyhovo найчастіше зберігають, щоб купити у правильний момент."
          allLabel="Усі улюблені" allHref="#/dobirky/najbilsh-bazhani"
          books={ALLOC.obrane}
          badgeFor={(bk) => ({ tone: 'rose', icon: 'heart', text: compactUA(SAVES[bk.id] || 0) })}
        />

        {/* 3 · Популярне зараз — standard cards */}
        <BookSection
          eyebrow="Переглядають найбільше"
          title="Популярне зараз"
          allLabel="Уся добірка" allHref="#/dobirky/populyarne-zaraz"
          books={ALLOC.popular}
        />

        <SecDivider />

        {/* 4 · Новинки місяця — New badge */}
        <BookSection
          eyebrow="Свіже на полицях"
          title="Новинки місяця"
          allLabel="Усі новинки" allHref="#/dobirky/novynky"
          books={ALLOC.novynky}
          badgeFor={() => ({ tone: 'accent', text: 'Новинка' })}
        />

        {/* 5 · Найбільші знижки — discount badge (warm band) */}
        <BookSection
          band="warm"
          eyebrow="Вигідно зараз"
          title="Найбільші знижки"
          sub="Щодня о 08:00 Knyhovo перевіряє ціни у 5 книгарнях — ось де зараз найвигідніше."
          allLabel="Усі знижки" allHref="#/dobirky/znyzhky"
          books={ALLOC.znyzhky}
          badgeFor={(bk) => { const p = pct(bk); return p ? { tone: 'green', text: `−${p}%` } : null; }}
        />

        {/* 6 · За жанром */}
        <GenreSection />

        <SecDivider />

        {/* 7 · Що читати сьогодні — moods */}
        <MoodSection />

        {/* 8 · Недооцінені книги — rating badge (green band) */}
        <BookSection
          band="green"
          eyebrow="Приховані скарби"
          title="Недооцінені книги"
          sub="Рейтинг 4.5+ і зовсім мало оцінок — тихі книги, що ще шукають свого читача. Книговик відкладає такі окремо."
          allLabel="Дослідити добірку" allHref="#/dobirky/pryhovani-skarby"
          books={ALLOC.gems}
          badgeFor={(bk) => ({ tone: 'rating', icon: 'star', text: (RATING[bk.id] || 4.5).toFixed(1).replace('.', ',') })}
        />

        {/* 9 · Щойно зібрали — weekly editorial collections */}
        <FreshSection />
      </main>
      <SiteFooter theme={theme} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CollectionsPage />);
