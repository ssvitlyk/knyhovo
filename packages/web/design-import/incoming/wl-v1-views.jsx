// Knyhovo Wishlist v1.0 — Main views: Desktop + Mobile.
// Depends on window.WL + window.V1 + window.KnyhovoDesignSystem_9fa616.
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

      <div className="v1-grid">
        <div>
          <_V1W.SortBar items={items} />
          <div className="v1-rows">
            {items.map((item) => <_V1W.Row key={item.id} item={item} />)}
          </div>
        </div>
        <_V1W.Panel items={items} />
      </div>
    </_V1W.Shell>
  );
}

/* ── Mobile main view ──────────────────────────────────────────────────── */
function V1MobileView({ theme, scenario }) {
  const items = _VW.getItems(scenario || 'Звичайний тиждень');
  const drops = _VW.drops(items);

  return (
    <_V1W.Shell theme={theme} label="Wishlist v1.0 · Mobile" mobile>
      <div className="v1-mob-head">
        <div>
          <p className="v1-eyebrow">ВІШЛИСТ · {items.length} КНИГ</p>
          <h1 className="v1-h1 v1-h1--mob">Мої книги</h1>
        </div>
        <div className="v1-mob-trust">
          <span className="v1-savings-pill v1-savings-pill--sm">
            <_VW.Icon name="trending-down" size={12} />
            <b>412 ₴</b> заощаджено
          </span>
          <span className="v1-checked-pill v1-checked-pill--sm">
            <_VW.Icon name="clock" size={11} />
            Перевірено о 08:00
          </span>
        </div>
      </div>

      <_V1W.MobilePanel items={items} />

      <div className="v1-mob-sort">
        <_VDS.Chip selected>Всі</_VDS.Chip>
        <_VDS.Chip>Знижки {drops.length ? '(' + drops.length + ')' : ''}</_VDS.Chip>
        <_VDS.Chip>Стежу</_VDS.Chip>
      </div>

      <div className="v1-rows v1-rows--mob">
        {items.map((item) => (
          <div key={item.id}
            className={'v1-mob-row' + (item.targetMet ? ' v1-mob-row--hot' : '') + (item.avail === 'out' ? ' v1-mob-row--out' : '')}>
            <span className="v1-mob-cover"></span>
            <div className="v1-mob-row-main">
              <span className="v1-mob-row-title">{item.title}</span>
              <span className="v1-mob-row-author">{item.author}</span>
              <div className="v1-mob-row-status">
                <_VW.ItemBadge item={item} />
                <_VW.Status item={item} />
              </div>
            </div>
            <div className="v1-mob-row-right">
              <_VW.PriceStack item={item} />
              <_VW.Delta item={item} />
            </div>
          </div>
        ))}
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
