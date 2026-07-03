// Knyhovo · Price History extension (W3) — VERDICTS v2 + savings + wishlist
// row/card compositions (verdicts & discounts in context).
// Depends on window.PHData + window.KnyhovoDesignSystem_9fa616. Exports window.PHV.
'use strict';

const PV = window.PHData;
const PV_DS = window.KnyhovoDesignSystem_9fa616;

/* ── Verdict badge — icon + label (colorblind-safe: shape + text + colour) ─ */
function VerdictBadge({ verdict, size = 13 }) {
  const v = PV.VERDICTS[verdict] || PV.VERDICTS.wait;
  return (
    <span className={'phv-badge phv-badge--' + v.tone}>
      <PV.Icon name={v.icon} size={size} />{v.label}
    </span>
  );
}

/* Reason line — the historical-context sentence (Knyhovyk voice) */
function VerdictReason({ verdict }) {
  const v = PV.VERDICTS[verdict] || PV.VERDICTS.wait;
  return <span className={'phv-reason' + (verdict === 'now' ? ' phv-reason--green' : '')}>{v.text}</span>;
}

/* Large anatomy block (spec / documentation) */
function VerdictBlock({ verdict }) {
  const v = PV.VERDICTS[verdict] || PV.VERDICTS.wait;
  return (
    <div className={'phv-block' + (verdict === 'now' ? ' phv-block--green' : '')} data-screen-label={'Verdict · ' + v.en}>
      <div className={'phv-block__icon phv-block__icon--' + v.tone}><PV.Icon name={v.icon} size={22} /></div>
      <div className="phv-block__body">
        <div className="phv-block__head">
          <span className="phv-block__title">{v.title}</span>
        </div>
        <p className="phv-block__text">{v.text}</p>
        <p className="phv-block__tone" style={{ marginTop: 'var(--space-2)' }}>{v.en} · {v.toneNote}</p>
      </div>
    </div>
  );
}

/* ── Savings visualization (old → current → saved) ───────────────────────── */
function SavingsStack({ item, align }) {
  const saved = PV.saved(item);
  return (
    <span className={'phv-savings' + (align === 'left' ? ' phv-savings--left' : '')}>
      {item.old > item.price ? <span className="phv-savings__old">{PV.uah(item.old)}</span> : null}
      <span className="phv-savings__now phv-savings__now--good">{PV.uah(item.price)}</span>
      {saved > 0 ? <span className="phv-savings__saved">Економія {saved} ₴</span> : null}
    </span>
  );
}

/* Ordinary (non-discount) price cell — stable / risen */
function PriceCell({ item }) {
  const d = PV.delta(item);
  return (
    <span className="wl-pricestack">
      {d > 0
        ? <span className="wl-delta wl-delta--up"><PV.Icon name="trending-up" size={14} />+{d} ₴</span>
        : null}
      <span className="wl-pricerow"><span className="wl-price">{PV.uah(item.price)}</span></span>
      <span className="wl-store">{item.store}</span>
    </span>
  );
}

/* ── CTA pair (frozen order: Деталі книги → До книгарні) ──────────────────── */
function CtaPair({ grow }) {
  const { Button } = PV_DS;
  const style = grow ? { flex: 1 } : null;
  return (
    <React.Fragment>
      <Button variant="secondary" size="sm" style={style}>Деталі книги</Button>
      <Button variant="primary" size="sm" style={style}>До книгарні</Button>
    </React.Fragment>
  );
}

/* ── Desktop wishlist row (frozen v1-row grid — verdict + savings in place) ─ */
function WLRow({ item }) {
  const now = item.verdict === 'now';
  return (
    <div className={'v1-row' + (now ? ' hy-row--moment' : '')}>
      <span className="v1-cover" aria-hidden="true"></span>
      <span className="v1-row-main">
        <span className="v1-row-title">{item.title}</span>
        <span className="v1-row-author">{item.author}</span>
      </span>
      <span className="hy-row-status">
        <VerdictBadge verdict={item.verdict} />
        <VerdictReason verdict={item.verdict} />
      </span>
      <span className="hy-pricecell">
        {now ? <SavingsStack item={item} /> : <PriceCell item={item} />}
      </span>
      <span className="h2-ctas"><CtaPair /></span>
      <span className="v1-row-actions">
        <button className={'wl-iconbtn' + (item.tracking ? ' wl-iconbtn--on' : '')} type="button"
          title={item.tracking ? 'Вимкнути стеження' : 'Стежити'}>
          <PV.Icon name={item.tracking ? 'bell' : 'bell-off'} size={16} />
        </button>
        <button className="wl-iconbtn" type="button" title="Прибрати з бажанок"><PV.Icon name="x" size={16} /></button>
      </span>
    </div>
  );
}

/* ── Mobile wishlist accordion card ──────────────────────────────────────── */
function WLMobCard({ item, defaultOpen }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  const now = item.verdict === 'now';
  const saved = PV.saved(item);
  const d = PV.delta(item);
  return (
    <div className={'hy-mcard' + (now ? ' hy-mcard--moment' : '')}>
      <button className="hy-mcard-top" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="v1-mob-cover" aria-hidden="true"></span>
        <span className="hy-mcard-main">
          <span className="v1-mob-row-title">{item.title}</span>
          <span className="v1-mob-row-author">{item.author}</span>
          <span className="hy-mcard-status"><VerdictBadge verdict={item.verdict} size={12} /></span>
        </span>
        <span className="hy-mcard-right">
          <span className={'hy-mcard-price' + (now ? ' hy-mcard-price--green' : '')}>{PV.uah(item.price)}</span>
          {now && saved > 0
            ? <span className="h2-msave">Економія {saved} ₴</span>
            : d > 0
              ? <span className="wl-delta wl-delta--up"><PV.Icon name="trending-up" size={12} />+{d} ₴</span>
              : null}
        </span>
        <span className={'hy-mcard-chev' + (open ? ' hy-mcard-chev--open' : '')}><PV.Icon name="chevron-down" size={16} /></span>
      </button>
      {now && (
        <div className="hy-mcard-cta h2-mcta"><CtaPair grow /></div>
      )}
      {open && (
        <div className="hy-mcard-body">
          <div className="hy-mcard-meta"><span>Порада Книговика</span><span style={{ textAlign: 'right', maxWidth: '62%' }}>{PV.VERDICTS[item.verdict].text}</span></div>
          {saved > 0 && <div className="hy-mcard-meta"><span>Економія</span><b className="hy-mcard-save">−{saved} ₴</b></div>}
          {item.old > item.price && <div className="hy-mcard-meta"><span>Стара ціна</span><s>{PV.uah(item.old)}</s></div>}
          <div className="hy-mcard-meta"><span>Книгарня</span><span>{item.store}</span></div>
          <div className="hy-mcard-meta"><span>Остання перевірка</span><span>сьогодні о 08:00</span></div>
          {!now && (
            <div className="h2-mcta" style={{ marginTop: 'var(--space-1)' }}><CtaPair grow /></div>
          )}
          <div className="hy-mcard-actions">
            <button className={'wl-iconbtn' + (item.tracking ? ' wl-iconbtn--on' : '')} type="button"
              title={item.tracking ? 'Вимкнути стеження' : 'Стежити'}><PV.Icon name={item.tracking ? 'bell' : 'bell-off'} size={16} /></button>
            <button className="wl-iconbtn" type="button" title="Прибрати з бажанок"><PV.Icon name="x" size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Skeleton row (warm — frozen rule) ───────────────────────────────────── */
function WLSkRow() {
  return (
    <div className="v1-row v1-sk-row">
      <span className="v1-cover v1-sk-block"></span>
      <span className="v1-row-main">
        <span className="v1-sk-block" style={{ width: '60%', height: 16 }}></span>
        <span className="v1-sk-block" style={{ width: '35%', height: 12, marginTop: 6 }}></span>
        <span className="v1-sk-block" style={{ width: '46%', height: 12, marginTop: 4 }}></span>
      </span>
      <span className="v1-sk-block" style={{ width: 120, height: 22, borderRadius: 999 }}></span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span className="v1-sk-block" style={{ width: 64, height: 14 }}></span>
        <span className="v1-sk-block" style={{ width: 86, height: 26 }}></span>
        <span className="v1-sk-block" style={{ width: 70, height: 14 }}></span>
      </span>
      <span className="v1-sk-block" style={{ width: 60, height: 12 }}></span>
    </div>
  );
}
function WLSkCard() {
  return (
    <div className="hy-mcard" style={{ minHeight: 92 }}>
      <div className="hy-mcard-top" style={{ cursor: 'default' }}>
        <span className="v1-mob-cover v1-sk-block"></span>
        <span className="hy-mcard-main">
          <span className="v1-sk-block" style={{ width: '70%', height: 14 }}></span>
          <span className="v1-sk-block" style={{ width: '45%', height: 11, marginTop: 5 }}></span>
          <span className="v1-sk-block" style={{ width: 96, height: 18, marginTop: 7, borderRadius: 999 }}></span>
        </span>
        <span className="hy-mcard-right">
          <span className="v1-sk-block" style={{ width: 64, height: 22 }}></span>
          <span className="v1-sk-block" style={{ width: 56, height: 11, marginTop: 4 }}></span>
        </span>
      </div>
    </div>
  );
}

/* ── Page chrome (frozen wishlist shell) ─────────────────────────────────── */
const PV_ASSET = '../../';
function WLShell({ theme, label, mobile, children }) {
  const { SearchBar, ThemeToggle, Button } = PV_DS;
  const logo = PV_ASSET + (theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png');
  return (
    <div className={'v1-page' + (mobile ? ' v1-mobile' : '')} data-theme={theme} data-screen-label={label}>
      <div className="v1-wrap">
        {mobile ? (
          <React.Fragment>
            <header className="v1-mob-header">
              <img className="v1-mob-logo" src={logo} alt="Knyhovo" />
              <div className="v1-mob-actions"><span style={{ pointerEvents: 'none' }}><ThemeToggle theme={theme} /></span></div>
            </header>
            <div className="v1-mob-search"><SearchBar placeholder="Назва книги, автора або ISBN…" /></div>
            <p className="v1-crumbs"><a href="#">Головна</a> · <span>Бажанки</span></p>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <header className="v1-header">
              <img className="v1-logo" src={logo} alt="Knyhovo" />
              <nav className="v1-nav">
                <a href="#" className="v1-nav-link">Головна</a>
                <a href="#" className="v1-nav-link">Каталог</a>
                <a href="#" className="v1-nav-link">Знижки</a>
                <a href="#" className="v1-nav-link v1-nav-active">Бажанки</a>
              </nav>
              <div className="v1-header-right">
                <span style={{ pointerEvents: 'none' }}><ThemeToggle theme={theme} /></span>
                <Button variant="secondary" size="sm">Увійти</Button>
              </div>
            </header>
            <div className="v1-searchbar"><SearchBar placeholder="Назва книги, автора або ISBN…" /></div>
            <p className="v1-crumbs"><a href="#">Головна</a> · <span>Бажанки</span></p>
          </React.Fragment>
        )}
        <div className="v1-shell-content">{children}</div>
        <footer className="v1-footer">
          <span className="v1-footer-brand">Knyhovo</span>
          <p className="v1-footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
          <p className="v1-footer-copy">© 2026 Knyhovo</p>
        </footer>
      </div>
    </div>
  );
}

window.PHV = {
  VerdictBadge, VerdictReason, VerdictBlock, SavingsStack, PriceCell, CtaPair,
  WLRow, WLMobCard, WLSkRow, WLSkCard, WLShell, ASSET: PV_ASSET,
};
