/**
 * Route-level loading fallback for /catalog. Warm `--surface-accent`
 * skeletons mirroring the hero + first shelf so there's no layout shift.
 */
export default function CatalogLoading(): React.JSX.Element {
  return (
    <main aria-busy="true">
      <section className="sec sec--hero">
        <div className="page">
          <div
            className="feat-card"
            style={{ background: 'var(--surface-accent)', boxShadow: 'none' }}
            aria-hidden="true"
          >
            <span style={{ width: 262, height: 181, borderRadius: 12, background: 'var(--surface)' }} />
            <span style={{ display: 'block', width: '60%', height: 20, borderRadius: 6, background: 'var(--surface)' }} />
            <span style={{ width: 90, height: 40, borderRadius: 10, background: 'var(--surface)' }} />
          </div>
        </div>
      </section>
      <section className="sec">
        <div className="page">
          <div style={{ width: 240, height: 28, borderRadius: 6, background: 'var(--surface-accent)', marginBottom: 18 }} />
          <div style={{ display: 'flex', gap: 18 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  flex: '0 0 202px',
                  aspectRatio: '2 / 3',
                  borderRadius: 18,
                  background: 'var(--surface-accent)',
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
