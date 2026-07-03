// Knyhovo · Book Details — Mobile — Filled, THEME COMPARISON (W3.2 review).
// Restores the side-by-side dark + light review: two 390px phone columns on the
// warm gridded review backdrop, dark on the left, light on the right. Reuses
// window.PHBDMobile (no new layout / no new visual language).
'use strict';

const { BookDetailsMobile: PHBDMCompare } = window.PHBDMobile;

function PHBDMColumn({ theme }) {
  // Each column carries its own theme + own page background (var(--bg)),
  // so the dark column is fully dark and the light column fully warm paper.
  return (
    <div data-theme={theme} style={{
      width: 390, maxWidth: '100%', flex: 'none',
      background: 'var(--bg)',
      boxShadow: 'var(--shadow-lg)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <PHBDMCompare theme={theme} state="filled" />
    </div>
  );
}

function PHBDMCompareFrame() {
  return (
    <div className="phbdm-stage">
      <div className="phbdm-row">
        <PHBDMColumn theme="dark" />
        <PHBDMColumn theme="light" />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('phbdm-compare-root')).render(<PHBDMCompareFrame />);
