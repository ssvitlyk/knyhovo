// Knyhovo Homepage v1.0 — final architecture.
// Foundation: Concept A (Oracle Search) — search-first hero, discovery shelves below.
// Composes ONLY frozen DS components: SearchBar, BookCard, Badge, Chip, Button, ThemeToggle.
// No new card variants. Search Results / Book Details / Wishlist patterns untouched.

const DS = window.KnyhovoDesignSystem_9fa616;

/* ---------------- Content (mock data — realistic Ukrainian catalog) ---------------- */
// Badge priority (frozen BookCard hierarchy): Найкраща ціна (green) → -N% (solid) → Новинка (accent). Max one per card.

const KN_POPULAR_QUERIES = ['Атомні звички', 'Жадан', 'Sapiens', 'Кідрук', 'Харарі'];

const POPULAR_NOW = [
  { title: 'Атомні звички', author: 'Джеймс Клір', price: '245 ₴', oldPrice: '320 ₴', store: 'Yakaboo', badge: 'green', cover: 'assets/covers/atomni.png' },
  { title: 'Sapiens. Людина розумна', author: 'Ювал Ной Харарі', price: '380 ₴', oldPrice: '450 ₴', store: 'Rozetka', badge: 'solid:-16%', cover: 'assets/covers/sapiens.png' },
  { title: 'Тонке мистецтво забивати на все', author: 'Марк Менсон', price: '240 ₴', oldPrice: '280 ₴', store: 'BookChef', badge: 'solid:-14%', cover: 'assets/covers/tonke.png' },
  { title: '1984', author: 'Джордж Орвелл', price: '210 ₴', oldPrice: null, store: 'Книгарня «Є»', badge: null, cover: 'assets/covers/b1984.png' },
  { title: 'Гаррі Поттер і келих вогню', author: 'Дж. К. Ролінг', price: '410 ₴', oldPrice: '490 ₴', store: 'Yakaboo', badge: 'solid:-16%', cover: 'assets/covers/harry.png' },
  { title: 'Думай повільно, вирішуй швидко', author: 'Деніел Канеман', price: '350 ₴', oldPrice: '420 ₴', store: 'Rozetka', badge: 'solid:-17%', cover: 'assets/covers/dumai.png' },
  { title: 'Тореадори з Васюківки', author: 'Всеволод Нестайко', price: '230 ₴', oldPrice: null, store: 'BookChef', badge: null, cover: 'assets/covers/toreadory.png' },
  { title: 'Лісова пісня', author: 'Леся Українка', price: '175 ₴', oldPrice: null, store: 'Книгарня «Є»', badge: 'green', cover: 'assets/covers/lisova.png' },
];

const NEW_RELEASES = [
  { title: 'Інтернат', author: 'Сергій Жадан', price: '210 ₴', oldPrice: null, store: 'Книгарня «Є»', badge: 'accent:Новинка', cover: 'assets/covers/internat.png' },
  { title: 'Той, хто відчиняє двері', author: 'Ілларіон Павлюк', price: '320 ₴', oldPrice: null, store: 'Yakaboo', badge: 'accent:Новинка', cover: 'assets/covers/dveri.png' },
  { title: 'Дофамінове покоління', author: 'Анна Лембке', price: '365 ₴', oldPrice: null, store: 'BookChef', badge: 'accent:Новинка', cover: 'assets/covers/dofamin.png' },
  { title: 'Доки світло не згасне назавжди', author: 'Макс Кідрук', price: '265 ₴', oldPrice: null, store: 'Nash Format', badge: 'accent:Новинка', cover: 'assets/covers/svitlo.png' },
  { title: 'Доця', author: 'Тамара Горіха Зерня', price: '280 ₴', oldPrice: null, store: 'Yakaboo', badge: 'accent:Новинка', cover: 'assets/covers/dotsia.png' },
  { title: 'Фелікс Австрія', author: 'Софія Андрухович', price: '300 ₴', oldPrice: null, store: 'Книгарня «Є»', badge: 'accent:Новинка', cover: 'assets/covers/feliks.png' },
  { title: 'За Перекопом є земля', author: 'Анастасія Левкова', price: '320 ₴', oldPrice: null, store: 'Nash Format', badge: 'accent:Новинка', cover: 'assets/covers/perekop.png' },
  { title: 'Драбина', author: 'Євгенія Кузнєцова', price: '290 ₴', oldPrice: null, store: 'BookChef', badge: 'accent:Новинка', cover: 'assets/covers/drabyna.png' },
];

const RECOMMENDS = [
  { title: 'Сто років самотності', author: 'Ґабріель Ґарсіа Маркес', price: '285 ₴', oldPrice: '340 ₴', store: 'Yakaboo', badge: 'solid:-16%', cover: 'assets/covers/sto-rokiv.png' },
  { title: 'Майстер і Маргарита', author: 'Михайло Булгаков', price: '220 ₴', oldPrice: '280 ₴', store: 'Rozetka', badge: 'solid:-21%', cover: 'assets/covers/majster.png' },
  { title: 'Маленький принц', author: 'А. де Сент-Екзюпері', price: '185 ₴', oldPrice: null, store: 'Yakaboo', badge: 'green', cover: 'assets/covers/pryntz.png' },
  { title: 'Кобзар', author: 'Тарас Шевченко', price: '165 ₴', oldPrice: null, store: 'Книгарня «Є»', badge: null, cover: 'assets/covers/kobzar.png' },
  { title: 'Тигролови', author: 'Іван Багряний', price: '210 ₴', oldPrice: '260 ₴', store: 'Yakaboo', badge: 'solid:-19%', cover: 'assets/covers/tygrolovy.png' },
  { title: 'Тіні забутих предків', author: 'Михайло Коцюбинський', price: '160 ₴', oldPrice: null, store: 'Книгарня «Є»', badge: 'green', cover: 'assets/covers/tini.png' },
  { title: 'Енеїда', author: 'Іван Котляревський', price: '195 ₴', oldPrice: null, store: 'BookChef', badge: null, cover: 'assets/covers/eneida.png' },
  { title: 'Місто', author: 'Валер’ян Підмогильний', price: '185 ₴', oldPrice: null, store: 'Rozetka', badge: null, cover: 'assets/covers/misto.png' },
];

/* ---------------- Helpers ---------------- */
function renderBadge(spec) {
  const { Badge } = DS;
  if (!spec) return null;
  if (spec === 'green') return <Badge tone="green">Найкраща ціна</Badge>;
  if (spec.startsWith('solid:')) return <Badge tone="solid">{spec.slice(6)}</Badge>;
  if (spec.startsWith('accent:')) return <Badge tone="accent">{spec.slice(7)}</Badge>;
  return null;
}

// KSD-style see-all chevron — a plain chevron-right used on mobile section title
// rows (replaces the desktop ghost text button on small screens). Static inline
// SVG (not lucide-managed) so React reconciliation stays clean.
function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  );
}

// Horizontal scroll rail (ksd.ua-style) — cover-first vertical cards, no 4-item
// cap; the row scrolls right to reveal more. Reuses the frozen DS BookCard; the
// rail + card layout is a page-level override on .kn-book only.
function BookGrid({ books }) {
  const { BookCard } = DS;
  return (
    <div className="hp-rail">
      {books.map((b) => (
        <BookCard key={b.title} title={b.title} author={b.author}
          price={b.price} oldPrice={b.oldPrice} store={b.store}
          cover={b.cover} badge={renderBadge(b.badge)} />
      ))}
    </div>
  );
}

// Cover-first shelf — vertical BookCards with the cover as the dominant element.
// Reuses the frozen DS BookCard (cover prop); shelf-style layout is a page-level
// CSS override on .hp-pick-grid only — BookCard component untouched.
function PickGrid({ books }) {
  const { BookCard } = DS;
  return (
    <div className="hp-pick-grid">
      {books.map((b) => (
        <BookCard key={b.title} title={b.title} author={b.author}
          price={b.price} oldPrice={b.oldPrice} store={b.store}
          cover={b.cover} badge={renderBadge(b.badge)} />
      ))}
    </div>
  );
}

/* ---------------- Header (reused frozen website header) ---------------- */
function SiteHeader({ theme, onTheme, loggedIn }) {
  const { Button, ThemeToggle } = DS;
  const logo = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png';
  const [menuOpen, setMenuOpen] = React.useState(false);
  const authLabel = loggedIn ? 'Профіль' : 'Увійти';
  const close = () => setMenuOpen(false);
  // Mobile menu items (ksd.ua-style hamburger drawer).
  const menuLinks = [
    { label: 'Головна', href: '#', active: true },
    { label: 'Каталог', href: 'Search Results Page.html' },
    { label: 'Бажанки', href: '#' },
    { label: 'Про нас', href: '#' },
  ];
  return (
    <header className="site-header" data-screen-label="Header">
      <a className="site-brand" href="#" aria-label="Knyhovo"><img className="site-logo" src={logo} alt="Knyhovo" /></a>
      <nav className="site-nav">
        <a href="#" className="nav-link nav-link--active">Головна</a>
        <a href="Search Results Page.html" className="nav-link">Каталог</a>
        <a href="#" className="nav-link">Бажанки</a>
        <a href="#" className="nav-link">Про нас</a>
      </nav>
      <div className="site-actions">
        <ThemeToggle theme={theme} onChange={onTheme} />
        <Button variant="secondary" size="sm">{authLabel}</Button>
        <button type="button" className={'site-burger' + (menuOpen ? ' is-open' : '')}
          aria-label="Меню" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          <span></span><span></span><span></span>
        </button>
      </div>
      <div className={'site-drawer' + (menuOpen ? ' is-open' : '')} onClick={close}></div>
      <nav className={'site-menu' + (menuOpen ? ' is-open' : '')}>
        {menuLinks.map((l) => (
          <a key={l.label} href={l.href} onClick={close}
            className={'site-menu__link' + (l.active ? ' is-active' : '')}>{l.label}</a>
        ))}
      </nav>
    </header>
  );
}

/* ---------------- Footer (reused frozen website footer) ---------------- */
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

/* ---------------- Hero (approved 50/50 layout — Concept A foundation) ---------------- */
function Hero({ theme }) {
  const { SearchBar, Chip } = DS;
  const [q, setQ] = React.useState('');
  const mascot = theme === 'dark'
    ? 'assets/mascot/mascot-hero-dark.png'
    : 'assets/mascot/mascot-hero-light.png';
  const onSearch = (val) => {
    const v = (val || '').trim();
    window.location.href = 'Search Results Page.html';
  };
  return (
    <section className="hero" data-screen-label="Hero">
      <div className="hero__text">
        <p className="kn-eyebrow">Знаходимо дешевше · Відстежуємо ціни · Сповіщаємо</p>
        <h1 className="hero__title">
          Де книга дешевша?<br />
          <em className="kn-accent-serif">Knyhovo знає.</em>
        </h1>
        <p className="hero__lead">
          Знаходьте бажане, порівнюйте ціни та купуйте вигідно.
        </p>
        <SearchBar
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onSearch={onSearch}
          placeholder="Назва книги, автора або ISBN..."
          buttonLabel="Знайти"
        />
        <div className="hero__stats">
          <div className="stat"><span className="stat__num">5+</span><span className="stat__label">книгарень</span></div>
          <div className="stat"><span className="stat__num">12k+</span><span className="stat__label">книг</span></div>
          <div className="stat"><span className="stat__num">24/7</span><span className="stat__label">відстеження цін</span></div>
        </div>
        <div className="hero__popular">
          <span className="hero__popular-label">Популярне:</span>
          {KN_POPULAR_QUERIES.map((c) => <Chip key={c} onClick={() => onSearch(c)}>{c}</Chip>)}
        </div>
      </div>
      <div className="hero__art">
        <img className="hero__mascot" src={mascot} alt="Knyhovyk — книжковий провідник Knyhovo" />
      </div>
    </section>
  );
}

/* ---------------- Discovery shelf (Popular Now / New Releases) ---------------- */
function Shelf({ id, eyebrow, title, lead, cta, books, variant, tint }) {
  const { Button } = DS;
  return (
    <section className={['hp-shelf', tint ? 'hp-shelf--tint' : ''].filter(Boolean).join(' ')} data-screen-label={id}>
      <div className="hp-shelf__head">
        <div className="hp-shelf__heading">
          {eyebrow ? <p className="kn-eyebrow">{eyebrow}</p> : null}
          <div className="hp-shelf__titlerow">
            <h2 className="hp-shelf__title">{title}</h2>
            {cta ? (
              <a className="hp-shelf__chev" href="Search Results Page.html" aria-label={cta}><Chevron /></a>
            ) : null}
          </div>
        </div>
        {cta ? <Button variant="ghost" className="hp-shelf__cta">{cta}</Button> : null}
      </div>
      <BookGrid books={books} />
    </section>
  );
}

/* ---------------- Книговик радить — editorial recommendation shelf (books only) ----------------
   Книговик (the product character) is the one recommending — not a curator, not the brand.
   Full-character avatarAtention asset (W8c canonical "advice" pose) peeks from the corner;
   green-tinted frame (Wishlist language) marks this as his personal pick. */
function RecommendsShelf({ framed }) {
  const { Button } = DS;
  return (
    <section className={['hp-recommends', framed ? 'hp-recommends--framed' : ''].filter(Boolean).join(' ')}
      data-screen-label="Книговик радить">
      <div className="hp-recommends__head">
        <div className="hp-recommends__heading">
          <div className="hp-recommends__titlerow">
            <h2 className="hp-recommends__title">Книговик радить</h2>
            <img className="hp-recommends__mascot" src="assets/mascot/avatarAtention.png"
              alt="Книговик" />
            <a className="hp-recommends__chev" href="Search Results Page.html" aria-label="Усі добірки"><Chevron /></a>
          </div>
        </div>
        <Button variant="ghost" className="hp-recommends__all">Усі →</Button>
      </div>
      <BookGrid books={RECOMMENDS} />
    </section>
  );
}

/* ---------------- Page ---------------- */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "loggedIn": false,
  "recommendsFramed": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [theme, setTheme] = React.useState(() => localStorage.getItem('kn-theme') || t.theme || 'light');

  // `theme` is the single source of truth (driven by ThemeToggle + the Tweak
  // radio's onChange). Apply it to the DOM, persist to localStorage, and mirror
  // it into the tweak block for the panel — one direction only, so there's no
  // theme↔tweak ping-pong when the stored values start out mismatched.
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kn-theme', theme);
    if (t.theme !== theme) setTweak('theme', theme);
  }, [theme]);

  React.useEffect(() => { window.lucide && lucide.createIcons(); });

  // Keep the hero pinned to exactly one viewport tall: measure the header so
  // header + hero == 100svh and everything else scrolls below the fold.
  React.useEffect(() => {
    const setH = () => {
      const h = document.querySelector('.site-header');
      if (h) document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
      // Mascot proportional scaling: tie --hero-h to the rendered hero height so
      // --msc-h (calc 47%) stays correct at any browser zoom level.
      const hero = document.querySelector('.hero');
      if (hero) document.documentElement.style.setProperty('--hero-h', hero.offsetHeight + 'px');
    };
    setH();
    window.addEventListener('resize', setH);
    return () => window.removeEventListener('resize', setH);
  }, []);

  return (
    <div className="page">
      <SiteHeader theme={theme} onTheme={setTheme} loggedIn={t.loggedIn} />

      <main data-screen-label="Homepage">
        <Hero theme={theme} />

        <RecommendsShelf framed={t.recommendsFramed} />

        <Shelf
          id="Popular Now"
          eyebrow="Найчастіше шукають"
          title="Популярне зараз"
          lead="Книги, за якими читачі приходять до Knyhovo цього тижня."
          cta="Усі →"
          variant="compact"
          books={POPULAR_NOW}
        />

        <Shelf
          id="New Releases"
          eyebrow="Щойно з друку"
          title="Новинки"
          cta="Весь каталог →"
          variant="compact"
          tint
          books={NEW_RELEASES}
        />
      </main>

      <SiteFooter theme={theme} />

      <TweaksPanel>
        <TweakSection label="Тема" />
        <TweakRadio label="Оформлення" value={theme}
          options={['light', 'dark']}
          onChange={(v) => setTheme(v)} />
        <TweakSection label="Акаунт" />
        <TweakToggle label="Користувач увійшов (Профіль)" value={t.loggedIn}
          onChange={(v) => setTweak('loggedIn', v)} />
        <TweakSection label="Книговик радить" />
        <TweakToggle label="Виділений фон секції" value={t.recommendsFramed}
          onChange={(v) => setTweak('recommendsFramed', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
