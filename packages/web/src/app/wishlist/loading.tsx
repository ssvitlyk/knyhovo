/**
 * Route-level loading fallback for the wishlist page.
 * Warm `--surface-accent` skeleton rows mirroring the WishlistRow layout.
 * Static under `prefers-reduced-motion`; staggered fade-in otherwise.
 */
export default function WishlistLoading(): React.JSX.Element {
  return (
    <main className="wishlist">
      {/* Hero skeleton */}
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <span className="v1-sk-block" style={{ width: 200, height: 11, marginBottom: 10 }} />
          <span className="v1-sk-block" style={{ width: 320, height: 36, display: 'block' }} />
        </div>
      </div>

      {/* Section skeleton */}
      <div className="v1-single">
        <div className="hy-front" style={{ marginBottom: 'var(--space-6)' }}>
          <span className="v1-sk-block" style={{ width: 180, height: 18, marginBottom: 14, display: 'block' }} />
        </div>

        <span className="v1-sk-block" style={{ width: 220, height: 18, marginBottom: 14, display: 'block' }} />

        {/* Skeleton rows */}
        <div className="v1-rows">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="v1-sk-row">
              <span className="v1-cover v1-sk-block" />
              <span className="v1-row-main">
                <span className="v1-sk-block" style={{ width: '60%', height: 16 }} />
                <span className="v1-sk-block" style={{ width: '35%', height: 12, marginTop: 6 }} />
              </span>
              <span className="v1-sk-block" style={{ width: 60, height: 22 }} />
              <span className="v1-sk-block" style={{ width: 80, height: 28 }} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
