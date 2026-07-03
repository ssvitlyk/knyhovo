// Knyhovo «Бажанки» (Wishlist) v1.0 — HYBRID DESIGN FREEZE (D + C) · Ревізія 2026-06-13.
// Supersedes previous Hybrid Freeze instructions.
// Desktop = Variant D (порадник, групування) · Mobile = Variant C accordion.
// Книговик = особистий порадник · Knyhovo = інструмент · Бажанки = основна сутність.
// Green hierarchy: зелений — виключно для позитивних подій.
// Depends on window.WL (wishlist-shared.jsx) and window.KnyhovoDesignSystem_9fa616.
// Exports to window.H2.

const H2_WL = window.WL;
const H2_DS = H2_WL.DS;

/* ── Verdicts — порада Книговика для кожної книги (frozen set) ──────────── */
const H2_VERDICTS = {
  now: { tone: 'green', label: 'Чудовий момент' },
  wait: { tone: 'neutral', label: 'Зачекайте' },
  high: { tone: 'blue', label: 'Ціна висока' },
  data: { tone: 'neutral', label: 'Збираємо дані' },
  out: { tone: 'neutral', label: 'Очікуємо наявності' },
};
function H2Verdict({ item }) {
  const { Badge } = H2_DS;
  const v = H2_VERDICTS[item.verdict] || H2_VERDICTS.wait;
  return <span className="wl-verdict"><Badge tone={v.tone}>{v.label}</Badge></span>;
}

/* Verdict reason — один чесний рядок доказу від Книговика. */
function h2Reason(item) {
  if (item.verdict === 'now') {
    return item.targetMet
      ? 'Ціна ' + H2_WL.uah(item.price) + ' — нижча за вашу ціль ' + H2_WL.uah(item.target)
      : 'Найнижча ціна за пів року спостережень';
  }
  if (item.verdict === 'high') return 'Ціна зросла на ' + Math.abs(H2_WL.delta(item)) + ' ₴ — такі сплески зазвичай минають';
  if (item.verdict === 'data') return 'Додано сьогодні · перший звіт про ціни — завтра о 08:00';
  if (item.verdict === 'out') return 'Немає в жодній із 5 книгарень · Книговик повідомить про появу';
  return 'Ціна стабільна · купувати не горить';
}

/* Групування mobile (Variant C foundation) */
function h2Groups(items) {
  return {
    discounted: items.filter(h2Opportunity),
    waiting: items.filter((i) => !h2Opportunity(i) && (i.verdict === 'wait' || i.verdict === 'high')),
    meeting: items.filter((i) => !h2Opportunity(i) && (i.verdict === 'data' || i.verdict === 'out')),
  };
}
const h2Moment = (i) => i.verdict === 'now';
const h2Savings = (i) => (H2_WL.delta(i) < 0 ? Math.abs(H2_WL.delta(i)) : 0);

/* Automatic promotion — без винятків (desktop і mobile):
   currentPrice < previousPrice · currentPrice ≤ targetPrice · lowestPriceInPeriod.
   Будь-яка книга зі знижкою автоматично піднімається у верхню секцію
   «Книги зі знижками». Користувач не шукає їх по списку.
   (У моках lowestPriceInPeriod кодується вердиктом 'now'.) */
function h2Opportunity(i) {
  return H2_WL.delta(i) < 0 || i.targetMet === true || i.verdict === 'now';
}

/* Desktop sections: 1. Hero · 2. Книги зі знижками · 3. Інші бажанки */
function h2DesktopGroups(items) {
  return {
    discounted: items.filter(h2Opportunity),
    rest: items.filter((i) => !h2Opportunity(i)),
  };
}

/* ── KnyhovoFooter — єдиний reusable footer (фіксовані spacing-токени).
   Один компонент на всі стани Бажанок — запобігає layout drift.
   Позиціонування ідентичне в усіх станах: bottom-anchored, однакові
   gutters і padding (керується .v1-shell-content + .v1-footer).        */
function KnyhovoFooter() {
  return (
    <footer className="v1-footer">
      <span className="v1-footer-brand">Knyhovo</span>
      <p className="v1-footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
      <p className="v1-footer-copy">© 2026 Knyhovo</p>
    </footer>
  );
}

/* ── H2Shell — production shell (header · search · crumbs · footer завжди) ─ */
function H2Shell({ theme, label, children, mobile }) {
  const { SearchBar } = H2_DS;
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
              <span style={{ pointerEvents: 'none' }}><H2_DS.ThemeToggle theme={theme} /></span>
            </div>
          </header>
          <div className="v1-mob-search">
            <SearchBar placeholder="Назва книги, автора або ISBN…" />
          </div>
          <p className="v1-crumbs"><a href="#">Головна</a> · <span>Бажанки</span></p>
          <div className="v1-shell-content">{children}</div>
          <KnyhovoFooter />
        </div>
      ) : (
        <div className="v1-wrap">
          <header className="v1-header">
            <img className="v1-logo" src={logo} alt="Knyhovo" />
            <nav className="v1-nav">
              <a href="#" className="v1-nav-link">Головна</a>
              <a href="#" className="v1-nav-link">Каталог</a>
              <a href="#" className="v1-nav-link">Знижки</a>
              <a href="#" className="v1-nav-link v1-nav-active">Бажанки</a>
            </nav>
            <div className="v1-header-right">
              <span style={{ pointerEvents: 'none' }}><H2_DS.ThemeToggle theme={theme} /></span>
              <H2_DS.Button variant="secondary" size="sm">Увійти</H2_DS.Button>
            </div>
          </header>
          <div className="v1-searchbar">
            <SearchBar placeholder="Назва книги, автора або ISBN…" />
          </div>
          <p className="v1-crumbs"><a href="#">Головна</a> · <span>Бажанки</span></p>
          <div className="v1-shell-content">{children}</div>
          <KnyhovoFooter />
        </div>
      )}
    </div>
  );
}

/* ── H2CtaPair — єдиний CTA-блок (порядок обов'язковий):
   1. «Деталі книги» — повноцінна secondary-кнопка (дослідження).
   2. «До книгарні» — primary (рішення → купівля).
   Для недоступних книг другий слот = «Повідомити мене» (secondary).
   Для книг без даних другий слот неактивний — позиція зберігається.        */
function H2CtaPair({ item, grow }) {
  const { Button } = H2_DS;
  const out = item.avail === 'out';
  const pending = item.avail === 'pending';
  const style = grow ? { flex: 1 } : null;
  return (
    <React.Fragment>
      <Button variant="secondary" size="sm" style={style}>Деталі книги</Button>
      {out
        ? <Button variant="secondary" size="sm" style={style}>Повідомити мене</Button>
        : <span style={{ ...(grow ? { flex: 1, display: 'flex' } : null), ...(pending ? { opacity: 0.45, pointerEvents: 'none' } : null) }}>
            <Button variant="primary" size="sm" style={grow ? { flex: 1 } : null}>До книгарні</Button>
          </span>}
    </React.Fragment>
  );
}

/* ── H2Row — desktop картка книги у бажанках (єдина сітка, повна ширина) ──
   cover → book info → recommendation/status → pricing → CTA → secondary actions.
   Однакова висота, однакові відступи, однакове положення CTA у всіх рядках. */
function H2Row({ item }) {
  const opp = h2Opportunity(item);
  const out = item.avail === 'out';
  const save = h2Savings(item);
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
        <H2Verdict item={item} />
        <span className="hy-reason">{h2Reason(item)}</span>
      </span>
      <span className="hy-pricecell">
        {opp && save > 0
          ? <span className="hy-savings">Економія {save} ₴</span>
          : <H2_WL.Delta item={item} />}
        <H2_WL.PriceStack item={item} big={opp} />
      </span>
      <span className="h2-ctas">
        <H2CtaPair item={item} />
      </span>
      <span className="v1-row-actions">
        <button className={'wl-iconbtn' + (item.tracking ? ' wl-iconbtn--on' : '')}
          title={item.tracking ? 'Вимкнути стеження' : 'Стежити'} type="button">
          <H2_WL.Icon name={item.tracking ? 'bell' : 'bell-off'} size={16} />
        </button>
        <button className="wl-iconbtn" title="Прибрати з бажанок" type="button">
          <H2_WL.Icon name="x" size={16} />
        </button>
      </span>
    </div>
  );
}

/* ── H2Letter — недільний лист від Книговика (Variant D, композиція frozen) ─ */
function H2Letter({ items, compact }) {
  const { Button } = H2_DS;
  const discounted = items.filter(h2Moment);
  const top = discounted[0];
  return (
    <div className={'hy-letter' + (compact ? ' hy-letter--compact' : '')} data-screen-label="Недільний лист">
      <p className="hy-letter__eyebrow">НЕДІЛЬНИЙ ЛИСТ · ЩОТИЖНЯ У ВАШІЙ СКРИНЬЦІ</p>
      <p className="hy-letter__text">
        {top
          ? <span>Цього тижня «{top.title.split('.')[0]}» нарешті подешевшав до <b className="hy-letter__price">{H2_WL.uah(top.price)}</b> — найнижча ціна за пів року. <em>Гарний момент.</em> Решта бажанок спокійно чекає свого.</span>
          : <span>Тихий тиждень: ціни на ваші бажанки стабільні. <em>Жодного приводу поспішати.</em> Я пильную далі — щодня о 08:00.</span>}
      </p>
      <p className="hy-letter__sig">— Книговик</p>
      <div className="hy-letter__actions">
        {discounted.length ? <Button variant="primary" size="sm">Переглянути знижки</Button> : null}
        <Button variant="secondary" size="sm">Налаштувати лист</Button>
      </div>
    </div>
  );
}

/* ── H2MobCard — мобільна картка-accordion (Variant C, закрита за замовчуванням)
   Collapsed: обкладинка · назва · автор · ціна · зміна · статус · CTA-ряд (для знижки).
   CTA завжди один ряд: [Деталі книги] [До книгарні] — порядок обов'язковий.
   Expanded: економія · стара ціна · книгарня · перевірка · ціль · сповіщення · дії. */
function H2MobCard({ item, defaultOpen }) {
  const { Badge } = H2_DS;
  const [open, setOpen] = React.useState(!!defaultOpen);
  const opp = h2Opportunity(item);
  const out = item.avail === 'out';
  const pending = item.avail === 'pending';
  const statusText = out ? 'Стежимо за появою' : pending ? 'Збираємо дані' : 'Перевірено сьогодні';
  return (
    <div className={'hy-mcard' + (opp ? ' hy-mcard--moment' : '') + (out ? ' hy-mcard--out' : '')}>
      <button className="hy-mcard-top" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="v1-mob-cover" aria-hidden="true"></span>
        <span className="hy-mcard-main">
          <span className="v1-mob-row-title">{item.title}</span>
          <span className="v1-mob-row-author">{item.author}</span>
          <span className="hy-mcard-status">
            {opp
              ? <Badge tone="green">Чудовий момент</Badge>
              : <span className="hy-mcard-quiet"><H2_WL.Icon name={out ? 'bell' : 'clock'} size={12} />{statusText}</span>}
          </span>
        </span>
        <span className="hy-mcard-right">
          {item.price != null
            ? <span className={'hy-mcard-price' + (opp ? ' hy-mcard-price--green' : '')}>{H2_WL.uah(item.price)}</span>
            : <span className="hy-mcard-price hy-mcard-price--faint">—</span>}
          {opp && h2Savings(item) > 0
            ? <span className="h2-msave">Економія {h2Savings(item)} ₴</span>
            : <H2_WL.Delta item={item} />}
        </span>
        <span className={'hy-mcard-chev' + (open ? ' hy-mcard-chev--open' : '')}>
          <H2_WL.Icon name="chevron-down" size={16} />
        </span>
      </button>
      {opp && !out && (
        <div className="hy-mcard-cta h2-mcta">
          <H2CtaPair item={item} grow />
        </div>
      )}
      {open && (
        <div className="hy-mcard-body">
          {h2Savings(item) > 0 && (
            <div className="hy-mcard-meta"><span>Економія</span><b className="hy-mcard-save">−{h2Savings(item)} ₴</b></div>
          )}
          {item.prev != null && item.prev !== item.price && (
            <div className="hy-mcard-meta"><span>Стара ціна</span><s>{H2_WL.uah(item.prev)}</s></div>
          )}
          {item.store && (
            <div className="hy-mcard-meta"><span>Книгарня</span><span>{item.store}</span></div>
          )}
          <div className="hy-mcard-meta"><span>Остання перевірка</span><span>сьогодні о 08:00</span></div>
          <div className="hy-mcard-meta">
            <span>Цільова ціна</span>
            {item.target
              ? <span className={item.targetMet ? 'hy-mcard-save' : ''}>≤ {H2_WL.uah(item.target)}{item.targetMet ? ' · досягнуто' : ''}</span>
              : <span className="hy-mcard-setlink">Встановити</span>}
          </div>
          <div className="hy-mcard-meta">
            <span>Сповіщення</span>
            <span>{item.alert ? 'Email · щодня о 08:00' : 'Вимкнено'}<button className="hy-mcard-edit" type="button">Змінити</button></span>
          </div>
          {!(opp && !out) && (
            <div className="h2-mcta" style={{ marginTop: 'var(--space-1)' }}>
              <H2CtaPair item={item} grow />
            </div>
          )}
          <div className="hy-mcard-actions">
            <button className={'wl-iconbtn' + (item.tracking ? ' wl-iconbtn--on' : '')} type="button"
              title={item.tracking ? 'Вимкнути стеження' : 'Стежити'}>
              <H2_WL.Icon name={item.tracking ? 'bell' : 'bell-off'} size={16} />
            </button>
            <button className="wl-iconbtn" title="Прибрати з бажанок" type="button">
              <H2_WL.Icon name="x" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── H2MobSummary — mobile-плашка: накопичена вигода за весь час ─────────── */
function H2MobSummary({ items }) {
  const discounted = items.filter(h2Opportunity);
  return (
    <React.Fragment>
      <div className="v1-mob-summary">
        <span className="v1-mob-summary-item hy-saveline">
          <H2_WL.Icon name="trending-down" size={13} />
          Заощаджено з Knyhovo: <b>412 ₴</b>
        </span>
        <span className="v1-mob-summary-sep"></span>
        <span className="v1-mob-summary-item">
          <H2_WL.Icon name="clock" size={12} />
          Перевірено о 08:00
        </span>
      </div>
      {discounted.length > 0 && (
        <p className="hy-mob-moments">
          <H2_WL.Icon name="trending-down" size={13} />
          {discounted.length === 1
            ? 'Сьогодні 1 книга зі знижкою'
            : 'Сьогодні ' + discounted.length + ' книги зі знижками'}
        </p>
      )}
    </React.Fragment>
  );
}

/* ── H2Mascot — затверджена сцена «у кріслі».
   ДОЗВОЛЕНО лише: empty · first-book. У стані «недоступна книга» Книговик
   ПОВНІСТЮ прибраний (ревізія 2026-06-13) — стан утилітарний.              */
function H2Mascot({ theme, copy, size = 'md', align = 'center' }) {
  const src = theme === 'dark'
    ? 'assets/mascot/mascot-reading-chair-dark-final.png'
    : 'assets/mascot/mascot-reading-chair-light-hybrid.png';
  const sizes = { sm: 160, md: 230, lg: 320 };
  const darkScale = theme === 'dark' ? 0.9723 : 1;
  const h = (sizes[size] || 230) * darkScale;
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
        transform: theme === 'dark' ? 'translateY(3%)' : 'none',
        WebkitMaskImage: MASK, maskImage: MASK,
        WebkitMaskComposite: 'source-in', maskComposite: 'intersect',
      }}>
        <img src={src} alt="Книговик у читацькому кріслі"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
      {copy ? <p className="v1-mascot-copy">{copy}</p> : null}
    </div>
  );
}

/* ── Skeletons — теплі warm-блоки (frozen правило) ───────────────────────── */
function H2SkRow() {
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
function H2SkCard() {
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

/* ── H2GroupHead — заголовок секції ──────────────────────────────────────── */
function H2GroupHead({ title, count, mobile, action }) {
  return (
    <div className={'hy-group-head' + (mobile ? ' hy-group-head--mob' : '')}>
      <h2 className="hy-group-title">{title}</h2>
      <span className="hy-group-count">{count}</span>
      {action || null}
    </div>
  );
}

window.H2 = {
  Shell: H2Shell,
  Row: H2Row,
  CtaPair: H2CtaPair,
  Letter: H2Letter,
  MobCard: H2MobCard,
  MobSummary: H2MobSummary,
  Mascot: H2Mascot,
  SkRow: H2SkRow,
  SkCard: H2SkCard,
  GroupHead: H2GroupHead,
  Verdict: H2Verdict,
  VERDICTS: H2_VERDICTS,
  reason: h2Reason,
  groups: h2Groups,
  desktopGroups: h2DesktopGroups,
  opportunity: h2Opportunity,
  moment: h2Moment,
  savings: h2Savings,
};
