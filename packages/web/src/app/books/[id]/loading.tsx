/**
 * Route-level loading fallback for the book details page.
 * Warm skeleton blocks with staggered fade-in per the frozen Book Details v1.1 spec.
 */
export default function BookLoading(): React.JSX.Element {
  return (
    <main className="results">
      <p className="results__eyebrow">КНИГА · ПОРІВНЯННЯ ЦІН</p>
      <div className="bdc-grid bd-stagger" aria-busy="true">
        <div>
          <div className="bdc-idrow">
            <div className="bd-sk" style={{ width: 220, height: 320, borderRadius: 'var(--radius-md)', flex: 'none' }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
              <div className="bd-sk" style={{ width: '40%', height: 10 }} />
              <div className="bd-sk" style={{ width: '78%', height: 26 }} />
              <div className="bd-sk" style={{ width: '34%', height: 14 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div className="bd-sk" style={{ width: '96%', height: 12 }} />
            <div className="bd-sk" style={{ width: '92%', height: 12 }} />
            <div className="bd-sk" style={{ width: '88%', height: 12 }} />
            <div className="bd-sk" style={{ width: '55%', height: 12 }} />
          </div>
        </div>
        <div className="bd-sk--card" style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="bd-sk" style={{ width: '45%', height: 10 }} />
          <div className="bd-sk" style={{ height: 148, borderRadius: 'var(--radius-md)' }} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
              <div className="bd-sk" style={{ width: '32%', height: 13 }} />
              <div className="bd-sk" style={{ width: '18%', height: 10, marginLeft: 'auto' }} />
              <div className="bd-sk" style={{ width: 64, height: 18 }} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
