// Knyhovo · Price History — EMPTY STATES canvas (W3 revision).
// "No history yet" state, desktop + mobile, both themes. Honest & calm —
// never apologetic, never faked into looking complete. Copy aligns with the
// frozen Wishlist language: «…коли настане вдалий момент купувати».
'use strict';

const PHE_DS = window.KnyhovoDesignSystem_9fa616;
const PHE_ASSET = '../../';
const { PriceHistoryEmpty } = window.PHChart;

function PHEFrame({ theme, children, mobile }) {
  return (
    <div className={'bd-page ph-frame' + (mobile ? ' bdm' : '')} data-theme={theme}
      style={{ padding: mobile ? 'var(--space-5) 0' : 'var(--space-8) var(--space-12)' }}>
      <div className={mobile ? 'bdm-wrap' : ''} style={mobile ? null : { maxWidth: 1180, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  );
}

function PHECanvas() {
  return (
    <DesignCanvas>
      <DCSection id="desktop" title="«Динаміка ціни» — немає історії · десктоп"
        subtitle="Чесний, спокійний стан: іконка + «Ще збираємо історію» + бейдж «Збираємо дані» + рядок про щоденну перевірку о 08:00">
        <DCArtboard id="e-light" label="Немає історії · Світла" width={1240} height={300}>
          <PHEFrame theme="light"><PriceHistoryEmpty /></PHEFrame>
        </DCArtboard>
        <DCArtboard id="e-dark" label="Немає історії · Темна" width={1240} height={300}>
          <PHEFrame theme="dark"><PriceHistoryEmpty /></PHEFrame>
        </DCArtboard>
      </DCSection>

      <DCSection id="mobile" title="«Динаміка ціни» — немає історії · мобільний"
        subtitle="Той самий блок, компактно · текст читається без обрізання · 320 та 390px">
        <DCArtboard id="e-m-light" label="Мобільний · Світла" width={390} height={340}>
          <PHEFrame theme="light" mobile><PriceHistoryEmpty mobile /></PHEFrame>
        </DCArtboard>
        <DCArtboard id="e-m-dark" label="Мобільний · Темна" width={390} height={340}>
          <PHEFrame theme="dark" mobile><PriceHistoryEmpty mobile /></PHEFrame>
        </DCArtboard>
        <DCArtboard id="e-m-320" label="Мобільний · 320px · Світла" width={320} height={380}>
          <PHEFrame theme="light" mobile><PriceHistoryEmpty mobile /></PHEFrame>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('phe-root')).render(<PHECanvas />);
