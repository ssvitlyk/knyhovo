// Knyhovo · Book Details — Mobile — FILLED (W3.1). The approved desktop Price
// History experience, continued on mobile: chart + typical band + stats, in the
// real Book Details mobile page, both themes, at 375 + 390px.
'use strict';

const { BookDetailsMobile: PHBDMF } = window.PHBDMobile;

function PHBDMFilledCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="filled" title="Book Details · мобільний · заповнено"
        subtitle="Динаміка ціни одразу під блоком «Де купити» · графік + смуга звичайної ціни + статистика 2×2 · обидві теми">
        <DCArtboard id="f-light" label="Заповнено · Світла · 390px" width={390} height={1980}>
          <PHBDMF theme="light" state="filled" />
        </DCArtboard>
        <DCArtboard id="f-dark" label="Заповнено · Темна · 390px" width={390} height={1980}>
          <PHBDMF theme="dark" state="filled" />
        </DCArtboard>
        <DCArtboard id="f-375" label="Заповнено · Світла · 375px" width={375} height={1990}>
          <PHBDMF theme="light" state="filled" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('phbdm-filled-root')).render(<PHBDMFilledCanvas />);
