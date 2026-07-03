// Knyhovo Wishlist v1.0 — Final Design Freeze · All required states.
// Approved for implementation.
'use strict';

const _SW = window.WL;
const _SDS = window.KnyhovoDesignSystem_9fa616;
const _SV = window.V1;

/* ────────────────────────────── 1. Loading ─────────────────────────────── */
function V1StateLoading({ theme, mobile }) {
  return (
    <_SV.Shell theme={theme} label="State · Loading" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <span className="v1-sk-block" style={{ width: 200, height: 11, marginBottom: 10, display: 'block' }}></span>
          <span className="v1-sk-block" style={{ width: 320, height: 36, display: 'block' }}></span>
        </div>
      </div>
      <div className={mobile ? '' : 'v1-single'}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[80, 72, 68, 92].map((w, i) => (
            <span key={i} className="v1-sk-block"
              style={{ width: w, height: 30, borderRadius: 99, display: 'inline-block' }}></span>
          ))}
        </div>
        <div className="v1-rows">
          {[0, 1, 2, 3, 4].map((i) => <_SV.SkRow key={i} />)}
        </div>
      </div>
    </_SV.Shell>
  );
}

/* ────────────────────────────── 2. Empty ───────────────────────────────── */
function V1StateEmpty({ theme, mobile }) {
  return (
    <_SV.Shell theme={theme} label="State · Empty" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">ВІШЛИСТ · ПОРОЖНІЙ</p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>Список очікування</h1>
        </div>
      </div>
      <div className="v1-empty-wrap">
        <_SV.Mascot theme={theme} size={mobile ? 'sm' : 'md'}
          copy="Яку книгу читаєте? Книговик постереже." />
        <p className="v1-empty-head">Починаємо з першої книги</p>
        <p className="v1-empty-sub">
          Додайте книгу — щодня о 08:00 перевіримо ціну у 5 книгарнях
          і повідомимо, коли вона впаде.
        </p>
        <_SDS.Button variant="primary" size={mobile ? 'md' : 'lg'}>Знайти книгу</_SDS.Button>
        {!mobile && (
          <div className="v1-empty-steps">
            {[['bookmark', 'Збережіть'], ['bell', 'Стежте'], ['trending-down', 'Купіть вигідно']].map(([ic, lb]) => (
              <div key={ic} className="v1-empty-step">
                <span className="v1-empty-step-icon"><_SW.Icon name={ic} size={16} /></span>
                <span className="v1-empty-step-label">{lb}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </_SV.Shell>
  );
}

/* ────────────────────────────── 3. First book ──────────────────────────── */
function V1StateFirstBook({ theme, mobile }) {
  const raw = _SW.getItems('Звичайний тиждень')[0];
  const item = { ...raw, targetMet: false, avail: 'in', tracking: true };

  return (
    <_SV.Shell theme={theme} label="State · First book" mobile={mobile}>
      {mobile ? (
        <React.Fragment>
          <div className="v1-mob-head">
            <div>
              <p className="v1-eyebrow">ВІШЛИСТ · ПЕРША КНИГА</p>
              <h1 className="v1-h1 v1-h1--mob">Чудовий початок</h1>
            </div>
          </div>
          <div className="v1-hint" style={{ margin: '12px 0 16px' }}>
            <_SW.Icon name="info" size={15} />
            <span>Щодня о 08:00 перевіряємо ціну у 5 книгарнях. Хочете встановити цільову ціну?</span>
          </div>
          <div className="v1-rows v1-rows--mob">
            <div className="v1-mob-row">
              <span className="v1-mob-cover"></span>
              <div className="v1-mob-row-main">
                <span className="v1-mob-row-title">{item.title}</span>
                <span className="v1-mob-row-author">{item.author}</span>
                <_SW.Status item={item} checked />
              </div>
              <div className="v1-mob-row-right">
                <_SW.PriceStack item={item} />
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <_SV.Mascot theme={theme} size="sm" copy="Починаємо з першої книги. Книговик уже стежить." />
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
              <_SW.Icon name="info" size={15} />
              <span>
                Готово — щодня о 08:00 перевіряємо ціну у 5 книгарнях і
                повідомимо першими. Хочете встановити цільову ціну?
              </span>
            </div>
            <div className="v1-rows" style={{ maxWidth: 720 }}>
              <_SV.Row item={item} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <_SDS.Button variant="secondary" size="sm">Встановити цільову ціну</_SDS.Button>
              <_SDS.Button variant="ghost" size="sm">Додати ще книгу</_SDS.Button>
            </div>
          </div>
          <div style={{ marginTop: 28 }}>
            <_SV.Mascot theme={theme} size="lg" align="center"
              copy="Починаємо з першої книги. Книговик уже стежить." />
          </div>
        </div>
      )}
    </_SV.Shell>
  );
}

/* ────────────────────────────── 4. No active alerts ────────────────────── */
function V1StateNoAlerts({ theme, mobile }) {
  const items = _SW.getItems('Тихий тиждень').slice(0, mobile ? 3 : 4);
  return (
    <_SV.Shell theme={theme} label="State · No active alerts" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">ВІШЛИСТ · {items.length} КНИГ · ПЕРЕВІРЕНО О 08:00</p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>
            Сьогодні <em>все спокійно</em>
          </h1>
        </div>
      </div>
      <div className="v1-quiet-banner" style={{ marginBottom: 20, maxWidth: mobile ? 'none' : 760 }}>
        <_SW.Icon name="clock" size={16} />
        <div>
          <p style={{ fontWeight: 500, margin: '0 0 2px' }}>Цього тижня без змін — ціни стабільні.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Knyhovo перевіряє щодня о 08:00. Повідомимо першими.
          </p>
        </div>
      </div>
      {mobile ? (
        <div className="v1-rows v1-rows--mob">
          {items.map((item) => (
            <div key={item.id} className="v1-mob-row">
              <span className="v1-mob-cover"></span>
              <div className="v1-mob-row-main">
                <span className="v1-mob-row-title">{item.title}</span>
                <span className="v1-mob-row-author">{item.author}</span>
                <_SW.Status item={item} checked />
              </div>
              <_SW.PriceStack item={item} />
            </div>
          ))}
        </div>
      ) : (
        <div className="v1-single">
          <_SV.SortBar items={items} />
          <div className="v1-rows">
            {items.map((item) => <_SV.Row key={item.id} item={item} />)}
          </div>
        </div>
      )}
    </_SV.Shell>
  );
}

/* ────────────────────────────── 5. 50+ books ───────────────────────────── */
function V1State50Plus({ theme, mobile }) {
  const base = _SW.getItems('Хвиля знижок');
  const TITLES = ['Відьмак', 'Атомні звички', 'Сапієнс', 'Кобзар', 'Тіні забутих предків', 'Дюна', '1984', 'Майстер і Маргарита'];
  const items = TITLES.map((title, i) => ({ ...base[i % base.length], id: 'b50-' + i, title }));
  const drops = _SW.drops(items);
  const rest = items.filter((i) => !drops.find((d) => d.id === i.id));

  return (
    <_SV.Shell theme={theme} label="State · 50+ books" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">ВІШЛИСТ · 54 КНИГИ · 38 ПІД СТЕЖЕННЯМ · {drops.length} ЗНИЖКИ</p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>Мої книги</h1>
        </div>
        {!mobile && (
          <div className="v1-page-head-right">
            <span className="v1-savings-pill">
              <_SW.Icon name="trending-down" size={14} />
              Заощаджено: <b>1 240 ₴</b>
            </span>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <_SDS.Button variant="ghost" size="sm">Групувати</_SDS.Button>
              <_SDS.Button variant="ghost" size="sm">Масові дії</_SDS.Button>
              <_SDS.Button variant="secondary" size="sm">Додати</_SDS.Button>
            </div>
          </div>
        )}
      </div>
      {mobile ? (
        <div>
          <div style={{ marginBottom: 12 }}>
            <_SDS.Input placeholder="Знайти у вішлисті · 54 книги" />
          </div>
          <div className="v1-mob-sort">
            <_SDS.Chip selected>Всі (54)</_SDS.Chip>
            <_SDS.Chip>Знижки ({drops.length})</_SDS.Chip>
            <_SDS.Chip>Фентезі</_SDS.Chip>
          </div>
          <div className="v1-rows v1-rows--mob">
            {items.slice(0, 5).map((item) => (
              <div key={item.id}
                className={'v1-mob-row' + (drops.find((d) => d.id === item.id) ? ' v1-mob-row--hot' : '')}>
                <span className="v1-mob-cover"></span>
                <div className="v1-mob-row-main">
                  <span className="v1-mob-row-title">{item.title}</span>
                  <span className="v1-mob-row-author">{item.author}</span>
                  <_SW.Status item={item} />
                </div>
                <_SW.PriceStack item={item} />
              </div>
            ))}
          </div>
          <div className="v1-load-more">
            <_SDS.Button variant="ghost" size="sm">Показати ще 49 книг</_SDS.Button>
          </div>
        </div>
      ) : (
        <div className="v1-single">
            <div style={{ marginBottom: 14, maxWidth: 420 }}>
              <_SDS.Input placeholder="Знайти у вішлисті · 54 книги" />
            </div>
            <div className="v1-sortbar">
              <div className="v1-sortchips">
                <_SDS.Chip selected>Всі (54)</_SDS.Chip>
                <_SDS.Chip>Знижки ({drops.length})</_SDS.Chip>
                <_SDS.Chip>Фентезі (18)</_SDS.Chip>
                <_SDS.Chip>Нонфікшн (12)</_SDS.Chip>
              </div>
              <div className="v1-sortright">
                <_SW.Icon name="sliders" size={15} />
                <span className="v1-sort-label">За зміною ціни</span>
              </div>
            </div>
            <div className="v1-group-head">
              <_SW.Icon name="trending-down" size={15} />
              <span className="v1-group-title">Знижки цього тижня</span>
              <span className="v1-group-count">{drops.length}</span>
            </div>
            <div className="v1-rows" style={{ marginBottom: 20 }}>
              {drops.slice(0, 2).map((i) => <_SV.Row key={i.id} item={i} />)}
            </div>
            <div className="v1-group-head">
              <_SW.Icon name="bookmark" size={15} />
              <span className="v1-group-title">Решта книг</span>
              <span className="v1-group-count">50</span>
            </div>
            <div className="v1-rows">
              {rest.slice(0, 4).map((i) => <_SV.Row key={i.id} item={i} compact />)}
            </div>
            <div className="v1-load-more"><_SDS.Button variant="ghost" size="sm">Показати ще 46 книг</_SDS.Button></div>
        </div>
      )}
    </_SV.Shell>
  );
}

/* ────────────────────────────── 6. Price drop ──────────────────────────── */
function V1StatePriceDrop({ theme, mobile }) {
  const items = _SW.getItems('Хвиля знижок');
  const drops = _SW.drops(items);
  const rest = items.filter((i) => _SW.delta(i) >= 0);

  return (
    <_SV.Shell theme={theme} label="State · Price drop" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">
            ВІШЛИСТ · {drops.length} ЗНИЖКИ СЬОГОДНІ · ПЕРЕВІРЕНО О 08:00
          </p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>
            Знайшли <em>кращу ціну</em>
          </h1>
        </div>
        {!mobile && (
          <div className="v1-page-head-right">
            <span className="v1-savings-pill">
              <_SW.Icon name="trending-down" size={14} /> Заощаджено: <b>412 ₴</b>
            </span>
          </div>
        )}
      </div>
      <div className="v1-drop-section" data-screen-label="Price drop section">
        <div className="v1-drop-head">
          <_SW.Icon name="trending-down" size={16} />
          <span className="v1-drop-section-title">Вигідні моменти цього тижня</span>
        </div>
        {mobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 16 }}>
            {drops.map((item) => <_SV.MobCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="v1-rows" style={{ marginBottom: 24 }}>
            {drops.map((item) => <_SV.Row key={item.id} item={item} />)}
          </div>
        )}
        <p className="v1-drop-rest-label">Решта книг без змін</p>
        {mobile ? (
          <div className="v1-rows v1-rows--mob">
            {rest.slice(0, 2).map((item) => (
              <div key={item.id} className="v1-mob-row">
                <span className="v1-mob-cover"></span>
                <div className="v1-mob-row-main">
                  <span className="v1-mob-row-title">{item.title}</span>
                  <span className="v1-mob-row-author">{item.author}</span>
                </div>
                <_SW.PriceStack item={item} />
              </div>
            ))}
          </div>
        ) : (
          <div className="v1-rows">
            {rest.slice(0, 3).map((item) => <_SV.Row key={item.id} item={item} compact />)}
          </div>
        )}
      </div>
    </_SV.Shell>
  );
}

/* ────────────────────────────── 7. Unavailable ─────────────────────────── */
function V1StateUnavailable({ theme, mobile }) {
  const allItems = _SW.getItems('Звичайний тиждень');
  const outItem = allItems.find((i) => i.avail === 'out')
    || { ...allItems[0], avail: 'out', id: 'out-x', title: 'Кобзар', author: 'Тарас Шевченко' };
  const restItems = allItems.filter((i) => i.id !== outItem.id).slice(0, mobile ? 2 : 3);

  return (
    <_SV.Shell theme={theme} label="State · Unavailable" mobile={mobile}>
      <div className="v1-page-head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">ВІШЛИСТ · {allItems.length} КНИГ · 1 НЕ В НАЯВНОСТІ</p>
          <h1 className={'v1-h1' + (mobile ? ' v1-h1--mob' : '')}>Мої книги</h1>
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
                <_SW.Status item={outItem} />
              </div>
            </div>
            <_SV.Mascot theme={theme} size="sm"
              copy="Зараз книги немає в наявності. Книговик повідомить, коли вона повернеться." />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <_SDS.Button variant="secondary" size="sm" style={{ flex: 1 }}>Повідомити мене</_SDS.Button>
            </div>
          </div>
          <p className="v1-plabel" style={{ margin: '14px 0 8px' }}>ІНШІ КНИГИ</p>
          <div className="v1-rows v1-rows--mob">
            {restItems.map((item) => (
              <div key={item.id} className="v1-mob-row">
                <span className="v1-mob-cover"></span>
                <div className="v1-mob-row-main">
                  <span className="v1-mob-row-title">{item.title}</span>
                  <span className="v1-mob-row-author">{item.author}</span>
                  <_SW.Status item={item} />
                </div>
                <_SW.PriceStack item={item} />
              </div>
            ))}
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
                  <_SW.Status item={outItem} />
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Перевіряємо щодня — повідомимо, щойно з'явиться у продажу.
                  </p>
                </div>
                <_SV.Mascot theme={theme} size="sm" align="right"
                  copy="Зараз книги немає в наявності. Книговик повідомить, коли вона повернеться." />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <_SDS.Button variant="secondary" size="sm">Повідомити про наявність</_SDS.Button>
                <_SDS.Button variant="ghost" size="sm">Знайти альтернативу</_SDS.Button>
              </div>
            </div>
            <p className="v1-plabel" style={{ margin: '0 0 12px' }}>ІНШІ КНИГИ</p>
            <_SV.SortBar items={restItems} />
            <div className="v1-rows">
              {restItems.map((item) => <_SV.Row key={item.id} item={item} />)}
            </div>
        </div>
      )}
    </_SV.Shell>
  );
}

Object.assign(window, {
  V1StateLoading, V1StateEmpty, V1StateFirstBook, V1StateNoAlerts,
  V1State50Plus, V1StatePriceDrop, V1StateUnavailable,
});
