// Knyhovo Wishlist v1.0 — HYBRID DESIGN FREEZE (D + C) · Усі обов'язкові стани.
'use strict';

const _GW = window.WL;
const _GDS = window.KnyhovoDesignSystem_9fa616;
const _GV = window.HY;

/* ── 1. Loading — теплі skeleton-блоки, ніколи холодні сірі ──────────────── */
function HYStateLoading({ theme, mobile }) {
  return (
    <_GV.Shell theme={theme} label="State · Loading" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <span className="v1-sk-block" style={{ width: 200, height: 11, marginBottom: 10, display: 'block' }}></span>
          <span className="v1-sk-block" style={{ width: 320, height: 36, display: 'block' }}></span>
        </div>
      </div>
      {mobile ? (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[72, 88, 64].map((w, i) => (
              <span key={i} className="v1-sk-block" style={{ width: w, height: 30, borderRadius: 99 }}></span>
            ))}
          </div>
          <div className="hy-mcards">
            {[0, 1, 2, 3, 4].map((i) => <_GV.SkCard key={i} />)}
          </div>
        </div>
      ) : (
        <div className="v1-single">
          <div className="hy-front hy-front--sk">
            <span className="v1-sk-block" style={{ width: 180, height: 18, marginBottom: 14, display: 'block' }}></span>
            <div className="v1-rows">
              <_GV.SkRow />
            </div>
          </div>
          <span className="v1-sk-block" style={{ width: 220, height: 18, margin: '24px 0 14px', display: 'block' }}></span>
          <div className="v1-rows">
            {[0, 1, 2].map((i) => <_GV.SkRow key={i} />)}
          </div>
        </div>
      )}
    </_GV.Shell>
  );
}

/* ── 2. Empty ────────────────────────────────────────────────────────────── */
function HYStateEmpty({ theme, mobile }) {
  return (
    <_GV.Shell theme={theme} label="State · Empty" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">ВІШЛИСТ · ПОРОЖНІЙ</p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>Полиця очікування</h1>
        </div>
      </div>
      <div className="v1-empty-wrap">
        <_GV.Mascot theme={theme} size={mobile ? 'sm' : 'md'}
          copy="Яку книгу читаєте? Книговик постереже момент." />
        <p className="v1-empty-head">Не просто зберігайте — купуйте вчасно</p>
        <p className="v1-empty-sub">
          Додайте книгу — щодня о 08:00 перевіримо ціну у 5 книгарнях
          і скажемо, коли настане її момент.
        </p>
        <_GDS.Button variant="primary" size={mobile ? 'md' : 'lg'}>Знайти книгу</_GDS.Button>
        {!mobile && (
          <div className="v1-empty-steps">
            {[['bookmark', 'Збережіть'], ['bell', 'Стежте'], ['trending-down', 'Купіть у момент']].map(([ic, lb]) => (
              <div key={ic} className="v1-empty-step">
                <span className="v1-empty-step-icon"><_GW.Icon name={ic} size={16} /></span>
                <span className="v1-empty-step-label">{lb}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </_GV.Shell>
  );
}

/* ── 3. First book ───────────────────────────────────────────────────────── */
function HYStateFirstBook({ theme, mobile }) {
  const raw = _GW.getItems('Звичайний тиждень').find((i) => i.verdict === 'data');
  const item = { ...raw, tracking: true };

  return (
    <_GV.Shell theme={theme} label="State · First book" mobile={mobile}>
      {mobile ? (
        <React.Fragment>
          <div className="v1-mob-head">
            <div>
              <p className="v1-eyebrow">ВІШЛИСТ · ПЕРША КНИГА</p>
              <h1 className="v1-h1 v1-h1--mob">Чудовий початок</h1>
            </div>
          </div>
          <div className="v1-hint" style={{ margin: '12px 0 16px' }}>
            <_GW.Icon name="info" size={15} />
            <span>Щодня о 08:00 перевіряємо ціну у 5 книгарнях. Скажемо, коли настане момент купувати.</span>
          </div>
          <div className="hy-mcards">
            <_GV.MobCard item={item} />
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <_GV.Mascot theme={theme} size="sm" copy="Починаємо з першої книги. Книговик уже стежить за моментом." />
          </div>
        </React.Fragment>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 40, alignItems: 'start' }}>
          <div>
            <p className="v1-eyebrow" style={{ margin: '28px 0 6px' }}>
              ВІШЛИСТ · ПЕРША КНИГА · СТЕЖЕННЯ УВІМКНЕНО
            </p>
            <h1 className="v1-h1">Чудовий початок</h1>
            <div className="v1-hint" style={{ margin: '20px 0' }}>
              <_GW.Icon name="info" size={15} />
              <span>
                Готово — щодня о 08:00 перевіряємо ціну у 5 книгарнях.
                Скажемо, коли настане момент купувати. Хочете встановити цільову ціну?
              </span>
            </div>
            <div className="v1-rows" style={{ maxWidth: 760 }}>
              <_GV.Row item={item} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <_GDS.Button variant="secondary" size="sm">Встановити цільову ціну</_GDS.Button>
              <_GDS.Button variant="ghost" size="sm">Додати ще книгу</_GDS.Button>
            </div>
          </div>
          <div style={{ marginTop: 28 }}>
            <_GV.Mascot theme={theme} size="lg" align="center"
              copy="Починаємо з першої книги. Книговик уже стежить за моментом." />
          </div>
        </div>
      )}
    </_GV.Shell>
  );
}

/* ── 4. Тихий тиждень — без активних сигналів, нуль зеленого ─────────────── */
function HYStateQuiet({ theme, mobile }) {
  const items = _GW.getItems('Тихий тиждень').slice(0, mobile ? 3 : 4);
  return (
    <_GV.Shell theme={theme} label="State · Quiet week" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">ВІШЛИСТ · {items.length} КНИГ · ПЕРЕВІРЕНО О 08:00</p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>
            Сьогодні <em>все спокійно</em>
          </h1>
        </div>
      </div>
      <div className="v1-quiet-banner" style={{ marginBottom: 20, maxWidth: mobile ? 'none' : 760 }}>
        <_GW.Icon name="clock" size={16} />
        <div>
          <p style={{ fontWeight: 500, margin: '0 0 2px' }}>Цього тижня без змін — ціни стабільні.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Жодного приводу поспішати. Knyhovo перевіряє щодня о 08:00 — повідомимо першими.
          </p>
        </div>
      </div>
      {mobile ? (
        <div className="hy-mcards">
          {items.map((item) => <_GV.MobCard key={item.id} item={item} />)}
        </div>
      ) : (
        <div className="v1-single">
          <div className="v1-rows">
            {items.map((item) => <_GV.Row key={item.id} item={item} />)}
          </div>
          <div style={{ marginTop: 24 }}>
            <_GV.Letter items={items} compact />
          </div>
        </div>
      )}
    </_GV.Shell>
  );
}

/* ── 5. 50+ книг ─────────────────────────────────────────────────────────── */
function HYState50Plus({ theme, mobile }) {
  const base = _GW.getItems('Хвиля знижок');
  const TITLES = ['Відьмак', 'Атомні звички', 'Сапієнс', 'Кобзар', 'Тіні забутих предків', 'Дюна', '1984', 'Майстер і Маргарита'];
  const items = TITLES.map((title, i) => ({ ...base[i % base.length], id: 'b50-' + i, title }));
  const g = _GV.groups(items);
  const dg = _GV.desktopGroups(items);

  return (
    <_GV.Shell theme={theme} label="State · 50+ books" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">ВІШЛИСТ · 54 КНИГИ · 38 ПІД СТЕЖЕННЯМ · {g.ready.length} МОМЕНТИ</p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>Полиця очікування</h1>
        </div>
        {!mobile && (
          <div className="v1-page-head-right">
            <span className="hy-saved">Заощаджено: <b>1 240 ₴</b></span>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <_GDS.Button variant="ghost" size="sm">Масові дії</_GDS.Button>
              <_GDS.Button variant="secondary" size="sm">Додати</_GDS.Button>
            </div>
          </div>
        )}
      </div>
      {mobile ? (
        <div>
          <div style={{ marginBottom: 12 }}>
            <_GDS.Input placeholder="Знайти у вішлисті · 54 книги" />
          </div>
          <div className="v1-mob-sort">
            <_GDS.Chip selected>Всі (54)</_GDS.Chip>
            <_GDS.Chip>Моменти ({g.ready.length})</_GDS.Chip>
            <_GDS.Chip>Фентезі</_GDS.Chip>
          </div>
          <_GV.GroupHead title="Готові до купівлі" count={g.ready.length} mobile />
          <div className="hy-mcards">
            {g.ready.slice(0, 2).map((item) => <_GV.MobCard key={item.id} item={item} />)}
          </div>
          <_GV.GroupHead title="Чекають свого моменту" count={50} mobile />
          <div className="hy-mcards">
            {g.waiting.slice(0, 3).map((item) => <_GV.MobCard key={item.id} item={item} />)}
          </div>
          <div className="v1-load-more">
            <_GDS.Button variant="ghost" size="sm">Показати ще 47 книг</_GDS.Button>
          </div>
        </div>
      ) : (
        <div className="v1-single">
          <div style={{ marginBottom: 14, maxWidth: 420 }}>
            <_GDS.Input placeholder="Знайти у вішлисті · 54 книги" />
          </div>
          <div className="v1-sortbar">
            <div className="v1-sortchips">
              <_GDS.Chip selected>Всі (54)</_GDS.Chip>
              <_GDS.Chip>Моменти ({g.ready.length})</_GDS.Chip>
              <_GDS.Chip>Фентезі (18)</_GDS.Chip>
              <_GDS.Chip>Нонфікшн (12)</_GDS.Chip>
            </div>
            <div className="v1-sortright">
              <_GW.Icon name="sliders" size={15} />
              <span className="v1-sort-label">За порадою</span>
            </div>
          </div>
          <div className="hy-front">
            <_GV.GroupHead title="Вигідний момент настав" count={dg.opportunities.length} />
            <div className="v1-rows">
              {dg.opportunities.slice(0, 2).map((i) => <_GV.Row key={i.id} item={i} />)}
            </div>
          </div>
          <_GV.GroupHead title="Решта полиці" count={50} />
          <div className="v1-rows">
            {dg.rest.slice(0, 4).map((i) => <_GV.Row key={i.id} item={i} />)}
          </div>
          <div className="v1-load-more"><_GDS.Button variant="ghost" size="sm">Показати ще 46 книг</_GDS.Button></div>
        </div>
      )}
    </_GV.Shell>
  );
}

/* ── 6. Price drop — хвиля знижок, максимум зеленого ─────────────────────── */
function HYStatePriceDrop({ theme, mobile }) {
  const items = _GW.getItems('Хвиля знижок');
  const g = _GV.groups(items);
  const dg = _GV.desktopGroups(items);

  return (
    <_GV.Shell theme={theme} label="State · Price drop" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">
            ВІШЛИСТ · {g.ready.length} МОМЕНТИ СЬОГОДНІ · ПЕРЕВІРЕНО О 08:00
          </p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>
            <em>Вигідний момент</em> настав
          </h1>
        </div>
        {!mobile && (
          <div className="v1-page-head-right">
            <span className="hy-saved">Заощаджено: <b>412 ₴</b></span>
          </div>
        )}
      </div>
      {mobile ? (
        <div>
          <_GV.MobSummary items={items} />
          <_GV.GroupHead title="Готові до купівлі" count={g.ready.length} mobile />
          <div className="hy-mcards" style={{ marginBottom: 16 }}>
            {g.ready.map((item) => <_GV.MobCard key={item.id} item={item} />)}
          </div>
          <_GV.GroupHead title="Чекають свого моменту" count={g.waiting.length} mobile />
          <div className="hy-mcards">
            {g.waiting.slice(0, 2).map((item) => <_GV.MobCard key={item.id} item={item} />)}
          </div>
        </div>
      ) : (
        <div className="v1-single">
          <div className="hy-front" data-screen-label="Price drop section">
            <_GV.GroupHead title="Вигідний момент настав" count={dg.opportunities.length} />
            <div className="v1-rows">
              {dg.opportunities.map((item) => <_GV.Row key={item.id} item={item} />)}
            </div>
          </div>
          <_GV.GroupHead title="Решта полиці" count={dg.rest.length} />
          <div className="v1-rows">
            {dg.rest.slice(0, 3).map((item) => <_GV.Row key={item.id} item={item} />)}
          </div>
        </div>
      )}
    </_GV.Shell>
  );
}

/* ── 7. Unavailable ──────────────────────────────────────────────────────── */
function HYStateUnavailable({ theme, mobile }) {
  const allItems = _GW.getItems('Звичайний тиждень');
  const outItem = allItems.find((i) => i.avail === 'out');
  const restItems = allItems.filter((i) => i.id !== outItem.id && i.verdict !== 'now').slice(0, mobile ? 2 : 3);

  return (
    <_GV.Shell theme={theme} label="State · Unavailable" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">ВІШЛИСТ · {allItems.length} КНИГ · 1 НЕ В НАЯВНОСТІ</p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>Полиця очікування</h1>
        </div>
      </div>
      {mobile ? (
        <div>
          <div className="v1-unavail-card">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
              <span className="v1-mob-cover" style={{ opacity: 0.45 }}></span>
              <div>
                <p className="v1-mob-row-title">{outItem.title}</p>
                <p className="v1-mob-row-author" style={{ marginBottom: 4 }}>{outItem.author}</p>
                <_GW.Status item={outItem} />
              </div>
            </div>
            <_GV.Mascot theme={theme} size="sm"
              copy="Зараз книги немає в наявності. Книговик повідомить, коли вона повернеться." />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <_GDS.Button variant="secondary" size="sm" style={{ flex: 1 }}>Повідомити мене</_GDS.Button>
            </div>
          </div>
          <_GV.GroupHead title="Чекають свого моменту" count={restItems.length} mobile />
          <div className="hy-mcards">
            {restItems.map((item) => <_GV.MobCard key={item.id} item={item} />)}
          </div>
        </div>
      ) : (
        <div className="v1-single">
          <div className="v1-unavail-card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 16, alignItems: 'start' }}>
              <span className="v1-cover" style={{ opacity: 0.45 }}></span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="v1-row-title">{outItem.title}</span>
                <span className="v1-row-author">{outItem.author}</span>
                <_GW.Status item={outItem} />
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Перевіряємо щодня — повідомимо, щойно з'явиться у продажу.
                </p>
              </div>
              <_GV.Mascot theme={theme} size="sm" align="right"
                copy="Зараз книги немає в наявності. Книговик повідомить, коли вона повернеться." />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <_GDS.Button variant="secondary" size="sm">Повідомити про наявність</_GDS.Button>
              <_GDS.Button variant="ghost" size="sm">Знайти альтернативу</_GDS.Button>
            </div>
          </div>
          <_GV.GroupHead title="Решта полиці" count={restItems.length} />
          <div className="v1-rows">
            {restItems.map((item) => <_GV.Row key={item.id} item={item} />)}
          </div>
        </div>
      )}
    </_GV.Shell>
  );
}

Object.assign(window, {
  HYStateLoading, HYStateEmpty, HYStateFirstBook, HYStateQuiet,
  HYState50Plus, HYStatePriceDrop, HYStateUnavailable,
});
