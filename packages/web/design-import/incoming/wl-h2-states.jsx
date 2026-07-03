// Knyhovo «Бажанки» v1.0 — HYBRID DESIGN FREEZE (D + C) · Ревізія 2026-06-13 · Стани.
// Недоступна книга — УТИЛІТАРНИЙ стан: без Книговика, без hero-ілюстрацій.
'use strict';

const _2GW = window.WL;
const _2GDS = window.KnyhovoDesignSystem_9fa616;
const _2GV = window.H2;

/* ── 1. Loading — теплі skeleton-блоки, ніколи холодні сірі ──────────────── */
function H2StateLoading({ theme, mobile }) {
  return (
    <_2GV.Shell theme={theme} label="State · Loading" mobile={mobile}>
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
            {[0, 1, 2, 3, 4].map((i) => <_2GV.SkCard key={i} />)}
          </div>
        </div>
      ) : (
        <div className="v1-single">
          <div className="hy-front hy-front--sk">
            <span className="v1-sk-block" style={{ width: 180, height: 18, marginBottom: 14, display: 'block' }}></span>
            <div className="v1-rows">
              <_2GV.SkRow />
            </div>
          </div>
          <span className="v1-sk-block" style={{ width: 220, height: 18, margin: '24px 0 14px', display: 'block' }}></span>
          <div className="v1-rows">
            {[0, 1, 2].map((i) => <_2GV.SkRow key={i} />)}
          </div>
        </div>
      )}
    </_2GV.Shell>
  );
}

/* ── 2. Empty — Книговик-порадник запрошує (mascot дозволений тут) ───────── */
function H2StateEmpty({ theme, mobile }) {
  return (
    <_2GV.Shell theme={theme} label="State · Empty" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">БАЖАНКИ · ПОРОЖНЬО</p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>Ваші бажанки</h1>
        </div>
      </div>
      <div className="v1-empty-wrap">
        <_2GV.Mascot theme={theme} size={mobile ? 'sm' : 'md'}
          copy="Яку книгу читаєте? Книговик постереже момент." />
        <p className="v1-empty-head">Не просто зберігайте книги — купуйте їх у правильний момент</p>
        <p className="v1-empty-sub">
          Додайте книгу — щодня о 08:00 Knyhovo перевірить ціни у 5 книгарнях,
          а Книговик підкаже, коли настане час купувати.
        </p>
        <_2GDS.Button variant="primary" size={mobile ? 'md' : 'lg'}>Знайти книгу</_2GDS.Button>
        {!mobile && (
          <div className="v1-empty-steps">
            {[['bookmark', 'Збережіть'], ['bell', 'Стежте'], ['trending-down', 'Купіть у момент']].map(([ic, lb]) => (
              <div key={ic} className="v1-empty-step">
                <span className="v1-empty-step-icon"><_2GW.Icon name={ic} size={16} /></span>
                <span className="v1-empty-step-label">{lb}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </_2GV.Shell>
  );
}

/* ── 3. First book — mascot дозволений тут ───────────────────────────────── */
function H2StateFirstBook({ theme, mobile }) {
  const raw = _2GW.getItems('Звичайний тиждень').find((i) => i.verdict === 'data');
  const item = { ...raw, tracking: true };

  return (
    <_2GV.Shell theme={theme} label="State · First book" mobile={mobile}>
      {mobile ? (
        <React.Fragment>
          <div className="v1-mob-head">
            <div>
              <p className="v1-eyebrow">БАЖАНКИ · ПЕРША КНИГА</p>
              <h1 className="v1-h1 v1-h1--mob">Бажанки, за якими стежить <em>Книговик</em>.</h1>
            </div>
          </div>
          <div className="v1-hint" style={{ margin: '12px 0 16px' }}>
            <_2GW.Icon name="info" size={15} />
            <span>Knyhovo перевіряє ціни щодня о 08:00 у 5 книгарнях, а Книговик підкаже, коли настане час купувати.</span>
          </div>
          <div className="hy-mcards">
            <_2GV.MobCard item={item} />
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <_2GV.Mascot theme={theme} size="sm" copy="Перша книга у бажанках. Книговик уже стежить за моментом." />
          </div>
        </React.Fragment>
      ) : (
        <div className="v1-single">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 380px', gap: 40, alignItems: 'start' }}>
            <div>
              <p className="v1-eyebrow" style={{ margin: '28px 0 6px' }}>
                БАЖАНКИ · ПЕРША КНИГА · СТЕЖЕННЯ УВІМКНЕНО
              </p>
              <h1 className="v1-h1">Бажанки, за якими стежить <em>Книговик</em>.</h1>
              <div className="v1-hint" style={{ margin: '20px 0 0' }}>
                <_2GW.Icon name="info" size={15} />
                <span>
                  Готово — Knyhovo перевіряє ціни щодня о 08:00 у 5 книгарнях,
                  а Книговик підкаже, коли настане час купувати. Хочете встановити цільову ціну?
                </span>
              </div>
            </div>
            <div style={{ marginTop: 28 }}>
              <_2GV.Mascot theme={theme} size="lg" align="center"
                copy="Перша книга у бажанках. Книговик уже стежить за моментом." />
            </div>
          </div>
          <div className="v1-rows" style={{ marginTop: 24 }}>
            <_2GV.Row item={item} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <_2GDS.Button variant="secondary" size="sm">Встановити цільову ціну</_2GDS.Button>
            <_2GDS.Button variant="ghost" size="sm">Додати ще книгу</_2GDS.Button>
          </div>
        </div>
      )}
    </_2GV.Shell>
  );
}

/* ── 4. Тихий тиждень — без знижок, нуль зеленого ────────────────────────── */
function H2StateQuiet({ theme, mobile }) {
  const items = _2GW.getItems('Тихий тиждень').slice(0, mobile ? 3 : 4);
  return (
    <_2GV.Shell theme={theme} label="State · Quiet week" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">БАЖАНКИ · {items.length} КНИГ · ПЕРЕВІРЕНО О 08:00</p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>
            Бажанки, за якими стежить <em>Книговик</em>.
          </h1>
        </div>
      </div>
      <div className="v1-quiet-banner" style={{ marginBottom: 20, maxWidth: mobile ? 'none' : 760 }}>
        <_2GW.Icon name="clock" size={16} />
        <div>
          <p style={{ fontWeight: 500, margin: '0 0 2px' }}>Цього тижня без змін — ціни стабільні.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Knyhovo перевіряє ціни щодня о 08:00, а Книговик підкаже, коли настане правильний момент купувати.
          </p>
        </div>
      </div>
      {mobile ? (
        <div className="hy-mcards">
          {items.map((item) => <_2GV.MobCard key={item.id} item={item} />)}
        </div>
      ) : (
        <div className="v1-single">
          <div className="v1-rows">
            {items.map((item) => <_2GV.Row key={item.id} item={item} />)}
          </div>
          <div style={{ marginTop: 24 }}>
            <_2GV.Letter items={items} compact />
          </div>
        </div>
      )}
    </_2GV.Shell>
  );
}

/* ── 5. 50+ книг ─────────────────────────────────────────────────────────── */
function H2State50Plus({ theme, mobile }) {
  const base = _2GW.getItems('Хвиля знижок');
  const TITLES = ['Відьмак', 'Атомні звички', 'Сапієнс', 'Кобзар', 'Тіні забутих предків', 'Дюна', '1984', 'Майстер і Маргарита'];
  const items = TITLES.map((title, i) => ({ ...base[i % base.length], id: 'b50-' + i, title }));
  const dg = _2GV.desktopGroups(items);

  return (
    <_2GV.Shell theme={theme} label="State · 50+ books" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">БАЖАНКИ · 54 КНИГИ · 38 ПІД СТЕЖЕННЯМ · {dg.discounted.length} ЗІ ЗНИЖКАМИ</p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>Бажанки, за якими стежить <em>Книговик</em>.</h1>
        </div>
        {!mobile && (
          <div className="v1-page-head-right">
            <span className="hy-saved">Заощаджено з Knyhovo: <b>1 240 ₴</b></span>
            <span className="hy-saved-sub">накопичено за весь час</span>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <_2GDS.Button variant="ghost" size="sm">Масові дії</_2GDS.Button>
              <_2GDS.Button variant="secondary" size="sm">Додати</_2GDS.Button>
            </div>
          </div>
        )}
      </div>
      {mobile ? (
        <div>
          <div style={{ marginBottom: 12 }}>
            <_2GDS.Input placeholder="Знайти у бажанках · 54 книги" />
          </div>
          <div className="v1-mob-sort">
            <_2GDS.Chip selected>Всі (54)</_2GDS.Chip>
            <_2GDS.Chip>Книги зі знижками ({dg.discounted.length})</_2GDS.Chip>
            <_2GDS.Chip>Фентезі</_2GDS.Chip>
          </div>
          <_2GV.GroupHead title="Книги зі знижками" count={dg.discounted.length} mobile />
          <div className="hy-mcards">
            {dg.discounted.slice(0, 2).map((item) => <_2GV.MobCard key={item.id} item={item} />)}
          </div>
          <_2GV.GroupHead title="Інші бажанки" count={50} mobile />
          <div className="hy-mcards">
            {dg.rest.slice(0, 3).map((item) => <_2GV.MobCard key={item.id} item={item} />)}
          </div>
          <div className="v1-load-more">
            <_2GDS.Button variant="ghost" size="sm">Показати ще 47 книг</_2GDS.Button>
          </div>
        </div>
      ) : (
        <div className="v1-single">
          <div style={{ marginBottom: 14, maxWidth: 420 }}>
            <_2GDS.Input placeholder="Знайти у бажанках · 54 книги" />
          </div>
          <div className="v1-sortbar">
            <div className="v1-sortchips">
              <_2GDS.Chip selected>Всі (54)</_2GDS.Chip>
              <_2GDS.Chip>Книги зі знижками ({dg.discounted.length})</_2GDS.Chip>
              <_2GDS.Chip>Фентезі (18)</_2GDS.Chip>
              <_2GDS.Chip>Нонфікшн (12)</_2GDS.Chip>
            </div>
            <div className="v1-sortright">
              <_2GW.Icon name="sliders" size={15} />
              <span className="v1-sort-label">За порадою</span>
            </div>
          </div>
          <div className="hy-front">
            <_2GV.GroupHead title="Книги зі знижками" count={dg.discounted.length} />
            <div className="v1-rows">
              {dg.discounted.slice(0, 2).map((i) => <_2GV.Row key={i.id} item={i} />)}
            </div>
          </div>
          <_2GV.GroupHead title="Інші бажанки" count={50} />
          <div className="v1-rows">
            {dg.rest.slice(0, 4).map((i) => <_2GV.Row key={i.id} item={i} />)}
          </div>
          <div className="v1-load-more"><_2GDS.Button variant="ghost" size="sm">Показати ще 46 книг</_2GDS.Button></div>
        </div>
      )}
    </_2GV.Shell>
  );
}

/* ── 6. Хвиля знижок — максимум зеленого ─────────────────────────────────── */
function H2StatePriceDrop({ theme, mobile }) {
  const items = _2GW.getItems('Хвиля знижок');
  const dg = _2GV.desktopGroups(items);

  return (
    <_2GV.Shell theme={theme} label="State · Price drop" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">
            БАЖАНКИ · {dg.discounted.length} КНИГИ ЗІ ЗНИЖКАМИ · ПЕРЕВІРЕНО О 08:00
          </p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>
            Бажанки, за якими стежить <em>Книговик</em>.
          </h1>
        </div>
        {!mobile && (
          <div className="v1-page-head-right">
            <span className="hy-saved">Заощаджено з Knyhovo: <b>412 ₴</b></span>
            <span className="hy-saved-sub">накопичено за весь час</span>
          </div>
        )}
      </div>
      {mobile ? (
        <div>
          <_2GV.MobSummary items={items} />
          <_2GV.GroupHead title="Книги зі знижками" count={dg.discounted.length} mobile />
          <div className="hy-mcards" style={{ marginBottom: 16 }}>
            {dg.discounted.map((item) => <_2GV.MobCard key={item.id} item={item} />)}
          </div>
          <_2GV.GroupHead title="Інші бажанки" count={dg.rest.length} mobile />
          <div className="hy-mcards">
            {dg.rest.map((item) => <_2GV.MobCard key={item.id} item={item} />)}
          </div>
        </div>
      ) : (
        <div className="v1-single">
          <div className="hy-front" data-screen-label="Книги зі знижками · wave">
            <_2GV.GroupHead title="Книги зі знижками" count={dg.discounted.length} />
            <div className="v1-rows">
              {dg.discounted.map((item) => <_2GV.Row key={item.id} item={item} />)}
            </div>
          </div>
          <_2GV.GroupHead title="Інші бажанки" count={dg.rest.length} />
          <div className="v1-rows">
            {dg.rest.slice(0, 3).map((item) => <_2GV.Row key={item.id} item={item} />)}
          </div>
        </div>
      )}
    </_2GV.Shell>
  );
}

/* ── 7. Недоступна книга — УТИЛІТАРНИЙ стан (ревізія 2026-06-13) ───────────
   Книговик повністю прибраний: без mascot, без hero-ілюстрацій, без
   окремого емоційного блоку. Назва · факт · [Повідомити мене] [Знайти схожі]. */
function H2StateUnavailable({ theme, mobile }) {
  const allItems = _2GW.getItems('Звичайний тиждень');
  const outItem = allItems.find((i) => i.avail === 'out');
  const restItems = allItems.filter((i) => i.id !== outItem.id && !_2GV.opportunity(i)).slice(0, mobile ? 2 : 3);

  return (
    <_2GV.Shell theme={theme} label="State · Unavailable" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">БАЖАНКИ · {allItems.length} КНИГ · 1 НЕ В НАЯВНОСТІ</p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>Бажанки, за якими стежить <em>Книговик</em>.</h1>
        </div>
      </div>
      {mobile ? (
        <div>
          <div className="v1-unavail-card" data-screen-label="Недоступна книга · утилітарний">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span className="v1-mob-cover" style={{ opacity: 0.45 }}></span>
              <div style={{ minWidth: 0 }}>
                <p className="v1-mob-row-title">{outItem.title}</p>
                <p className="v1-mob-row-author" style={{ margin: '2px 0 6px' }}>{outItem.author}</p>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', margin: 0, textWrap: 'pretty' }}>
                  Наразі книги немає в наявності. Книговик повідомить, коли вона з'явиться.
                </p>
              </div>
            </div>
            <div className="h2-mcta" style={{ marginTop: 14 }}>
              <_2GDS.Button variant="secondary" size="sm" style={{ flex: 1 }}>Повідомити мене</_2GDS.Button>
              <_2GDS.Button variant="ghost" size="sm" style={{ flex: 1 }}>Знайти схожі</_2GDS.Button>
            </div>
          </div>
          <_2GV.GroupHead title="Інші бажанки" count={restItems.length} mobile />
          <div className="hy-mcards">
            {restItems.map((item) => <_2GV.MobCard key={item.id} item={item} />)}
          </div>
        </div>
      ) : (
        <div className="v1-single">
          <div className="v1-unavail-card" style={{ marginBottom: 20 }} data-screen-label="Недоступна книга · утилітарний">
            <div style={{ display: 'grid', gridTemplateColumns: '48px minmax(0,1fr) auto', gap: 16, alignItems: 'center' }}>
              <span className="v1-cover" style={{ opacity: 0.45 }}></span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <span className="v1-row-title">{outItem.title}</span>
                <span className="v1-row-author">{outItem.author}</span>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-body)', margin: '4px 0 0', textWrap: 'pretty' }}>
                  Наразі книги немає в наявності. Книговик повідомить, коли вона з'явиться.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <_2GDS.Button variant="secondary" size="sm">Повідомити мене</_2GDS.Button>
                <_2GDS.Button variant="ghost" size="sm">Знайти схожі</_2GDS.Button>
              </div>
            </div>
          </div>
          <_2GV.GroupHead title="Інші бажанки" count={restItems.length} />
          <div className="v1-rows">
            {restItems.map((item) => <_2GV.Row key={item.id} item={item} />)}
          </div>
        </div>
      )}
    </_2GV.Shell>
  );
}

Object.assign(window, {
  H2StateLoading, H2StateEmpty, H2StateFirstBook, H2StateQuiet,
  H2State50Plus, H2StatePriceDrop, H2StateUnavailable,
});
