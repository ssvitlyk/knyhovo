// Knyhovo Wishlist v1.0 — Final Design Freeze · Main views: Desktop + Mobile.
// Approved for implementation.
'use strict';

const _VW = window.WL;
const _VDS = window.KnyhovoDesignSystem_9fa616;
const _V1W = window.V1;

/* ── Desktop main view ─────────────────────────────────────────────────── */
function V1DesktopView({ theme, scenario }) {
  const items = _VW.getItems(scenario || 'Звичайний тиждень');
  const drops = _VW.drops(items);

  return (
    <_V1W.Shell theme={theme} label="Wishlist v1.0 · Desktop">
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">
            ВІШЛИСТ · {items.length} КНИГ · {items.filter((i) => i.tracking).length} ВІДСТЕЖУЄТЬСЯ
          </p>
          <h1 className="v1-h1">
            Мої книги,{' '}
            <em>за якими Knyhovo стежить</em>
          </h1>
          <p className="v1-sub">Knyhovo непомітно стежить за цінами — сповістимо, коли настане слушний момент.</p>
        </div>
        <div className="v1-page-head-right">
          <div className="v1-trust-row">
            <span className="v1-savings-pill">
              <_VW.Icon name="trending-down" size={14} />
              Заощаджено з Knyhovo: <b>412 ₴</b>
            </span>
            <span className="v1-checked-pill">
              <_VW.Icon name="clock" size={13} />
              Перевірено сьогодні о 08:00
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <_VDS.Button variant="ghost" size="sm">Масові дії</_VDS.Button>
            <_VDS.Button variant="secondary" size="sm">Додати книгу</_VDS.Button>
          </div>
        </div>
      </div>

      {drops.length > 0 && (
        <div className="v1-drop-banner" data-screen-label="Price drop banner">
          <_VW.Icon name="trending-down" size={16} />
          <span>
            <b>{drops.length === 1 ? 'Знайшли кращу ціну' : 'Знайшли ' + drops.length + ' кращих ціни'}:</b>{' '}
            {drops.slice(0, 2).map((d, i) => (
              <span key={d.id}>«{d.title}» — ціна впала
                {i < drops.length - 1 && i < 1 ? ', ' : ''}
              </span>
            ))}
          </span>
        </div>
      )}

      <div className="v1-single">
        <_V1W.SortBar items={items} />
        <div className="v1-rows">
          {items.map((item) => <_V1W.Row key={item.id} item={item} />)}
        </div>
      </div>
    </_V1W.Shell>
  );
}

/* ── Mobile main view ──────────────────────────────────────────────────── */
/* Brief hierarchy: crumbs → eyebrow → h1 → savings → checked → digest → chips → items → footer */
function V1MobileView({ theme, scenario }) {
  const items = _VW.getItems(scenario || 'Звичайний тиждень');
  const drops = _VW.drops(items);
  const digest = drops[0];

  return (
    <_V1W.Shell theme={theme} label="Wishlist v1.0 · Mobile" mobile>

      {/* Hero — full title per brief */}
      <div style={{ padding: 'var(--space-5) 0 var(--space-3)' }}>
        <p className="v1-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>ВІШЛИСТ · {items.length} КНИГ</p>
        <h1 className="v1-h1 v1-h1--mob">
          Мої книги,{' '}<em>за якими стежить Knyhovo</em>
        </h1>
      </div>

      {/* Compact summary plate — savings + checked on one small row (no dashboard, saves hero space) */}
      <div className="v1-mob-summary">
        <span className="v1-mob-summary-item v1-mob-summary-item--save">
          <_VW.Icon name="trending-down" size={13} />
          <b>412 ₴</b> заощаджено
        </span>
        <span className="v1-mob-summary-sep"></span>
        <span className="v1-mob-summary-item">
          <_VW.Icon name="clock" size={12} />
          Перевірено сьогодні о 08:00
        </span>
      </div>
      {digest && (
        <p className="v1-mob-digest-line">
          «{digest.title}» впав до{' '}
          <b style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{_VW.uah(digest.price)}</b>
          {' '}— найнижча за 3 місяці.{' '}
          <a href="#" style={{ color: 'var(--accent)', fontWeight: 500 }}>До книги</a>
        </p>
      )}

      {/* Filter chips */}
      <div className="v1-mob-sort">
        <_VDS.Chip selected>Всі</_VDS.Chip>
        <_VDS.Chip>Знижки {drops.length ? '(' + drops.length + ')' : ''}</_VDS.Chip>
        <_VDS.Chip>Стежу</_VDS.Chip>
      </div>

      {/* Book items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {items.map((item) => <_V1W.MobCard key={item.id} item={item} />)}
      </div>

      <div className="v1-mob-sticky">
        <_VDS.Button variant="primary" size="md" style={{ width: '100%' }}>
          Додати книгу
        </_VDS.Button>
      </div>
    </_V1W.Shell>
  );
}

Object.assign(window, { V1DesktopView, V1MobileView });
