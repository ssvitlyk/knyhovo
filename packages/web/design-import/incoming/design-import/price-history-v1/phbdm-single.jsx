// Knyhovo · Book Details — Mobile — Filled, SINGLE THEME (W3.2 polish review).
// Renders the filled mobile Book Details page in one theme, in a centered phone-
// width column, so the polished «Динаміка ціни» rhythm can be reviewed per theme.
// Theme is read from <html data-theme>. Reuses window.PHBDMobile (no new layout).
'use strict';

const { BookDetailsMobile: PHBDMSingle } = window.PHBDMobile;
const PHBDM_THEME = document.documentElement.getAttribute('data-theme') || 'light';

function PHBDMSingleFrame() {
  return (
    <div style={{ minHeight: '100vh', width: '100%', background: 'var(--bg)', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 390, maxWidth: '100%' }}>
        <PHBDMSingle theme={PHBDM_THEME} state="filled" />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('phbdm-single-root')).render(<PHBDMSingleFrame />);
