// Knyhovo · W7 — Search Intelligence · SHARED
// Icons, mock data, page chrome (frozen header/footer/results shell),
// and small helpers. Exposed on window.SI. Composes only DS exports.
'use strict';

const DS = window.KnyhovoDesignSystem_9fa616;

/* ---------------- Inline Lucide-style icons (2px stroke, rounded) ----------------
   The DS specifies Lucide; we inline the handful we need so the canvas
   renders without a network icon pass. Stroke uses currentColor. */
const SI_ICONS = {
  search: 'M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M21 21l-4.3-4.3',
  sparkles: 'M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16 10.1 11.4 5.5 9.5 10.1 7.6 12 3 M19 14l.8 2 .2.1 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z M5 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0',
  layers: 'M12 2 2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  hash: 'M4 9h16 M4 15h16 M10 3 8 21 M16 3l-2 18',
  chevron: 'M9 18l6-6-6-6',
  arrowRight: 'M5 12h14 M13 5l7 7-7 7',
  clock: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 7v5l3 2',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10.3 21a1.94 1.94 0 0 0 3.4 0',
  bookPlus: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z M9 7h4 M11 5v4',
  scan: 'M3 7V5a2 2 0 0 1 2-2h2 M17 3h2a2 2 0 0 1 2 2v2 M21 17v2a2 2 0 0 1-2 2h-2 M7 21H5a2 2 0 0 1-2-2v-2 M7 8v8 M11 8v8 M15 8v8',
  bookOpen: 'M12 7v14 M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  alert: 'M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  cloudOff: 'M3 3l18 18 M5.8 5.8A8 8 0 0 0 9 21h7a4 4 0 0 0 1.8-7.6 M13 5.1A6 6 0 0 1 18.5 11',
  send: 'M22 2 11 13 M22 2 15 22l-4-9-9-4 20-7z',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18 M6 6l12 12',
};

function SIIcon({ name, style }) {
  const d = SI_ICONS[name] || SI_ICONS.search;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      {d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg}></path>)}
    </svg>
  );
}

/* ---------------- Highlight a matched substring inside suggestion text ---------------- */
function siHighlight(text, q) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <React.Fragment>
      {text.slice(0, i)}
      <mark className="si-hl">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </React.Fragment>
  );
}

const uah = (n) => n + ' ₴';

/* ---------------- Mock data ---------------- */
const SI_DATA = {
  // No-results recovery scenarios (the brief's example queries)
  recover: {
    harry: {
      typed: 'гари потер',
      corrected: 'Гаррі Поттер',
      confidence: 'high',
      results: [
        { title: 'Гаррі Поттер і філософський камінь', author: 'Дж. К. Ролінґ', price: 285, oldPrice: 340, store: 'Yakaboo', badge: 'green' },
        { title: 'Гаррі Поттер і таємна кімната', author: 'Дж. К. Ролінґ', price: 295, oldPrice: null, store: 'Книгарня «Є»', badge: null },
        { title: 'Гаррі Поттер і в’язень Азкабану', author: 'Дж. К. Ролінґ', price: 310, oldPrice: 360, store: 'Rozetka', badge: 'solid' },
        { title: 'Гаррі Поттер і келих вогню', author: 'Дж. К. Ролінґ', price: 340, oldPrice: null, store: 'BookChef', badge: null },
      ],
      jump: { kind: 'Серія', name: 'Гаррі Поттер', meta: '7 книг · Дж. К. Ролінґ', icon: 'layers' },
    },
    witcher: {
      typed: 'ведьмак',
      candidates: ['Відьмак', 'Анджей Сапковський'],
      confidence: 'low',
      note: 'Запит схожий на російську назву. Можливо, ви шукали українське видання:',
      jumps: [
        { kind: 'Серія', name: 'Відьмак', meta: '8 книг · фентезі · Анджей Сапковський', icon: 'layers' },
        { kind: 'Автор', name: 'Анджей Сапковський', meta: '11 книг у 5 книгарнях', icon: 'user' },
      ],
      results: [
        { title: 'Відьмак. Останнє бажання', author: 'Анджей Сапковський', price: 265, oldPrice: null, store: 'Yakaboo', badge: 'green' },
        { title: 'Відьмак. Меч призначення', author: 'Анджей Сапковський', price: 275, oldPrice: 320, store: 'Книгарня «Є»', badge: 'solid' },
      ],
    },
    martian: {
      typed: 'марсіянин енді веєр',
      corrected: 'Марсіянин',
      confidence: 'high',
      note: 'Ми розпізнали назву й автора в одному запиті.',
      results: [
        { title: 'Марсіянин', author: 'Енді Вейр', price: 295, oldPrice: 350, store: 'Nash Format', badge: 'green' },
      ],
      jump: { kind: 'Автор', name: 'Енді Вейр', meta: '4 книги · фантастика', icon: 'user' },
    },
  },

  // ISBN intelligence
  isbn: {
    code: '978-617-12-0512-3',
    exact: { title: 'Атомні звички', author: 'Джеймс Клір', price: 245, oldPrice: 320, store: 'Yakaboo', badge: 'green' },
    multi: {
      work: { title: 'Дюна', author: 'Френк Герберт', count: 4, stores: 5, from: 340 },
      editions: [
        { fmt: 'Тверда обкладинка', meta: 'КСД · 2021 · 656 с.', price: 420, store: 'Yakaboo' },
        { fmt: 'М’яка обкладинка', meta: 'КСД · 2023 · 656 с.', price: 340, store: 'Книгарня «Є»', best: true },
        { fmt: 'Подарункове видання', meta: 'КСД · 2022 · ілюстроване', price: 690, store: 'Rozetka' },
        { fmt: 'Аудіокнига', meta: 'Абук · 18 год 12 хв', price: 250, store: 'Абук' },
      ],
    },
  },

  // Series navigation (reading order)
  series: {
    name: 'Відьмак',
    author: 'Анджей Сапковський',
    meta: '8 книг · фентезі',
    volumes: [
      { no: '0.5', title: 'Останнє бажання', tag: 'збірка', price: 265, avail: 'ok', owned: false },
      { no: '0.7', title: 'Меч призначення', tag: 'збірка', price: 275, avail: 'ok', owned: true },
      { no: '1', title: 'Кров ельфів', tag: null, price: 290, avail: 'ok', owned: false },
      { no: '2', title: 'Час погорди', tag: null, price: 290, avail: 'soon', owned: false },
      { no: '3', title: 'Хрещення вогнем', tag: null, price: 295, avail: 'ok', owned: false },
      { no: '4', title: 'Вежа Ластівки', tag: null, price: 305, avail: 'out', owned: false },
      { no: '5', title: 'Володарка Озера', tag: null, price: 320, avail: 'ok', owned: false },
    ],
  },

  // Author exploration
  author: {
    name: 'Стівен Кінг',
    meta: { books: 64, tracked: 1820 },
    tabs: ['Популярні', 'Найвідстежуваніші', 'Найдешевші'],
    books: {
      'Популярні': [
        { title: 'Сяйво', author: 'Стівен Кінг', price: 310, oldPrice: 360, store: 'Yakaboo', badge: 'solid' },
        { title: 'Воно', author: 'Стівен Кінг', price: 480, oldPrice: null, store: 'Книгарня «Є»', badge: null },
        { title: 'Зелена миля', author: 'Стівен Кінг', price: 295, oldPrice: null, store: 'Rozetka', badge: null },
        { title: '11/22/63', author: 'Стівен Кінг', price: 420, oldPrice: 470, store: 'BookChef', badge: 'solid' },
      ],
      'Найвідстежуваніші': [
        { title: 'Воно', author: 'Стівен Кінг', price: 480, oldPrice: null, store: 'Книгарня «Є»', badge: 'accent' },
        { title: 'Протистояння', author: 'Стівен Кінг', price: 540, oldPrice: null, store: 'Yakaboo', badge: null },
        { title: 'Сяйво', author: 'Стівен Кінг', price: 310, oldPrice: 360, store: 'Yakaboo', badge: 'solid' },
        { title: 'Острів Дума', author: 'Стівен Кінг', price: 330, oldPrice: null, store: 'Nash Format', badge: null },
      ],
      'Найдешевші': [
        { title: 'Містер Мерседес', author: 'Стівен Кінг', price: 230, oldPrice: 280, store: 'Rozetka', badge: 'green' },
        { title: 'Долорес Клейборн', author: 'Стівен Кінг', price: 245, oldPrice: null, store: 'BookChef', badge: null },
        { title: 'Зелена миля', author: 'Стівен Кінг', price: 295, oldPrice: null, store: 'Rozetka', badge: null },
        { title: 'Сяйво', author: 'Стівен Кінг', price: 310, oldPrice: 360, store: 'Yakaboo', badge: 'solid' },
      ],
    },
  },

  // Ambiguous / canonical work + editions
  work: {
    title: 'Маленький принц',
    author: 'Антуан де Сент-Екзюпері',
    count: 9,
    stores: 5,
    from: 95,
    note: '9 видань у 5 книгарнях — від кишенькового до подарункового. Оберіть формат, ми покажемо найкращу ціну саме на нього.',
    editions: [
      { fmt: 'Тверда обкладинка', meta: 'Видавництво Старого Лева · 2020', price: 180, store: 'Yakaboo' },
      { fmt: 'М’яка обкладинка', meta: 'КМ-Букс · 2022', price: 95, store: 'Книгарня «Є»', best: true },
      { fmt: 'Ілюстроване видання', meta: 'А-ба-ба-га-ла-ма-га · 2019', price: 320, store: 'Rozetka' },
      { fmt: 'Двомовне видання', meta: 'укр./фр. · Основи · 2021', price: 240, store: 'BookChef' },
      { fmt: 'Аудіокнига', meta: 'Абук · 2 год 4 хв', price: 120, store: 'Абук' },
    ],
  },

  popular: ['Атомні звички', 'Сергій Жадан', 'Дюна', 'Гаррі Поттер', 'Кобзар'],
};

/* ---------------- Typeahead suggestion model (while typing «гар») ---------------- */
const SI_TYPEAHEAD = {
  recent: ['Стівен Кінг', 'атомні звички'],
  // Keyed by what to show for the seeded query — the live prototype computes its own.
  groups: (q) => {
    const titles = [
      { title: 'Гаррі Поттер і філософський камінь', author: 'Дж. К. Ролінґ', price: 285 },
      { title: 'Гаррі Поттер і таємна кімната', author: 'Дж. К. Ролінґ', price: 295 },
      { title: 'Гарвардський метод переговорів', author: 'Роджер Фішер', price: 260 },
    ];
    const authors = [{ name: 'Гарпер Лі', meta: '3 книги' }];
    const series = [{ name: 'Гаррі Поттер', meta: '7 книг · Дж. К. Ролінґ' }];
    return { titles, authors, series };
  },
};

/* ============================================================
   CHROME — frozen header / footer / results shell
   ============================================================ */
function SIHeader({ theme, onTheme }) {
  const { Button, ThemeToggle } = DS;
  const logo = theme === 'dark' ? '../../assets/logo/knyhovo-logo-dark.png' : '../../assets/logo/knyhovo-logo-light.png';
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

function SIFooter({ theme }) {
  const logo = theme === 'dark' ? '../../assets/logo/knyhovo-logo-dark.png' : '../../assets/logo/knyhovo-logo-light.png';
  return (
    <footer className="site-footer" data-screen-label="Footer">
      <img className="footer-logo" src={logo} alt="Knyhovo" />
      <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
      <p className="footer-copy">© 2026 Knyhovo</p>
    </footer>
  );
}

// Full desktop page: frozen chassis with a results title + SearchBar slot.
function SIPage({ theme, query, summary, children, searchExtra }) {
  const { SearchBar } = DS;
  return (
    <div className="bd-page" data-theme={theme} style={{ background: 'var(--bg)', color: 'var(--text)', minHeight: '100%' }}>
      <div className="page">
        <SIHeader theme={theme} />
        <main className="results" data-screen-label="Search results">
          <p className="results__eyebrow">ПОШУК · 5 КНИГАРЕНЬ · НАЙНИЖЧІ ЦІНИ</p>
          <h1 className="results__title">Результати для <em>«{query}»</em></h1>
          <div className="results__search">
            <SearchBar value={query} onChange={() => {}} />
            {searchExtra}
          </div>
          {summary !== undefined && (
            <div className="results__toolbar">
              <p className="results__summary">{summary}</p>
            </div>
          )}
          {children}
        </main>
        <SIFooter theme={theme} />
      </div>
    </div>
  );
}

window.SI = {
  DS, Icon: SIIcon, icons: SI_ICONS, highlight: siHighlight, uah,
  DATA: SI_DATA, TYPEAHEAD: SI_TYPEAHEAD,
  Header: SIHeader, Footer: SIFooter, Page: SIPage,
};
