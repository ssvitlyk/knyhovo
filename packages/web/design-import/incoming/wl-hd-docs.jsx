// Knyhovo Wishlist v1.0 — HYBRID DESIGN FREEZE (D + C) · Документація.
// Hybrid Recommendation · Green hierarchy · Card spec · Approval.
'use strict';

const _JW = window.WL;
const _JDS = window.KnyhovoDesignSystem_9fa616;
const _JV = window.HY;

function HYSpec({ label, children }) {
  return (
    <div className="v1-spec-row">
      <span className="v1-spec-label">{label}</span>
      <span className="v1-spec-val">{children}</span>
    </div>
  );
}

/* ── Hybrid Recommendation (D + C) ───────────────────────────────────────── */
function HYDocHybrid({ theme }) {
  const MATRIX = [
    ['Desktop', 'Variant D «Момент»', 'Секції за готовністю («Готові до купівлі» · «Чекають свого моменту» · «Знайомимось»), вердикти, недільний лист, лічильник заощаджень.'],
    ['Mobile', 'Variant C accordion', 'Компактний список: одна книга = одна картка. Основне видно одразу, додаткове — після розкриття. Краще масштабується, зручніше для однієї руки.'],
    ['Discount states', 'Variant D styling', 'Активне зниження ціни — окремий важливий стан: зелений бейдж, зелений border, легкий зелений фон, зелені цифри економії.'],
    ['Card behavior', 'Variant C expansion', 'Accordion: за замовчуванням картки закриті. CTA «До книгарні» — максимум один додатковий тап.'],
  ];
  const STATUS = [
    ['Variant A — Shelf', 'Відхилено', false],
    ['Variant B — Price-first', 'Відхилено', false],
    ['Variant C — Balanced', 'Mobile Foundation', true],
    ['Variant D — «Момент»', 'Primary Direction', true],
  ];
  return (
    <div className="v1-doc-page" data-theme={theme} data-screen-label="Doc · Hybrid recommendation">
      <div className="v1-doc-wrap">
        <p className="v1-eyebrow">HYBRID RECOMMENDATION (D + C)</p>
        <h1 className="v1-h1">Гібридна стратегія</h1>
        <p className="v1-doc-lead">
          Variant C розморожено — він більше не фінальний напрямок. Variant D «Момент» стає
          основою Wishlist v1.0. Гібрид поєднує сильні сторони обох: філософію та структуру D
          на desktop, компактну accordion-архітектуру C на mobile.
        </p>

        <h3 className="v1-doc-h3">Статуси варіантів</h3>
        <div className="v1-mascot-table" style={{ marginBottom: 32 }}>
          {STATUS.map(([name, st, ok]) => (
            <div key={name} className={'v1-mascot-row' + (ok ? '' : ' v1-mascot-row--no')}>
              <span className={'v1-mascot-dot v1-mascot-dot--' + (ok ? 'yes' : 'no')}></span>
              <span className="v1-mascot-row-label">{name}</span>
              <span className="v1-mascot-row-copy">{st}</span>
            </div>
          ))}
        </div>

        <h3 className="v1-doc-h3">Матриця рішень</h3>
        <div className="v1-doc-anno" style={{ marginBottom: 32 }}>
          {MATRIX.map(([area, src, desc]) => (
            <div key={area} className="v1-spec-row">
              <span className="v1-spec-label">{area}</span>
              <span className="v1-spec-val"><b style={{ color: 'var(--text)' }}>{src}</b> — {desc}</span>
            </div>
          ))}
        </div>

        <h3 className="v1-doc-h3">Філософія</h3>
        <p className="v1-approval-tagline" style={{ margin: '8px 0 16px' }}>
          «Не просто зберігай книги. Купуй їх у правильний момент.»
        </p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', maxWidth: '64ch', margin: 0 }}>
          Новий вішлист — не список, а помічник у рішеннях. Knyhovo знає момент: кожна книга
          отримує пораду — купуйте зараз або зачекайте. Без поспіху, без пропущених знижок,
          без FOMO-мови.
        </p>
      </div>
    </div>
  );
}

/* ── Green hierarchy ─────────────────────────────────────────────────────── */
function HYDocGreen({ theme }) {
  const items = _JW.getItems('Хвиля знижок');
  const moment = items.find((i) => i.verdict === 'now' && i.targetMet) || items[0];
  const drop = items.find((i) => i.verdict === 'now' && !i.targetMet) || items[1];
  return (
    <div className="v1-doc-page" data-theme={theme} data-screen-label="Doc · Green hierarchy">
      <div className="v1-doc-wrap">
        <p className="v1-eyebrow">СПЕЦИФІКАЦІЯ · GREEN HIERARCHY</p>
        <h1 className="v1-h1">Зелений — лише для позитивних подій</h1>
        <p className="v1-doc-lead">
          Зелений (<code>--brand-green</code>) використовується виключно для хороших новин:
          ціль досягнута, книга подешевшала, найнижча ціна за період, вигідний момент,
          рекомендація купувати зараз. Користувач миттєво розуміє: «тут відбувається щось хороше».
          Чим сильніша вигода — тим більше зеленого.
        </p>

        <h3 className="v1-doc-h3">Шкала інтенсивності</h3>
        <div className="v1-doc-anno" style={{ marginBottom: 32 }}>
          <HYSpec label="Рівень 1 · зміна">Лише зелена дельта <span className="wl-delta wl-delta--down">−15 ₴</span> — ціна знизилась, але момент ще не настав.</HYSpec>
          <HYSpec label="Рівень 2 · момент">Дельта + зелений бейдж <_JDS.Badge tone="green">Чудовий момент</_JDS.Badge> — вердикт «купуйте зараз».</HYSpec>
          <HYSpec label="Рівень 3 · підсвічена картка">Бейдж + зелений border + легкий зелений фон картки + зелена ціна. Найсильніший сигнал — historical low або досягнута ціль.</HYSpec>
          <HYSpec label="Глобальний рівень">Лічильник заощаджень — зелена serif-цифра у шапці та mobile-плашці.</HYSpec>
        </div>

        <h3 className="v1-doc-h3">Live-приклад · desktop row (рівень 3)</h3>
        <div style={{ maxWidth: 900, marginBottom: 28 }}>
          <_JV.Row item={moment} front />
        </div>

        <h3 className="v1-doc-h3">Live-приклад · mobile card (рівень 3)</h3>
        <div style={{ maxWidth: 390, marginBottom: 32 }}>
          <_JV.MobCard item={drop} />
        </div>

        <h3 className="v1-doc-h3">Заборонено</h3>
        <ul className="v1-doc-ul">
          <li>Зелений для нейтральних чи технічних станів (завантаження, фільтри, навігація).</li>
          <li>Зелений для негативних подій — зростання ціни лишається muted, ніколи червоним і ніколи зеленим.</li>
          <li>Більше одного зеленого бейджа на картку (frozen ієрархія: максимум один сильний сигнал).</li>
          <li>Зелені CTA-кнопки — primary CTA завжди accent (copper/amber), зелений лише контекст.</li>
        </ul>
      </div>
    </div>
  );
}

/* ── Mobile card spec (C accordion + D discount styling) ─────────────────── */
function HYDocCardSpec({ theme }) {
  const items = _JW.getItems('Хвиля знижок');
  const drop = items.find((i) => i.verdict === 'now') || items[0];
  const plain = items.find((i) => i.verdict === 'wait' && i.avail === 'in') || items[1];
  return (
    <div className="v1-doc-page" data-theme={theme} data-screen-label="Doc · Card spec">
      <div className="v1-doc-wrap">
        <p className="v1-eyebrow">СПЕЦИФІКАЦІЯ КОМПОНЕНТА · HYBRID FREEZE</p>
        <h1 className="v1-h1">Мобільна картка-accordion</h1>
        <p className="v1-doc-lead">
          Архітектура Variant C: одна книга = одна картка, основна інформація видима одразу,
          додаткова ховається. Підсвічування знижок — патерни Variant D.
        </p>

        <h3 className="v1-doc-h3">Пріоритети інформації (mobile)</h3>
        <div className="v1-doc-anno" style={{ marginBottom: 32 }}>
          {[
            ['1', 'Назва книги'], ['2', 'Поточна ціна'], ['3', 'Розмір економії'],
            ['4', 'CTA «До книгарні»'], ['5', 'Статус («чудовий момент»)'], ['6', 'Решта — після розкриття'],
          ].map(([n, t]) => (
            <div key={n} className="v1-spec-row">
              <span className="v1-spec-label">Пріоритет {n}</span>
              <span className="v1-spec-val">{t}</span>
            </div>
          ))}
        </div>

        <div className="v1-doc-grid-2" style={{ alignItems: 'start' }}>
          <div style={{ maxWidth: 390, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="v1-doc-b" style={{ marginBottom: 2 }}>Згорнута (default) · momentum + звичайна</p>
            <_JV.MobCard item={drop} />
            <_JV.MobCard item={plain} />
            <p className="v1-doc-b" style={{ margin: '14px 0 2px' }}>Розгорнута</p>
            <_JV.MobCard item={drop} defaultOpen />
          </div>
          <div className="v1-spec-list">
            <h3 className="v1-doc-h3" style={{ marginTop: 0 }}>Згорнутий стан</h3>
            <HYSpec label="Зміст">Обкладинка 36×52 · назва · автор · поточна ціна · зміна ціни · статус · CTA (для моменту)</HYSpec>
            <HYSpec label="CTA">«До книгарні» видимий без розкриття для вигідного моменту; для решти — один тап (у розкритті)</HYSpec>
            <HYSpec label="Тап-ціль">Вся шапка картки ≥44px, chevron обертається 180°</HYSpec>

            <h3 className="v1-doc-h3">Розгорнутий стан</h3>
            <HYSpec label="Зміст">Економія · стара ціна · книгарня · остання перевірка · цільова ціна · сповіщення · дії (деталі, стеження, прибрати)</HYSpec>
            <HYSpec label="Поведінка">Accordion · за замовчуванням закрито · border-top перед тілом</HYSpec>

            <h3 className="v1-doc-h3">Discount state (D)</h3>
            <HYSpec label="Border">color-mix(brand-green 45%, border)</HYSpec>
            <HYSpec label="Фон">color-mix(brand-green 6%, surface) — легкий зелений</HYSpec>
            <HYSpec label="Бейдж">tone="green" «Чудовий момент» — максимум один</HYSpec>
            <HYSpec label="Цифри">Поточна ціна та економія — --brand-green serif</HYSpec>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Approval ────────────────────────────────────────────────────────────── */
function HYDocApproval({ theme }) {
  return (
    <div className="v1-doc-page v1-doc-page--approval" data-theme={theme} data-screen-label="Doc · Approval">
      <div className="v1-doc-wrap v1-doc-wrap--narrow">
        <p className="v1-eyebrow" style={{ letterSpacing: '0.12em' }}>
          KNYHOVO · ВІШЛИСТ v1.0 · HYBRID DESIGN FREEZE (D + C)
        </p>
        <h1 className="v1-h1 v1-h1--large">
          Wishlist v1.0 — гібридна фіксація
        </h1>
        <p className="v1-approval-tagline">
          «Не просто зберігай книги. Купуй їх у правильний момент.»
        </p>

        <div className="v1-approval-why">
          <h3 className="v1-doc-h3">Чому гібрид</h3>
          <div className="v1-doc-grid-2">
            {[
              ['Variant D — Primary Direction', 'Філософія «Knyhovo знає момент»: секції за готовністю, вердикти, недільний лист, лічильник заощаджень. Цінність продукту видима на desktop.'],
              ['Variant C — Mobile Foundation', 'Компактний accordion-список краще масштабується, зручніший для однієї руки і не перевантажує. D один-в-один на mobile не переноситься.'],
              ['Discounts = D', 'Активне зниження ціни — окремий важливий стан, не просто бейдж: зелений border, легкий зелений фон, зелені цифри економії.'],
              ['Green hierarchy', 'Зелений — виключно для позитивних подій. Чим сильніша вигода, тим більше зеленого. Негатив ніколи не зелений і не червоний.'],
            ].map(([t, d]) => (
              <div key={t} className="v1-approval-point">
                <p className="v1-doc-b">{t}</p>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="v1-approval-frozen">
          <h3 className="v1-doc-h3">Заморожені рекомендації для реалізації</h3>
          <ol className="v1-doc-ol">
            <li>Desktop = Variant D: «Готові до купівлі» (зелена секція) → «Чекають свого моменту» → «Знайомимось» → недільний лист.</li>
            <li>Mobile = Variant C: компактний accordion-список; одна книга = одна картка; за замовчуванням закриті.</li>
            <li>Discount state = Variant D styling: зелений бейдж + border + легкий фон + зелені цифри. Максимум один бейдж на картку.</li>
            <li>CTA «До книгарні» — видимий одразу для моменту, максимум один додатковий тап для решти.</li>
            <li>Mobile-пріоритети: назва → ціна → економія → CTA → статус → решта після розкриття.</li>
            <li>Зелений — лише позитивні події; CTA-кнопки завжди accent, ніколи зелені.</li>
            <li>Лічильник заощаджень: зелена serif-цифра (шапка desktop, плашка mobile).</li>
            <li>Маскот (крісло) — лише у 3 станах: empty, first-book, unavailable.</li>
            <li>Skeleton — теплі --surface-accent блоки; sticky CTA «Додати книгу» на mobile.</li>
            <li>Копірайтинг: спокійний, довірливий, без FOMO. «Жодного приводу поспішати».</li>
          </ol>
        </div>

        <div className="v1-approval-stamp">
          <p className="v1-eyebrow">СТАТУС</p>
          <p className="v1-approval-status">WISHLIST v1.0 — HYBRID DESIGN FREEZE (D + C)</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
            Approved for implementation · Knyhovo Design System v1.0 · Заміняє Final Design Freeze від 2026-06-12
          </p>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HYDocHybrid, HYDocGreen, HYDocCardSpec, HYDocApproval });
