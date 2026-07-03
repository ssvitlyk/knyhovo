// Knyhovo Wishlist — Variant C «Balanced» (Вішлист).
// EXPLORATION ONLY — not approved for implementation.
// Philosophy: «Мої книги під розумним наглядом». Equal weight: the list (left)
// and the monitoring panel (right, 460px) — the Book Details v1.1 two-pane
// architecture reused, so the whole product keeps one spatial model.

const WLC = window.WL;

function WLCPanel({ items }) {
  const { Button } = WLC.DS;
  const tracked = items.filter((i) => i.tracking).length;
  const alerts = items.filter((i) => i.alert).length;
  const drops = WLC.drops(items);
  const fired = WLC.fired(items);
  const attention = [...fired, ...drops.filter((i) => !i.targetMet)];
  return (
    <aside className="wlc-panel" data-screen-label="Monitoring panel">
      <h2 className="wlc-panel__title">Стеження</h2>
      <div className="wlc-panelstats">
        <div><div className="wl-stat__n" style={{ fontSize: '1.625rem' }}>{tracked}</div><div className="wl-stat__l">Під стеженням</div></div>
        <div><div className="wl-stat__n" style={{ fontSize: '1.625rem' }}>{alerts}</div><div className="wl-stat__l">Зі сповіщеннями</div></div>
        <div><div className={'wl-stat__n' + (drops.length ? ' wl-stat__n--green' : '')} style={{ fontSize: '1.625rem' }}>{drops.length}</div><div className="wl-stat__l">Подешевшали</div></div>
        <div><div className="wl-stat__n" style={{ fontSize: '1.125rem', paddingTop: 7 }}>08:00</div><div className="wl-stat__l">Перевірено сьогодні</div></div>
      </div>

      {attention.length ? (
        <div className="wlc-attn" data-screen-label="Варті уваги">
          <p className="wl-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>ВАРТІ УВАГИ</p>
          {attention.map((i) => (
            <div className="wlc-attn__row" key={i.id}>
              <span className="wlc-attn__title">{i.title}</span>
              <WLC.Delta item={i} />
              <span className="wl-price" style={{ fontSize: '1.125rem' }}>{WLC.uah(i.price)}</span>
            </div>
          ))}
          <Button variant="primary" size="md" style={{ width: '100%', marginTop: 'var(--space-3)' }}>
            Переглянути пропозиції
          </Button>
        </div>
      ) : (
        <div className="wl-hint" style={{ marginBottom: 'var(--space-4)' }}>
          <WLC.Icon name="info" size={16} />
          <span>Цього тижня без змін. Ціни стабільні — ми перевіряємо щодня о 08:00.</span>
        </div>
      )}

      <div data-screen-label="Notification settings">
        <div className="wlc-setrow">
          <WLC.Icon name="mail" size={16} />
          <span className="wlc-setrow__label">Email-сповіщення</span>
          <WLC.DS.Badge tone="green">Увімкнено</WLC.DS.Badge>
        </div>
        <div className="wlc-setrow">
          <WLC.Icon name="bell" size={16} />
          <span className="wlc-setrow__label">Push-сповіщення</span>
          <WLC.DS.Badge tone="neutral">Вимкнено</WLC.DS.Badge>
        </div>
        <div className="wlc-setrow">
          <WLC.Icon name="clock" size={16} />
          <span className="wlc-setrow__label">Перевірка цін</span>
          <span style={{ color: 'var(--text-muted)' }}>щодня о 08:00</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border)' }}>
        <Button variant="ghost" size="sm">Як працює стеження?</Button>
        <Button variant="ghost" size="sm" style={{ marginLeft: 'auto' }}>До пошуку</Button>
      </div>
    </aside>
  );
}

function wlcSort(items) {
  const rank = (i) => (i.targetMet ? 0 : WLC.delta(i) < 0 ? 1 : i.avail === 'in' ? 2 : i.avail === 'pending' ? 3 : 4);
  return [...items].sort((a, b) => rank(a) - rank(b));
}

function VariantBalanced({ theme, items }) {
  const { Button, Chip } = WLC.DS;
  const changed = items.filter((i) => i.price != null && WLC.delta(i) !== 0).length;
  const alerts = items.filter((i) => i.alert).length;
  const out = items.filter((i) => i.avail === 'out').length;
  return (
    <WLC.Shell theme={theme} label={'Variant C · ' + theme}>
      <div className="wl-head" data-screen-label="Page head">
        <div className="wl-head__main">
          <p className="wl-eyebrow">ВІШЛИСТ · {items.length} КНИГ · ПЕРЕВІРЕНО СЬОГОДНІ О 08:00</p>
          <h1 className="wl-h1">Вішлист</h1>
          <p className="wl-sub">Ваші книги — і їхні ціни під наглядом. Зберегли — ми стежимо; впала ціна — повідомимо.</p>
        </div>
      </div>

      <div className="wlc-grid">
        <div data-screen-label="Wishlist list">
          <div className="wl-toolbar">
            <div className="wl-chips">
              <Chip selected>Усі · {items.length}</Chip>
              <Chip>Зі змінами · {changed}</Chip>
              <Chip>Зі сповіщеннями · {alerts}</Chip>
              <Chip>Недоступні · {out}</Chip>
            </div>
            <div className="wl-toolbar__right">
              <Button variant="ghost" size="sm">За зміною ціни <WLC.Icon name="chevron-down" size={14} /></Button>
            </div>
          </div>
          <div className="wl-rows">
            {wlcSort(items).map((i) => <WLC.Row key={i.id} item={i} />)}
          </div>
          <p className="wl-checked" style={{ marginTop: 'var(--space-3)' }}>
            Ціни оновлено сьогодні о 08:00 · 5 книгарень · повернутися до <a href="#" style={{ color: 'var(--accent)' }}>результатів пошуку</a>
          </p>
        </div>
        <WLCPanel items={items} />
      </div>
    </WLC.Shell>
  );
}

/* ---------------- Mobile (<768px) — expandable cards + sticky attention strip ----------- */
function WLCMobileCard({ item, open }) {
  const { Button } = WLC.DS;
  return (
    <div className={'wlm-card' + (open ? ' wlm-card--open' : '')}>
      <div className="wlm-card__top">
        <span className="wlm-cover"></span>
        <span className="wlm-card__main">
          <span className="wlm-title">{item.title}</span>
          <span className="wl-row__author">{item.author}</span>
          <span style={{ marginTop: 2, display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
            <WLC.ItemBadge item={item} />
          </span>
        </span>
        <span className="wl-pricestack">
          {item.avail === 'pending' ? <span className="wlm-price wlm-price--faint">…</span>
            : item.avail === 'out' ? <span className="wlm-price wlm-price--faint">—</span>
              : <span className="wlm-price">{WLC.uah(item.price)}</span>}
          {WLC.delta(item) !== 0 && item.price != null ? <WLC.Delta item={item} /> : null}
        </span>
        <span className="wl-iconbtn" style={{ width: 44, height: 44 }}>
          <WLC.Icon name="chevron-down" size={18} />
        </span>
      </div>
      {open ? (
        <div className="wlm-card__body" data-screen-label="Expanded card">
          <WLC.Status item={item} checked />
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <WLC.Target item={item} />
          </div>
          <div className="wlm-card__actionrow">
            <Button variant="secondary" size="md"><WLC.Icon name="bell" size={15} /> Стежимо</Button>
            <Button variant="primary" size="md">До книгарні</Button>
          </div>
          <div className="wlm-card__actionrow">
            <Button variant="ghost" size="sm">Деталі книги</Button>
            <Button variant="ghost" size="sm">Прибрати</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VariantBalancedMobile({ theme, items }) {
  const { Button } = WLC.DS;
  const drops = WLC.drops(items).length;
  const sorted = wlcSort(items);
  return (
    <WLMShell theme={theme} label="Variant C · mobile">
      <div className="wlm-sticky" data-screen-label="Attention strip">
        <WLC.Icon name="trending-down" size={18} />
        <span className="wlm-sticky__text">
          {drops ? drops + ' книги подешевшали' : 'Ціни стабільні'}
          <small>перевірено сьогодні о 08:00</small>
        </span>
        <Button variant="ghost" size="sm">Угору</Button>
      </div>
      <p className="wl-eyebrow">ВІШЛИСТ · {items.length} КНИГ</p>
      <h1 className="wl-h1" style={{ marginBottom: 'var(--space-3)' }}>Вішлист</h1>
      <div className="wlm-chips">
        <WLC.DS.Chip selected>Усі</WLC.DS.Chip>
        <WLC.DS.Chip>Зі змінами</WLC.DS.Chip>
        <WLC.DS.Chip>Сповіщення</WLC.DS.Chip>
        <WLC.DS.Chip>Недоступні</WLC.DS.Chip>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }} data-screen-label="Expandable cards">
        {sorted.map((i, idx) => <WLCMobileCard key={i.id} item={i} open={idx === 0} />)}
      </div>
    </WLMShell>
  );
}

window.WLVariantC = { VariantBalanced, VariantBalancedMobile };
