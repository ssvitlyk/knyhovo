// Knyhovo · Price History — DESKTOP canvas. Shows the new «Динаміка ціни»
// block inside the frozen Book Details (Variant C) page + standalone states.
'use strict';

const PHD_DS = window.KnyhovoDesignSystem_9fa616;
const PHD_ASSET = '../../';
const { PriceHistory } = window.PHChart;

const PHD_OFFERS = [
  { store: 'Rozetka', price: 259, old: 289, avail: 'in' },
  { store: 'Книгарня «Є»', price: 265, old: null, avail: 'in' },
  { store: 'BookChef', price: 280, old: null, avail: 'low' },
  { store: 'Nash Format', price: null, old: null, avail: 'out' },
];
const PHD_AVAIL = { in: ['В наявності', 'in'], low: ['Закінчується', 'low'], out: ['Немає в наявності', 'out'] };

function OffersPanel() {
  const { Button, Badge } = PHD_DS;
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
        {PHD_OFFERS.map((o) => {
          const [label, cls] = PHD_AVAIL[o.avail];
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

/* Full Book Details (Variant C) lower page — proves placement BELOW offers. */
function BookDetailsContext({ theme }) {
  const { Button, ThemeToggle } = PHD_DS;
  const b = window.PHData.BOOK;
  const logo = PHD_ASSET + (theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png');
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
        <div className="bd-topbar">
          <div className="bd-search"><PHD_DS.SearchBar placeholder="Назва книги, автора або ISBN…" /></div>
        </div>
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
            <div className="bd-desc">
              <p>{b.desc}</p>
              <p>Сапковський переосмислює класичні казкові сюжети з іронією та моральною неоднозначністю: кожне полювання для Ґеральта — це вибір між меншим і більшим злом.</p>
            </div>
            <div style={{ marginTop: 'var(--space-3)' }}><Button variant="ghost" size="sm">Читати опис повністю</Button></div>
            <h2 className="bd-h2" style={{ marginTop: 'var(--space-8)' }}>Про видання</h2>
            <dl className="bd-meta">
              <div><dt>Видавництво</dt><dd>Клуб Сімейного Дозвілля</dd></div>
              <div><dt>ISBN</dt><dd>978-617-12-0512-3</dd></div>
              <div><dt>Мова</dt><dd>Українська</dd></div>
              <div><dt>Формат</dt><dd>Паперова · тверда обкладинка</dd></div>
            </dl>
          </div>
          <OffersPanel />
        </div>

        {/* ▼ NEW — Price history, placed directly below the offers panel */}
        <PriceHistory initial="90" />

        <footer className="site-footer">
          <img className="footer-logo" src={logo} alt="Knyhovo" />
          <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
          <p className="footer-copy">© 2026 Knyhovo</p>
        </footer>
      </div>
    </div>
  );
}

/* Standalone state frame — the section on the real page background. */
function StateFrame({ theme, children }) {
  return (
    <div className="bd-page ph-frame" data-theme={theme} style={{ padding: 'var(--space-8) var(--space-12)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>{children}</div>
    </div>
  );
}

function PHDCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="context" title="«Динаміка ціни» у контексті сторінки книги"
        subtitle="Book Details v1.1 (Variant C) · блок розміщено одразу під панеллю пропозицій · обидві теми · період перемикається">
        <DCArtboard id="ctx-light" label="Book Details · Світла" width={1440} height={1600}>
          <BookDetailsContext theme="light" />
        </DCArtboard>
        <DCArtboard id="ctx-dark" label="Book Details · Темна" width={1440} height={1600}>
          <BookDetailsContext theme="dark" />
        </DCArtboard>
      </DCSection>

      <DCSection id="states" title="Блок «Динаміка ціни» — заповнено"
        subtitle="Графік + звичайний діапазон (бенд) + статистика (Зараз · Найнижча · Звичайна ціна · Зміна) · період перемикається">
        <DCArtboard id="pop-light" label="Заповнено · Світла" width={1240} height={620}>
          <StateFrame theme="light"><PriceHistory initial="90" /></StateFrame>
        </DCArtboard>
        <DCArtboard id="pop-dark" label="Заповнено · Темна" width={1240} height={620}>
          <StateFrame theme="dark"><PriceHistory initial="90" /></StateFrame>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('phd-root')).render(<PHDCanvas />);
