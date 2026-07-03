// Knyhovo · Price History v1 — W3.1 mobile completion.
// Shared Book Details MOBILE page chassis (Variant C ·<768px), parameterised by
// the price-history `state` ('filled' | 'empty' | 'loading'). Reuses the frozen
// Book Details mobile classes (ph-bd.css) + the existing window.PHChart mobile
// components — no new layout paradigm, no new visual language.
//   Placement (frozen for this extension): OffersPanel → Price History →
//   remaining Book Details content (опис · про видання) → footer.
'use strict';

const PHBDM_DS = window.KnyhovoDesignSystem_9fa616;
const PHBDM_ASSET = '../../';
const { PriceHistoryMobile, PriceHistoryEmpty, PriceHistoryLoading } = window.PHChart;

/* Offers panel — decision-first block (copied from the frozen mobile chassis). */
function PHBDM_Offers() {
  const { Button, Badge } = PHBDM_DS;
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

/* Price-history section, swapped by state. Same section, same placement. */
function PHBDM_History({ state }) {
  if (state === 'empty') return <PriceHistoryEmpty mobile />;
  if (state === 'loading') return <PriceHistoryLoading mobile />;
  return <PriceHistoryMobile initial="90" />;
}

/* Remaining Book Details content below the price-history section. */
function PHBDM_Rest() {
  const { Button } = PHBDM_DS;
  const b = window.PHData.BOOK;
  return (
    <React.Fragment>
      <section className="bd-section" data-screen-label="Опис · mobile">
        <h2 className="bd-h2">Про книгу</h2>
        <div className="bd-desc">
          <p>{b.desc}</p>
          <p>Сапковський переосмислює класичні казкові сюжети з іронією та моральною неоднозначністю: кожне полювання для Ґеральта — це вибір між меншим і більшим злом.</p>
        </div>
        <div style={{ marginTop: 'var(--space-3)' }}><Button variant="ghost" size="sm">Читати опис повністю</Button></div>
      </section>
      <section className="bd-section" data-screen-label="Про видання · mobile">
        <h2 className="bd-h2">Про видання</h2>
        <dl className="bd-meta">
          <div><dt>Видавництво</dt><dd>Клуб Сімейного Дозвілля</dd></div>
          <div><dt>ISBN</dt><dd>978-617-12-0512-3</dd></div>
          <div><dt>Мова</dt><dd>Українська</dd></div>
          <div><dt>Формат</dt><dd>Тверда обкладинка</dd></div>
        </dl>
      </section>
    </React.Fragment>
  );
}

/* Full mobile Book Details page for one price-history state. */
function BookDetailsMobile({ theme, state }) {
  const { ThemeToggle } = PHBDM_DS;
  const b = window.PHData.BOOK;
  const logo = PHBDM_ASSET + (theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png');
  return (
    <div className="bd-page bdm" data-theme={theme} data-screen-label={'Book Details · mobile · ' + state + ' · ' + theme}>
      <div className="bdm-wrap">
        <header className="bdm-header">
          <img className="site-logo" src={logo} alt="Knyhovo" />
          <div className="bdm-header__actions">
            <span style={{ pointerEvents: 'none' }}><ThemeToggle theme={theme} /></span>
            <button className="bdm-iconbtn" type="button" aria-label="Меню"><window.PHData.Icon name="menu" size={20} /></button>
          </div>
        </header>
        <div className="bdm-search"><PHBDM_DS.SearchBar placeholder="Назва, автор або ISBN…" /></div>
        <p className="bdm-crumbs">Каталог · Фентезі · <span>{b.title}</span></p>

        <div className="bdm-hero">
          <div className="bd-cover bd-cover--md"><span>Обкладинка</span></div>
          <p className="bd-eyebrow">ФЕНТЕЗІ · КНИГА 1 ІЗ 8</p>
          <h1 className="bd-h1">{b.title}</h1>
          <p className="bd-author">{b.author}</p>
        </div>

        {/* 1 · Offers (decision-first) */}
        <PHBDM_Offers />

        {/* 2 · Price history — directly below offers, never moved */}
        <PHBDM_History state={state} />

        {/* 3 · Remaining Book Details content */}
        <PHBDM_Rest />

        <footer className="site-footer">
          <img className="footer-logo" src={logo} alt="Knyhovo" />
          <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
          <p className="footer-copy">© 2026 Knyhovo</p>
        </footer>
      </div>
    </div>
  );
}

window.PHBDMobile = { BookDetailsMobile };
