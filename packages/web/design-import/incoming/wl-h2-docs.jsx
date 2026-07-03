// Knyhovo «Бажанки» v1.0 — HYBRID DESIGN FREEZE (D + C) · Ревізія 2026-06-13 · Документація.
'use strict';

const _2JW = window.WL;
const _2JDS = window.KnyhovoDesignSystem_9fa616;
const _2JV = window.H2;

function H2Spec({ label, children }) {
  return (
    <div className="v1-spec-row">
      <span className="v1-spec-label">{label}</span>
      <span className="v1-spec-val">{children}</span>
    </div>
  );
}

/* ── Що змінилось — ревізія 2026-06-13 ───────────────────────────────────── */
function H2DocChanges({ theme }) {
  const ROWS = [
    ['Найменування', '«Wishlist / Вішлист» → «Бажанки» у всіх екранах. Wishlist item → «книга у бажанках». Фільтр «Моменти» → «Книги зі знижками».'],
    ['Hero', '«Коли купувати? Knyhovo знає.» → «Бажанки, за якими стежить Книговик.» Підзаголовок: «…Книговик підкаже, коли настане час купувати.»'],
    ['Заощадження', 'Формат «Заощаджено з Knyhovo: 412 ₴» — накопичена вигода за весь час користування, не за тиждень.'],
    ['Секції desktop', '«Вигідний момент настав» → «Книги зі знижками» · «Решта полиці» → «Інші бажанки». Структура: Hero → знижки → інші.'],
    ['Desktop-картки', 'Повна ширина контентної області, єдина сітка (cover → info → status → pricing → CTA → secondary), однакова висота, однакове положення CTA.'],
    ['CTA-порядок', '[Деталі книги] → [До книгарні] — на desktop і mobile, в один ряд. «Деталі книги» — повноцінна secondary-кнопка, не текст і не посилання.'],
    ['Економія', 'Більший акцент: «Економія 80 ₴» — зелена serif, добре читається на картці й у згорнутому mobile-стані.'],
    ['Mobile', 'Variant C accordion без змін. Книги зі знижками автоматично у верхній секції — як на desktop.'],
    ['Недоступна книга', 'Книговик повністю прибраний. Утилітарний стан: назва · факт · [Повідомити мене] [Знайти схожі]. Без емоційного блоку.'],
    ['Правило заголовків', '1+ книга → «Бажанки, за якими стежить Книговик.» у всіх станах. «Ваші бажанки» / onboarding-копірайт — лише у порожньому стані (0 книг).'],
    ['Уніфікація секцій', 'Desktop і mobile однаково: верхній блок «Книги зі знижками», нижній «Інші бажанки». Прибрано «Чекають свого моменту», «Знайомимось», «Готові до купівлі», «Моменти».'],
    ['Ролі у копі', 'Knyhovo — шукає, перевіряє, моніторить ціни. Книговик — радить, стежить, підказує, повідомляє. Рекомендації — від персонального помічника, не від магазину.'],
  ];
  return (
    <div className="v1-doc-page" data-theme={theme} data-screen-label="Doc · Changes">
      <div className="v1-doc-wrap">
        <p className="v1-eyebrow">WISHLIST v1.0 — FINAL DESIGN FREEZE · PRODUCTION-READY</p>
        <h1 className="v1-h1">Що змінилось</h1>
        <p className="v1-doc-lead">
          Гібридна модель збережена: Desktop = Variant D (порадник, групування, пріоритизація),
          Mobile = Variant C (accordion-картки). Зміни — у найменуванні, структурі секцій,
          уніфікації карток і CTA та утилітарному стані недоступної книги.
        </p>
        <div className="v1-doc-anno">
          {ROWS.map(([label, desc]) => (
            <div key={label} className="v1-spec-row">
              <span className="v1-spec-label">{label}</span>
              <span className="v1-spec-val">{desc}</span>
            </div>
          ))}
        </div>
        <h3 className="v1-doc-h3">Продуктовий принцип</h3>
        <p className="v1-approval-tagline" style={{ margin: '8px 0 8px' }}>
          «Knyhovo знаходить ціни. Книговик радить.»
        </p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', maxWidth: '64ch', margin: 0 }}>
          Бажанки — це не список. Бажанки — це книги, за якими стежить Книговик.
          Усі дизайн-рішення підсилюють саме цю ідею.
        </p>
      </div>
    </div>
  );
}

/* ── Hybrid Recommendation (D + C) ───────────────────────────────────────── */
function H2DocHybrid({ theme }) {
  const MATRIX = [
    ['Desktop', 'Variant D «Момент»', 'Секції «Книги зі знижками» (автопідняття) · «Інші бажанки», вердикти Книговика, недільний лист, лічильник «Заощаджено з Knyhovo».'],
    ['Mobile', 'Variant C accordion', 'Компактний список: одна книга = одна картка. Основне видно одразу, додаткове — після розкриття. Знижки теж автоматично вгорі.'],
    ['Discount states', 'Variant D styling', 'Знижка — окремий важливий стан: зелений бейдж, зелений border, легкий зелений фон, помітна зелена «Економія N ₴».'],
    ['Card behavior', 'Variant C expansion', 'Accordion: за замовчуванням картки закриті. CTA-ряд [Деталі книги] [До книгарні] — максимум один додатковий тап.'],
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
        <p className="v1-eyebrow">HYBRID RECOMMENDATION (D + C) · РЕВІЗІЯ 2026-06-13</p>
        <h1 className="v1-h1">Гібридна стратегія</h1>
        <p className="v1-doc-lead">
          Основний напрямок без змін: Variant D «Момент» — основа desktop, Variant C accordion —
          основа mobile. Книговик — особистий порадник, Knyhovo — інструмент, який йому допомагає,
          бажанки — основна сутність продукту.
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
          «Бажанки — це книги, за якими стежить Книговик.»
        </p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-muted)', maxWidth: '64ch', margin: 0 }}>
          Бажанки — не список, а помічник у рішеннях. Knyhovo знаходить ціни, Книговик радить:
          кожна книга отримує пораду — купуйте зараз або зачекайте. Без поспіху, без пропущених
          знижок, без FOMO-мови. У майбутньому Книговик стане AI-персонажем — тексти вже зараз
          підсилюють образ мудрого книжкового помічника.
        </p>
      </div>
    </div>
  );
}

/* ── Green hierarchy ─────────────────────────────────────────────────────── */
function H2DocGreen({ theme }) {
  const items = _2JW.getItems('Хвиля знижок');
  const moment = items.find((i) => i.verdict === 'now' && i.targetMet) || items[0];
  const drop = items.find((i) => i.verdict === 'now' && !i.targetMet) || items[1];
  return (
    <div className="v1-doc-page" data-theme={theme} data-screen-label="Doc · Green hierarchy">
      <div className="v1-doc-wrap">
        <p className="v1-eyebrow">СПЕЦИФІКАЦІЯ · GREEN HIERARCHY</p>
        <h1 className="v1-h1">Зелений — лише для позитивних подій</h1>
        <p className="v1-doc-lead">
          Зелений (<code>--brand-green</code>) використовується виключно для хороших новин:
          знижка, досягнута ціль, історичний мінімум, вигідний момент. Ніколи — для нейтральних
          станів. Чим сильніша вигода — тим більше зеленого. Економія («Економія 80 ₴»,
          «Економія 15 ₴») — помітна зелена serif-цифра, яка добре читається.
        </p>

        <h3 className="v1-doc-h3">Шкала інтенсивності</h3>
        <div className="v1-doc-anno" style={{ marginBottom: 32 }}>
          <H2Spec label="Рівень 1 · зміна">Лише зелена дельта <span className="wl-delta wl-delta--down">−15 ₴</span> — ціна знизилась, але момент ще не настав.</H2Spec>
          <H2Spec label="Рівень 2 · момент">Дельта + зелений бейдж <_2JDS.Badge tone="green">Чудовий момент</_2JDS.Badge> — вердикт «купуйте зараз».</H2Spec>
          <H2Spec label="Рівень 3 · підсвічена картка">Бейдж + зелений border + легкий зелений фон + зелена ціна + акцентна «Економія N ₴». Найсильніший сигнал.</H2Spec>
          <H2Spec label="Глобальний рівень">«Заощаджено з Knyhovo: N ₴» — зелена serif-цифра у шапці та mobile-плашці; накопичена вигода за весь час.</H2Spec>
        </div>

        <h3 className="v1-doc-h3">Live-приклад · desktop картка (рівень 3, повна ширина)</h3>
        <div style={{ marginBottom: 28 }}>
          <_2JV.Row item={moment} />
        </div>

        <h3 className="v1-doc-h3">Live-приклад · mobile card (рівень 3)</h3>
        <div style={{ maxWidth: 390, marginBottom: 32 }}>
          <_2JV.MobCard item={drop} />
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

/* ── Card spec (desktop chassis + mobile accordion + CTA order) ──────────── */
function H2DocCardSpec({ theme }) {
  const items = _2JW.getItems('Хвиля знижок');
  const drop = items.find((i) => i.verdict === 'now') || items[0];
  const plain = items.find((i) => i.verdict === 'wait' && i.avail === 'in') || items[1];
  return (
    <div className="v1-doc-page" data-theme={theme} data-screen-label="Doc · Card spec">
      <div className="v1-doc-wrap">
        <p className="v1-eyebrow">СПЕЦИФІКАЦІЯ КОМПОНЕНТА · РЕВІЗІЯ 2026-06-13</p>
        <h1 className="v1-h1">Картка книги у бажанках</h1>
        <p className="v1-doc-lead">
          Одна сутність — один вигляд у всіх станах. Desktop: повноширинна картка з єдиною сіткою
          та однаковою висотою. Mobile: accordion Variant C. CTA-порядок обов'язковий:
          спочатку дослідження, потім рішення, потім купівля.
        </p>

        <h3 className="v1-doc-h3">Desktop · єдина сітка (повна ширина, однакова висота)</h3>
        <div className="v1-doc-anno" style={{ marginBottom: 24 }}>
          {[
            ['1 · Cover', 'Обкладинка 48×70, --radius-xs'],
            ['2 · Book info', 'Назва (serif, ellipsis) · автор (muted)'],
            ['3 · Recommendation', 'Вердикт-бейдж + один чесний рядок причини'],
            ['4 · Pricing', '«Економія N ₴» (зелена serif) або дельта · ціна · стара ціна · книгарня — вирівняно праворуч'],
            ['5 · CTA', '[Деталі книги · secondary] → [До книгарні · primary] — фіксована позиція в усіх рядках'],
            ['6 · Secondary actions', 'Стеження (дзвіночок) · прибрати — фіксована позиція праворуч'],
          ].map(([n, t]) => (
            <div key={n} className="v1-spec-row">
              <span className="v1-spec-label">{n}</span>
              <span className="v1-spec-val">{t}</span>
            </div>
          ))}
        </div>
        <p className="v1-doc-b" style={{ marginBottom: 6 }}>Live · знижка та звичайна — однакова сітка й висота</p>
        <div className="v1-rows" style={{ marginBottom: 32 }}>
          <_2JV.Row item={drop} />
          <_2JV.Row item={plain} />
        </div>

        <h3 className="v1-doc-h3">CTA-порядок (desktop і mobile)</h3>
        <div className="v1-doc-anno" style={{ marginBottom: 32 }}>
          <H2Spec label="1 · Деталі книги">Повноцінна secondary-кнопка (не текст, не посилання). Користувач спочатку досліджує.</H2Spec>
          <H2Spec label="2 · До книгарні">Primary CTA. Після дослідження — рішення, потім купівля.</H2Spec>
          <H2Spec label="Mobile">Обидві кнопки в один ряд, 50/50, у згорнутій картці зі знижкою та у розкритті для решти.</H2Spec>
          <H2Spec label="Недоступна книга">Другий слот = «Повідомити мене» (secondary) — позиція CTA не змінюється.</H2Spec>
        </div>

        <div className="v1-doc-grid-2" style={{ alignItems: 'start' }}>
          <div style={{ maxWidth: 390, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="v1-doc-b" style={{ marginBottom: 2 }}>Mobile згорнута (default) · знижка + звичайна</p>
            <_2JV.MobCard item={drop} />
            <_2JV.MobCard item={plain} />
            <p className="v1-doc-b" style={{ margin: '14px 0 2px' }}>Mobile розгорнута</p>
            <_2JV.MobCard item={plain} defaultOpen />
          </div>
          <div className="v1-spec-list">
            <h3 className="v1-doc-h3" style={{ marginTop: 0 }}>Згорнутий стан (mobile)</h3>
            <H2Spec label="Зміст">Обкладинка 36×52 · назва · автор · ціна · економія/зміна · статус · CTA-ряд (для знижки)</H2Spec>
            <H2Spec label="Видиме головне">Назва · ціна · економія · CTA — решта після розгортання</H2Spec>
            <H2Spec label="Тап-ціль">Вся шапка картки ≥44px, chevron обертається 180°</H2Spec>

            <h3 className="v1-doc-h3">Розгорнутий стан (mobile)</h3>
            <H2Spec label="Зміст">Економія · стара ціна · книгарня · остання перевірка · цільова ціна · сповіщення · CTA-ряд · дії</H2Spec>
            <H2Spec label="Поведінка">Accordion · за замовчуванням закрито · border-top перед тілом</H2Spec>

            <h3 className="v1-doc-h3">Discount state (D)</h3>
            <H2Spec label="Border">color-mix(brand-green 45%, border)</H2Spec>
            <H2Spec label="Фон">color-mix(brand-green 5–6%, surface) — легкий зелений</H2Spec>
            <H2Spec label="Бейдж">tone="green" «Чудовий момент» — максимум один</H2Spec>
            <H2Spec label="Цифри">Ціна та «Економія N ₴» — --brand-green serif, добре читаються</H2Spec>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Approval ────────────────────────────────────────────────────────────── */
function H2DocApproval({ theme }) {
  return (
    <div className="v1-doc-page v1-doc-page--approval" data-theme={theme} data-screen-label="Doc · Approval">
      <div className="v1-doc-wrap v1-doc-wrap--narrow">
        <p className="v1-eyebrow" style={{ letterSpacing: '0.12em' }}>
          KNYHOVO · WISHLIST v1.0 — FINAL DESIGN FREEZE · «БАЖАНКИ»
        </p>
        <h1 className="v1-h1 v1-h1--large">
          Бажанки v1.0 — фінальна фіксація
        </h1>
        <p className="v1-approval-tagline">
          «Knyhovo знаходить ціни. Книговик радить.»
        </p>

        <div className="v1-approval-why">
          <h3 className="v1-doc-h3">Основний напрямок</h3>
          <div className="v1-doc-grid-2">
            {[
              ['Desktop = Variant D', 'Порадник, групування, пріоритизація: Hero → «Книги зі знижками» (автопідняття) → «Інші бажанки» → недільний лист.'],
              ['Mobile = Variant C', 'Accordion-картки, деталі всередині картки, закриті за замовчуванням. Знижки автоматично вгорі.'],
              ['Книговик = порадник', 'Не магазин, не бренд-асистент. Мудрий книжковий помічник — майбутній AI-персонаж. Усі тексти підсилюють цей образ.'],
              ['Бажанки = сутність', 'Бажанки — не список, а книги, за якими стежить Книговик. Knyhovo — інструмент, який йому допомагає.'],
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
            <li>Правило заголовків: 1+ книга → «Бажанки, за якими стежить Книговик.» у всіх станах; «Ваші бажанки» / onboarding — лише у порожньому стані.</li>
            <li>Найменування: «Бажанки» всюди; фільтр «Книги зі знижками»; «книга у бажанках».</li>
            <li>Секції уніфіковані (desktop і mobile): «Книги зі знижками» → «Інші бажанки». Без «Чекають свого моменту» / «Знайомимось» / «Моменти».</li>
            <li>Ролі: Knyhovo шукає/перевіряє/моніторить ціни; Книговик радить/стежить/підказує/повідомляє — персональний помічник, не магазин.</li>
            <li>Заощадження: «Заощаджено з Knyhovo: N ₴» — накопичена вигода за весь час, зелена serif-цифра.</li>
            <li>Desktop: повноширинні картки, єдина сітка (cover → info → status → pricing → CTA → secondary), однакова висота й відступи.</li>
            <li>Книги зі знижками автоматично піднімаються у верхню секцію — desktop і mobile, користувач не шукає їх по списку.</li>
            <li>CTA-порядок усюди: [Деталі книги · secondary] → [До книгарні · primary], в один ряд; на mobile — рівні за шириною (50/50).</li>
            <li>Зелений — лише позитивні події (знижка, ціль, історичний мінімум, вигідний момент); CTA ніколи не зелені.</li>
            <li>Недоступна книга — утилітарний стан без Книговика: назва · факт · [Повідомити мене] [Знайти схожі].</li>
            <li>Footer єдиний (&lt;KnyhovoFooter /&gt;), bottom-anchored, однакові відступи у всіх станах (desktop і mobile). Маскот — лише empty і first-book.</li>
          </ol>
        </div>

        <div className="v1-approval-stamp">
          <p className="v1-eyebrow">СТАТУС</p>
          <p className="v1-approval-status">WISHLIST v1.0 — FINAL DESIGN FREEZE</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
            Approved for implementation · Фінальна версія перед передачею в реалізацію · Hybrid D + C · Knyhovo Design System v1.0
          </p>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { H2DocChanges, H2DocHybrid, H2DocGreen, H2DocCardSpec, H2DocApproval });
