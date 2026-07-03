// Knyhovo Wishlist — Variant B «Alert-first» (Стеження за цінами).
// EXPLORATION ONLY — not approved for implementation.
// Philosophy: «Не пропустіть кращу ціну». A monitoring dashboard: price changes
// are the dominant signal; unchanged books step back into collapsed groups.

const WLB = window.WL;

function WLBDigest({ items }) {
  const drops = WLB.drops(items).length;
  const rises = WLB.rises(items).length;
  const fired = WLB.fired(items).length;
  return (
    <div className="wl-digest" data-screen-label="Digest strip">
      <div className="wl-digest__cell">
        <div className={'wl-stat__n' + (drops ? ' wl-stat__n--green' : '')}>{drops}</div>
        <div className="wl-stat__l">Подешевшали</div>
      </div>
      <div className="wl-digest__cell">
        <div className={'wl-stat__n' + (fired ? ' wl-stat__n--accent' : '')}>{fired}</div>
        <div className="wl-stat__l">Ціль досягнута</div>
      </div>
      <div className="wl-digest__cell">
        <div className="wl-stat__n">{rises}</div>
        <div className="wl-stat__l">Подорожчали</div>
      </div>
      <div className="wl-digest__cell">
        <div className="wl-stat__n" style={{ fontSize: '1.25rem', paddingTop: 6 }}>сьогодні · 08:00</div>
        <div className="wl-stat__l">Остання перевірка</div>
      </div>
    </div>
  );
}

function wlbSplit(items) {
  const changed = items.filter((i) => i.price != null && WLB.delta(i) !== 0)
    .sort((a, b) => (b.targetMet ? 1 : 0) - (a.targetMet ? 1 : 0) || WLB.delta(a) - WLB.delta(b));
  const waiting = items.filter((i) => i.avail === 'pending' || i.avail === 'out');
  const stable = items.filter((i) => !changed.includes(i) && !waiting.includes(i));
  return { changed, stable, waiting };
}

function VariantAlert({ theme, items }) {
  const { Button } = WLB.DS;
  const { changed, stable, waiting } = wlbSplit(items);
  return (
    <WLB.Shell theme={theme} label={'Variant B · ' + theme} crumbTail="Стеження за цінами">
      <div className="wl-head" data-screen-label="Page head">
        <div className="wl-head__main">
          <p className="wl-eyebrow">СТЕЖЕННЯ ЗА ЦІНАМИ · 5 КНИГАРЕНЬ · ЩОДНЯ О 08:00</p>
          <h1 className="wl-h1">Що змінилось у цінах</h1>
          <p className="wl-sub">Щоранку перевіряємо кожну вашу книгу в п’яти книгарнях. Зміни — згори, тиша — нижче.</p>
        </div>
        <div className="wl-head__aside">
          <Button variant="secondary" size="sm"><WLB.Icon name="sliders" size={15} /> Сповіщення</Button>
          <span className="wl-statline"><WLB.Icon name="mail" size={13} /> Email увімкнено · push вимкнено</span>
        </div>
      </div>

      <WLBDigest items={items} />

      <section data-screen-label="Зміни цього тижня">
        <div className="wl-group__head" style={{ marginTop: 0 }}>
          <h2 className="wl-group__title">Зміни цього тижня</h2>
          <span className="wl-group__count">{changed.length}</span>
        </div>
        {changed.length ? (
          <div className="wl-rows">
            {changed.map((i) => <WLB.Row key={i.id} item={i} variant="feed" checked />)}
          </div>
        ) : (
          <div className="wl-hint">
            <WLB.Icon name="info" size={16} />
            <span>Цього тижня без змін — і це добрий знак: ціни стабільні. Ми перевіряємо щодня о 08:00 і повідомимо першими.</span>
          </div>
        )}
      </section>

      <section className="wl-group" data-screen-label="Без змін">
        <WLB.Collapsed icon="clock" label="Без змін" count={stable.length + ' книги · перевірено сьогодні'} />
      </section>

      <section className="wl-group" data-screen-label="Очікують">
        <div className="wl-group__head">
          <h2 className="wl-group__title">Очікують даних і наявності</h2>
          <span className="wl-group__count">{waiting.length}</span>
        </div>
        <div className="wl-rows">
          {waiting.map((i) => <WLB.Row key={i.id} item={i} checked />)}
        </div>
      </section>
    </WLB.Shell>
  );
}

/* ---------------- Mobile (<768px) — notification feed, sticky digest ---------------- */
function WLBMobileCard({ item }) {
  const { Button } = WLB.DS;
  const hot = item.targetMet;
  return (
    <div className={'wlm-card' + (hot ? ' wlm-card--open' : '')}
      style={hot ? { borderColor: 'color-mix(in oklab, var(--accent) 45%, var(--border))' } : null}>
      <div className="wlm-card__top">
        <span className="wlm-cover"></span>
        <span className="wlm-card__main">
          <span className="wlm-title">{item.title}</span>
          <span className="wl-row__author">{item.author}</span>
          <span style={{ marginTop: 2 }}><WLB.ItemBadge item={item} /></span>
        </span>
        <span className="wl-pricestack">
          <WLB.Delta item={item} showZero />
          {item.price != null
            ? <span className="wlm-price">{WLB.uah(item.price)}</span>
            : <span className="wlm-price wlm-price--faint">—</span>}
          <span className="wl-store">{item.store || (item.avail === 'out' ? 'немає в наявності' : 'збираємо ціни')}</span>
        </span>
      </div>
      {hot ? (
        <div className="wlm-card__body" style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)' }}>
          <Button variant="primary" size="md" style={{ width: '100%' }}>Перейти до книгарні</Button>
        </div>
      ) : null}
    </div>
  );
}

function VariantAlertMobile({ theme, items }) {
  const { Button } = WLB.DS;
  const { changed, stable, waiting } = wlbSplit(items);
  const drops = WLB.drops(items).length;
  return (
    <WLMShell theme={theme} label="Variant B · mobile">
      <div className="wlm-sticky" data-screen-label="Sticky digest">
        <WLB.Icon name="bell" size={18} />
        <span className="wlm-sticky__text">
          {drops ? drops + ' подешевшали · 1 ціль досягнута' : 'Цього тижня без змін'}
          <small>перевірено сьогодні о 08:00</small>
        </span>
        <Button variant="ghost" size="sm">Сповіщення</Button>
      </div>
      <p className="wl-eyebrow">СТЕЖЕННЯ · {items.length} КНИГ · ЩОДНЯ</p>
      <h1 className="wl-h1" style={{ marginBottom: 'var(--space-4)' }}>Що змінилось</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }} data-screen-label="Changes feed">
        {changed.map((i) => <WLBMobileCard key={i.id} item={i} />)}
        {!changed.length ? (
          <div className="wl-hint"><WLB.Icon name="info" size={16} /><span>Без змін. Ціни стабільні — ми пильнуємо далі.</span></div>
        ) : null}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }} data-screen-label="Collapsed groups">
        <WLB.Collapsed icon="clock" label="Без змін" count={String(stable.length)} />
        <WLB.Collapsed icon="bookmark" label="Очікують даних і наявності" count={String(waiting.length)} />
      </div>
    </WLMShell>
  );
}

window.WLVariantB = { VariantAlert, VariantAlertMobile };
