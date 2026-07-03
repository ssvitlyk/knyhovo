// Knyhovo Wishlist v1.0 — HYBRID DESIGN FREEZE (D + C) · Main views.
// Desktop = Variant D «Момент» · Mobile = Variant C accordion + D enhancements.
'use strict';

const _HW = window.WL;
const _HDS = window.KnyhovoDesignSystem_9fa616;
const _HV = window.HY;

/* ── Desktop — Variant D (primary direction) ─────────────────────────────── */
/* ── Desktop — Variant D revised: full-width rows + automatic promotion.
   IA (mandatory order): 1. Buying opportunities · 2. Remaining wishlist · 3. Weekly digest. */
function HYDesktopView({ theme, scenario }) {
  const { Button } = _HDS;
  const items = _HW.getItems(scenario || 'Звичайний тиждень');
  const g = _HV.desktopGroups(items);

  return (
    <_HV.Shell theme={theme} label="Wishlist v1.0 Hybrid · Desktop">
      <div className="v1-page-head" data-screen-label="Page head">
        <div className="v1-page-head-left">
          <p className="v1-eyebrow">
            ВІШЛИСТ · {items.length} КНИГ · ПЕРЕВІРЕНО СЬОГОДНІ О 08:00
          </p>
          <h1 className="v1-h1">Коли купувати? <em>Knyhovo знає момент.</em></h1>
          <p className="v1-sub">Не просто зберігайте книги — купуйте їх у правильний момент. Кожна книга на полиці отримує пораду: зараз або зачекати.</p>
        </div>
        <div className="v1-page-head-right">
          <span className="hy-saved">Заощаджено з Knyhovo: <b>412 ₴</b></span>
          <span className="hy-saved-sub">за 4 покупки у вдалий момент</span>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Button variant="ghost" size="sm">Масові дії</Button>
            <Button variant="secondary" size="sm">Додати книгу</Button>
          </div>
        </div>
      </div>

      <div className="v1-single">
        <section className="hy-front" data-screen-label="Вигідний момент настав">
          <_HV.GroupHead title="Вигідний момент настав" count={g.opportunities.length} />
          {g.opportunities.length ? (
            <div className="v1-rows">
              {g.opportunities.map((i) => <_HV.Row key={i.id} item={i} />)}
            </div>
          ) : (
            <p className="hy-front-empty">
              Поки що жодна книга не дочекалась свого моменту. Щойно дочекається — вона з’явиться тут, а ми напишемо.
            </p>
          )}
        </section>

        <section className="hy-group" data-screen-label="Решта полиці">
          <_HV.GroupHead title="Решта полиці" count={g.rest.length}
            action={<Button variant="ghost" size="sm" style={{ marginLeft: 'auto' }}>За порадою <_HW.Icon name="chevron-down" size={14} /></Button>} />
          <div className="v1-rows">
            {g.rest.map((i) => <_HV.Row key={i.id} item={i} />)}
          </div>
        </section>

        <section className="hy-group" data-screen-label="Weekly letter">
          <_HV.Letter items={items} />
        </section>
      </div>
    </_HV.Shell>
  );
}

/* ── Mobile — Variant C foundation (compact accordion list) + D enhancements ─
   Пріоритети: назва → ціна → економія → CTA → статус → решта після розкриття. */
function HYMobileView({ theme, scenario }) {
  const { Chip, Button } = _HDS;
  const items = _HW.getItems(scenario || 'Звичайний тиждень');
  const g = _HV.groups(items);
  const moments = g.ready.length;

  return (
    <_HV.Shell theme={theme} label="Wishlist v1.0 Hybrid · Mobile" mobile>
      <div style={{ padding: 'var(--space-5) 0 var(--space-3)' }}>
        <p className="v1-eyebrow" style={{ marginBottom: 'var(--space-2)' }}>ВІШЛИСТ · {items.length} КНИГ</p>
        <h1 className="v1-h1 v1-h1--mob">Коли купувати? <em>Knyhovo знає.</em></h1>
      </div>

      <_HV.MobSummary items={items} />

      <div className="v1-mob-sort">
        <Chip selected>Всі</Chip>
        <Chip>Моменти {moments ? '(' + moments + ')' : ''}</Chip>
        <Chip>Стежу</Chip>
      </div>

      {g.ready.length > 0 && (
        <React.Fragment>
          <_HV.GroupHead title="Готові до купівлі" count={g.ready.length} mobile />
          <div className="hy-mcards" data-screen-label="Готові до купівлі · mobile">
            {g.ready.map((i) => <_HV.MobCard key={i.id} item={i} />)}
          </div>
        </React.Fragment>
      )}

      <_HV.GroupHead title="Чекають свого моменту" count={g.waiting.length} mobile />
      <div className="hy-mcards" data-screen-label="Чекають свого моменту · mobile">
        {g.waiting.map((i) => <_HV.MobCard key={i.id} item={i} />)}
      </div>

      {g.meeting.length > 0 && (
        <React.Fragment>
          <_HV.GroupHead title="Знайомимось" count={g.meeting.length} mobile />
          <div className="hy-mcards" data-screen-label="Знайомимось · mobile">
            {g.meeting.map((i) => <_HV.MobCard key={i.id} item={i} />)}
          </div>
        </React.Fragment>
      )}

      <div className="v1-mob-sticky">
        <Button variant="primary" size="md" style={{ width: '100%' }}>Додати книгу</Button>
      </div>
    </_HV.Shell>
  );
}

Object.assign(window, { HYDesktopView, HYMobileView });
