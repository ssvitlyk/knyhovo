// Knyhovo · Price Alerts (W4) — Wishlist Alerts canvas.
// The frozen «Бажанки» page, extended with the four alert lifecycle states in
// the row (desktop) and accordion card (mobile). Light + dark + state gallery.
'use strict';

const { WShell, WRow, WMobCard } = window.ALC;
const ALW_D = window.ALData;
const ALW_AL = window.AL;

const ALW_ROWS = ALW_D.ROWS;

/* ── Desktop «Бажанки» page in context ───────────────────────────────────── */
function ALWPage({ theme }) {
  return (
    <WShell theme={theme} label={'Бажанки · сповіщення · ' + theme}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">Бажанки · 5 книг</p>
          <h1 className="v1-h1">Бажанки, за якими стежить <em>Книговик</em>.</h1>
          <p className="v1-sub">Не просто зберігайте книги — купуйте їх у правильний момент. Книговик щодня перевіряє ціни та напише, щойно настане час.</p>
        </div>
        <div className="v1-page-head-right">
          <span className="hy-saved">Заощаджено з Knyhovo:<b>124 ₴</b></span>
          <span className="hy-saved-sub">за весь час</span>
        </div>
      </div>

      <div className="hy-front">
        <div className="hy-group-head">
          <h2 className="hy-group-title">Книги зі знижками</h2>
          <span className="hy-group-count">1 книга</span>
        </div>
        <div className="v1-rows">
          <WRow row={ALW_ROWS.trig} />
        </div>
      </div>

      <div className="hy-group">
        <div className="hy-group-head">
          <h2 className="hy-group-title">Інші бажанки</h2>
          <span className="hy-group-count">4 книги</span>
        </div>
        <div className="v1-rows">
          <WRow row={ALW_ROWS.watch} />
          <WRow row={ALW_ROWS.paused} />
          <WRow row={ALW_ROWS.saved} />
          <WRow row={ALW_ROWS.unavail} />
        </div>
      </div>
    </WShell>
  );
}

/* ── Mobile «Бажанки» page in context ────────────────────────────────────── */
function ALWPageMob({ theme }) {
  return (
    <WShell theme={theme} mobile label={'Бажанки · мобільний · ' + theme}>
      <div className="v1-mob-head">
        <div>
          <p className="v1-eyebrow">Бажанки · 5 книг</p>
          <h1 className="v1-h1 v1-h1--mob">Бажанки, за якими стежить <em>Книговик</em>.</h1>
        </div>
      </div>
      <div className="v1-quiet-banner" style={{ marginBottom: 'var(--space-4)' }}>
        <ALW_AL.Icon name="clock" size={18} />
        <span style={{ fontSize: 'var(--fs-sm)' }}>Заощаджено з Knyhovo <b style={{ color: 'var(--brand-green)', fontFamily: 'var(--font-display)' }}>124 ₴</b> · перевірка щодня о 08:00.</span>
      </div>

      <div className="hy-group-head hy-group-head--mob"><h2 className="hy-group-title">Книги зі знижками</h2></div>
      <div className="hy-mcards"><WMobCard row={ALW_ROWS.trig} defaultOpen /></div>

      <div className="hy-group-head hy-group-head--mob"><h2 className="hy-group-title">Інші бажанки</h2></div>
      <div className="hy-mcards">
        <WMobCard row={ALW_ROWS.watch} />
        <WMobCard row={ALW_ROWS.paused} />
        <WMobCard row={ALW_ROWS.saved} />
        <WMobCard row={ALW_ROWS.unavail} />
      </div>

      <div className="v1-mob-sticky">
        <window.ALC.CtaPair />
      </div>
    </WShell>
  );
}

function ALWFrame({ theme, mobile, pad, children }) {
  return (
    <div className={'v1-page' + (mobile ? ' v1-mobile' : '')} data-theme={theme} style={{ padding: pad || 'var(--space-6) var(--space-8)' }}>
      <div className="v1-wrap" style={{ padding: 0 }}>{children}</div>
    </div>
  );
}

function ALWCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="ctx-d" title="Бажанки зі сповіщеннями — у контексті · десктоп"
        subtitle="Frozen «Бажанки» (Hybrid D). Чотири стани сповіщення в зарезервованій колонці статусу + дзвіночок у діях. Висота рядка (104px) і сітка незмінні. Triggered-рядок авто-підіймається у зелену секцію «Книги зі знижками».">
        <DCArtboard id="ctx-light" label="Світла" width={1440} height={1360}>
          <ALWPage theme="light" />
        </DCArtboard>
        <DCArtboard id="ctx-dark" label="Темна" width={1440} height={1360}>
          <ALWPage theme="dark" />
        </DCArtboard>
      </DCSection>

      <DCSection id="rows" title="Стани рядка · десктоп"
        subtitle="saved (без сповіщення) · watch · triggered · paused · unavailable. Глиф дзвоника + текст статусу читаються без кольору.">
        <DCArtboard id="rows-light" label="Світла" width={1180} height={760}>
          <ALWFrame theme="light">
            <div className="v1-rows">
              <WRow row={ALW_ROWS.saved} />
              <WRow row={ALW_ROWS.watch} />
              <WRow row={ALW_ROWS.trig} />
              <WRow row={ALW_ROWS.paused} />
              <WRow row={ALW_ROWS.unavail} />
            </div>
          </ALWFrame>
        </DCArtboard>
        <DCArtboard id="rows-dark" label="Темна" width={1180} height={760}>
          <ALWFrame theme="dark">
            <div className="v1-rows">
              <WRow row={ALW_ROWS.saved} />
              <WRow row={ALW_ROWS.watch} />
              <WRow row={ALW_ROWS.trig} />
              <WRow row={ALW_ROWS.paused} />
              <WRow row={ALW_ROWS.unavail} />
            </div>
          </ALWFrame>
        </DCArtboard>
      </DCSection>

      <DCSection id="ctx-m" title="Бажанки зі сповіщеннями — у контексті · мобільний"
        subtitle="Той самий чотиристановий набір у акордеон-картці. Стан сповіщення — у згорнутому чипі статусу; деталі та керування — при розкритті. 44px дотик.">
        <DCArtboard id="m-light" label="Мобільний · Світла" width={390} height={1480}>
          <ALWPageMob theme="light" />
        </DCArtboard>
        <DCArtboard id="m-dark" label="Мобільний · Темна" width={390} height={1480}>
          <ALWPageMob theme="dark" />
        </DCArtboard>
      </DCSection>

      <DCSection id="cards" title="Стани картки · мобільний"
        subtitle="Згорнуто + розкрито. Triggered показує CTA одразу; решта — після розкриття. «Змінити сповіщення» відкриває конфігурацію (див. Alert Configuration).">
        <DCArtboard id="c-watch" label="watch · розкрито" width={375} height={360}>
          <ALWFrame theme="light" mobile pad="var(--space-5)"><div className="hy-mcards"><WMobCard row={ALW_ROWS.watch} defaultOpen /></div></ALWFrame>
        </DCArtboard>
        <DCArtboard id="c-trig" label="triggered · розкрито" width={375} height={400}>
          <ALWFrame theme="light" mobile pad="var(--space-5)"><div className="hy-mcards"><WMobCard row={ALW_ROWS.trig} defaultOpen /></div></ALWFrame>
        </DCArtboard>
        <DCArtboard id="c-paused" label="paused · розкрито" width={375} height={360}>
          <ALWFrame theme="light" mobile pad="var(--space-5)"><div className="hy-mcards"><WMobCard row={ALW_ROWS.paused} defaultOpen /></div></ALWFrame>
        </DCArtboard>
        <DCArtboard id="c-unavail" label="unavailable · розкрито" width={375} height={360}>
          <ALWFrame theme="dark" mobile pad="var(--space-5)"><div className="hy-mcards"><WMobCard row={ALW_ROWS.unavail} defaultOpen /></div></ALWFrame>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('alw-root')).render(<ALWCanvas />);
