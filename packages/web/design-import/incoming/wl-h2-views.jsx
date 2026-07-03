// Knyhovo «Бажанки» v1.0 — HYBRID DESIGN FREEZE (D + C) · Ревізія 2026-06-13 · Main views.
// Desktop = Variant D · Mobile = Variant C accordion.
// Структура desktop: 1. Hero · 2. Книги зі знижками · 3. Інші бажанки (+ недільний лист).
'use strict';

const _2W = window.WL;
const _2DS = window.KnyhovoDesignSystem_9fa616;
const _2V = window.H2;

/* ── Desktop — Variant D (повноширинні картки, автоматичне підняття знижок) ─ */
function H2DesktopView({ theme, scenario }) {
  const { Button } = _2DS;
  const items = _2W.getItems(scenario || 'Звичайний тиждень');
  const g = _2V.desktopGroups(items);

  return (
    <_2V.Shell theme={theme} label="Бажанки v1.0 Hybrid · Desktop">
      <div className="v1-page-head" data-screen-label="Hero">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">
            БАЖАНКИ · {items.length} КНИГ · ПЕРЕВІРЕНО СЬОГОДНІ О 08:00
          </p>
          <h1 className="v1-h1">Бажанки, за якими стежить <em>Книговик</em>.</h1>
          <p className="v1-sub">Не просто зберігайте книги — купуйте їх у правильний момент. Книговик підкаже, коли настане час купувати.</p>
        </div>
        <div className="v1-page-head-right">
          <span className="hy-saved">Заощаджено з Knyhovo: <b>412 ₴</b></span>
          <span className="hy-saved-sub">накопичено за весь час · 4 покупки у вдалий момент</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Button variant="ghost" size="sm">Масові дії</Button>
            <Button variant="secondary" size="sm">Додати книгу</Button>
          </div>
        </div>
      </div>

      <div className="v1-single">
        <section className="hy-front" data-screen-label="Книги зі знижками">
          <_2V.GroupHead title="Книги зі знижками" count={g.discounted.length} />
          {g.discounted.length ? (
            <div className="v1-rows">
              {g.discounted.map((i) => <_2V.Row key={i.id} item={i} />)}
            </div>
          ) : (
            <p className="hy-front-empty">
              Сьогодні знижок немає. Щойно якась із бажанок подешевшає — вона з’явиться тут, а Книговик напише.
            </p>
          )}
        </section>

        <section className="hy-group" data-screen-label="Інші бажанки">
          <_2V.GroupHead title="Інші бажанки" count={g.rest.length}
            action={<Button variant="ghost" size="sm" style={{ marginLeft: 'auto' }}>За порадою <_2W.Icon name="chevron-down" size={14} /></Button>} />
          <div className="v1-rows">
            {g.rest.map((i) => <_2V.Row key={i.id} item={i} />)}
          </div>
        </section>

        <section className="hy-group" data-screen-label="Недільний лист">
          <_2V.Letter items={items} />
        </section>
      </div>
    </_2V.Shell>
  );
}

/* ── Mobile — Variant C accordion (закриті за замовчуванням) ────────────────
   Книги зі знижками автоматично у верхній секції — як на desktop.
   Пріоритети: назва → ціна → економія → CTA → статус → решта після розкриття. */
function H2MobileView({ theme, scenario }) {
  const { Chip, Button } = _2DS;
  const items = _2W.getItems(scenario || 'Звичайний тиждень');
  const g = _2V.desktopGroups(items);

  return (
    <_2V.Shell theme={theme} label="Бажанки v1.0 Hybrid · Mobile" mobile>
      <div style={{ padding: 'var(--space-5) 0 var(--space-3)' }}>
        <p className="v1-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>БАЖАНКИ · {items.length} КНИГ</p>
        <h1 className="v1-h1 v1-h1--mob">Бажанки, за якими стежить <em>Книговик</em>.</h1>
      </div>

      <_2V.MobSummary items={items} />

      <div className="v1-mob-sort">
        <Chip selected>Всі</Chip>
        <Chip>Книги зі знижками {g.discounted.length ? '(' + g.discounted.length + ')' : ''}</Chip>
        <Chip>Стежу</Chip>
      </div>

      {g.discounted.length > 0 && (
        <React.Fragment>
          <_2V.GroupHead title="Книги зі знижками" count={g.discounted.length} mobile />
          <div className="hy-mcards" data-screen-label="Книги зі знижками · mobile">
            {g.discounted.map((i) => <_2V.MobCard key={i.id} item={i} />)}
          </div>
        </React.Fragment>
      )}

      <_2V.GroupHead title="Інші бажанки" count={g.rest.length} mobile />
      <div className="hy-mcards" data-screen-label="Інші бажанки · mobile">
        {g.rest.map((i) => <_2V.MobCard key={i.id} item={i} />)}
      </div>

      <div className="v1-mob-sticky">
        <Button variant="primary" size="md" style={{ width: '100%' }}>Додати книгу</Button>
      </div>
    </_2V.Shell>
  );
}

Object.assign(window, { H2DesktopView, H2MobileView });
