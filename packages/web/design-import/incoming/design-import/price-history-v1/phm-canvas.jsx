// Knyhovo · Price History — MOBILE canvas. The new «Динаміка ціни» block
// inside the frozen Book Details mobile chassis + standalone states.
'use strict';

const PHM_DS = window.KnyhovoDesignSystem_9fa616;
const PHM_ASSET = '../../';
const { PriceHistoryMobile } = window.PHChart;

function MobOffers() {
  const { Button, Badge } = PHM_DS;
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

function MobContext({ theme }) {
  const { ThemeToggle } = PHM_DS;
  const b = window.PHData.BOOK;
  const logo = PHM_ASSET + (theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png');
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
        <div className="bdm-search"><PHM_DS.SearchBar placeholder="Назва, автор або ISBN…" /></div>
        <p className="bdm-crumbs">Каталог · Фентезі · <span>{b.title}</span></p>

        <div className="bdm-hero">
          <div className="bd-cover bd-cover--md"><span>Обкладинка</span></div>
          <p className="bd-eyebrow">ФЕНТЕЗІ · КНИГА 1 ІЗ 8</p>
          <h1 className="bd-h1">{b.title}</h1>
          <p className="bd-author">{b.author}</p>
        </div>

        <MobOffers />

        {/* ▼ NEW — compact price history, same data, chips selector */}
        <PriceHistoryMobile initial="90" />

        <footer className="site-footer">
          <img className="footer-logo" src={logo} alt="Knyhovo" />
          <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
          <p className="footer-copy">© 2026 Knyhovo</p>
        </footer>
      </div>
    </div>
  );
}

function MobFrame({ theme, children }) {
  return (
    <div className="bd-page bdm ph-frame" data-theme={theme} style={{ padding: 'var(--space-5) 0' }}>
      <div className="bdm-wrap">{children}</div>
    </div>
  );
}

function PHMCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="context" title="«Динаміка ціни» — мобільний контекст"
        subtitle="Book Details v1.1 · компактний графік · вибір періоду чипами · обидві теми">
        <DCArtboard id="m-ctx-light" label="Mobile · Світла" width={390} height={1640}>
          <MobContext theme="light" />
        </DCArtboard>
        <DCArtboard id="m-ctx-dark" label="Mobile · Темна" width={390} height={1640}>
          <MobContext theme="dark" />
        </DCArtboard>
      </DCSection>

      <DCSection id="states" title="Блок «Динаміка ціни» — мобільний"
        subtitle="Заповнено · чипи періоду переносяться · статистика 2×2">
        <DCArtboard id="m-pop-light" label="Заповнено · Світла" width={390} height={560}>
          <MobFrame theme="light"><PriceHistoryMobile initial="90" /></MobFrame>
        </DCArtboard>
        <DCArtboard id="m-pop-dark" label="Заповнено · Темна" width={390} height={560}>
          <MobFrame theme="dark"><PriceHistoryMobile initial="90" /></MobFrame>
        </DCArtboard>
        <DCArtboard id="m-pop-320" label="Заповнено · 320px · Світла" width={320} height={580}>
          <MobFrame theme="light"><PriceHistoryMobile initial="90" /></MobFrame>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('phm-root')).render(<PHMCanvas />);
