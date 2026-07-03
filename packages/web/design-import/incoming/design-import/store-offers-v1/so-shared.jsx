// Knyhovo · W6 — Store Offers Intelligence · shared data + components.
// A thin intelligence layer composed on TOP of the frozen Book Details
// OffersPanel. Composes window.KnyhovoDesignSystem_9fa616 exports + DS v1.0
// tokens only. Exported to window.SO for the page + matrix canvases.
'use strict';

const SO_DS = window.KnyhovoDesignSystem_9fa616;
const SO_ASSET = '../../';
const soUah = (n) => n + ' ₴';

/* ---------------- Icons (Lucide path data · 2px · round caps) ---------------- */
const SO_ICON_PATHS = {
  check: ['M20 6 9 17l-5-5'],
  'shield-check': ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'],
  clock: ['M12 6v6l4 2'],
  truck: ['M14 18V6a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h2', 'M14 9h4l4 4v4a1 1 0 0 1-1 1h-1', 'M9 18h6'],
  info: ['M12 16v-4', 'M12 8h.01'],
  'alert-triangle': ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  'alert-circle': ['M12 8v4', 'M12 16h.01'],
  refresh: ['M3 12a9 9 0 0 1 15-6.7L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-15 6.7L3 16', 'M3 21v-5h5'],
  layers: ['m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z', 'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65', 'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  search: ['M11 11m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0', 'm21 21-4.3-4.3'],
  'arrow-down': ['M12 5v14', 'm19 12-7 7-7-7'],
  'arrow-up': ['M12 19V5', 'm5 12 7-7 7 7'],
  'trending-down': ['M16 17h6v-6', 'm22 17-8.5-8.5-5 5L2 7'],
  menu: ['M4 12h16', 'M4 6h16', 'M4 18h16'],
  'link-off': ['M15 7h2a5 5 0 0 1 .9 9.9', 'M9 17H7A5 5 0 0 1 7 7', 'M8 12h4', 'm2 2 20 20'],
};
function SOIcon({ name, size = 14 }) {
  const round = name === 'info' || name === 'alert-circle';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {round ? <circle cx="12" cy="12" r="10"></circle> : null}
      {SO_ICON_PATHS[name].map((d, i) => <path key={i} d={d}></path>)}
    </svg>
  );
}

/* ---------------- Availability vocabulary ---------------- */
const SO_AVAIL = {
  in: { label: 'В наявності', cls: 'in' },
  low: { label: 'Закінчується', cls: 'low' },
  out: { label: 'Немає в наявності', cls: 'out' },
  unknown: { label: 'Наявність уточнюється', cls: 'unknown' },
};

/* ---------------- Per-row status meta line (signals 3·4·5) ---------------- */
function soFacts(o) {
  // Store-down / link-down collapse the meta line to a single honest fact.
  if (o.storeDown) return [{ key: 'down', warn: true, icon: 'alert-triangle', text: 'Книгарня тимчасово недоступна' }];
  const out = [];
  const av = SO_AVAIL[o.avail];
  out.push({ key: 'avail', dot: av.cls, availCls: av.cls, text: av.label });
  if (o.fresh === 'stale') out.push({ key: 'stale', warn: true, icon: 'clock', text: 'Ціна могла змінитися' });
  else if (o.fresh === 'changed' && o.changedFrom != null) {
    const dropped = o.changedFrom > o.price;
    out.push({ key: 'changed', drop: dropped, icon: dropped ? 'trending-down' : 'arrow-up',
      text: dropped ? `Ціна впала з ${soUah(o.changedFrom)}` : `Ціна зросла з ${soUah(o.changedFrom)}` });
  }
  if (o.linkDown) out.push({ key: 'link', warn: true, icon: 'link-off', text: 'Посилання недоступне' });
  else if (o.delivery === 'unknown') out.push({ key: 'deliv', warn: true, icon: 'truck', text: 'Доставка уточнюється у книгарні' });
  else if (o.delivery) out.push({ key: 'deliv', icon: 'truck', text: o.delivery });
  return out;
}

function SOMeta({ o }) {
  return (
    <div className="so-row__meta">
      {soFacts(o).map((f) => (
        <span key={f.key} className={'so-fact' + (f.warn ? ' so-fact--warn' : '') + (f.availCls ? ' so-avail--' + f.availCls : '')}
          style={f.drop ? { color: 'var(--brand-green)' } : null}>
          {f.dot ? <span className={'so-dot so-dot--' + f.dot}></span> : null}
          {f.icon ? <SOIcon name={f.icon} size={12} /> : null}
          {f.text}
        </span>
      ))}
    </div>
  );
}

/* ---------------- Best-offer block (frozen .bdc-best + explanation) -------- */
function SOBest({ best }) {
  const { Button, Badge } = SO_DS;
  return (
    <div className="bdc-best" data-screen-label="Best offer">
      <Badge tone="green">{best.badge}</Badge>
      <div className="bdc-best__pricerow">
        {best.oldPrice ? <span className="bdc-best__old">{soUah(best.oldPrice)}</span> : null}
        <span className="bdc-best__price">{soUah(best.price)}</span>
      </div>
      <p className="bdc-best__store">у <b>{best.store}</b>{best.verified ? ' · Перевірена книгарня' : ''}</p>
      {/* Signal 1 — why this offer, not just that it is */}
      <ul className="so-reasons">
        {best.reasons.map((r, i) => (
          <li key={i} className="so-reason"><SOIcon name="check" size={15} />{r}</li>
        ))}
      </ul>
      {best.note ? (
        <p className="so-best-note"><SOIcon name="info" size={13} />{best.note}</p>
      ) : null}
      <Button variant="primary" style={{ width: '100%' }}>Перейти до книгарні</Button>
    </div>
  );
}

/* ---------------- Intelligence offer row ---------------- */
function SORow({ o }) {
  const { Button, Badge } = SO_DS;
  const muted = o.avail === 'out' || o.storeDown || o.linkDown;
  const ctaDisabled = o.avail === 'out' || o.storeDown || o.linkDown;
  let badge = null;
  if (o.cheapestTag) badge = <Badge tone="neutral">Найдешевша</Badge>;
  else if (o.sameTag) badge = <Badge tone="neutral">Така сама ціна</Badge>;
  else if (o.oldPrice && o.avail !== 'out') badge = <Badge tone="solid">{'-' + Math.round((1 - o.price / o.oldPrice) * 100) + '%'}</Badge>;
  return (
    <div className={'so-row' + (muted ? ' so-row--muted' : '')}>
      <div className="so-row__store">
        {o.verified ? <span className="so-verified" title="Перевірена книгарня"><SOIcon name="shield-check" size={15} /></span> : null}
        <span className="so-row__name">{o.store}</span>
        {badge}
      </div>
      <div className="so-row__pricecell">
        {o.oldPrice && o.avail !== 'out' ? <span className="so-row__old">{soUah(o.oldPrice)}</span> : null}
        <span className="so-row__price">{o.price == null ? '—' : soUah(o.price)}</span>
      </div>
      <div className="so-row__cta">
        <Button variant="secondary" size="sm" disabled={ctaDisabled}>Перейти</Button>
      </div>
      <SOMeta o={o} />
      {o.grouped ? (
        <p className="so-grouped"><SOIcon name="layers" size={13} />Схожі пропозиції обʼєднано · {o.grouped}<button type="button">показати</button></p>
      ) : null}
    </div>
  );
}

/* ---------------- Panel bodies: empty · loading · error -------------------- */
function SOEmpty() {
  const { Button } = SO_DS;
  return (
    <div className="so-state" data-screen-label="Offers · empty">
      <span className="so-state__icon"><SOIcon name="search" size={20} /></span>
      <h3 className="so-state__title">Поки що немає пропозицій</h3>
      <p className="so-state__text">Ми не знайшли цю книгу в книгарнях, які перевіряємо. Knyhovo перевіряє ціни щодня о 08:00 — щойно вона зʼявиться, Книговик підкаже.</p>
      <div className="so-state__actions">
        <Button variant="secondary"><SOIcon name="bell" size={15} /> Стежити за наявністю</Button>
      </div>
    </div>
  );
}
function SOError({ onRetry }) {
  const { Button } = SO_DS;
  return (
    <div className="so-state" data-screen-label="Offers · error">
      <span className="so-state__icon"><SOIcon name="alert-circle" size={20} /></span>
      <h3 className="so-state__title">Не вдалося завантажити ціни</h3>
      <p className="so-state__text">Щось пішло не так під час перевірки книгарень. Решта сторінки доступна — спробуйте оновити ціни ще раз.</p>
      <div className="so-state__actions">
        <Button variant="secondary" onClick={onRetry}><SOIcon name="refresh" size={15} /> Спробувати ще раз</Button>
      </div>
    </div>
  );
}
function SOLoading() {
  const { Sk } = window.SO;
  return (
    <div className="so-sk-rows" aria-hidden="true" data-screen-label="Offers · loading">
      <div className="so-sk-best">
        <Sk w={88} h={20} r={999} />
        <Sk w={140} h={30} style={{ margin: '14px 0 10px' }} />
        <Sk w={170} h={13} style={{ marginBottom: 16 }} />
        <Sk w="100%" h={44} r={8} />
      </div>
      {[68, 60, 74, 56].map((w, i) => (
        <div className="so-sk-row" key={i}>
          <div><Sk w={w + '%'} h={15} style={{ marginBottom: 7 }} /><Sk w={Math.max(40, w - 18) + '%'} h={11} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}><Sk w={56} h={18} /><Sk w={74} h={30} r={8} /></div>
        </div>
      ))}
    </div>
  );
}
function SOSk({ w, h = 12, r = 6, style }) {
  return <span className="so-sk" style={{ width: w, height: h, borderRadius: r, ...style }}></span>;
}

/* ---------------- The panel ---------------- */
function SOPanel({ state, mobile, stagger }) {
  const s = window.SO.STATES[state];
  let body;
  if (s.kind === 'empty') body = <SOEmpty />;
  else if (s.kind === 'error') body = <SOError />;
  else if (s.kind === 'loading') body = <SOLoading />;
  else body = (
    <React.Fragment>
      <SOBest best={s.best} />
      <div className={stagger ? 'so-stagger' : ''}>
        {s.rows.map((o) => <SORow key={o.store} o={o} />)}
      </div>
      <p className="bd-updated">{s.footnote}</p>
    </React.Fragment>
  );
  return (
    <aside className={'bdc-panel so-panel' + (mobile ? ' so-panel--mobile' : '')} data-screen-label={'Offers · ' + state}>
      <p className="bd-eyebrow" style={{ marginBottom: 0 }}>{s.eyebrow}</p>
      {body}
    </aside>
  );
}

/* ---------------- Page chrome (reused frozen chassis) ---------------- */
function SOChromeDesktop({ theme, children }) {
  const { Button, ThemeToggle, SearchBar } = SO_DS;
  const logo = SO_ASSET + (theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png');
  const b = window.SO.BOOK;
  return (
    <div className="bd-page" data-theme={theme} data-screen-label={'Book Details · ' + theme}>
      <div className="bd-wrap">
        <header className="site-header">
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
        <div className="bd-topbar"><div className="bd-search"><SearchBar placeholder="Назва книги, автора або ISBN…" /></div></div>
        <p className="bd-crumbs">Каталог · Фентезі · <span>{b.title}</span></p>
        {children}
        <footer className="site-footer">
          <img className="footer-logo" src={logo} alt="Knyhovo" />
          <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
          <p className="footer-copy">© 2026 Knyhovo</p>
        </footer>
      </div>
    </div>
  );
}

window.SO = {
  DS: SO_DS, ASSET: SO_ASSET, uah: soUah, AVAIL: SO_AVAIL,
  Icon: SOIcon, Meta: SOMeta, Best: SOBest, Row: SORow,
  Empty: SOEmpty, Error: SOError, Loading: SOLoading, Sk: SOSk,
  Panel: SOPanel, ChromeDesktop: SOChromeDesktop,
  BOOK: {
    title: 'Відьмак. Останнє бажання',
    author: 'Анджей Сапковський',
    genreEyebrow: 'ФЕНТЕЗІ · СЕРІЯ «ВІДЬМАК» · КНИГА 1 ІЗ 8',
    desc: '«Останнє бажання» відкриває сагу про Ґеральта з Рівії — відьмака, мисливця на чудовиськ. Збірка оповідань знайомить із головними героями циклу та законами цього світу.',
  },
};
