// Knyhovo Wishlist v1.0 — Design canvas composition.
// Mounts all artboards via design_canvas.jsx + tweaks_panel.jsx.
// Depends on window.WL + window.V1 + window.V1DesktopView + window.V1MobileView +
//           window.V1StateLoading + … + window.V1DocApproval.
'use strict';

function V1Canvas() {
  const [theme,    setTheme]    = React.useState('light');
  const [scenario, setScenario] = React.useState('Звичайний тиждень');

  return (
    <React.Fragment>
      {/* ─── Tweaks panel ─────────────────────────────────── */}
      <div id="v1-tweaks" style={{
        position: 'fixed', top: 20, right: 20, zIndex: 9999,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '16px 20px', width: 224,
        boxShadow: '0 8px 24px rgba(0,0,0,.14)',
        fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)',
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 14, textTransform: 'uppercase' }}>
          Tweaks
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Тема</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {['light', 'dark'].map((t) => (
            <button key={t} type="button" onClick={() => setTheme(t)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid',
                borderColor: theme === t ? 'var(--accent)' : 'var(--border)',
                background: theme === t ? 'var(--accent-weak)' : 'transparent',
                color: theme === t ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', fontWeight: 500, fontSize: 12,
              }}>{t}</button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Сценарій</p>
        {['Звичайний тиждень', 'Хвиля знижок', 'Тихий тиждень'].map((s) => (
          <button key={s} type="button" onClick={() => setScenario(s)}
            style={{
              display: 'block', width: '100%', marginBottom: 4, padding: '6px 10px',
              borderRadius: 6, border: '1px solid',
              borderColor: scenario === s ? 'var(--accent)' : 'var(--border)',
              background: scenario === s ? 'var(--accent-weak)' : 'transparent',
              color: scenario === s ? 'var(--accent)' : 'var(--text-body)',
              cursor: 'pointer', textAlign: 'left', fontSize: 12,
            }}>{s}</button>
        ))}
      </div>

      <DesignCanvas>

        {/* ═══════════════════════════════════════════════════
            SECTION 1: Main views
        ═══════════════════════════════════════════════════ */}
        <DCSection id="main" title="Головні екрани" subtitle="Desktop + Mobile · обидві теми">

          <DCArtboard id="desk-light" label={`Desktop · ${theme === 'dark' ? 'Темна' : 'Світла'} · ${scenario}`} width={1440} height={2440}>
            <V1DesktopView theme={theme} scenario={scenario} />
          </DCArtboard>

          <DCArtboard id="mob-light" label={`Mobile · ${theme === 'dark' ? 'Темна' : 'Світла'} · ${scenario}`} width={390} height={1840}>
            <V1MobileView theme={theme} scenario={scenario} />
          </DCArtboard>

          <DCArtboard id="desk-alt" label={`Desktop · ${theme === 'dark' ? 'Світла' : 'Темна'} · ${scenario}`} width={1440} height={2440}>
            <V1DesktopView theme={theme === 'dark' ? 'light' : 'dark'} scenario={scenario} />
          </DCArtboard>

          <DCArtboard id="mob-alt" label={`Mobile · ${theme === 'dark' ? 'Світла' : 'Темна'} · ${scenario}`} width={390} height={1840}>
            <V1MobileView theme={theme === 'dark' ? 'light' : 'dark'} scenario={scenario} />
          </DCArtboard>

        </DCSection>

        {/* ═══════════════════════════════════════════════════
            SECTION 2: States
        ═══════════════════════════════════════════════════ */}
        <DCSection id="states" title="Стани" subtitle="Усі обов'язкові стани · desktop + mobile">

          <DCArtboard id="s-loading-d" label="Завантаження · Desktop" width={1440} height={1280}>
            <V1StateLoading theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-loading-m" label="Завантаження · Mobile" width={390} height={1220}>
            <V1StateLoading theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-empty-d" label="Порожній стан · Desktop" width={1440} height={1340}>
            <V1StateEmpty theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-empty-m" label="Порожній стан · Mobile" width={390} height={1180}>
            <V1StateEmpty theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-first-d" label="Перша книга · Desktop" width={1440} height={1020}>
            <V1StateFirstBook theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-first-m" label="Перша книга · Mobile" width={390} height={1080}>
            <V1StateFirstBook theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-quiet-d" label="Без активних сповіщень · Desktop" width={1440} height={1560}>
            <V1StateNoAlerts theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-quiet-m" label="Без активних сповіщень · Mobile" width={390} height={1100}>
            <V1StateNoAlerts theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-50-d" label="50+ книг · Desktop" width={1440} height={1920}>
            <V1State50Plus theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-50-m" label="50+ книг · Mobile" width={390} height={1280}>
            <V1State50Plus theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-drop-d" label="Знижка ціни · Desktop" width={1440} height={1840}>
            <V1StatePriceDrop theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-drop-m" label="Знижка ціни · Mobile" width={390} height={1540}>
            <V1StatePriceDrop theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-out-d" label="Недоступна книга · Desktop" width={1440} height={1720}>
            <V1StateUnavailable theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-out-m" label="Недоступна книга · Mobile" width={390} height={1260}>
            <V1StateUnavailable theme={theme} mobile />
          </DCArtboard>

        </DCSection>

        {/* ═══════════════════════════════════════════════════
            SECTION 3: Documentation
        ═══════════════════════════════════════════════════ */}
        <DCSection id="docs" title="Документація" subtitle="Специфікація · Маскот · Анотації · Затвердження">

          <DCArtboard id="d-panel" label="Панель моніторингу — специфікація" width={1200} height={1840}>
            <V1DocPanelSpec theme={theme} />
          </DCArtboard>

          <DCArtboard id="d-mascot" label="Маскот — дошка використання" width={1200} height={1540}>
            <V1DocMascotBoard theme={theme} />
          </DCArtboard>

          <DCArtboard id="d-anno" label="Анотації реалізації" width={1200} height={1800}>
            <V1DocAnnotations theme={theme} />
          </DCArtboard>

          <DCArtboard id="d-approve" label="Затверджений напрям" width={1200} height={1100}>
            <V1DocApproval theme={theme} />
          </DCArtboard>

        </DCSection>

      </DesignCanvas>
    </React.Fragment>
  );
}

const v1Root = document.getElementById('v1-root');
ReactDOM.createRoot(v1Root).render(<V1Canvas />);
