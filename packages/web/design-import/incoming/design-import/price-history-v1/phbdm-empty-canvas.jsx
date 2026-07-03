// Knyhovo · Book Details — Mobile — EMPTY (W3.1). Price-history infrastructure
// exists, but this book lacks enough observations yet. Calm, reassuring, never
// an error. Copy matches the frozen desktop / Wishlist language. Both themes.
'use strict';

const { BookDetailsMobile: PHBDME } = window.PHBDMobile;

function PHBDMEmptyCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="empty" title="Book Details · мобільний · немає історії"
        subtitle="«Ще збираємо історію» + бейдж «Збираємо дані» + спокійний рядок про щоденну перевірку о 08:00 · не помилка · обидві теми">
        <DCArtboard id="e-light" label="Немає історії · Світла · 390px" width={390} height={1640}>
          <PHBDME theme="light" state="empty" />
        </DCArtboard>
        <DCArtboard id="e-dark" label="Немає історії · Темна · 390px" width={390} height={1640}>
          <PHBDME theme="dark" state="empty" />
        </DCArtboard>
        <DCArtboard id="e-375" label="Немає історії · Світла · 375px" width={375} height={1660}>
          <PHBDME theme="light" state="empty" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('phbdm-empty-root')).render(<PHBDMEmptyCanvas />);
