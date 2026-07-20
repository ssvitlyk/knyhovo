import { AbIcon } from './icons';

/**
 * Decorative mini-UI vignettes for the `Features` cards — ported verbatim
 * from `about-app.jsx` (VizWishlist/VizAlerts/VizHistory/VizDetails). All
 * aria-hidden; not real interactive UI.
 */

export function VizWishlist(): React.JSX.Element {
  return (
    <div className="vg-stack" aria-hidden="true">
      <div className="vg-row">
        <img className="vg-cover" src="/covers/atomni.png" alt="" />
        <div className="vg-col">
          <div className="vg-t">Атомні звички</div>
          <div className="vg-s">Джеймс Клір</div>
        </div>
        <span className="vg-heart">
          <AbIcon name="heart" size={15} fill />
        </span>
      </div>
      <div className="vg-row">
        <img className="vg-cover" src="/covers/misto.png" alt="" />
        <div className="vg-col">
          <div className="vg-t">Місто</div>
          <div className="vg-s">Валер’ян Підмогильний</div>
        </div>
        <span className="vg-badge">Ціна впала</span>
      </div>
    </div>
  );
}

export function VizAlerts(): React.JSX.Element {
  return (
    <div className="vg-row" style={{ width: '80%' }} aria-hidden="true">
      <span
        className="ab-ic"
        style={{
          width: 34,
          height: 34,
          background: 'color-mix(in oklab, var(--brand-green) 14%, var(--surface))',
          color: 'var(--brand-green)',
        }}
      >
        <AbIcon name="bell" size={17} />
      </span>
      <div className="vg-col">
        <div className="vg-t">Ціна впала до 245 ₴</div>
        <div className="vg-s">«Атомні звички» · ваша ціль досягнута</div>
      </div>
    </div>
  );
}

export function VizHistory(): React.JSX.Element {
  return (
    <>
      <svg className="vg-spark" width="190" height="70" viewBox="0 0 190 70" fill="none" aria-hidden="true">
        <path
          d="M6 20 L34 26 L60 22 L86 37 L112 33 L140 49 L168 55"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="168" cy="55" r="4.5" fill="var(--brand-green)" />
      </svg>
      <span className="vg-badge vg-sparkbadge">−18% за 90 днів</span>
    </>
  );
}

export function VizDetails(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '82%' }} aria-hidden="true">
      <img
        src="/covers/sapiens.png"
        alt=""
        style={{ width: 44, height: 64, borderRadius: 5, objectFit: 'cover', boxShadow: 'var(--shadow-md)', flexShrink: 0 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <div className="vg-pr vg-pr--best">
          <span>Книгарня А</span>
          <b>245 ₴</b>
        </div>
        <div className="vg-pr">
          <span>Книгарня Б</span>
          <b>289 ₴</b>
        </div>
        <div className="vg-pr">
          <span>Книгарня В</span>
          <b>312 ₴</b>
        </div>
      </div>
    </div>
  );
}
