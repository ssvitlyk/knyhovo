/**
 * Profile loading skeleton — shown by Next.js during server fetch.
 * Mirrors the notifications loading skeleton structure.
 */
export default function ProfileLoading(): React.JSX.Element {
  return (
    <div className="np-content" aria-busy="true">
      <div className="np-head">
        <div className="np-head__text">
          <span className="np-sk" style={{ display: 'block', height: 34, width: 160, borderRadius: 'var(--radius-sm)' }} />
          <span className="np-sk" style={{ display: 'block', height: 15, width: 280, marginTop: 'var(--space-3)', borderRadius: 'var(--radius-xs)' }} />
        </div>
      </div>
      <div className="pf-cards">
        {([0, 1, 2] as const).map((i) => (
          <div key={i} className="pf-card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <span className="np-sk" style={{ display: 'block', height: 20, width: '40%', maxWidth: 200, borderRadius: 'var(--radius-xs)' }} />
            <span className="np-sk" style={{ display: 'block', height: 40, width: '100%', borderRadius: 'var(--radius-sm)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
