// Knyhovo Wishlist v1.0 — Final Design Freeze. Approved for implementation.
// Depends on window.WL (wishlist-shared.jsx) and window.KnyhovoDesignSystem_9fa616.
// Exports to window.V1.

const V1_WL = window.WL;
const V1_DS = V1_WL.DS;

/* «Вигідний момент» — ціна на історичному мінімумі або суттєво нижче середньої.
   Тон: оптимістичний, ніколи терміновий. Макс. один badge на рядок (frozen ієрархія). */
const fzGoodMoment = (i) => V1_WL.delta(i) < 0 && i.verdict === 'now';

/* ─────────────────── V1Shell — production shell (no exploration banner) ─── */
function V1Shell({ theme, label, children, mobile }) {
  const { SearchBar } = V1_DS;
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
              <span style={{ pointerEvents: 'none' }}><V1_DS.ThemeToggle theme={theme} /></span>
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
              <span style={{ pointerEvents: 'none' }}><V1_DS.ThemeToggle theme={theme} /></span>
              <V1_DS.Button variant="secondary" size="sm">Увійти</V1_DS.Button>
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

/* ─────────────────── V1Row — enhanced list row with CTA ────────────────── */
function V1Row({ item, compact }) {
  const { Button, Badge } = V1_DS;
  const moment = fzGoodMoment(item);
  const hot = item.targetMet || moment;
  const out = item.avail === 'out';
  const pending = item.avail === 'pending';
  const cls = 'v1-row'
    + (hot ? ' v1-row--hot' : '')
    + (out ? ' v1-row--out' : '')
    + (pending ? ' v1-row--dim' : '');
  return (
    <div className={cls}>
      <span className="v1-cover" aria-hidden="true"></span>
      <span className="v1-row-main">
        <span className="v1-row-title">{item.title}</span>
        <span className="v1-row-author">{item.author}</span>
        <span className="v1-row-meta">
          {moment ? <Badge tone="green">Вигідний момент</Badge> : <V1_WL.ItemBadge item={item} />}
          <V1_WL.Status item={item} checked />
        </span>
        {item.target && !compact ? <V1_WL.Target item={item} /> : null}
      </span>
      {!compact ? <V1_WL.Delta item={item} showZero /> : null}
      <V1_WL.PriceStack item={item} />
      <span className="v1-row-cta">
        {hot
          ? <Button variant="primary" size="sm">Перейти до книгарні</Button>
          : out
            ? <span className="v1-row-watch"><V1_WL.Icon name="bell" size={14} />Стежимо</span>
            : pending
              ? <span className="v1-row-watch"><V1_WL.Icon name="clock" size={14} />Збираємо</span>
              : <Button variant="secondary" size="sm">Переглянути</Button>
        }
      </span>
      <span className="v1-row-actions">
        <button className={'wl-iconbtn' + (item.tracking ? ' wl-iconbtn--on' : '')}
          title={item.tracking ? 'Вимкнути стеження' : 'Стежити'} type="button">
          <V1_WL.Icon name={item.tracking ? 'bell' : 'bell-off'} size={16} />
        </button>
        <button className="wl-iconbtn" title="Прибрати" type="button">
          <V1_WL.Icon name="x" size={16} />
        </button>
      </span>
    </div>
  );
}

/* ─────────────────── V1Panel — Monitoring panel (desktop right column) ──── */
function V1Panel({ items }) {
  const drops = V1_WL.drops(items);
  const fired = V1_WL.fired(items);
  const tracked = items.filter((i) => i.tracking);
  const digest = drops[0];
  return (
    <aside className="v1-panel" aria-label="Моніторинг">
      {/* 1. Savings counter */}
      <div className="v1-psect">
        <p className="v1-plabel">ЗАОЩАДЖЕНО З KNYHOVO</p>
        <p className="v1-savings-amt">412 ₴</p>
        <p className="v1-savings-sub">за весь час · {fired.length} цілі досягнуто</p>
      </div>

      <div className="v1-pdiv"></div>

      {/* 2. Last check */}
      <div className="v1-pcheck">
        <V1_WL.Icon name="clock" size={14} />
        <span>Остання перевірка: <b>сьогодні о 08:00</b></span>
      </div>

      {/* 3. Weekly digest */}
      {digest ? (
        <div className="v1-pdigest">
          <p className="v1-plabel">ДАЙДЖЕСТ ТИЖНЯ</p>
          <p className="v1-pdigest-body">
            «{digest.title}» впав до <b className="v1-pdigest-price">{V1_WL.uah(digest.price)}</b> — найнижча ціна за останні 3 місяці.
          </p>
          <a href="#" className="v1-pdigest-link">Перейти до книги</a>
        </div>
      ) : (
        <div className="v1-pdigest">
          <p className="v1-plabel">ДАЙДЖЕСТ ТИЖНЯ</p>
          <p className="v1-pdigest-body" style={{ color: 'var(--text-muted)' }}>
            Цього тижня цін без суттєвих змін. Knyhovo стежить щодня.
          </p>
        </div>
      )}

      <div className="v1-pdiv"></div>

      {/* 4. Tracking stats */}
      <div className="v1-pstats">
        <div className="v1-pstat">
          <span className="v1-pstat-n">{tracked.length}</span>
          <span className="v1-pstat-l">СТЕЖИМО</span>
        </div>
        <div className="v1-pstat">
          <span className={'v1-pstat-n' + (drops.length ? ' v1-pstat-n--accent' : '')}>{drops.length}</span>
          <span className="v1-pstat-l">ЗНИЖОК</span>
        </div>
        <div className="v1-pstat">
          <span className={'v1-pstat-n' + (fired.length ? ' v1-pstat-n--green' : '')}>{fired.length}</span>
          <span className="v1-pstat-l">ЦІЛЕЙ</span>
        </div>
      </div>

      <div className="v1-pdiv"></div>

      {/* 5. Notification settings */}
      <div className="v1-pnotif">
        <V1_WL.Icon name="bell" size={14} />
        <span>Email-сповіщення · щодня о 08:00</span>
        <button className="v1-pnotif-edit" type="button">Змінити</button>
      </div>
    </aside>
  );
}

/* ─────────────────── V1MobilePanel — assistant-style vertical stack ─────── */
function V1MobilePanel({ items }) {
  const drops = V1_WL.drops(items);
  const tracked = items.filter((i) => i.tracking);
  const alerts = items.filter((i) => i.alert);
  const moments = items.filter(fzGoodMoment);
  const digest = drops[0];
  return (
    <div className="fz-assist" aria-label="Моніторинг">
      <div className="fz-assist-row fz-assist-row--lead">
        <V1_WL.Icon name="trending-down" size={15} />
        <span>Заощаджено з Knyhovo</span>
        <b className="fz-assist-amt">412 ₴</b>
      </div>
      <div className="fz-assist-row">
        <V1_WL.Icon name="clock" size={14} />
        <span>Перевірено сьогодні о 08:00</span>
      </div>
      <div className="fz-assist-row">
        <V1_WL.Icon name="bookmark" size={14} />
        <span>{tracked.length} книг під наглядом</span>
      </div>
      <div className="fz-assist-row">
        <V1_WL.Icon name="bell" size={14} />
        <span>{alerts.length} активні сповіщення</span>
      </div>
      {moments.length > 0 && (
        <div className="fz-assist-row fz-assist-row--moment">
          <V1_WL.Icon name="trending-down" size={14} />
          <span>{moments.length === 1 ? '1 вигідний момент' : moments.length + ' вигідні моменти'}</span>
        </div>
      )}
      {digest && (
        <p className="fz-assist-digest">
          «{digest.title}» впав до <b>{V1_WL.uah(digest.price)}</b> — найнижча ціна за останні 3 місяці.
        </p>
      )}
    </div>
  );
}

/* ─────────────────── FzMobCard — compact expandable mobile card ────────── */
function FzMobCard({ item }) {
  const { Button, Badge } = V1_DS;
  const [open, setOpen] = React.useState(false);
  const moment = fzGoodMoment(item);
  const hot = item.targetMet || moment;
  const out = item.avail === 'out';
  const pending = item.avail === 'pending';
  const statusText = out ? 'Стежимо' : pending ? 'Збираємо дані' : 'Перевірено сьогодні';
  return (
    <div className={'fz-mcard' + (hot ? ' fz-mcard--hot' : '') + (out ? ' fz-mcard--out' : '')}>
      <button className="fz-mcard-top" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="v1-mob-cover" aria-hidden="true"></span>
        <span className="fz-mcard-main">
          <span className="v1-mob-row-title">{item.title}</span>
          <span className="v1-mob-row-author">{item.author}</span>
          <span className="fz-mcard-status">
            {moment
              ? <Badge tone="green">Вигідний момент</Badge>
              : <span className="fz-mcard-quiet"><V1_WL.Icon name={out ? 'bell' : 'clock'} size={12} />{statusText}</span>}
          </span>
        </span>
        <span className="fz-mcard-right">
          {item.price != null
            ? <span className="fz-mcard-price">{V1_WL.uah(item.price)}</span>
            : <span className="fz-mcard-price fz-mcard-price--faint">—</span>}
          <V1_WL.Delta item={item} />
        </span>
        <span className={'fz-mcard-chev' + (open ? ' fz-mcard-chev--open' : '')}>
          <V1_WL.Icon name="chevron-down" size={16} />
        </span>
      </button>
      {hot && !out && (
        <div className="fz-mcard-cta">
          <Button variant="primary" size="sm" style={{ width: '100%' }}>Перейти до книгарні</Button>
        </div>
      )}
      {open && (
        <div className="fz-mcard-body">
          {item.prev != null && item.prev !== item.price && (
            <div className="fz-mcard-meta"><span>Стара ціна</span><s>{V1_WL.uah(item.prev)}</s></div>
          )}
          {item.store && (
            <div className="fz-mcard-meta"><span>Книгарня</span><span>{item.store}</span></div>
          )}
          <div className="fz-mcard-meta"><span>Сповіщення</span><span>{item.alert ? 'Email · щодня о 08:00' : 'Вимкнено'}</span></div>
          {item.target && (
            <div className="fz-mcard-meta"><span>Цільова ціна</span><span>≤ {V1_WL.uah(item.target)}</span></div>
          )}
          <div className="fz-mcard-actions">
            <button className={'wl-iconbtn' + (item.tracking ? ' wl-iconbtn--on' : '')} type="button"
              title={item.tracking ? 'Вимкнути стеження' : 'Стежити'}>
              <V1_WL.Icon name={item.tracking ? 'bell' : 'bell-off'} size={16} />
            </button>
            <button className="wl-iconbtn" title="Прибрати" type="button">
              <V1_WL.Icon name="x" size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── V1Mascot — contextual mascot placement ─────────────── */
function V1Mascot({ theme, copy, size = 'md', align = 'center' }) {
  const src = theme === 'dark'
    ? 'assets/mascot/mascot-reading-chair-dark-final.png'
    : 'assets/mascot/mascot-reading-chair-light-final.png';
  const sizes = { sm: 160, md: 230, lg: 320 };
  // Light theme is the reference footprint. The dark composition is illustrated
  // ~11% larger inside the identical 1536×1024 canvas, so we scale the dark block
  // down to match light's visual area in the hero zone. Internal proportions,
  // pose, eyes, blanket and chair geometry are untouched — only group scale.
  const darkScale = theme === 'dark' ? 0.89 : 1;
  const h = (sizes[size] || 230) * darkScale;
  const MASK = [
    'linear-gradient(to bottom, black 82%, transparent 100%)',
    'linear-gradient(to top,    black 86%, transparent 100%)',
    'linear-gradient(to right,  transparent 0%, black 8%)',
    'linear-gradient(to left,   transparent 0%, black 8%)',
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

/* ─────────────────── V1SortBar — filter + sort controls ─────────────────── */
function V1SortBar({ items }) {
  const { Chip } = V1_DS;
  const drops = V1_WL.drops(items);
  return (
    <div className="v1-sortbar">
      <div className="v1-sortchips">
        <Chip selected>Всі книги</Chip>
        <Chip>Знижки {drops.length ? '(' + drops.length + ')' : ''}</Chip>
        <Chip>Стежу</Chip>
        <Chip>Ціль встановлена</Chip>
      </div>
      <div className="v1-sortright">
        <V1_WL.Icon name="sliders" size={15} />
        <span className="v1-sort-label">За зміною ціни</span>
      </div>
    </div>
  );
}

/* ─────────────────── V1Skeleton — warm skeleton blocks ──────────────────── */
function V1SkRow() {
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

function V1SkPanel() {
  return (
    <aside className="v1-panel">
      {[90, 60, 100, 44, 60].map((w, i) => (
        <span key={i} className="v1-sk-block" style={{ width: w + '%', height: i === 2 ? 72 : 20 }}></span>
      ))}
    </aside>
  );
}

window.V1 = {
  Shell: V1Shell,
  Row: V1Row,
  Panel: V1Panel,
  MobilePanel: V1MobilePanel,
  MobCard: FzMobCard,
  Mascot: V1Mascot,
  SortBar: V1SortBar,
  SkRow: V1SkRow,
  SkPanel: V1SkPanel,
  goodMoment: fzGoodMoment,
};
