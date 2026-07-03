// Knyhovo Book Details — DS v1.0 · shared data + primitives.
// Variant C (Balanced) approved & frozen 2026-06-11 as Book Details v1.1. Composes window.KnyhovoDesignSystem_9fa616 exports
// and frozen v1.0 tokens only. Exported to window.BD for the variant files.

const KN_DS = window.KnyhovoDesignSystem_9fa616;

/* ---------------- Demo content (mock data, clearly fictional placeholder) ---------------- */
const BD_BOOK = {
  title: 'Відьмак. Останнє бажання',
  author: 'Анджей Сапковський',
  publisher: 'Клуб Сімейного Дозвілля',
  isbn: '978-617-12-0512-3',
  lang: 'Українська',
  format: 'Паперова книга · тверда обкладинка',
  series: '«Відьмак», книга 1 із 8',
  genreEyebrow: 'ФЕНТЕЗІ · СЕРІЯ «ВІДЬМАК» · КНИГА 1 ІЗ 8',
  desc: [
    '«Останнє бажання» відкриває сагу про Ґеральта з Рівії — відьмака, мисливця на чудовиськ, який мандрує світом, де людська жорстокість часто виявляється страшнішою за будь-яку потвору. Збірка оповідань знайомить із головними героями циклу та законами цього світу.',
    'Сапковський переосмислює класичні казкові сюжети з іронією та моральною неоднозначністю: кожне полювання для Ґеральта — це вибір між меншим і більшим злом, а не двобій добра з темрявою.',
    'Саме з цієї книги варто починати знайомство з циклом: тут уперше з’являються Йеннефер і Любисток — і звучить останнє бажання, що назавжди змінить долю відьмака.',
  ],
};

const BD_OFFERS = [
  { store: 'Yakaboo', price: 240, oldPrice: 320, avail: 'in' },
  { store: 'Rozetka', price: 259, oldPrice: 289, avail: 'in' },
  { store: 'Книгарня «Є»', price: 265, oldPrice: null, avail: 'in' },
  { store: 'BookChef', price: 280, oldPrice: null, avail: 'low' },
  { store: 'Nash Format', price: null, oldPrice: null, avail: 'out' },
];

const BD_SERIES_BOOKS = [
  { title: 'Меч призначення', author: 'Анджей Сапковський', price: 235, oldPrice: 260, store: 'Yakaboo' },
  { title: 'Кров ельфів', author: 'Анджей Сапковський', price: 250, oldPrice: null, store: 'Книгарня «Є»' },
  { title: 'Час погорди', author: 'Анджей Сапковський', price: 255, oldPrice: null, store: 'Rozetka' },
  { title: 'Хрещення вогнем', author: 'Анджей Сапковський', price: 270, oldPrice: 300, store: 'Yakaboo' },
];

const BD_AUTHOR_BOOKS = [
  { title: 'Сезон гроз', author: 'Анджей Сапковський', price: 265, oldPrice: null, store: 'Yakaboo' },
  { title: 'Вежа ластівки', author: 'Анджей Сапковський', price: 260, oldPrice: null, store: 'BookChef' },
  { title: 'Володарка озера', author: 'Анджей Сапковський', price: 275, oldPrice: 310, store: 'Rozetka' },
  { title: 'Божі воїни', author: 'Анджей Сапковський', price: 290, oldPrice: null, store: 'Книгарня «Є»' },
];

const BD_AVAIL = {
  in: { label: 'В наявності', cls: 'in' },
  low: { label: 'Закінчується', cls: 'low' },
  out: { label: 'Немає в наявності', cls: 'out' },
};

const bdUah = (n) => n + ' ₴';
const bdPct = (o) => '-' + Math.round((1 - o.price / o.oldPrice) * 100) + '%';
const bdBest = (offers) => offers.filter((o) => o.avail !== 'out' && o.price != null)
  .reduce((a, b) => (a && a.price <= b.price ? a : b), null);

/* ---------------- Icons (Lucide path data, 2px stroke, round caps — DS icon spec) ------- */
const BD_ICON_PATHS = {
  bookmark: ['m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'],
  'bookmark-check': ['m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z', 'm9 10 2 2 4-4'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  'chart-line': ['M3 3v18h18', 'm19 9-5 5-4-4-3 3'],
  'external-link': ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  info: ['M12 16v-4', 'M12 8h.01'],
};
function BDIcon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === 'info' ? <circle cx="12" cy="12" r="10"></circle> : null}
      {BD_ICON_PATHS[name].map((d, i) => <path key={i} d={d}></path>)}
    </svg>
  );
}

/* ---------------- Chrome: header / search / crumbs / footer (reused patterns) ----------- */
function BDHeader({ theme }) {
  const { Button, ThemeToggle } = KN_DS;
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
        <span style={{ pointerEvents: 'none' }}><ThemeToggle theme={theme} /></span>
        <Button variant="secondary" size="sm">Увійти</Button>
      </div>
    </header>
  );
}

function BDFooter({ theme }) {
  const logo = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png';
  return (
    <footer className="site-footer" data-screen-label="Footer">
      <img className="footer-logo" src={logo} alt="Knyhovo" />
      <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
      <p className="footer-copy">© 2026 Knyhovo</p>
    </footer>
  );
}

function BDSearchSkeleton() {
  return (
    <div className="kn-field" aria-hidden="true">
      <span className="bd-sk kn-skeleton-search__icon"></span>
      <span className="bd-sk kn-skeleton-search__query"></span>
      <span className="kn-skeleton-search__button"></span>
    </div>
  );
}

/* Page shell shared by every artboard. frozen=true → approved v1.1 banner; false → exploration banner.
   Footer is ALWAYS present in every state (frozen Search Results rule, inherited here). */
function BDShell({ theme, label, searchSkeleton, crumbTail, frozen, children }) {
  const { SearchBar } = KN_DS;
  return (
    <div className="bd-page" data-theme={theme} data-screen-label={label}>
      <div className="bd-note">{frozen ? <b>Approved · Book Details v1.1 · Frozen 2026-06-11</b> : <React.Fragment><b>Exploration only</b> · Variants A &amp; B · not approved</React.Fragment>}</div>
      <div className="bd-wrap">
        <BDHeader theme={theme} />
        <div className="bd-topbar">
          <div className="bd-search">
            {searchSkeleton ? <BDSearchSkeleton /> : <SearchBar placeholder="Назва книги, автора або ISBN…" />}
          </div>
        </div>
        <p className="bd-crumbs">Каталог · Фентезі · <span>{crumbTail || BD_BOOK.title}</span></p>
        {children}
        <BDFooter theme={theme} />
      </div>
    </div>
  );
}

/* ---------------- Primitives ---------------- */
function BDCover({ size = 'lg' }) {
  return <div className={'bd-cover bd-cover--' + size} aria-label="Обкладинка (плейсхолдер)"><span>Обкладинка</span></div>;
}

function BDWishlist({ saved, alert, size = 'md' }) {
  const { Button, Badge } = KN_DS;
  return (
    <div className="bd-wish" data-screen-label="Wishlist control">
      <Button variant="secondary" size={size}>
        <BDIcon name={saved ? 'bookmark-check' : 'bookmark'} size={16} />
        {saved ? 'У вішлисті' : 'До вішлиста'}
      </Button>
      {saved && alert ? (
        <Badge tone="accent"><BDIcon name="bell" size={11} /> Стежимо за ціною</Badge>
      ) : null}
    </div>
  );
}

function BDMeta({ book, missing }) {
  const rows = [
    ['Видавництво', book.publisher],
    ['ISBN', book.isbn],
    ['Мова', book.lang],
    ['Формат', book.format],
    ['Серія', book.series],
  ];
  return (
    <dl className="bd-meta" data-screen-label="Book metadata">
      {rows.map(([dt, dd]) => (
        <div key={dt}>
          <dt>{dt}</dt>
          {dd ? <dd>{dd}</dd> : <dd className="bd-meta--missing">{missing || '—'}</dd>}
        </div>
      ))}
    </dl>
  );
}

/* Offer rows — price comparison. Best offer: green badge + primary CTA;
   metadata hierarchy follows the frozen BookCard rules (price accent serif,
   store always muted-neutral, old price muted strikethrough). */
function BDOfferRow({ o, best, compact }) {
  const { Button, Badge } = KN_DS;
  const av = BD_AVAIL[o.avail];
  const out = o.avail === 'out';
  return (
    <div className={'bd-offer' + (best ? ' bd-offer--best' : '') + (out ? ' bd-offer--out' : '')}>
      <span className="bd-offer__store">
        {o.store}
        {best ? <Badge tone="green">Найкраща ціна</Badge>
          : o.oldPrice && !out ? <Badge tone="solid">{bdPct(o)}</Badge> : null}
      </span>
      <span className={'bd-offer__avail bd-offer__avail--' + av.cls}>{av.label}</span>
      <span className="bd-offer__pricecell">
        {o.oldPrice && !out ? <span className="bd-offer__old">{bdUah(o.oldPrice)}</span> : null}
        <span className="bd-offer__price">{out ? '—' : bdUah(o.price)}</span>
      </span>
      <Button variant={best ? 'primary' : 'secondary'} size={best && !compact ? 'md' : 'sm'} disabled={out}>
        Перейти до книгарні
      </Button>
    </div>
  );
}

function BDOfferList({ offers, compact, updatedNote }) {
  const best = bdBest(offers);
  const sorted = [...offers].sort((a, b) => {
    if ((a.avail === 'out') !== (b.avail === 'out')) return a.avail === 'out' ? 1 : -1;
    return (a.price ?? 1e9) - (b.price ?? 1e9);
  });
  return (
    <div data-screen-label="Price comparison">
      <div className={'bd-offers' + (compact ? ' bd-offers--compact' : '')}>
        {sorted.map((o) => <BDOfferRow key={o.store} o={o} best={o === best} compact={compact} />)}
      </div>
      {updatedNote ? <p className="bd-updated">Ціни оновлено сьогодні о 08:00 · {offers.length} книгарень</p> : null}
    </div>
  );
}

/* Price-history placeholder — reserved space only; no chart styles invented. */
function BDHistory() {
  const { Badge } = KN_DS;
  return (
    <section className="bd-section" data-screen-label="Price history placeholder">
      <div className="bd-history">
        <div className="bd-history__icon"><BDIcon name="chart-line" size={20} /></div>
        <div>
          <div className="bd-history__titlerow">
            <span className="bd-history__title">Динаміка ціни</span>
            <Badge tone="neutral">Незабаром</Badge>
          </div>
          <p>Тут з’явиться графік зміни ціни за останні місяці — щоб ви бачили, коли купувати найвигідніше. Ми вже збираємо дані для цієї книги.</p>
        </div>
      </div>
    </section>
  );
}

/* Related shelf — composes the frozen BookCard; vertical layout via the
   approved page-level override (component itself untouched). */
function BDShelf({ title, books }) {
  const { BookCard, Badge } = KN_DS;
  return (
    <section className="bd-section" data-screen-label={title}>
      <h2 className="bd-h2">{title}</h2>
      <div className="bd-shelf">
        {books.map((b) => (
          <BookCard key={b.title} title={b.title} author={b.author}
            price={bdUah(b.price)} oldPrice={b.oldPrice ? bdUah(b.oldPrice) : null}
            store={b.store}
            badge={b.oldPrice ? <Badge tone="solid">{bdPct(b)}</Badge> : null} />
        ))}
      </div>
    </section>
  );
}

function BDHint({ children }) {
  return <div className="bd-hint"><BDIcon name="info" size={16} />{' '}<span>{children}</span></div>;
}

/* Skeleton helper */
function BDSk({ w, h = 12, r, style }) {
  return <span className="bd-sk" style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }}></span>;
}

/* One-shot stagger entrance (frozen skeleton spec): the class is dropped after
   the cascade finishes so the steady state carries no animation properties. */
function useBDStagger() {
  const [on, setOn] = React.useState(true);
  React.useEffect(() => { const id = setTimeout(() => setOn(false), 800); return () => clearTimeout(id); }, []);
  return on ? ' bd-stagger' : '';
}

window.BD = {
  DS: KN_DS,
  BOOK: BD_BOOK, OFFERS: BD_OFFERS, SERIES_BOOKS: BD_SERIES_BOOKS, AUTHOR_BOOKS: BD_AUTHOR_BOOKS,
  AVAIL: BD_AVAIL, uah: bdUah, pct: bdPct, best: bdBest,
  Icon: BDIcon, Header: BDHeader, Footer: BDFooter, Shell: BDShell,
  Cover: BDCover, Wishlist: BDWishlist, Meta: BDMeta,
  OfferRow: BDOfferRow, OfferList: BDOfferList, History: BDHistory,
  Shelf: BDShelf, Hint: BDHint, Sk: BDSk, SearchSkeleton: BDSearchSkeleton, useStagger: useBDStagger,
};
