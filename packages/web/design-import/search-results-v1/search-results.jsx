// Knyhovo Search Results v1.0 — APPROVED & FROZEN (2026-06-10).
// This pattern is approved and frozen. Future iterations may extend Search Results
// functionality, but must not redesign the established visual foundations.
// Compose only from: SearchBar, BookCard, Button, Badge, Chip, ThemeToggle.

const DS = window.KnyhovoDesignSystem_9fa616;

/* ---------------- Mock backend data (24 results for «психологія») ---------------- */
const KN_RESULTS = [
  { title: 'Атомні звички', author: 'Джеймс Клір', price: 245, oldPrice: 320, store: 'Yakaboo', pop: 98, isNew: false },
  { title: 'Мислення швидке й повільне', author: 'Деніел Канеман', price: 420, oldPrice: 470, store: 'Книгарня «Є»', pop: 94, isNew: false },
  { title: 'Емоційний інтелект', author: 'Деніел Ґоулман', price: 350, oldPrice: null, store: 'Yakaboo', pop: 91, isNew: false },
  { title: 'Тонке мистецтво забивати на все', author: 'Марк Менсон', price: 240, oldPrice: 280, store: 'Rozetka', pop: 89, isNew: false },
  { title: 'Чому ми спимо', author: 'Метью Волкер', price: 390, oldPrice: null, store: 'Nash Format', pop: 87, isNew: false },
  { title: '7 звичок надзвичайно ефективних людей', author: 'Стівен Кові', price: 310, oldPrice: null, store: 'BookChef', pop: 86, isNew: false },
  { title: 'Потік. Психологія оптимального досвіду', author: 'Міхай Чиксентмігаї', price: 330, oldPrice: 380, store: 'Yakaboo', pop: 84, isNew: false },
  { title: 'Сила волі', author: 'Келлі Макґоніґал', price: 285, oldPrice: null, store: 'Книгарня «Є»', pop: 82, isNew: true },
  { title: 'Людина в пошуках справжнього сенсу', author: 'Віктор Франкл', price: 195, oldPrice: 230, store: 'Rozetka', pop: 90, isNew: false },
  { title: 'Психологія впливу', author: 'Роберт Чалдіні', price: 360, oldPrice: null, store: 'Yakaboo', pop: 80, isNew: false },
  { title: 'Спершу найважливіше', author: 'Стівен Кові', price: 270, oldPrice: null, store: 'BookChef', pop: 64, isNew: false },
  { title: 'Емоційна гнучкість', author: 'Сьюзан Девід', price: 305, oldPrice: 340, store: 'Nash Format', pop: 71, isNew: true },
  { title: 'Як завойовувати друзів', author: 'Дейл Карнегі', price: 220, oldPrice: null, store: 'Rozetka', pop: 85, isNew: false },
  { title: 'Тіло веде лік', author: 'Бессел ван дер Колк', price: 440, oldPrice: 490, store: 'Yakaboo', pop: 79, isNew: false },
  { title: 'Мистецтво любові', author: 'Еріх Фромм', price: 185, oldPrice: null, store: 'Книгарня «Є»', pop: 75, isNew: false },
  { title: 'Внутрішня опора', author: 'Анна Бикова', price: 250, oldPrice: null, store: 'BookChef', pop: 58, isNew: true },
  { title: 'Стоїцизм на щодень', author: 'Раян Голідей', price: 340, oldPrice: 375, store: 'Nash Format', pop: 77, isNew: false },
  { title: 'Перемогти прокрастинацію', author: 'Петр Людвіг', price: 230, oldPrice: null, store: 'Rozetka', pop: 69, isNew: false },
  { title: 'Дофамінове покоління', author: 'Анна Лембке', price: 365, oldPrice: null, store: 'Yakaboo', pop: 73, isNew: true },
  { title: 'Межі. Коли казати «так»', author: 'Генрі Клауд', price: 290, oldPrice: 325, store: 'Книгарня «Є»', pop: 62, isNew: false },
  { title: 'Незламність. Наука стійкості', author: 'Рік Хансон', price: 315, oldPrice: null, store: 'Nash Format', pop: 60, isNew: false },
  { title: 'Тиша. Сила інтровертів', author: 'Сьюзан Кейн', price: 275, oldPrice: null, store: 'BookChef', pop: 76, isNew: false },
  { title: 'Ігри, у які грають люди', author: 'Ерік Берн', price: 210, oldPrice: 250, store: 'Rozetka', pop: 81, isNew: false },
  { title: 'Шлях художника', author: 'Джулія Кемерон', price: 320, oldPrice: null, store: 'Yakaboo', pop: 66, isNew: false },
];

const KN_POPULAR = ['Атомні звички', 'Сергій Жадан', 'Sapiens', 'Гаррі Поттер', 'Кафка на пляжі'];

const KN_SORTS = [
  { id: 'cheap', label: 'Найдешевші спочатку' },
  { id: 'popular', label: 'Найпопулярніші' },
  { id: 'new', label: 'Новинки' },
];

/* ---------------- Helpers ---------------- */
function knBookWord(n) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'книга';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'книги';
  return 'книг';
}
const knUah = (n) => n + ' ₴';

function knSorted(list, sort) {
  const copy = [...list];
  if (sort === 'cheap') copy.sort((a, b) => a.price - b.price);
  if (sort === 'popular') copy.sort((a, b) => b.pop - a.pop);
  if (sort === 'new') copy.sort((a, b) => (b.isNew - a.isNew) || (b.pop - a.pop));
  return copy;
}

function knBadgeFor(book, list) {
  const { Badge } = DS;
  const cheapest = Math.min(...list.map((b) => b.price));
  if (book.price === cheapest) return <Badge tone="green">Найкраща ціна</Badge>;
  if (book.oldPrice) {
    const pct = Math.round((1 - book.price / book.oldPrice) * 100);
    return <Badge tone="solid">{`-${pct}%`}</Badge>;
  }
  if (book.isNew) return <Badge tone="accent">Новинка</Badge>;
  return null;
}

/* ---------------- Pagination algorithm (frozen spec) ----------------
   Rules: always show first+last+current; show ±1 adjacent; fill single
   hidden pages instead of ellipsis; never show ellipsis hiding 1 page. */
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
      if (gap === 2) items.push(sorted[i - 1] + 1); // fill single hidden page
      else if (gap > 2) items.push('\u2026');        // ellipsis for larger gaps
    }
    items.push(sorted[i]);
  }
  return items;
}

/* ---------------- Header (reused website header) ---------------- */
function SiteHeader({ theme, onTheme }) {
  const { Button, ThemeToggle } = DS;
  const logo = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png';
  return (
    <header className="site-header" data-screen-label="Header">
      <img className="site-logo" src={logo} alt="Knyhovo" />
      <nav className="site-nav">
        <a href="#" className="nav-link">Головна</a>
        <a href="#" className="nav-link nav-link--active">Каталог</a>
        <a href="#" className="nav-link">Знижки</a>
        <a href="#" className="nav-link">Про нас</a>
      </nav>
      <div className="site-actions">
        <ThemeToggle theme={theme} onChange={onTheme} />
        <Button variant="secondary" size="sm">Увійти</Button>
      </div>
    </header>
  );
}

/* ---------------- Footer (reused website footer) ---------------- */
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

/* ---------------- Loading skeletons (frozen spec: warm surfaces, staggered fade-in)
   Motion: opacity+translate, 280ms ease-out, 50ms stagger — no infinite animations.
   Warm paper tones only (--surface-accent / --accent-weak); no cold greys. ----------- */
function SkeletonCard() {
  return (
    <div className="kn-skeleton" aria-hidden="true">
      <div className="kn-skeleton__cover"></div>
      <div className="kn-skeleton__body">
        <div className="kn-skeleton__line kn-skeleton__line--badge"></div>
        <div className="kn-skeleton__line kn-skeleton__line--title"></div>
        <div className="kn-skeleton__line kn-skeleton__line--author"></div>
        <div className="kn-skeleton__row">
          <div className="kn-skeleton__line kn-skeleton__line--price"></div>
          <div className="kn-skeleton__line kn-skeleton__line--store"></div>
        </div>
      </div>
    </div>
  );
}

/* SearchBar loading — exact .kn-field capsule dimensions + border-radius preserved */
function SearchBarSkeleton() {
  return (
    <div className="kn-field kn-skeleton-search" aria-hidden="true">
      <span className="kn-skeleton__line kn-skeleton-search__icon"></span>
      <span className="kn-skeleton__line kn-skeleton-search__query"></span>
      <span className="kn-skeleton__line kn-skeleton-search__button"></span>
    </div>
  );
}

/* ---------------- Empty state ---------------- */
function EmptyState({ theme, onSuggest }) {
  const { Chip } = DS;
  const mascot = theme === 'dark' ? 'assets/mascot/mascot-lantern.png' : 'assets/mascot/mascot-magnifier.png';
  return (
    <div className="kn-empty" data-screen-label="Empty state">
      <img className="kn-empty__mascot" src={mascot} alt="" />
      <h3 className="kn-empty__title">Книгу не знайдено</h3>
      <p className="kn-empty__text">Спробуйте іншу назву або ISBN.</p>
      <div className="kn-empty__chips">
        <span className="kn-empty__chips-label">Популярні запити:</span>
        {KN_POPULAR.map((q) => (
          <Chip key={q} onClick={() => onSuggest(q)}>{q}</Chip>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Pagination (frozen spec — uses getPageItems algorithm) ----------- */
function Pagination({ page, pages, onPage }) {
  const { Button } = DS;
  if (pages <= 1) return null;
  const items = getPageItems(page, pages);
  return (
    <nav className="kn-pagination" aria-label="Сторінки результатів" data-screen-label="Pagination">
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
      <Button variant="secondary" size="sm" disabled={page === pages} onClick={() => onPage(page + 1)}>Далі →</Button>
    </nav>
  );
}

/* ---------------- Page ---------------- */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "state": "Результати",
  "perPage": 3
}/*EDITMODE-END*/;

function App() {
  const { SearchBar, BookCard, Chip } = DS;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [theme, setTheme] = React.useState(() => localStorage.getItem('kn-theme') || 'light');
  const [query, setQuery] = React.useState('психологія');
  const [committed, setCommitted] = React.useState('психологія');
  const [sort, setSort] = React.useState('cheap');
  const [page, setPage] = React.useState(1);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kn-theme', theme);
  }, [theme]);

  React.useEffect(() => { window.lucide && lucide.createIcons(); });

  // Simulated backend: the seed query returns the full set; other queries filter title/author.
  const found = React.useMemo(() => {
    const q = committed.trim().toLowerCase();
    if (!q || q === 'психологія') return KN_RESULTS;
    return KN_RESULTS.filter((b) =>
      b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q));
  }, [committed]);

  const doSearch = (q) => {
    const next = (q !== undefined ? q : query);
    setQuery(next);
    setSearching(true);
    setPage(1);
    setTimeout(() => { setCommitted(next); setSearching(false); }, 900);
  };

  // Tweak overrides let the panel force any state for review.
  const forcedLoading = t.state === 'Завантаження';
  const forcedEmpty = t.state === 'Порожньо';
  const isLoading = forcedLoading || searching;
  const isEmpty = !isLoading && (forcedEmpty || found.length === 0);

  const sorted = knSorted(found, sort);
  const perPage = t.perPage;
  const pages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(page, pages);
  const visible = sorted.slice((safePage - 1) * perPage, safePage * perPage);

  const onPage = (n) => { setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <div className="page">
      <SiteHeader theme={theme} onTheme={setTheme} />

      <main className="results" data-screen-label="Search results">
        <p className="results__eyebrow">ПОШУК · 5 КНИГАРЕНЬ · НАЙНИЖЧІ ЦІНИ</p>
        <h1 className="results__title">Результати для <em>«{committed.trim() || '…'}»</em></h1>

        <div className="results__search">
          {forcedLoading
            ? <SearchBarSkeleton />
            : <SearchBar value={query} onChange={(e) => setQuery(e.target.value)} onSearch={doSearch} />}
          {!forcedLoading && query.length > 0 && (
            <button className="results__search-clear"
              onClick={() => { setQuery(''); setCommitted(''); setPage(1); }}>
              × Очистити запит
            </button>
          )}
        </div>

        <div className="results__toolbar" data-screen-label="Results toolbar">
          <p className="results__summary" aria-live="polite">
            {isLoading ? 'Шукаємо найкращі ціни…'
              : isEmpty ? 'Нічого не знайдено'
              : `Знайдено ${sorted.length} ${knBookWord(sorted.length)}`}
          </p>
          <div className="results__sort" role="group" aria-label="Сортування">
            <span className="results__sort-label">Сортування:</span>
            {KN_SORTS.map((s) => (
              <Chip key={s.id} selected={sort === s.id}
                onClick={() => { setSort(s.id); setPage(1); }}>{s.label}</Chip>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="results__grid" data-screen-label="Loading state">
            {Array.from({ length: Math.min(perPage, 8) }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : isEmpty ? (
          <EmptyState theme={theme} onSuggest={(q) => { setTweak('state', 'Результати'); doSearch(q); }} />
        ) : (
          <React.Fragment>
            <div className="results__grid">
              {visible.map((b) => (
                <BookCard key={b.title} title={b.title} author={b.author}
                  price={knUah(b.price)} oldPrice={b.oldPrice ? knUah(b.oldPrice) : null}
                  store={b.store} badge={knBadgeFor(b, KN_RESULTS)} />
              ))}
            </div>
            <Pagination page={safePage} pages={pages} onPage={onPage} />
          </React.Fragment>
        )}
      </main>

      <SiteFooter theme={theme} />

      <TweaksPanel>
        <TweakSection label="Стан сторінки" />
        <TweakRadio label="Стан" value={t.state}
          options={['Результати', 'Завантаження', 'Порожньо']}
          onChange={(v) => setTweak('state', v)} />
        <TweakSection label="Пагінація" />
        <TweakSlider label="Книг на сторінці" value={t.perPage} min={2} max={8} step={1}
          onChange={(v) => setTweak('perPage', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
