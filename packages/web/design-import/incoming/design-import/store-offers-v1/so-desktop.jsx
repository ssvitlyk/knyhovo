// Knyhovo · W6 — Offers Intelligence · DESKTOP canvas.
// (1) The intelligence OffersPanel inside the real frozen Book Details
// Variant C page · light + dark. (2) All 10 panel states as a gallery.
'use strict';

const SOD = window.SO;

/* Book Details Variant C desktop with the intelligence panel in its real slot. */
function SOD_Page({ theme, state = 'normal' }) {
  const b = SOD.BOOK;
  return (
    <SOD.ChromeDesktop theme={theme}>
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
          <h2 className="bd-h2" style={{ marginTop: 'var(--space-10)' }}>Про видання</h2>
          <dl className="bd-meta">
            <div><dt>Видавництво</dt><dd>Клуб Сімейного Дозвілля</dd></div>
            <div><dt>ISBN</dt><dd>978-617-12-0512-3</dd></div>
            <div><dt>Мова</dt><dd>Українська</dd></div>
            <div><dt>Формат</dt><dd>Тверда обкладинка</dd></div>
          </dl>
        </div>
        <SOD.Panel state={state} stagger />
      </div>
    </SOD.ChromeDesktop>
  );
}

/* Isolated panel frame for the gallery — real panel width on the page bg. */
function SOD_Frame({ theme, state }) {
  return (
    <div className="bd-page" data-theme={theme} style={{ padding: 'var(--space-8)' }}>
      <div style={{ maxWidth: 460, margin: '0 auto' }}>
        <SOD.Panel state={state} />
      </div>
    </div>
  );
}

function SODCanvas() {
  const filled = ['normal', 'cheapest', 'bestOverall', 'cheapestStale', 'cheapestOut', 'samePrice', 'providerUnavailable'];
  const stateH = { normal: 740, cheapest: 700, bestOverall: 760, cheapestStale: 720, cheapestOut: 720, samePrice: 720, providerUnavailable: 720 };
  return (
    <DesignCanvas>
      <DCSection id="ctx" title="W6 · Offers Intelligence — у контексті Book Details"
        subtitle="Frozen Variant C сторінка. Інтелектуальний шар доданий лише в OffersPanel: пояснення найкращого вибору, надійність книгарні, доставка, свіжість ціни. Layout не змінено. Обидві теми.">
        <DCArtboard id="ctx-light" label="Book Details · Світла" width={1320} height={1180}>
          <SOD_Page theme="light" />
        </DCArtboard>
        <DCArtboard id="ctx-dark" label="Book Details · Темна" width={1320} height={1180}>
          <SOD_Page theme="dark" />
        </DCArtboard>
      </DCSection>

      <DCSection id="states-light" title="Стани панелі · світла тема"
        subtitle="Сім наповнених станів. «Найкраща ціна» (зелений) лише коли найдешевша = найкраща; інакше «Найкращий вибір» + чесна примітка про найдешевшу.">
        {filled.map((s) => (
          <DCArtboard key={s} id={'dl-' + s} label={SOD.STATES[s].label} width={500} height={stateH[s]}>
            <SOD_Frame theme="light" state={s} />
          </DCArtboard>
        ))}
      </DCSection>

      <DCSection id="states-dark" title="Стани панелі · темна тема"
        subtitle="Ті самі сім станів у темній темі. Акцент — світло-оранжевий; зелений лише для позитиву (наявність, найдешевша).">
        {filled.map((s) => (
          <DCArtboard key={s} id={'dd-' + s} label={SOD.STATES[s].label} width={500} height={stateH[s]}>
            <SOD_Frame theme="dark" state={s} />
          </DCArtboard>
        ))}
      </DCSection>

      <DCSection id="states-system" title="Системні стани · порожньо · завантаження · помилка"
        subtitle="Панель ніколи не зникає — змінюється лише її тіло. Решта Book Details завжди доступна.">
        <DCArtboard id="sys-empty-l" label="Немає пропозицій · Світла" width={500} height={340}>
          <SOD_Frame theme="light" state="empty" />
        </DCArtboard>
        <DCArtboard id="sys-loading-l" label="Завантаження · Світла" width={500} height={560}>
          <SOD_Frame theme="light" state="loading" />
        </DCArtboard>
        <DCArtboard id="sys-error-l" label="Помилка · Світла" width={500} height={340}>
          <SOD_Frame theme="light" state="error" />
        </DCArtboard>
        <DCArtboard id="sys-empty-d" label="Немає пропозицій · Темна" width={500} height={340}>
          <SOD_Frame theme="dark" state="empty" />
        </DCArtboard>
        <DCArtboard id="sys-loading-d" label="Завантаження · Темна" width={500} height={560}>
          <SOD_Frame theme="dark" state="loading" />
        </DCArtboard>
        <DCArtboard id="sys-error-d" label="Помилка · Темна" width={500} height={340}>
          <SOD_Frame theme="dark" state="error" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('so-root')).render(<SODCanvas />);
