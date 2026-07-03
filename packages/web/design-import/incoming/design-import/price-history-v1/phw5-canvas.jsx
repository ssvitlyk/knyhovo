// Knyhovo · Price History W5 — page canvas. The frozen v1.2.1 «Динаміка ціни»
// block, now driven by the W5 API (window.PHSection), shown in the real Book
// Details (Variant C) page directly below the offers panel, plus deterministic
// state galleries. Desktop + mobile · light + dark · filled/empty/loading/error.
'use strict';

const PHW5_DS = window.KnyhovoDesignSystem_9fa616;
const PHW5_ASSET = '../../';
const { PriceHistorySection } = window.PHSection;

const PHW5_OFFERS = [
  { store: 'Rozetka', price: 259, old: 289, avail: 'in' },
  { store: 'Книгарня «Є»', price: 265, old: null, avail: 'in' },
  { store: 'BookChef', price: 280, old: null, avail: 'low' },
  { store: 'Nash Format', price: null, old: null, avail: 'out' },
];
const PHW5_AVAIL = { in: ['В наявності', 'in'], low: ['Закінчується', 'low'], out: ['Немає в наявності', 'out'] };

/* ── Desktop offers panel (frozen Book Details) ──────────────────────────── */
function PHW5_OffersDesktop() {
  const { Button, Badge } = PHW5_DS;
  return (
    <aside className="bdc-panel" data-screen-label="Offers panel">
      <p className="bd-eyebrow" style={{ marginBottom: 0 }}>ЦІНИ У 5 КНИГАРНЯХ</p>
      <div className="bdc-best">
        <Badge tone="green">Найкраща ціна</Badge>
        <div className="bdc-best__pricerow">
          <span className="bdc-best__old">320 ₴</span>
          <span className="bdc-best__price">240 ₴</span>
        </div>
        <p className="bdc-best__store">у <b>Yakaboo</b> · <span style={{ color: 'var(--brand-green)' }}>В наявності</span></p>
        <Button variant="primary" style={{ width: '100%' }}>Перейти до книгарні</Button>
      </div>
      <div>
        {PHW5_OFFERS.map((o) => {
          const [label, cls] = PHW5_AVAIL[o.avail];
          const out = o.avail === 'out';
          return (
            <div key={o.store} className={'bdc-row' + (out ? ' bdc-row--out' : '')}>
              <span className="bdc-row__store">{o.store}</span>
              <span className={'bdc-row__avail bd-offer__avail--' + cls}>{label}</span>
              {o.old && !out ? <span className="bdc-row__old">{o.old} ₴</span> : null}
              <span className="bdc-row__price">{out ? '—' : o.price + ' ₴'}</span>
              <Button variant="secondary" size="sm" disabled={out}>Перейти</Button>
            </div>
          );
        })}
      </div>
      <p className="bd-updated">Ціни оновлено сьогодні о 08:00</p>
    </aside>
  );
}

/* ── Full desktop Book Details with the LIVE price-history block ──────────── */
function PHW5_Desktop({ theme }) {
  const { Button, ThemeToggle, SearchBar } = PHW5_DS;
  const b = window.PHData.BOOK;
  const logo = PHW5_ASSET + (theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png');
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

        <div className="bdc-grid">
          <div className="bdc-left">
            <div className="bdc-idrow">
              <div className="bd-cover bd-cover--md"><span>Обкладинка</span></div>
              <div>
                <p className="bd-eyebrow">{b.genreEyebrow}</p>
                <h1 className="bd-h1">{b.title}</h1>
                <p className="bd-author">{b.author}</p>
              </div>
            </div>
            <div className="bd-desc"><p>{b.desc}</p></div>
          </div>
          <PHW5_OffersDesktop />
        </div>

        {/* ▼ OffersPanel → Price History (live API) → remaining content */}
        <PriceHistorySection bookId="demo" />

        <h2 className="bd-h2" style={{ marginTop: 'var(--space-12)' }}>Про видання</h2>
        <dl className="bd-meta">
          <div><dt>Видавництво</dt><dd>Клуб Сімейного Дозвілля</dd></div>
          <div><dt>ISBN</dt><dd>978-617-12-0512-3</dd></div>
          <div><dt>Мова</dt><dd>Українська</dd></div>
          <div><dt>Формат</dt><dd>Тверда обкладинка</dd></div>
        </dl>

        <footer className="site-footer">
          <img className="footer-logo" src={logo} alt="Knyhovo" />
          <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
          <p className="footer-copy">© 2026 Knyhovo</p>
        </footer>
      </div>
    </div>
  );
}

/* ── Mobile offers (frozen Book Details mobile) ──────────────────────────── */
function PHW5_OffersMobile() {
  const { Button, Badge } = PHW5_DS;
  return (
    <section className="bd-section" data-screen-label="Offers · mobile" style={{ marginTop: 'var(--space-6)' }}>
      <h2 className="bd-h2">Де купити</h2>
      <div className="bdm-panel">
        <div className="bdc-best">
          <Badge tone="green">Найкраща ціна</Badge>
          <div className="bdc-best__pricerow">
            <span className="bdc-best__old">320 ₴</span>
            <span className="bdc-best__price">240 ₴</span>
          </div>
          <p className="bdc-best__store">у <b>Yakaboo</b> · <span style={{ color: 'var(--brand-green)' }}>В наявності</span></p>
          <Button variant="primary" style={{ width: '100%' }}>Перейти до книгарні</Button>
        </div>
        <div style={{ marginTop: 'var(--space-2)' }}>
          <div className="bdc-row">
            <span className="bdc-row__store">Rozetka</span>
            <span className="bdc-row__avail bd-offer__avail--in">В наявності</span>
            <span className="bdc-row__old">289 ₴</span>
            <span className="bdc-row__price">259 ₴</span>
          </div>
          <div className="bdc-row">
            <span className="bdc-row__store">Книгарня «Є»</span>
            <span className="bdc-row__avail bd-offer__avail--in">В наявності</span>
            <span className="bdc-row__price">265 ₴</span>
          </div>
        </div>
        <p className="bd-updated">Ціни оновлено сьогодні о 08:00</p>
      </div>
    </section>
  );
}

/* ── Mobile Book Details with the LIVE price-history block ────────────────── */
function PHW5_Mobile({ theme }) {
  const { ThemeToggle, SearchBar } = PHW5_DS;
  const b = window.PHData.BOOK;
  const logo = PHW5_ASSET + (theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png');
  return (
    <div className="bd-page bdm" data-theme={theme} data-screen-label={'Book Details · mobile · ' + theme}>
      <div className="bdm-wrap">
        <header className="bdm-header">
          <img className="site-logo" src={logo} alt="Knyhovo" />
          <div className="bdm-header__actions">
            <span style={{ pointerEvents: 'none' }}><ThemeToggle theme={theme} /></span>
            <button className="bdm-iconbtn" type="button" aria-label="Меню"><window.PHData.Icon name="menu" size={20} /></button>
          </div>
        </header>
        <div className="bdm-search"><SearchBar placeholder="Назва, автор або ISBN…" /></div>
        <p className="bdm-crumbs">Каталог · Фентезі · <span>{b.title}</span></p>
        <div className="bdm-hero">
          <div className="bd-cover bd-cover--md"><span>Обкладинка</span></div>
          <p className="bd-eyebrow">ФЕНТЕЗІ · КНИГА 1 ІЗ 8</p>
          <h1 className="bd-h1">{b.title}</h1>
          <p className="bd-author">{b.author}</p>
        </div>

        <PHW5_OffersMobile />
        {/* ▼ directly below offers */}
        <PriceHistorySection mobile bookId="demo" />

        <section className="bd-section" data-screen-label="Опис · mobile">
          <h2 className="bd-h2">Про книгу</h2>
          <div className="bd-desc"><p>{b.desc}</p></div>
        </section>

        <footer className="site-footer">
          <img className="footer-logo" src={logo} alt="Knyhovo" />
          <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
          <p className="footer-copy">© 2026 Knyhovo</p>
        </footer>
      </div>
    </div>
  );
}

/* ── State-gallery frames (deterministic via forceState) ─────────────────── */
function PHW5_StateFrame({ theme, mobile, children }) {
  return (
    <div className={'bd-page ph-frame' + (mobile ? ' bdm' : '')} data-theme={theme}
      style={{ padding: mobile ? 'var(--space-5) 0' : 'var(--space-8) var(--space-10)' }}>
      <div className={mobile ? 'bdm-wrap' : ''} style={mobile ? null : { maxWidth: 1120, margin: '0 auto' }}>{children}</div>
    </div>
  );
}

/* ── Canvas ───────────────────────────────────────────────────────────────── */
function PHW5Canvas() {
  return (
    <DesignCanvas>
      <DCSection id="ctx" title="W5 · «Динаміка ціни» від API — у контексті сторінки"
        subtitle="Frozen v1.2.1 блок, керований GET /api/books/:id/price-history (default 90d). Розміщено одразу під OffersPanel. Перемикач періоду — живий. Обидві теми.">
        <DCArtboard id="ctx-light" label="Book Details · Світла · LIVE" width={1440} height={1640}>
          <PHW5_Desktop theme="light" />
        </DCArtboard>
        <DCArtboard id="ctx-dark" label="Book Details · Темна · LIVE" width={1440} height={1640}>
          <PHW5_Desktop theme="dark" />
        </DCArtboard>
      </DCSection>

      <DCSection id="states-d" title="Стани · десктоп"
        subtitle="filled · empty · loading · error — детерміновано. «Найвища» не показується; типова ціна; зміна нейтральна для не-вигідних станів.">
        <DCArtboard id="d-filled" label="Заповнено · Світла" width={1180} height={560}>
          <PHW5_StateFrame theme="light"><PriceHistorySection forceState="filled" /></PHW5_StateFrame>
        </DCArtboard>
        <DCArtboard id="d-filled-dark" label="Заповнено · Темна" width={1180} height={560}>
          <PHW5_StateFrame theme="dark"><PriceHistorySection forceState="filled" /></PHW5_StateFrame>
        </DCArtboard>
        <DCArtboard id="d-empty" label="Немає історії · Світла" width={1180} height={300}>
          <PHW5_StateFrame theme="light"><PriceHistorySection forceState="empty" /></PHW5_StateFrame>
        </DCArtboard>
        <DCArtboard id="d-loading" label="Завантаження · Світла" width={1180} height={560}>
          <PHW5_StateFrame theme="light"><PriceHistorySection forceState="loading" /></PHW5_StateFrame>
        </DCArtboard>
        <DCArtboard id="d-error" label="Помилка · Світла" width={1180} height={320}>
          <PHW5_StateFrame theme="light"><PriceHistorySection forceState="error" /></PHW5_StateFrame>
        </DCArtboard>
      </DCSection>

      <DCSection id="ctx-m" title="W5 · мобільний — у контексті сторінки"
        subtitle="Той самий блок під OffersPanel. 2×2 статистика · чипи 44px не переповнюються · без горизонтального скролу. Живий перемикач.">
        <DCArtboard id="m-light" label="Мобільний · Світла · LIVE" width={390} height={1720}>
          <PHW5_Mobile theme="light" />
        </DCArtboard>
        <DCArtboard id="m-dark" label="Мобільний · Темна · LIVE" width={390} height={1720}>
          <PHW5_Mobile theme="dark" />
        </DCArtboard>
      </DCSection>

      <DCSection id="states-m" title="Стани · мобільний · 375px"
        subtitle="filled · empty · loading · error — без горизонтального скролу, статистика 2×2, чипи вирівняні.">
        <DCArtboard id="m-filled" label="Заповнено · Світла · 375px" width={375} height={620}>
          <PHW5_StateFrame theme="light" mobile><PriceHistorySection mobile forceState="filled" /></PHW5_StateFrame>
        </DCArtboard>
        <DCArtboard id="m-filled-dark" label="Заповнено · Темна · 375px" width={375} height={620}>
          <PHW5_StateFrame theme="dark" mobile><PriceHistorySection mobile forceState="filled" /></PHW5_StateFrame>
        </DCArtboard>
        <DCArtboard id="m-empty" label="Немає історії · Світла · 375px" width={375} height={360}>
          <PHW5_StateFrame theme="light" mobile><PriceHistorySection mobile forceState="empty" /></PHW5_StateFrame>
        </DCArtboard>
        <DCArtboard id="m-loading" label="Завантаження · Світла · 375px" width={375} height={600}>
          <PHW5_StateFrame theme="light" mobile><PriceHistorySection mobile forceState="loading" /></PHW5_StateFrame>
        </DCArtboard>
        <DCArtboard id="m-error" label="Помилка · Світла · 375px" width={375} height={360}>
          <PHW5_StateFrame theme="light" mobile><PriceHistorySection mobile forceState="error" /></PHW5_StateFrame>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('phw5-root')).render(<PHW5Canvas />);
