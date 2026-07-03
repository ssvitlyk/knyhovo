// Knyhovo · Price History — LOADING STATES canvas (W3 revision).
// The skeleton MIRRORS the final component structure (title · explanatory
// text · period chips · chart with typical band · 4-stat row) so users
// recognise price history is loading and layout shift is minimised.
// Warm --surface-accent / --surface-sunk blocks only — never cold grey.
'use strict';

const PHL_DS = window.KnyhovoDesignSystem_9fa616;
const PHL_ASSET = '../../';
const { PriceHistoryLoading } = window.PHChart;

function PHLFrame({ theme, children, mobile }) {
  return (
    <div className={'bd-page ph-frame' + (mobile ? ' bdm' : '')} data-theme={theme}
      style={{ padding: mobile ? 'var(--space-5) 0' : 'var(--space-8) var(--space-12)' }}>
      <div className={mobile ? 'bdm-wrap' : ''} style={mobile ? null : { maxWidth: 1180, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  );
}

function PHLCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="desktop" title="«Динаміка ціни» — завантаження · десктоп"
        subtitle="Скелет повторює фінальну структуру: заголовок · пояснювальний текст · чипи періоду · графік зі смугою звичайної ціни · рядок статистики">
        <DCArtboard id="l-light" label="Завантаження · Світла" width={1240} height={580}>
          <PHLFrame theme="light"><PriceHistoryLoading /></PHLFrame>
        </DCArtboard>
        <DCArtboard id="l-dark" label="Завантаження · Темна" width={1240} height={580}>
          <PHLFrame theme="dark"><PriceHistoryLoading /></PHLFrame>
        </DCArtboard>
      </DCSection>

      <DCSection id="mobile" title="«Динаміка ціни» — завантаження · мобільний"
        subtitle="Та сама структура, компактно · без горизонтального скролу · 320 та 390px">
        <DCArtboard id="l-m-light" label="Мобільний · Світла" width={390} height={540}>
          <PHLFrame theme="light" mobile><PriceHistoryLoading mobile /></PHLFrame>
        </DCArtboard>
        <DCArtboard id="l-m-dark" label="Мобільний · Темна" width={390} height={540}>
          <PHLFrame theme="dark" mobile><PriceHistoryLoading mobile /></PHLFrame>
        </DCArtboard>
        <DCArtboard id="l-m-320" label="Мобільний · 320px · Світла" width={320} height={560}>
          <PHLFrame theme="light" mobile><PriceHistoryLoading mobile /></PHLFrame>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('phl-root')).render(<PHLCanvas />);
