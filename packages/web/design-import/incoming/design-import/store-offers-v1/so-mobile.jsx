// Knyhovo · W6 — Offers Intelligence · MOBILE canvas.
// (1) Intelligence OffersPanel inside the frozen Book Details mobile layout
// (<768px) · light + dark. (2) All 10 states as 375px frames.
// No horizontal scroll; rows stay tappable; 44px touch targets.
'use strict';

const SOM = window.SO;

function SOM_Offers({ state }) {
  // Mobile offers live in a .bd-section with the frozen .bdm-panel surface.
  const s = SOM.STATES[state];
  return (
    <section className="bd-section" data-screen-label={'Offers · mobile · ' + state} style={{ marginTop: 'var(--space-6)' }}>
      <h2 className="bd-h2">Де купити</h2>
      <div className="bdm-panel">
        {s.kind === 'empty' ? <SOM.Empty />
          : s.kind === 'error' ? <SOM.Error />
            : s.kind === 'loading' ? <SOM.Loading />
              : (
                <React.Fragment>
                  <SOM.Best best={s.best} />
                  <div>{s.rows.map((o) => <SOM.Row key={o.store} o={o} />)}</div>
                  <p className="bd-updated">{s.footnote}</p>
                </React.Fragment>
              )}
      </div>
    </section>
  );
}

function SOM_Page({ theme, state = 'normal' }) {
  const { ThemeToggle, SearchBar } = SOM.DS;
  const b = SOM.BOOK;
  const logo = SOM.ASSET + (theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png');
  return (
    <div className="bd-page bdm" data-theme={theme} data-screen-label={'Book Details · mobile · ' + theme}>
      <div className="bdm-wrap">
        <header className="bdm-header">
          <img className="site-logo" src={logo} alt="Knyhovo" />
          <div className="bdm-header__actions">
            <span style={{ pointerEvents: 'none' }}><ThemeToggle theme={theme} /></span>
            <button className="bdm-iconbtn" type="button" aria-label="Меню"><SOM.Icon name="menu" size={20} /></button>
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
        <SOM_Offers state={state} />
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

/* Isolated mobile panel frame for the state gallery (375px). */
function SOM_Frame({ theme, state }) {
  return (
    <div className="bd-page bdm" data-theme={theme} style={{ padding: 'var(--space-4)' }}>
      <div className="bdm-wrap" style={{ padding: 0 }}>
        <SOM_Offers state={state} />
      </div>
    </div>
  );
}

function SOMCanvas() {
  const filled = ['normal', 'cheapest', 'bestOverall', 'cheapestStale', 'cheapestOut', 'samePrice', 'providerUnavailable'];
  const fh = { normal: 760, cheapest: 700, bestOverall: 780, cheapestStale: 720, cheapestOut: 720, samePrice: 720, providerUnavailable: 720 };
  return (
    <DesignCanvas>
      <DCSection id="ctx" title="W6 · Offers Intelligence — мобільний Book Details"
        subtitle="Frozen мобільна сторінка (<768px). Той самий інтелектуальний шар: статус-лінія під кожною книгарнею, без горизонтального скролу, тапабельні рядки, 44px кнопки. Обидві теми.">
        <DCArtboard id="m-light" label="Мобільний · Світла" width={390} height={1480}>
          <SOM_Page theme="light" />
        </DCArtboard>
        <DCArtboard id="m-dark" label="Мобільний · Темна" width={390} height={1480}>
          <SOM_Page theme="dark" />
        </DCArtboard>
      </DCSection>

      <DCSection id="m-light-states" title="Стани · 375px · світла"
        subtitle="Рядок стає двома стовпцями (інфо · ціна) + статус-лінія; кнопка справа під ціною. Назви книгарень переносяться, не обрізаються.">
        {filled.map((s) => (
          <DCArtboard key={s} id={'ml-' + s} label={SOM.STATES[s].label} width={375} height={fh[s]}>
            <SOM_Frame theme="light" state={s} />
          </DCArtboard>
        ))}
      </DCSection>

      <DCSection id="m-dark-states" title="Стани · 375px · темна">
        {filled.map((s) => (
          <DCArtboard key={s} id={'md-' + s} label={SOM.STATES[s].label} width={375} height={fh[s]}>
            <SOM_Frame theme="dark" state={s} />
          </DCArtboard>
        ))}
      </DCSection>

      <DCSection id="m-sys" title="Системні стани · 375px"
        subtitle="Порожньо · завантаження · помилка — панель ніколи не зникає, решта сторінки доступна.">
        <DCArtboard id="ms-empty" label="Немає пропозицій · Світла" width={375} height={420}>
          <SOM_Frame theme="light" state="empty" />
        </DCArtboard>
        <DCArtboard id="ms-loading" label="Завантаження · Світла" width={375} height={560}>
          <SOM_Frame theme="light" state="loading" />
        </DCArtboard>
        <DCArtboard id="ms-error" label="Помилка · Світла" width={375} height={420}>
          <SOM_Frame theme="light" state="error" />
        </DCArtboard>
        <DCArtboard id="ms-empty-d" label="Немає пропозицій · Темна" width={375} height={420}>
          <SOM_Frame theme="dark" state="empty" />
        </DCArtboard>
        <DCArtboard id="ms-error-d" label="Помилка · Темна" width={375} height={420}>
          <SOM_Frame theme="dark" state="error" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('so-root')).render(<SOMCanvas />);
