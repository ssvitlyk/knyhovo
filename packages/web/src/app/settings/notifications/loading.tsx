/**
 * Notifications loading skeleton — shown by Next.js during server fetch.
 * Port of ContentLoading from design-import/incoming/np-shared.jsx.
 */
export default function NotificationsLoading(): React.JSX.Element {
  return (
    <div className="np-content" aria-busy="true">
      <div className="np-head">
        <div className="np-head__text">
          <span className="np-sk" style={{ display: 'block', height: 34, width: 280, borderRadius: 'var(--radius-sm)' }} />
          <span className="np-sk" style={{ display: 'block', height: 15, width: 220, marginTop: 'var(--space-3)', borderRadius: 'var(--radius-xs)' }} />
        </div>
        <span className="np-sk" style={{ display: 'block', height: 26, width: 150, borderRadius: 'var(--radius-pill)' }} />
      </div>
      <div className="np-cards">
        {([0, 1] as const).map((i) => (
          <div key={i} className="np-card np-card--sk">
            <div className="np-card__info" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <span className="np-sk" style={{ display: 'block', height: 17, width: '52%', maxWidth: 230 }} />
              <span className="np-sk" style={{ display: 'block', height: 13, width: '86%', maxWidth: 380 }} />
            </div>
            <span className="np-sk" style={{ display: 'block', width: 48, height: 26, borderRadius: 'var(--radius-pill)', flexShrink: 0 }} />
          </div>
        ))}
      </div>
      <div className="np-helper">
        <span className="np-sk" style={{ display: 'block', height: 13, width: 190, borderRadius: 'var(--radius-xs)' }} />
      </div>
    </div>
  );
}
