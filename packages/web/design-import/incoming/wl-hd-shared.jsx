// Knyhovo Wishlist v1.0 — HYBRID DESIGN FREEZE (D + C).
// Desktop = Variant D «Момент» (primary direction).
// Mobile  = Variant C accordion architecture (mobile foundation) + D discount styling.
// Green hierarchy: зелений — виключно для позитивних подій; що сильніша вигода, тим більше зеленого.
// Depends on window.WL (wishlist-shared.jsx) and window.KnyhovoDesignSystem_9fa616.
// Exports to window.HY.

const HY_WL = window.WL;
const HY_DS = HY_WL.DS;

/* ── Verdicts — порада Knyhovyk-а для кожної книги (Variant D) ──────────── */
const HY_VERDICTS = {
  now: { tone: 'green', label: 'Чудовий момент' },
  wait: { tone: 'neutral', label: 'Зачекайте' },
  high: { tone: 'blue', label: 'Ціна висока' },
  data: { tone: 'neutral', label: 'Збираємо дані' },
  out: { tone: 'neutral', label: 'Очікуємо наявності' },
};
function HYVerdict({ item }) {
  const { Badge } = HY_DS;
  const v = HY_VERDICTS[item.verdict] || HY_VERDICTS.wait;
  return <span className="wl-verdict"><Badge tone={v.tone}>{v.label}</Badge></span>;
}

/* Verdict reason — один чесний рядок доказу. */
function hyReason(item) {
  if (item.verdict === 'now') {
    return item.targetMet
      ? 'Ціна ' + HY_WL.uah(item.price) + ' — нижча за вашу ціль ' + HY_WL.uah(item.target)
      : 'Найнижча ціна за пів року спостережень';
  }
  if (item.verdict === 'high') return 'Ціна зросла на ' + Math.abs(HY_WL.delta(item)) + ' ₴ — такі сплески зазвичай минають';
  if (item.verdict === 'data') return 'Додано сьогодні · перший звіт про ціни — завтра о 08:00';
  if (item.verdict === 'out') return 'Немає в жодній із 5 книгарень · повідомимо про появу';
  return 'Ціна стабільна · купувати не горить';
}

/* Групування за готовністю до купівлі (Variant D) */
function hyGroups(items) {
  return {
    ready: items.filter((i) => i.verdict === 'now'),
    waiting: items.filter((i) => i.verdict === 'wait' || i.verdict === 'high'),
    meeting: items.filter((i) => i.verdict === 'data' || i.verdict === 'out'),
  };
}
const hyMoment = (i) => i.verdict === 'now';
const hySavings = (i) => (HY_WL.delta(i) < 0 ? Math.abs(HY_WL.delta(i)) : 0);

/* Automatic promotion rules (desktop revised freeze) — без винятків:
   currentPrice < previousPrice · currentPrice ≤ targetPrice · lowestPriceInPeriod.
   Будь-яка книга, що відповідає хоча б одній умові, автоматично
   піднімається у верхню секцію «Вигідний момент настав».
   (У моках lowestPriceInPeriod кодується вердиктом 'now'.) */
const hyOpportunity = (i) =>
  HY_WL.delta(i) < 0 || i.targetMet === true || i.verdict === 'now';

/* Desktop sections: opportunities → remaining wishlist (no buying signals) */
function hyDesktopGroups(items) {
  return {
    opportunities: items.filter(hyOpportunity),
    rest: items.filter((i) => !hyOpportunity(i)),
  };
}

/* ── HYShell — production shell (header · search · crumbs · footer завжди) ─ */
function HYShell({ theme, label, children, mobile }) {
  const { SearchBar } = HY_DS;
  const logo = theme === 'dark'
    ? 'assets/logo/knyhovo-logo-dark.png'
    : 'assets/logo/knyhovo-logo-light.png';
  return (
    <div className={'v1-page' + (mobile ? ' v1-mobile' : '')} data-theme={theme} data-screen-label={label}>
      {mobile ? (
        <div className="v1-wrap">
          <header className="v1-mob-header">
            <img className="v1-mob-logo" src={logo} alt="Knyhovo" />
            <div className="v1-mob-actions">
              <span style={{ pointerEvents: 'none' }}><HY_DS.ThemeToggle theme={theme} /></span>
            </div>
          </header>
          <div className="v1-mob-search">
            <SearchBar placeholder="Назва книги, автора або ISBN…" />
          </div>
          <p className="v1-crumbs"><a href="#">Головна</a> · <span>Вішлист</span></p>
          {children}
          <footer className="v1-footer">
            <span className="v1-footer-brand">Knyhovo</span>
            <p className="v1-footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
            <p className="v1-footer-copy">© 2026 Knyhovo</p>
          </footer>
        </div>
      ) : (
        <div className="v1-wrap">
          <header className="v1-header">
            <img className="v1-logo" src={logo} alt="Knyhovo" />
            <nav className="v1-nav">
              <a href="#" className="v1-nav-link">Головна</a>
              <a href="#" className="v1-nav-link">Каталог</a>
              <a href="#" className="v1-nav-link">Знижки</a>
              <a href="#" className="v1-nav-link v1-nav-active">Вішлист</a>
            </nav>
            <div className="v1-header-right">
              <span style={{ pointerEvents: 'none' }}><HY_DS.ThemeToggle theme={theme} /></span>
              <HY_DS.Button variant="secondary" size="sm">Увійти</HY_DS.Button>
            </div>
          </header>
          <div className="v1-searchbar">
            <SearchBar placeholder="Назва книги, автора або ISBN…" />
          </div>
          <p className="v1-crumbs"><a href="#">Головна</a> · <span>Вішлист</span></p>
          {children}
          <footer className="v1-footer">
            <span className="v1-footer-brand">Knyhovo</span>
            <p className="v1-footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
            <p className="v1-footer-copy">© 2026 Knyhovo</p>
          </footer>
        </div>
      )}
    </div>
  );
}

/* ── HYRow — desktop full-width offer row (revised freeze) ─────────────────
   [Cover] [Metadata] [Status] [Price] [Primary CTA] [Secondary actions]
   На всю ширину контент-контейнера — жодних вузьких центрованих карток. */
function HYRow({ item, front }) {
  const { Button } = HY_DS;
  const opp = hyOpportunity(item);
  const out = item.avail === 'out';
  const pending = item.avail === 'pending';
  const save = hySavings(item);
  const cls = 'v1-row hy-row'
    + (opp ? ' hy-row--moment' : '')
    + (out ? ' v1-row--out' : '');
  return (
    <div className={cls}>
      <span className="v1-cover" aria-hidden="true"></span>
      <span className="v1-row-main">
        <span className="v1-row-title">{item.title}</span>
        <span className="v1-row-author">{item.author}</span>
      </span>
      <span className="hy-row-status">
        <HYVerdict item={item} />
        <span className="hy-reason">{hyReason(item)}</span>
      </span>
      <span className="hy-pricecell">
        {opp && save > 0
          ? <span className="hy-savings">Економія {save} ₴</span>
          : <HY_WL.Delta item={item} />}
        <HY_WL.PriceStack item={item} big={opp} />
      </span>
      <span className="v1-row-cta">
        {opp && !out
          ? <Button variant="primary" size="md">Перейти до книгарні</Button>
          : out
            ? <span className="v1-row-watch"><HY_WL.Icon name="bell" size={14} />Стежимо</span>
            : pending
              ? <span className="v1-row-watch"><HY_WL.Icon name="clock" size={14} />Збираємо</span>
              : <Button variant="secondary" size="sm">Переглянути</Button>}
      </span>
      <span className="v1-row-actions">
        <button className={'wl-iconbtn' + (item.tracking ? ' wl-iconbtn--on' : '')}
          title={item.tracking ? 'Вимкнути стеження' : 'Стежити'} type="button">
          <HY_WL.Icon name={item.tracking ? 'bell' : 'bell-off'} size={16} />
        </button>
        <button className="wl-iconbtn" title="Прибрати" type="button">
          <HY_WL.Icon name="x" size={16} />
        </button>
      </span>
    </div>
  );
}

/* ── HYLetter — щотижневий дайджест «Недільний лист» (Variant D) ─────────── */
function HYLetter({ items, compact }) {
  const { Button } = HY_DS;
  const ready = hyGroups(items).ready;
  const top = ready[0];
  return (
    <div className={'hy-letter' + (compact ? ' hy-letter--compact' : '')} data-screen-label="Недільний лист">
      <p className="hy-letter__eyebrow">НЕДІЛЬНИЙ ЛИСТ · ЩОТИЖНЯ У ВАШІЙ СКРИНЬЦІ</p>
      <p className="hy-letter__text">
        {top
          ? <span>Цього тижня «{top.title.split('.')[0]}» нарешті подешевшав до <b className="hy-letter__price">{HY_WL.uah(top.price)}</b> — найнижча ціна за пів року. <em>Гарний момент.</em> Решта полиці спокійно чекає свого.</span>
          : <span>Тихий тиждень: ціни на вашій полиці стабільні. <em>Жодного приводу поспішати.</em> Ми пильнуємо далі — щодня о 08:00.</span>}
      </p>
      <p className="hy-letter__sig">— Knyhovyk</p>
      <div className="hy-letter__actions">
        {ready.length ? <Button variant="primary" size="sm">Переглянути готові</Button> : null}
        <Button variant="secondary" size="sm">Налаштувати лист</Button>
      </div>
    </div>
  );
}

/* ── HYMobCard — мобільна картка-accordion (Variant C) + D discount styling ─
   Collapsed: обкладинка · назва · автор · ціна · зміна · статус · CTA (для моменту).
   Expanded: цільова ціна · остання перевірка · книгарня · стара ціна ·
             сповіщення · додаткові дії. За замовчуванням — закрита.            */
function HYMobCard({ item, defaultOpen }) {
  const { Button, Badge } = HY_DS;
  const [open, setOpen] = React.useState(!!defaultOpen);
  const moment = hyMoment(item);
  const out = item.avail === 'out';
  const pending = item.avail === 'pending';
  const statusText = out ? 'Стежимо за появою' : pending ? 'Збираємо дані' : 'Перевірено сьогодні';
  return (
    <div className={'hy-mcard' + (moment ? ' hy-mcard--moment' : '') + (out ? ' hy-mcard--out' : '')}>
      <button className="hy-mcard-top" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="v1-mob-cover" aria-hidden="true"></span>
        <span className="hy-mcard-main">
          <span className="v1-mob-row-title">{item.title}</span>
          <span className="v1-mob-row-author">{item.author}</span>
          <span className="hy-mcard-status">
            {moment
              ? <Badge tone="green">Чудовий момент</Badge>
              : <span className="hy-mcard-quiet"><HY_WL.Icon name={out ? 'bell' : 'clock'} size={12} />{statusText}</span>}
          </span>
        </span>
        <span className="hy-mcard-right">
          {item.price != null
            ? <span className={'hy-mcard-price' + (moment ? ' hy-mcard-price--green' : '')}>{HY_WL.uah(item.price)}</span>
            : <span className="hy-mcard-price hy-mcard-price--faint">—</span>}
          <HY_WL.Delta item={item} />
        </span>
        <span className={'hy-mcard-chev' + (open ? ' hy-mcard-chev--open' : '')}>
          <HY_WL.Icon name="chevron-down" size={16} />
        </span>
      </button>
      {moment && !out && (
        <div className="hy-mcard-cta">
          <Button variant="primary" size="sm" style={{ width: '100%' }}>До книгарні</Button>
        </div>
      )}
      {open && (
        <div className="hy-mcard-body">
          {hySavings(item) > 0 && (
            <div className="hy-mcard-meta"><span>Економія</span><b className="hy-mcard-save">−{hySavings(item)} ₴</b></div>
          )}
          {item.prev != null && item.prev !== item.price && (
            <div className="hy-mcard-meta"><span>Стара ціна</span><s>{HY_WL.uah(item.prev)}</s></div>
          )}
          {item.store && (
            <div className="hy-mcard-meta"><span>Книгарня</span><span>{item.store}</span></div>
          )}
          <div className="hy-mcard-meta"><span>Остання перевірка</span><span>сьогодні о 08:00</span></div>
          <div className="hy-mcard-meta">
            <span>Цільова ціна</span>
            {item.target
              ? <span className={item.targetMet ? 'hy-mcard-save' : ''}>≤ {HY_WL.uah(item.target)}{item.targetMet ? ' · досягнуто' : ''}</span>
              : <span className="hy-mcard-setlink">Встановити</span>}
          </div>
          <div className="hy-mcard-meta">
            <span>Сповіщення</span>
            <span>{item.alert ? 'Email · щодня о 08:00' : 'Вимкнено'}<button className="hy-mcard-edit" type="button">Змінити</button></span>
          </div>
          <div className="hy-mcard-actions">
            <Button variant="ghost" size="sm">Деталі книги</Button>
            {!moment && !out && !pending && (
              <Button variant="secondary" size="sm">До книгарні</Button>
            )}
            <span style={{ flex: 1 }}></span>
            <button className={'wl-iconbtn' + (item.tracking ? ' wl-iconbtn--on' : '')} type="button"
              title={item.tracking ? 'Вимкнути стеження' : 'Стежити'}>
              <HY_WL.Icon name={item.tracking ? 'bell' : 'bell-off'} size={16} />
            </button>
            <button className="wl-iconbtn" title="Прибрати" type="button">
              <HY_WL.Icon name="x" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── HYMobSummary — компактна mobile-плашка: заощадження (зелене) + перевірка ─ */
function HYMobSummary({ items }) {
  const moments = items.filter(hyMoment);
  return (
    <React.Fragment>
      <div className="v1-mob-summary">
        <span className="v1-mob-summary-item hy-saveline">
          <HY_WL.Icon name="trending-down" size={13} />
          <b>412 ₴</b> заощаджено
        </span>
        <span className="v1-mob-summary-sep"></span>
        <span className="v1-mob-summary-item">
          <HY_WL.Icon name="clock" size={12} />
          Перевірено сьогодні о 08:00
        </span>
      </div>
      {moments.length > 0 && (
        <p className="hy-mob-moments">
          <HY_WL.Icon name="trending-down" size={13} />
          {moments.length === 1 ? '1 книга дочекалась свого моменту' : moments.length + ' книги дочекались свого моменту'}
        </p>
      )}
    </React.Fragment>
  );
}

/* ── HYMascot — контекстне розміщення затвердженої сцени «у кріслі» ──────── */
function HYMascot({ theme, copy, size = 'md', align = 'center' }) {
  const src = theme === 'dark'
    ? 'assets/mascot/mascot-reading-chair-dark-final.png'
    : 'assets/mascot/mascot-reading-chair-light-hybrid.png';
  const sizes = { sm: 160, md: 230, lg: 320 };
  const darkScale = theme === 'dark' ? 0.89 : 1;
  const h = (sizes[size] || 230) * darkScale;
  /* Градієнт-маска: фон ілюстрації органічно зливається з --bg сторінки.
     Світла тема (новий рендер) — м'якший, довший розчин країв. */
  const MASK = theme === 'dark'
    ? [
      'linear-gradient(to bottom, black 82%, transparent 100%)',
      'linear-gradient(to top,    black 86%, transparent 100%)',
      'linear-gradient(to right,  transparent 0%, black 8%)',
      'linear-gradient(to left,   transparent 0%, black 8%)',
    ].join(', ')
    : [
      'linear-gradient(to bottom, black 72%, transparent 99%)',
      'linear-gradient(to top,    black 80%, transparent 99%)',
      'linear-gradient(to right,  transparent 0%, black 14%)',
      'linear-gradient(to left,   transparent 0%, black 14%)',
    ].join(', ');
  return (
    <div className="v1-mascot-wrap" style={{ textAlign: align }}>
      <div style={{
        display: 'inline-block', overflow: 'hidden',
        width: h * (680 / 440), height: h,
        WebkitMaskImage: MASK, maskImage: MASK,
        WebkitMaskComposite: 'source-in', maskComposite: 'intersect',
      }}>
        <img src={src} alt="Knyhovyk у читацькому кріслі"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      {copy ? <p className="v1-mascot-copy">{copy}</p> : null}
    </div>
  );
}

/* ── Skeletons — теплі warm-блоки (frozen правило) ───────────────────────── */
function HYSkRow() {
  return (
    <div className="v1-row v1-sk-row">
      <span className="v1-cover v1-sk-block"></span>
      <span className="v1-row-main">
        <span className="v1-sk-block" style={{ width: '60%', height: 16 }}></span>
        <span className="v1-sk-block" style={{ width: '35%', height: 12, marginTop: 6 }}></span>
        <span className="v1-sk-block" style={{ width: '45%', height: 12, marginTop: 4 }}></span>
      </span>
      <span className="v1-sk-block" style={{ width: 60, height: 36 }}></span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span className="v1-sk-block" style={{ width: 80, height: 28 }}></span>
        <span className="v1-sk-block" style={{ width: 55, height: 12 }}></span>
      </span>
    </div>
  );
}
function HYSkCard() {
  return (
    <div className="hy-mcard" style={{ minHeight: 96 }}>
      <div className="hy-mcard-top" style={{ cursor: 'default' }}>
        <span className="v1-mob-cover v1-sk-block"></span>
        <span className="hy-mcard-main">
          <span className="v1-sk-block" style={{ width: '70%', height: 14 }}></span>
          <span className="v1-sk-block" style={{ width: '45%', height: 11, marginTop: 5 }}></span>
          <span className="v1-sk-block" style={{ width: '55%', height: 11, marginTop: 5 }}></span>
        </span>
        <span className="hy-mcard-right">
          <span className="v1-sk-block" style={{ width: 64, height: 22 }}></span>
          <span className="v1-sk-block" style={{ width: 44, height: 11 }}></span>
        </span>
      </div>
    </div>
  );
}

/* ── HYGroupHead — заголовок групи за готовністю ─────────────────────────── */
function HYGroupHead({ title, count, mobile, action }) {
  return (
    <div className={'hy-group-head' + (mobile ? ' hy-group-head--mob' : '')}>
      <h2 className="hy-group-title">{title}</h2>
      <span className="hy-group-count">{count}</span>
      {action || null}
    </div>
  );
}

window.HY = {
  Shell: HYShell,
  Row: HYRow,
  Letter: HYLetter,
  MobCard: HYMobCard,
  MobSummary: HYMobSummary,
  Mascot: HYMascot,
  SkRow: HYSkRow,
  SkCard: HYSkCard,
  GroupHead: HYGroupHead,
  Verdict: HYVerdict,
  VERDICTS: HY_VERDICTS,
  reason: hyReason,
  groups: hyGroups,
  desktopGroups: hyDesktopGroups,
  opportunity: hyOpportunity,
  moment: hyMoment,
  savings: hySavings,
};
