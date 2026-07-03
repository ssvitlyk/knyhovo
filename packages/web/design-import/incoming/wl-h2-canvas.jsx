// Knyhovo «Бажанки» v1.0 — HYBRID DESIGN FREEZE (D + C) · Ревізія 2026-06-13 · Canvas.
'use strict';

function H2Canvas() {
  const [theme, setTheme] = React.useState('light');
  const [scenario, setScenario] = React.useState('Звичайний тиждень');

  return (
    <React.Fragment>
      {/* ─── Tweaks panel ─────────────────────────────────── */}
      <div id="h2-tweaks" style={{
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
          Final Design Freeze · Hybrid D + C
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

        {/* ═══ SECTION 1: Main views ═══ */}
        <DCSection id="main" title="Головні екрани — Бажанки (Hybrid D + C)"
          subtitle="Desktop = Variant D · Mobile = Variant C accordion · знижки автоматично вгорі · обидві теми">

          <DCArtboard id="h2-desk-light" label={`Desktop · Світла · ${scenario}`} width={1440} height={2560}>
            <H2DesktopView theme="light" scenario={scenario} />
          </DCArtboard>

          <DCArtboard id="h2-desk-dark" label={`Desktop · Темна · ${scenario}`} width={1440} height={2560}>
            <H2DesktopView theme="dark" scenario={scenario} />
          </DCArtboard>

          <DCArtboard id="h2-mob-light" label={`Mobile · Світла · ${scenario}`} width={390} height={2120}>
            <H2MobileView theme="light" scenario={scenario} />
          </DCArtboard>

          <DCArtboard id="h2-mob-dark" label={`Mobile · Темна · ${scenario}`} width={390} height={2120}>
            <H2MobileView theme="dark" scenario={scenario} />
          </DCArtboard>

        </DCSection>

        {/* ═══ SECTION 2: States ═══ */}
        <DCSection id="states" title="Стани" subtitle="Ревізія 2026-06-13 · Недоступна книга — утилітарний стан без Книговика">

          <DCArtboard id="s-loading-d" label="Завантаження · Desktop" width={1440} height={1330}>
            <H2StateLoading theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-loading-m" label="Завантаження · Mobile" width={390} height={1230}>
            <H2StateLoading theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-empty-d" label="Порожній стан · Desktop" width={1440} height={1290}>
            <H2StateEmpty theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-empty-m" label="Порожній стан · Mobile" width={390} height={1080}>
            <H2StateEmpty theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-first-d" label="Перша книга · Desktop" width={1440} height={1180}>
            <H2StateFirstBook theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-first-m" label="Перша книга · Mobile" width={390} height={1120}>
            <H2StateFirstBook theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-quiet-d" label="Тихий тиждень · Desktop" width={1440} height={1700}>
            <H2StateQuiet theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-quiet-m" label="Тихий тиждень · Mobile" width={390} height={1130}>
            <H2StateQuiet theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-50-d" label="50+ книг · Desktop" width={1440} height={2200}>
            <H2State50Plus theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-50-m" label="50+ книг · Mobile" width={390} height={1640}>
            <H2State50Plus theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-drop-d" label="Хвиля знижок · Desktop" width={1440} height={2040}>
            <H2StatePriceDrop theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-drop-m" label="Хвиля знижок · Mobile" width={390} height={1780}>
            <H2StatePriceDrop theme={theme} mobile />
          </DCArtboard>

          <DCArtboard id="s-out-d" label="Недоступна книга · Desktop" width={1440} height={1500}>
            <H2StateUnavailable theme={theme} />
          </DCArtboard>
          <DCArtboard id="s-out-m" label="Недоступна книга · Mobile" width={390} height={1180}>
            <H2StateUnavailable theme={theme} mobile />
          </DCArtboard>

        </DCSection>

        {/* ═══ SECTION 3: Documentation ═══ */}
        <DCSection id="docs" title="Документація"
          subtitle="Що змінилось · Hybrid Recommendation · Green hierarchy · Специфікація картки · Final Design Freeze">

          <DCArtboard id="d-changes" label="Що змінилось — Final Freeze" width={1200} height={1320}>
            <H2DocChanges theme={theme} />
          </DCArtboard>

          <DCArtboard id="d-hybrid" label="Hybrid Recommendation (D + C)" width={1200} height={1400}>
            <H2DocHybrid theme={theme} />
          </DCArtboard>

          <DCArtboard id="d-green" label="Green hierarchy — специфікація" width={1200} height={1560}>
            <H2DocGreen theme={theme} />
          </DCArtboard>

          <DCArtboard id="d-cardspec" label="Картка книги у бажанках — специфікація" width={1200} height={2240}>
            <H2DocCardSpec theme={theme} />
          </DCArtboard>

          <DCArtboard id="d-approve" label="Final Design Freeze — затверджено" width={1200} height={1500}>
            <H2DocApproval theme={theme} />
          </DCArtboard>

        </DCSection>

      </DesignCanvas>
    </React.Fragment>
  );
}

const h2Root = document.getElementById('h2-root');
ReactDOM.createRoot(h2Root).render(<H2Canvas />);
