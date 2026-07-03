// Knyhovo Wishlist v1.0 — HYBRID DESIGN FREEZE (D + C) · Canvas composition.
'use strict';

function HYCanvas() {
  const [theme, setTheme] = React.useState('light');
  const [scenario, setScenario] = React.useState('Звичайний тиждень');

  return (
    <React.Fragment>
      {/* ─── Tweaks panel ─────────────────────────────────── */}
      <div id="hy-tweaks" style={{
        position: 'fixed', top: 20, right: 20, zIndex: 9999,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '16px 20px', width: 224,
        boxShadow: '0 8px 24px rgba(0,0,0,.14)',
        fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text)',
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>
          Tweaks
        </p>
        <p style={{ fontSize: 10, color: 'var(--brand-green)', marginBottom: 14, fontWeight: 600 }}>
          Hybrid Design Freeze (D + C) · Approved
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Тема (стани і документація)</p>
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

        {/* ═══ SECTION 1: Main views — desktop light/dark + mobile light/dark ═══ */}
        <DCSection id="main" title="Головні екрани — Hybrid (D + C)"
          subtitle="Desktop = Variant D «Момент» · Mobile = Variant C accordion + D discount styling · обидві теми">

          <DCArtboard id="hy-desk-light" label={`Desktop · Світла · ${scenario}`} width={1440} height={2520}>
            <HYDesktopView theme="light" scenario={scenario} />
          </DCArtboard>

          <DCArtboard id="hy-desk-dark" label={`Desktop · Темна · ${scenario}`} width={1440} height={2520}>
            <HYDesktopView theme="dark" scenario={scenario} />
          </DCArtboard>

          <DCArtboard id="hy-mob-light" label={`Mobile · Світла · ${scenario}`} width={390} height={2050}>
            <HYMobileView theme="light" scenario={scenario} />
          </DCArtboard>

          <DCArtboard id="hy-mob-dark" label={`Mobile · Темна · ${scenario}`} width={390} height={2050}>
            <HYMobileView theme="dark" scenario={scenario} />
          </DCArtboard>

        </DCSection>

        {/* ═══ SECTION 2: States ═══ */}
        <DCSection id="states" title="Стани" subtitle="Hybrid Freeze · Усі обов'язкові стани · desktop + mobile">

          <DCArtboard id="s-loading-d" label="Завантаження · Desktop" width={1440} height={1330}>
            <HYStateLoading theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-loading-m" label="Завантаження · Mobile" width={390} height={1230}>
            <HYStateLoading theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-empty-d" label="Порожній стан · Desktop" width={1440} height={1290}>
            <HYStateEmpty theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-empty-m" label="Порожній стан · Mobile" width={390} height={1080}>
            <HYStateEmpty theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-first-d" label="Перша книга · Desktop" width={1440} height={1010}>
            <HYStateFirstBook theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-first-m" label="Перша книга · Mobile" width={390} height={1040}>
            <HYStateFirstBook theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-quiet-d" label="Тихий тиждень · Desktop" width={1440} height={1660}>
            <HYStateQuiet theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-quiet-m" label="Тихий тиждень · Mobile" width={390} height={1130}>
            <HYStateQuiet theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-50-d" label="50+ книг · Desktop" width={1440} height={2150}>
            <HYState50Plus theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-50-m" label="50+ книг · Mobile" width={390} height={1560}>
            <HYState50Plus theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-drop-d" label="Хвиля знижок · Desktop" width={1440} height={1980}>
            <HYStatePriceDrop theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-drop-m" label="Хвиля знижок · Mobile" width={390} height={1640}>
            <HYStatePriceDrop theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-out-d" label="Недоступна книга · Desktop" width={1440} height={1760}>
            <HYStateUnavailable theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-out-m" label="Недоступна книга · Mobile" width={390} height={1290}>
            <HYStateUnavailable theme={theme} mobile />
          </DCArtboard>

        </DCSection>

        {/* ═══ SECTION 3: Documentation ═══ */}
        <DCSection id="docs" title="Документація"
          subtitle="Hybrid Recommendation (D + C) · Green hierarchy · Специфікація картки · Затвердження">

          <DCArtboard id="d-hybrid" label="Hybrid Recommendation (D + C)" width={1200} height={1330}>
            <HYDocHybrid theme={theme} />
          </DCArtboard>

          <DCArtboard id="d-green" label="Green hierarchy — специфікація" width={1200} height={1560}>
            <HYDocGreen theme={theme} />
          </DCArtboard>

          <DCArtboard id="d-cardspec" label="Мобільна картка — специфікація" width={1200} height={1700}>
            <HYDocCardSpec theme={theme} />
          </DCArtboard>

          <DCArtboard id="d-approve" label="Затверджений напрям" width={1200} height={1330}>
            <HYDocApproval theme={theme} />
          </DCArtboard>

        </DCSection>

      </DesignCanvas>
    </React.Fragment>
  );
}

const hyRoot = document.getElementById('hy-root');
ReactDOM.createRoot(hyRoot).render(<HYCanvas />);
