// Knyhovo · Book Details — Mobile — LOADING (W3.1). Only the price-history
// section is skeleton (it loads after the page). The skeleton mirrors the final
// structure (title · explanatory text · chips · chart with band · stats) so the
// section reserves identical height and never shifts. Warm surfaces only.
'use strict';

const { BookDetailsMobile: PHBDML } = window.PHBDMobile;

function PHBDMLoadingCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="loading" title="Book Details · мобільний · завантаження"
        subtitle="Скелет секції повторює фінальну структуру (заголовок · текст · чипи · графік зі смугою · статистика) — однакова висота, без зсуву · обидві теми">
        <DCArtboard id="l-light" label="Завантаження · Світла · 390px" width={390} height={1820}>
          <PHBDML theme="light" state="loading" />
        </DCArtboard>
        <DCArtboard id="l-dark" label="Завантаження · Темна · 390px" width={390} height={1820}>
          <PHBDML theme="dark" state="loading" />
        </DCArtboard>
        <DCArtboard id="l-375" label="Завантаження · Світла · 375px" width={375} height={1840}>
          <PHBDML theme="light" state="loading" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('phbdm-loading-root')).render(<PHBDMLoadingCanvas />);
