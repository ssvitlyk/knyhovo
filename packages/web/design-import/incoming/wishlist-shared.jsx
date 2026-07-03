// Knyhovo Wishlist & Price Tracking — EXPLORATION ONLY (not approved for implementation).
// Shared data + primitives. Composes window.KnyhovoDesignSystem_9fa616 exports and frozen
// v1.0 tokens only. Inherits frozen rules from Search Results v1.0 / Book Details v1.1.
// Exported to window.WL for the variant files.

const WL_DS = window.KnyhovoDesignSystem_9fa616;

/* ---------------- Demo content (mock data, clearly fictional placeholder) ----------------
   The item list deliberately covers every item-level state required by the brief:
   price-drop (with/without target), price-rise, stable, saved-only, partial-data,
   unavailable — so each variant's "default" artboard doubles as a state matrix.  */
const WL_BASE_ITEMS = [
  { id: 'vidmak', title: 'Відьмак. Останнє бажання', author: 'Анджей Сапковський',
    price: 240, prev: 320, store: 'Yakaboo', avail: 'in',
    tracking: true, alert: true, target: 250, targetMet: true,
    collection: 'Фентезі', added: '3 тижні тому', verdict: 'now' },
  { id: 'krov', title: 'Кров ельфів', author: 'Анджей Сапковський',
    price: 235, prev: 250, store: 'Книгарня «Є»', avail: 'in',
    tracking: true, alert: false, target: null,
    collection: 'Фентезі', added: '3 тижні тому', verdict: 'now' },
  { id: 'zvychky', title: 'Атомні звички', author: 'Джеймс Клір',
    price: 245, prev: 245, store: 'Yakaboo', avail: 'in',
    tracking: true, alert: true, target: 199, targetMet: false,
    collection: 'Нонфікшн', added: 'місяць тому', verdict: 'wait' },
  { id: 'sapiens', title: 'Сапієнс. Людина розумна', author: 'Ювал Ной Харарі',
    price: 335, prev: 310, store: 'Rozetka', avail: 'in',
    tracking: true, alert: false, target: null,
    collection: 'Нонфікшн', added: '2 місяці тому', verdict: 'high' },
  { id: 'tini', title: 'Тіні забутих предків', author: 'Михайло Коцюбинський',
    price: 180, prev: 180, store: 'Книгарня «Є»', avail: 'in',
    tracking: false, alert: false, target: null,
    collection: 'Класика', added: 'пів року тому', verdict: 'wait' },
  { id: 'mech', title: 'Меч призначення', author: 'Анджей Сапковський',
    price: 255, prev: 255, store: 'Rozetka', avail: 'in',
    tracking: true, alert: false, target: null,
    collection: 'Фентезі', added: '3 тижні тому', verdict: 'wait' },
  { id: 'dim', title: 'Дім солі', author: 'Світлана Тараторіна',
    price: null, prev: null, store: null, avail: 'pending',
    tracking: true, alert: false, target: null,
    collection: 'Фентезі', added: 'сьогодні', verdict: 'data' },
  { id: 'kobzar', title: 'Кобзар', author: 'Тарас Шевченко',
    price: null, prev: 320, store: null, avail: 'out',
    tracking: true, alert: true, target: null,
    collection: 'Класика', added: '2 місяці тому', verdict: 'out' },
];

/* Scenario transform — Tweaks: «Звичайний тиждень» / «Хвиля знижок» / «Тихий тиждень» */
function wlGetItems(scenario) {
  const clone = WL_BASE_ITEMS.map((i) => ({ ...i }));
  if (scenario === 'Хвиля знижок') {
    const z = clone.find((i) => i.id === 'zvychky');
    z.price = 195; z.prev = 245; z.targetMet = true; z.verdict = 'now';
    const m = clone.find((i) => i.id === 'mech');
    m.price = 229; m.prev = 255; m.verdict = 'now';
  }
  if (scenario === 'Тихий тиждень') {
    clone.forEach((i) => {
      if (i.price != null) { i.prev = i.price; }
      i.targetMet = false;
      if (i.verdict === 'now') i.verdict = 'wait';
    });
  }
  return clone;
}

const wlUah = (n) => n + ' ₴';
const wlDelta = (i) => (i.price != null && i.prev != null ? i.price - i.prev : 0);
const wlDrops = (items) => items.filter((i) => wlDelta(i) < 0);
const wlRises = (items) => items.filter((i) => wlDelta(i) > 0);
const wlFired = (items) => items.filter((i) => i.targetMet);

/* ---------------- Icons (Lucide path data, 2px stroke, round caps — DS icon spec) ------- */
const WL_ICONS = {
  bookmark: ['m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'],
  'bookmark-check': ['m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z', 'm9 10 2 2 4-4'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  'bell-off': ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0', 'm3 3 18 18'],
  'trending-down': ['m22 17-8.5-8.5-5 5L2 7', 'M16 17h6v-6'],
  'trending-up': ['m22 7-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  'external-link': ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  'chart-line': ['M3 3v18h18', 'm19 9-5 5-4-4-3 3'],
  sliders: ['M21 4h-7', 'M10 4H3', 'M21 12h-9', 'M8 12H3', 'M21 20h-5', 'M12 20H3', 'M14 2v4', 'M8 10v4', 'M16 18v4'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  check: ['M20 6 9 17l-5-5'],
  'chevron-down': ['m6 9 6 6 6-6'],
  plus: ['M5 12h14', 'M12 5v14'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'],
  archive: ['M3 4h18v5H3z', 'M4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9', 'M10 13h4'],
  info: [{ circle: [12, 12, 10] }, 'M12 16v-4', 'M12 8h.01'],
  clock: [{ circle: [12, 12, 10] }, 'M12 6v6l4 2'],
  target: [{ circle: [12, 12, 10] }, { circle: [12, 12, 6] }, { circle: [12, 12, 2] }],
  search: [{ circle: [11, 11, 8] }, 'm21 21-4.3-4.3'],
};
function WLIcon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {WL_ICONS[name].map((d, i) =>
        typeof d === 'string'
          ? <path key={i} d={d}></path>
          : <circle key={i} cx={d.circle[0]} cy={d.circle[1]} r={d.circle[2]}></circle>
      )}
    </svg>
  );
}

/* ---------------- Chrome: header / footer / shell (inherited composition) --------------- */
function WLHeader({ theme }) {
  const { Button, ThemeToggle } = WL_DS;
  const logo = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png';
  return (
    <header className="site-header" data-screen-label="Header">
      <img className="site-logo" src={logo} alt="Knyhovo" />
      <nav className="site-nav">
        <a href="#" className="nav-link">Головна</a>
        <a href="#" className="nav-link">Каталог</a>
        <a href="#" className="nav-link">Знижки</a>
        {/* Exploratory nav entry — same frozen link styles; placement is an open question */}
        <a href="#" className="nav-link nav-link--active">Вішлист</a>
      </nav>
      <div className="site-actions">
        <span style={{ pointerEvents: 'none' }}><ThemeToggle theme={theme} /></span>
        <Button variant="secondary" size="sm">Увійти</Button>
      </div>
    </header>
  );
}

function WLFooter({ theme }) {
  const logo = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png';
  return (
    <footer className="site-footer" data-screen-label="Footer">
      <img className="footer-logo" src={logo} alt="Knyhovo" />
      <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
      <p className="footer-copy">© 2026 Knyhovo</p>
    </footer>
  );
}

function WLSearchSkeleton() {
  return (
    <div className="kn-field" aria-hidden="true">
      <span className="wl-sk kn-skeleton-search__icon"></span>
      <span className="wl-sk kn-skeleton-search__query"></span>
      <span className="kn-skeleton-search__button"></span>
    </div>
  );
}

/* Page shell shared by every artboard. Footer is ALWAYS present in every state
   (frozen Search Results rule, inherited here). */
function WLShell({ theme, label, searchSkeleton, crumbTail, children }) {
  const { SearchBar } = WL_DS;
  return (
    <div className="wl-page" data-theme={theme} data-screen-label={label}>
      <div className="wl-note"><b>Exploration only</b> · not approved for implementation</div>
      <div className="wl-wrap">
        <WLHeader theme={theme} />
        <div className="wl-topbar">
          <div className="wl-search">
            {searchSkeleton ? <WLSearchSkeleton /> : <SearchBar placeholder="Назва книги, автора або ISBN…" />}
          </div>
        </div>
        <p className="wl-crumbs"><a href="#">Головна</a> · <span>{crumbTail || 'Вішлист'}</span></p>
        {children}
        <WLFooter theme={theme} />
      </div>
    </div>
  );
}

/* ---------------- Item-level primitives ---------------- */

/* Delta — drop is the good news (forest green); rise stays calm (muted). */
function WLDelta({ item, showZero }) {
  const d = wlDelta(item);
  if (d === 0 || item.price == null) {
    return showZero ? <span className="wl-delta wl-delta--up">без змін</span> : null;
  }
  const down = d < 0;
  return (
    <span className={'wl-delta ' + (down ? 'wl-delta--down' : 'wl-delta--up')}>
      <WLIcon name={down ? 'trending-down' : 'trending-up'} size={14} />
      {(down ? '−' : '+') + Math.abs(d) + ' ₴'}
    </span>
  );
}

/* Price stack — frozen metadata hierarchy (price accent serif · old muted strike · store muted). */
function WLPriceStack({ item, big }) {
  if (item.avail === 'pending') {
    return (
      <div className="wl-pricestack">
        <span className="wl-price wl-price--faint">Збираємо ціни…</span>
        <span className="wl-store">5 книгарень · перший звіт завтра</span>
      </div>
    );
  }
  if (item.avail === 'out') {
    return (
      <div className="wl-pricestack">
        <span className="wl-price wl-price--faint">Немає в наявності</span>
        <span className="wl-store">остання ціна · {wlUah(item.prev)}</span>
      </div>
    );
  }
  const d = wlDelta(item);
  return (
    <div className="wl-pricestack">
      <div className="wl-pricerow">
        {d !== 0 ? <span className="wl-old">{wlUah(item.prev)}</span> : null}
        <span className="wl-price" style={big ? { fontSize: '1.875rem' } : null}>{wlUah(item.price)}</span>
      </div>
      <span className="wl-store">{item.store}</span>
    </div>
  );
}

/* One strong badge max per item (frozen badge-priority spirit):
   Ціль досягнута (green) → -N% (solid) → Нова (accent). */
function WLItemBadge({ item }) {
  const { Badge } = WL_DS;
  if (item.targetMet) return <Badge tone="green">Ціль досягнута</Badge>;
  const d = wlDelta(item);
  if (d < 0) return <Badge tone="solid">{'-' + Math.round((1 - item.price / item.prev) * 100) + '%'}</Badge>;
  if (item.added === 'сьогодні') return <Badge tone="accent">Нова</Badge>;
  return null;
}

/* Quiet status line — the three-tier model: Збережено → Стежимо → Сповіщення. */
function WLStatus({ item, checked }) {
  return (
    <span className={'wl-statline' + (item.tracking ? ' wl-statline--on' : '')}>
      <WLIcon name={item.tracking ? 'bell' : 'bookmark-check'} size={13} />
      {item.avail === 'out'
        ? 'Стежимо за появою у продажу'
        : item.avail === 'pending'
          ? 'Додано сьогодні · збираємо дані'
          : item.tracking
            ? (item.alert
              ? (item.target ? <span>Сповістимо за ціни ≤ <b>{wlUah(item.target)}</b></span> : 'Сповістимо про зниження')
              : 'Стежимо за ціною щодня')
            : 'Збережено · без стеження'}
      {checked ? <span className="wl-checked"> · перевірено сьогодні о 08:00</span> : null}
    </span>
  );
}

/* Target chip — «Куплю за ≤ N ₴» */
function WLTarget({ item }) {
  if (!item.target) {
    return (
      <span className="wl-target"><WLIcon name="target" size={12} /> Встановити цільову ціну</span>
    );
  }
  return (
    <span className={'wl-target' + (item.targetMet ? ' wl-target--met' : '')}>
      <WLIcon name={item.targetMet ? 'check' : 'target'} size={12} />
      <span>Куплю за ≤ <b>{wlUah(item.target)}</b></span>
    </span>
  );
}

/* Quick actions cluster */
function WLActions({ item, compact }) {
  return (
    <span className="wl-row__actions">
      <button className={'wl-iconbtn' + (item.tracking ? ' wl-iconbtn--on' : '')}
        title={item.tracking ? 'Вимкнути стеження' : 'Стежити за ціною'} type="button">
        <WLIcon name={item.tracking ? 'bell' : 'bell-off'} size={17} />
      </button>
      {!compact ? (
        <button className="wl-iconbtn" title="Налаштувати сповіщення" type="button">
          <WLIcon name="sliders" size={17} />
        </button>
      ) : null}
      <button className="wl-iconbtn" title="Прибрати з вішлиста" type="button">
        <WLIcon name="x" size={17} />
      </button>
    </span>
  );
}

/* List row — the B/C chassis. Highlights follow item state. */
function WLRow({ item, variant, checked }) {
  const { Button } = WL_DS;
  const cls = 'wl-row'
    + (item.targetMet ? ' wl-row--hot' : '')
    + (item.avail === 'out' ? ' wl-row--out' : '')
    + (item.avail === 'pending' ? ' wl-row--dim' : '')
    + (variant === 'feed' ? ' wl-feedrow' + (item.targetMet ? ' wl-feedrow--top' : '') : '');
  return (
    <div className={cls}>
      <span className="wl-cover" aria-label="Обкладинка (плейсхолдер)"></span>
      <span className="wl-row__main">
        <span className="wl-row__title">{item.title}</span>
        <span className="wl-row__author">{item.author}</span>
        <span className="wl-row__badges">
          <WLItemBadge item={item} />
          <WLStatus item={item} checked={checked} />
        </span>
      </span>
      {variant === 'feed' ? <WLDelta item={item} showZero /> : null}
      <WLPriceStack item={item} big={variant === 'feed' && item.targetMet} />
      {variant === 'feed'
        ? (item.targetMet
          ? <Button variant="primary" size="md">Перейти до книгарні</Button>
          : <Button variant="secondary" size="sm" disabled={item.avail !== 'in'}>Перейти до книгарні</Button>)
        : <WLActions item={item} />}
    </div>
  );
}

/* Collapsed group row */
function WLCollapsed({ icon, label, count }) {
  return (
    <div className="wl-collapsed">
      <WLIcon name={icon} size={17} />
      <span>{label}</span>
      <span className="wl-collapsed__count">{count}</span>
      <span className="wl-collapsed__chev"><WLIcon name="chevron-down" size={17} /></span>
    </div>
  );
}

/* Mascot scene — reading-chair Knyhovyk, approved painterly renders (user-provided).
   Light: whitelistWhite · Dark: whitelistBlack. The vector drafts remain in assets/ as history. */
const WL_SCENE_SRC = {
  light: 'assets/mascot/mascot-reading-chair-light-final.png',
  dark: 'assets/mascot/mascot-reading-chair-dark-final.png',
};
/* Gradient masks: blend mascot image natively into DS --bg.
   fade="bottom"       hero/center — fades out the lower edge
   fade="left-bottom" right-side placement — left edge + bottom edge both fade
   fade="right"        vignette thumbnail — right edge fades into adjacent text */
function WLScene({ variant, theme, style, desc, fade }) {
  const src = WL_SCENE_SRC[theme === 'dark' ? 'dark' : 'light'];

  // choose mask based on explicit fade prop or sensible default per variant
  const f = fade || (variant === 'vignette' ? 'right' : 'bottom');
  const MASKS = {
    // fades only the outermost ~10-14% of each edge — keeps the character fully crisp
    bottom:       'linear-gradient(to bottom, black 86%, transparent 100%)',
    'left-bottom': [
      'linear-gradient(to right,  transparent 0%, black 10%)',
      'linear-gradient(to bottom, black 87%, transparent 100%)',
    ].join(', '),
    all: [
      'linear-gradient(to bottom, black 86%, transparent 100%)',
      'linear-gradient(to top,    black 88%, transparent 100%)',
      'linear-gradient(to right,  transparent 0%, black 8%)',
      'linear-gradient(to left,   transparent 0%, black 8%)',
    ].join(', '),
    right:         'linear-gradient(to right, black 52%, transparent 98%)',
    none:          'none',
  };
  const maskImage         = MASKS[f] || MASKS.bottom;
  // intersect when multiple gradient layers
  const multi             = f === 'left-bottom' || f === 'all';
  const mkComposite       = multi ? 'intersect'  : 'match-source';
  const webkitMkComposite = multi ? 'source-in'  : 'source-over';

  if (variant === 'vignette') {
    return (
      <div className="wl-scene wl-scene--vignette" style={{ gap: 'var(--space-4)', ...style }}
        data-screen-label="Mascot scene vignette">
        <div style={{
          width: 132, height: 88, flexShrink: 0, overflow: 'hidden',
          borderRadius: 'var(--radius-sm)',
          WebkitMaskImage: maskImage, maskImage: maskImage,
          WebkitMaskComposite: webkitMkComposite, maskComposite: mkComposite,
        }}>
          <img src={src} alt="Knyhovyk читає у кріслі"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        <span className="wl-scene__desc">{desc || 'Knyhovyk у кріслі, в круглих окулярах, занурений у книгу — поруч стосик книжок, що чекають.'}</span>
      </div>
    );
  }
  return (
    <div className="wl-scene" style={{
      padding: 0, overflow: 'hidden',
      WebkitMaskImage: maskImage, maskImage: maskImage,
      WebkitMaskComposite: webkitMkComposite, maskComposite: mkComposite,
      ...style,
    }} data-screen-label="Mascot scene">
      <img src={src} alt="Knyhovyk сидить у читацькому кріслі з книгою"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  );
}

/* Skeleton helper */
function WLSk({ w, h = 12, r, style }) {
  return <span className="wl-sk" style={{ width: w, height: h, borderRadius: r, ...style }}></span>;
}

/* One-shot stagger entrance (frozen skeleton spec) */
function useWLStagger() {
  const [on, setOn] = React.useState(true);
  React.useEffect(() => { const id = setTimeout(() => setOn(false), 900); return () => clearTimeout(id); }, []);
  return on ? ' wl-stagger' : '';
}

window.WL = {
  DS: WL_DS,
  getItems: wlGetItems, uah: wlUah, delta: wlDelta, drops: wlDrops, rises: wlRises, fired: wlFired,
  Icon: WLIcon, Header: WLHeader, Footer: WLFooter, Shell: WLShell, SearchSkeleton: WLSearchSkeleton,
  Delta: WLDelta, PriceStack: WLPriceStack, ItemBadge: WLItemBadge, Status: WLStatus,
  Target: WLTarget, Actions: WLActions, Row: WLRow, Collapsed: WLCollapsed,
  Scene: WLScene, Sk: WLSk, useStagger: useWLStagger,
};
