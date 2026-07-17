/**
 * Route-level loading fallback for the wishlist v2.2 page. Mirrors the real
 * section geometry (hero band ~208px → «Зараз вигідно купити» band → «Решта
 * бажанок» grid) with warm `--surface-accent` skeleton blocks — never cold
 * greys (frozen rule). No inner `.page`: the root layout already provides the
 * padded page container.
 */
export default function WishlistLoading(): React.JSX.Element {
  return (
    <main className="wishlist">
      <div className="wl-sk wl-sk--hero" />

      <div className="band band--green">
        <div className="wl-sk wl-sk--line" style={{ width: 220, height: 22, marginBottom: 18 }} />
        <div className="wl-sk-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="wl-sk wl-sk--card" />
          ))}
        </div>
      </div>

      <div className="sec">
        <div className="wl-sk wl-sk--line" style={{ width: 180, height: 22, marginBottom: 18 }} />
        <div className="wl-sk-grid">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="wl-sk wl-sk--tile" />
          ))}
        </div>
      </div>
    </main>
  );
}
