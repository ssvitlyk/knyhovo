// Knyhovo · Price Alerts extension (W4) — compositions inside the frozen
// chassis. Wishlist rows/cards (the .v1-row grid & .hy-mcard accordion) and
// the Book Details wishlist toggle (.bd-wish). NOTHING here changes frozen
// layout, grid, spacing or type — alert states reuse the slots already
// reserved by the frozen patterns. Exports window.ALC.
'use strict';

const ALC_DS = window.KnyhovoDesignSystem_9fa616;
const ALD = window.ALData;
const AL = window.AL;
const ALCIcon = ALD.Icon;

/* CTA pair — frozen order (Деталі книги → До книгарні), reused verbatim */
function ALCtaPair({ grow }) {
  const { Button } = ALC_DS;
  const s = grow ? { flex: 1 } : null;
  return (
    <React.Fragment>
      <Button variant="secondary" size="sm" style={s}>Деталі книги</Button>
      <Button variant="primary" size="sm" style={s}>До книгарні</Button>
    </React.Fragment>
  );
}

/* Price cell — reuses frozen .wl-* primitives. Triggered = green moment. */
function ALPriceCell({ row }) {
  const a = row.alert || {};
  if (row.price == null) {
    return <span className="wl-pricestack"><span className="wl-price wl-price--faint">Немає в наявності</span><span className="wl-store">Стежимо за поверненням</span></span>;
  }
  if (a.state === 'trig') {
    const saved = row.old ? row.old - row.price : 0;
    return (
      <span className="phv-savings">
        {row.old ? <span className="phv-savings__old">{ALD.uah(row.old)}</span> : null}
        <span className="phv-savings__now phv-savings__now--good">{ALD.uah(row.price)}</span>
        {saved > 0 ? <span className="phv-savings__saved">Економія {saved} ₴</span> : null}
      </span>
    );
  }
  return <span className="wl-pricestack"><span className="wl-pricerow"><span className="wl-price">{ALD.uah(row.price)}</span></span><span className="wl-store">{row.store}</span></span>;
}

/* ── Desktop wishlist row — alert state lives in the reserved status column +
   the actions bell. Row grid / height (min 104px) unchanged. ── */
function ALWRow({ row }) {
  const a = row.alert || {};
  const trig = a.state === 'trig';
  const out = row.price == null || a.state === 'unavail';
  return (
    <div className={'v1-row' + (trig ? ' hy-row--moment' : '') + (out ? ' v1-row--out' : '')}>
      <span className="v1-cover" aria-hidden="true"></span>
      <span className="v1-row-main">
        <span className="v1-row-title">{row.title}</span>
        <span className="v1-row-author">{row.author}</span>
      </span>
      <span className="hy-row-status">
        {a.state ? <AL.Chip state={a.state} /> : <span className="al-target">Сповіщення не налаштовано</span>}
        {a.state === 'watch' ? <AL.Target intent={a.intent} /> : null}
        {trig ? <AL.Target intent={a.intent} triggered price={row.price} /> : null}
        {a.state === 'paused' ? <span className="al-target">Поновіть, щоб Книговик стежив далі.</span> : null}
        {a.state === 'unavail' ? <span className="al-target">Сповістимо, щойно книга з’явиться.</span> : null}
      </span>
      <span className="hy-pricecell"><ALPriceCell row={row} /></span>
      <span className="h2-ctas"><ALCtaPair /></span>
      <span className="v1-row-actions">
        <AL.Bell state={a.state || 'off'} />
        <button className="wl-iconbtn" type="button" title="Прибрати з бажанок"><ALCIcon name="x" size={16} /></button>
      </span>
    </div>
  );
}

/* ── Mobile wishlist accordion card — alert state in the collapsed status
   chip; details + management when expanded. ── */
function ALWMobCard({ row, defaultOpen }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  const a = row.alert || {};
  const trig = a.state === 'trig';
  const out = row.price == null || a.state === 'unavail';
  const saved = trig && row.old ? row.old - row.price : 0;
  return (
    <div className={'hy-mcard' + (trig ? ' hy-mcard--moment' : '') + (out ? ' hy-mcard--out' : '')}>
      <button className="hy-mcard-top" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="v1-mob-cover" aria-hidden="true"></span>
        <span className="hy-mcard-main">
          <span className="v1-mob-row-title">{row.title}</span>
          <span className="v1-mob-row-author">{row.author}</span>
          <span className="hy-mcard-status">{a.state ? <AL.Chip state={a.state} /> : null}</span>
        </span>
        <span className="hy-mcard-right">
          <span className={'hy-mcard-price' + (trig ? ' hy-mcard-price--green' : out ? ' hy-mcard-price--faint' : '')}>{out ? '—' : ALD.uah(row.price)}</span>
          {saved > 0 ? <span className="h2-msave">Економія {saved} ₴</span> : null}
        </span>
        <span className={'hy-mcard-chev' + (open ? ' hy-mcard-chev--open' : '')}><ALCIcon name="chevron-down" size={16} /></span>
      </button>
      {trig ? <div className="hy-mcard-cta h2-mcta"><ALCtaPair grow /></div> : null}
      {open ? (
        <div className="hy-mcard-body">
          {trig ? (
            <div className="hy-mcard-meta"><span>Сповіщення</span><span className="hy-mcard-save" style={{ textAlign: 'right', maxWidth: '64%' }}>Ціна досягла цілі {a.target} ₴</span></div>
          ) : a.state ? (
            <div className="hy-mcard-meta"><span>Сповіщення</span><span style={{ textAlign: 'right', maxWidth: '64%' }}>{AL.CHIP[a.state].label}{a.target ? ' · нижче ' + a.target + ' ₴' : ''}</span></div>
          ) : (
            <div className="hy-mcard-meta"><span>Сповіщення</span><span>не налаштовано</span></div>
          )}
          {row.old && trig ? <div className="hy-mcard-meta"><span>Стара ціна</span><s>{ALD.uah(row.old)}</s></div> : null}
          <div className="hy-mcard-meta"><span>Книгарня</span><span>{out ? '—' : row.store}</span></div>
          <div className="hy-mcard-meta"><span>Остання перевірка</span><span>сьогодні о 08:00</span></div>
          {!trig ? <div className="h2-mcta" style={{ marginTop: 'var(--space-1)' }}><ALCtaPair grow /></div> : null}
          <div className="hy-mcard-actions">
            {a.state === 'unavail'
              ? <span className="al-target" style={{ marginRight: 'auto' }}>Сповіщення недоступні</span>
              : <button className="al-link al-link--sm" type="button" style={{ marginRight: 'auto' }}><ALCIcon name="pencil" size={13} />{a.state ? 'Змінити сповіщення' : 'Сповістити про ціну'}</button>}
            <AL.Bell state={a.state || 'off'} />
            <button className="wl-iconbtn" type="button" title="Прибрати"><ALCIcon name="x" size={16} /></button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ── Book Details — extended wishlist toggle (.bd-wish). Placement unchanged:
   directly below the best-price CTA in the offers panel. ── */
function ALBDToggle({ state = 'unsaved', size = 'md', book = ALD.BOOK }) {
  const { Button, Badge } = ALC_DS;
  if (state === 'loading') {
    return (
      <div className="bd-wish" aria-hidden="true">
        <span className="bd-sk" style={{ width: 150, height: size === 'md' ? 44 : 36, borderRadius: 'var(--radius-sm)' }}></span>
        <span className="bd-sk" style={{ width: 132, height: 22, borderRadius: 999 }}></span>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: '100%' }}>
        <div className="bd-wish">
          <Button variant="secondary" size={size}><ALCIcon name="bookmark-check" size={16} /> У вішлисті</Button>
        </div>
        <AL.Note kind="err" action={<AL.Retry label="Ще раз" />}>Не вдалося ввімкнути сповіщення.</AL.Note>
      </div>
    );
  }
  const saved = state !== 'unsaved';
  const alert = state === 'alert';
  const paused = state === 'paused';
  const trig = state === 'trig';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: '100%' }}>
      <div className="bd-wish">
        <Button variant="secondary" size={size}>
          <ALCIcon name={saved ? 'bookmark-check' : 'bookmark'} size={16} />
          {saved ? 'У вішлисті' : 'До вішлиста'}
        </Button>
        {alert ? <Badge tone="accent"><ALCIcon name="bell-dot" size={11} /> Стежимо за ціною</Badge> : null}
        {trig ? <AL.Chip state="trig" /> : null}
        {paused ? <AL.Chip state="paused" /> : null}
      </div>
      {saved && !alert && !paused && !trig ? (
        <button className="al-link" type="button"><ALCIcon name="bell" size={15} />Сповістити про зниження ціни</button>
      ) : null}
      {alert ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <AL.Target intent="below" book={book} />
          <button className="al-link al-link--sm" type="button"><ALCIcon name="pencil" size={13} />Змінити</button>
        </div>
      ) : null}
      {trig ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <AL.Target intent="below" book={book} triggered price={book.current} />
          <button className="al-link al-link--sm" type="button"><ALCIcon name="pencil" size={13} />Змінити</button>
        </div>
      ) : null}
      {paused ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span className="al-target">Стеження призупинене — Книговик не перевіряє ціль.</span>
          <button className="al-link al-link--sm" type="button"><ALCIcon name="bell-dot" size={13} />Поновити сповіщення</button>
        </div>
      ) : null}
    </div>
  );
}

/* Compact Book Details offers panel (frozen) — host for the toggle + config */
function ALBDPanel({ book = ALD.BOOK, children, mobile }) {
  const { Button, Badge } = ALC_DS;
  return (
    <aside className={mobile ? 'bdm-panel' : 'bdc-panel'} data-screen-label="Offers panel">
      {!mobile ? <p className="bd-eyebrow" style={{ marginBottom: 0 }}>ЦІНИ У 5 КНИГАРНЯХ</p> : null}
      <div className="bdc-best">
        <Badge tone="green">Найкраща ціна</Badge>
        <div className="bdc-best__pricerow">
          <span className="bdc-best__old">320 ₴</span>
          <span className="bdc-best__price">{book.current} ₴</span>
        </div>
        <p className="bdc-best__store">у <b>{book.store}</b> · <span style={{ color: 'var(--brand-green)' }}>В наявності</span></p>
        <Button variant="primary" style={{ width: '100%' }}>Перейти до книгарні</Button>
      </div>
      {children}
    </aside>
  );
}

/* ── Page shells (frozen Wishlist / Book Details chrome) ─────────────────── */
const ALC_ASSET = '../../';
function ALWShell({ theme, label, mobile, children }) {
  const { SearchBar, ThemeToggle, Button } = ALC_DS;
  const logo = ALC_ASSET + (theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png');
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

window.ALC = {
  CtaPair: ALCtaPair, WRow: ALWRow, WMobCard: ALWMobCard,
  BDToggle: ALBDToggle, BDPanel: ALBDPanel, WShell: ALWShell, ASSET: ALC_ASSET,
};
