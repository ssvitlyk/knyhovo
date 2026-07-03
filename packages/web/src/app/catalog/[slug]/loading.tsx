/**
 * Route-level loading fallback for /catalog/[slug]. Warm `--surface-accent`
 * skeletons mirroring the info header + grid so there's no layout shift.
 */
export default function CollectionDetailLoading(): React.JSX.Element {
  return (
    <main aria-busy="true">
      <div className="page">
        <div style={{ padding: '14px 0 0' }}>
          <div style={{ width: 220, height: 13, borderRadius: 4, background: 'var(--surface-accent)' }} />
        </div>
        <div className="cd-info">
          <div style={{ width: '48%', height: 30, borderRadius: 6, background: 'var(--surface-accent)' }} />
          <div style={{ width: '70%', height: 16, borderRadius: 6, background: 'var(--surface-accent)', marginTop: 10 }} />
        </div>
      </div>

      <div className="cd-sortbar">
        <div className="page">
          <div className="cd-sortbar__row">
            <div style={{ width: 208, height: 40, borderRadius: 10, background: 'var(--surface-accent)' }} />
          </div>
        </div>
      </div>

      <div className="page">
        <div className="cd-grid-wrap">
          <div className="cd-grid">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '2 / 3',
                  borderRadius: 18,
                  background: 'var(--surface-accent)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
