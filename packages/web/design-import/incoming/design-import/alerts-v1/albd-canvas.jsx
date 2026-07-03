// Knyhovo · Price Alerts (W4) — Book Details Alerts canvas.
// The frozen Book Details v1.2.1 wishlist toggle (.bd-wish), extended with the
// alert states: unsaved / saved / saved+alert / loading / error. Placement is
// unchanged — directly below the best-price CTA in the offers panel. The
// lightweight configuration opens in place (popover desktop / sheet mobile).
'use strict';

const ALBD_DS = window.KnyhovoDesignSystem_9fa616;
const ALBD = window.ALData;
const ALBD_AL = window.AL;
const ALBD_C = window.ALC;
const ALBD_ASSET = '../../';

/* Two-pane Book Details shell (frozen Variant C) */
function ALBDShell({ theme, label, children, panel }) {
  const { Button, ThemeToggle, SearchBar } = ALBD_DS;
  const b = ALBD.BOOK;
  const logo = ALBD_ASSET + (theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png');
  return (
    <div className="bd-page" data-theme={theme} data-screen-label={label}>
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
                <p className="bd-eyebrow">ФЕНТЕЗІ · СЕРІЯ «ВІДЬМАК» · КНИГА 1 ІЗ 8</p>
                <h1 className="bd-h1">{b.title}</h1>
                <p className="bd-author">{b.author}</p>
              </div>
            </div>
            <div className="bd-desc"><p>«Останнє бажання» відкриває сагу про Ґеральта з Рівії — відьмака, мисливця на чудовиськ. Збірка оповідань знайомить із головними героями циклу та законами цього світу, де людська жорстокість часто страшніша за будь-яку потвору.</p></div>
          </div>
          {panel}
        </div>
        <footer className="site-footer">
          <img className="footer-logo" src={logo} alt="Knyhovo" />
          <p className="footer-line">Знаходимо найкращі ціни на книги — щодня.</p>
          <p className="footer-copy">© 2026 Knyhovo</p>
        </footer>
      </div>
    </div>
  );
}

/* Offers panel + the wishlist/alert control, in the frozen slot */
function ALBDPanelWith({ toggleState, configOpen, note }) {
  return (
    <ALBD_C.BDPanel>
      <div className="al-anchor" style={{ display: 'block', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border)' }}>
        <ALBD_C.BDToggle state={toggleState} />
        {note ? <div style={{ marginTop: 'var(--space-3)' }}>{note}</div> : null}
        {configOpen ? (
          <div className="al-pop al-pop--left" style={{ position: 'static', marginTop: 'var(--space-3)' }}>
            <ALBD_AL.Config initialIntent="below" editing={toggleState === 'alert'} />
          </div>
        ) : null}
      </div>
    </ALBD_C.BDPanel>
  );
}

/* A small framed offers panel for the state gallery */
function ALBDMini({ theme, toggleState, note }) {
  return (
    <div className="bd-page" data-theme={theme} style={{ padding: 'var(--space-6)' }}>
      <div style={{ maxWidth: 460 }}>
        <ALBD_C.BDPanel>
          <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border)' }}>
            <ALBD_C.BDToggle state={toggleState} />
            {note ? <div style={{ marginTop: 'var(--space-3)' }}>{note}</div> : null}
          </div>
        </ALBD_C.BDPanel>
      </div>
    </div>
  );
}

function ALBDCanvas() {
  const okNote = <ALBD_AL.Note kind="ok"><b>Сповіщення увімкнено.</b> Книговик напише, коли ціна стане нижче 240 ₴.</ALBD_AL.Note>;
  return (
    <DesignCanvas>
      <DCSection id="ctx" title="Сповіщення про ціну — у контексті Book Details · десктоп"
        subtitle="Контроль «вішлист + сповіщення» у зарезервованому місці: одразу під найкращою ціною в OffersPanel. Жодних змін у двопанельній сітці Variant C. Конфігурація відкривається на місці (поповер).">
        <DCArtboard id="ctx-alert" label="Saved + alert · Світла" width={1320} height={920}>
          <ALBDShell theme="light" label="Book Details · saved+alert · light" panel={<ALBDPanelWith toggleState="alert" />} />
        </DCArtboard>
        <DCArtboard id="ctx-config" label="Конфігурація відкрита · Світла" width={1320} height={1140}>
          <ALBDShell theme="light" label="Book Details · config open · light" panel={<ALBDPanelWith toggleState="saved" configOpen />} />
        </DCArtboard>
        <DCArtboard id="ctx-alert-d" label="Saved + alert · Темна" width={1320} height={920}>
          <ALBDShell theme="dark" label="Book Details · saved+alert · dark" panel={<ALBDPanelWith toggleState="alert" />} />
        </DCArtboard>
        <DCArtboard id="ctx-config-d" label="Конфігурація відкрита · Темна" width={1320} height={1140}>
          <ALBDShell theme="dark" label="Book Details · config open · dark" panel={<ALBDPanelWith toggleState="saved" configOpen />} />
        </DCArtboard>
      </DCSection>

      <DCSection id="states" title="Стани контролу · десктоп"
        subtitle="unsaved → saved → saved+alert → loading → error. Кнопка «У вішлисті» (frozen secondary) незмінна; сповіщення додається бейджем + лінією цілі. Loading — теплий скелет; error — локальне відновлення, не блокує сторінку.">
        <DCArtboard id="s-unsaved" label="unsaved" width={520} height={300}>
          <ALBDMini theme="light" toggleState="unsaved" />
        </DCArtboard>
        <DCArtboard id="s-saved" label="saved" width={520} height={330}>
          <ALBDMini theme="light" toggleState="saved" />
        </DCArtboard>
        <DCArtboard id="s-alert" label="saved + alert" width={520} height={340}>
          <ALBDMini theme="light" toggleState="alert" />
        </DCArtboard>
        <DCArtboard id="s-ok" label="saved + alert · підтвердження" width={520} height={380}>
          <ALBDMini theme="light" toggleState="alert" note={okNote} />
        </DCArtboard>
        <DCArtboard id="s-loading" label="loading" width={520} height={300}>
          <ALBDMini theme="light" toggleState="loading" />
        </DCArtboard>
        <DCArtboard id="s-error" label="error" width={520} height={350}>
          <ALBDMini theme="light" toggleState="error" />
        </DCArtboard>
      </DCSection>

      <DCSection id="states-dark" title="Стани контролу · темна тема"
        subtitle="Той самий набір у темній темі — амбер-акцент, теплі скелети, бейдж «Стежимо за ціною».">
        <DCArtboard id="sd-saved" label="saved" width={520} height={330}>
          <ALBDMini theme="dark" toggleState="saved" />
        </DCArtboard>
        <DCArtboard id="sd-alert" label="saved + alert" width={520} height={340}>
          <ALBDMini theme="dark" toggleState="alert" />
        </DCArtboard>
        <DCArtboard id="sd-loading" label="loading" width={520} height={300}>
          <ALBDMini theme="dark" toggleState="loading" />
        </DCArtboard>
        <DCArtboard id="sd-error" label="error" width={520} height={350}>
          <ALBDMini theme="dark" toggleState="error" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('albd-root')).render(<ALBDCanvas />);
