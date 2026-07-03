// Knyhovo · W6 — Feasibility review (design/spec only, NOT a redesign).
// Classifies every existing W6 state into W6a (ships on current data model) vs
// W6b (needs new backend), with required API fields, field existence, backend
// impact, and MVP safety — plus a migration matrix and roadmap. No new states.
'use strict';

const FZ = window.SO;
const { useState: fzUseState } = React;

/* ── Current model snapshot (grounded in frozen Book Details v1.1 + W5) ──── */
// Live offers today: { store, price, oldPrice, avail: in|low|out } + one global
// batch timestamp ("оновлено сьогодні о 08:00") + the store link behind «Перейти».
// W5 already defines availability ∈ in-stock | out-of-stock | unknown (crawler
// level) and book-level price history — NOT per-store offer history.

function Imp({ level, label }) { return <span className={'fz-imp fz-imp--' + level}>{label}</span>; }
function Mark({ v }) {
  const map = { yes: ['fz-mark--yes', 'Так'], part: ['fz-mark--part', 'Частково'], no: ['fz-mark--no', 'Ні'] };
  const [cls, txt] = map[v];
  return <span className={'fz-mark ' + cls}>{txt}</span>;
}
function Tier({ t }) {
  return <span className={'fz-key ' + (t.startsWith('W6a') ? 'fz-key--a' : 'fz-key--b')}>{t}</span>;
}

/* ── Table A — field inventory ──────────────────────────────────────────── */
const FZ_FIELDS = [
  { f: 'store', d: 'Назва книгарні', used: 'усі', exists: 'yes', imp: ['none', 'немає'], mvp: 'yes' },
  { f: 'price', d: 'Поточна ціна (копійки)', used: 'усі', exists: 'yes', imp: ['none', 'немає'], mvp: 'yes' },
  { f: 'oldPrice', d: 'Стара ціна (−N%)', used: '1 · 3 · best', exists: 'yes', imp: ['none', 'немає'], mvp: 'yes' },
  { f: 'offerUrl', d: 'Партнерське посилання («Перейти»)', used: 'усі CTA', exists: 'yes', imp: ['none', 'немає'], mvp: 'yes', note: 'Ядро продукту — вже існує.' },
  { f: 'availability', d: 'in-stock · out-of-stock', used: 'усі', exists: 'yes', imp: ['none', 'немає'], mvp: 'yes', note: 'Enum уже визначено у W5.' },
  { f: 'availability: unknown', d: '«Наявність уточнюється»', used: '7', exists: 'part', imp: ['low', 'низький'], mvp: 'yes', note: 'Значення enum уже є у краулері — лишити прокинути в offers.' },
  { f: 'availability: low', d: '«Закінчується»', used: '1 · 4 · 6', exists: 'no', imp: ['medium', 'середній'], mvp: 'part', note: 'Немає в enum (тільки in/out/unknown). Потребує рівня запасів від провайдера. Деградує до in-stock.' },
  { f: 'updatedAt', d: 'Глобальний час батч-оновлення', used: 'футер свіжості', exists: 'yes', imp: ['none', 'немає'], mvp: 'yes' },
  { f: 'lastCheckedAt', d: 'Час перевірки на рівні офера', used: '4 (stale)', exists: 'no', imp: ['medium', 'середній'], mvp: 'no', note: 'Глобальний час не може позначити один офер застарілим.' },
  { f: 'previousPrice', d: 'Дельта «Ціна впала з X» (per-store)', used: 'свіжість: changed', exists: 'no', imp: ['medium', 'середній'], mvp: 'no', note: 'Історія W5 — книжкова, не per-store.' },
  { f: 'delivery', d: 'Доставка per-store', used: '1 · 3 · 6', exists: 'no', imp: ['high', 'високий'], mvp: 'no', note: 'Фіди рідко містять; нормалізація важка. Fallback «уточнюється» вже закладено.' },
  { f: 'verified', d: 'Надійність книгарні (статичний конфіг)', used: '3 · 6 · мітка', exists: 'no', imp: ['low', 'низький'], mvp: 'part', note: 'Таблиця-конфіг, без змін краулера. Без рейтингів/відгуків.' },
  { f: 'storeStatus', d: 'Книгарня недоступна (статус краулу)', used: '7', exists: 'no', imp: ['low', 'низький'], mvp: 'part', note: 'Краулер уже знає про збій ранa.' },
  { f: 'linkStatus', d: 'Здоровʼя партнерського посилання', used: '7', exists: 'no', imp: ['medium', 'середній'], mvp: 'no', note: 'Потрібна валідація посилань.' },
  { f: 'duplicateGroup', d: '«Схожі пропозиції обʼєднано · N»', used: 'grouped', exists: 'no', imp: ['medium', 'середній'], mvp: 'no', note: 'Логіка дедуплікації + лічильник.' },
  { f: 'derived', d: 'Найдешевша · Така сама ціна · Найкращий вибір · −N%', used: 'усі', exists: 'yes', imp: ['none', 'клієнт'], mvp: 'yes', note: 'Обчислюється на клієнті з price + avail + freshness.' },
];

/* ── Table B — state migration matrix ───────────────────────────────────── */
const FZ_STATES = [
  { id: 'normal', tier: 'W6a', fields: 'жодного для ядра', imp: ['none', 'немає'], mvp: 'yes', note: 'Ядро вантажиться на поточній моделі. Факти доставки / надійності / дублікатів — пізніші W6b-збагачення; відсутні = просто не показано.' },
  { id: 'cheapest', tier: 'W6a', fields: 'жодного', imp: ['none', 'немає'], mvp: 'yes', note: 'Чиста клієнтська логіка над price + avail + freshness. «На N ₴ дешевше» — обчислення.' },
  { id: 'cheapestOut', tier: 'W6a', fields: 'жодного', imp: ['none', 'немає'], mvp: 'yes', note: 'avail=out уже існує; пропуск OOS у виборі best — на клієнті. Найцінніша дивергенція, що їде одразу.' },
  { id: 'samePrice', tier: 'W6a*', fields: 'verified · delivery (лише для причини)', imp: ['none', 'немає / низький'], mvp: 'yes', note: 'Виявлення рівної ціни + «Така сама ціна» їдуть зараз (детермінований вибір). Осмислений тай-брейк за доставкою/надійністю — W6b.' },
  { id: 'empty', tier: 'W6a', fields: 'жодного', imp: ['none', 'немає'], mvp: 'yes', note: 'Порожній список оферів — уже існує.' },
  { id: 'loading', tier: 'W6a', fields: 'жодного', imp: ['none', 'немає'], mvp: 'yes', note: 'Клієнтський стан запиту.' },
  { id: 'error', tier: 'W6a', fields: 'жодного', imp: ['none', 'немає'], mvp: 'yes', note: 'Клієнтський стан запиту. Локальна відновлювана помилка.' },
  { id: 'bestOverall', tier: 'W6b', fields: 'verified · delivery', imp: ['low', 'низький → високий'], mvp: 'no', note: 'Дивергенція за OOS/stale уже їде (4 · 5). Дивергенція за надійністю/доставкою потребує нових полів (verified — дешево, delivery — дорого).' },
  { id: 'cheapestStale', tier: 'W6b', fields: 'lastCheckedAt (per-offer)', imp: ['medium', 'середній'], mvp: 'no', note: 'Глобальний час не може позначити один офер застарілим. Потрібен час перевірки на рівні офера.' },
  { id: 'providerUnavailable', tier: 'W6b', fields: 'availability:unknown · storeStatus · linkStatus', imp: ['medium', 'низький → середній'], mvp: 'no', note: 'unknown-avail — низький (прокинути enum); storeStatus — низький; linkStatus — середній. Може їхати поетапно.' },
];

/* ── Roadmap ────────────────────────────────────────────────────────────── */
const FZ_ROAD = [
  { no: 'W6a', when: 'MVP · зараз', title: 'Інтелект на поточній моделі', items: [
    <span>Виставити наявний список оферів через <b>GET /api/books/:id/offers</b>: <code>store · price · oldPrice · availability(in/out) · offerUrl</code> + глобальний <code>updatedAt</code>.</span>,
    <span>Прокинути вже наявне <code>availability: unknown</code> (enum з W5) — вмикає часткове S7.</span>,
    <span>Стани: <b>1 · 2 · 5 · 6 · 8 · 9 · 10</b>. Вибір best-offer, «Найдешевша / Така сама ціна / −N%» — все на клієнті. Жодних змін краулера.</span>,
  ] },
  { no: 'P1', when: 'низький', title: 'Надійність книгарні', items: [
    <span>Статичний конфіг <code>verified</code> на книгарню (таблиця, без краулу).</span>,
    <span>Вмикає мітку «Перевірена книгарня» + надійнісну половину станів <b>3 · 6</b>.</span>,
  ] },
  { no: 'P2', when: 'середній', title: 'Свіжість на рівні офера', items: [
    <span>Зберігати <code>lastCheckedAt</code> per-offer; виводити прапор <code>stale</code>.</span>,
    <span>Вмикає стан <b>4</b> + точність «оновлено» в рядку. Опційно: <code>previousPrice</code> для «Ціна впала з X».</span>,
  ] },
  { no: 'P3', when: 'низький–середній', title: 'Здоровʼя краулу та посилань', items: [
    <span><code>storeStatus</code> зі статусу рану краулера + <code>linkStatus</code> із валідації партнерських посилань.</span>,
    <span>Завершує стан <b>7</b> (книгарня / посилання недоступні).</span>,
  ] },
  { no: 'P4', when: 'високий', title: 'Доставка', items: [
    <span>Парсинг + нормалізація <code>delivery</code> на книгарню.</span>,
    <span>Вмикає факти доставки + доставкову половину тай-брейку <b>3 · 6</b>. Найважче; fallback «Доставка уточнюється» уже спроєктовано.</span>,
  ] },
  { no: 'P5', when: 'середній', title: 'Дедуплікація', items: [
    <span><code>duplicateGroup</code> + лічильник для «Схожі пропозиції обʼєднано».</span>,
  ] },
];

function FzFeasibility() {
  const [theme, setTheme] = fzUseState('light');
  const logo = FZ.ASSET + (theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png');
  const { ThemeToggle } = FZ.DS;
  const lbl = (id) => FZ.STATES[id].label;
  return (
    <div className="mx-page" data-theme={theme}>
      <div className="mx-wrap">
        <div className="mx-topbar">
          <div className="mx-brand"><img src={logo} alt="Knyhovo" /><span className="mx-pill">W6 · Feasibility</span></div>
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>

        <p className="mx-eyebrow">Offers Intelligence · feasibility review</p>
        <h1 className="mx-h1">API-міграція та беканд-готовність</h1>
        <p className="mx-lead">Класифікація кожного з 10 наявних станів W6 на <b>W6a</b> (їде на поточній моделі даних) та <b>W6b</b> (потребує нових беканд-можливостей). Без редизайну візуалів і без нових станів — лише оцінка реалізовності.</p>
        <div className="mx-note"><b>Поточна модель (frozen Book Details v1.1 + W5):</b> live-офер = <code>{'{ store, price, oldPrice, avail: in|low|out }'}</code> + один глобальний час батч-оновлення + посилання книгарні за «Перейти». W5 уже визначає <code>availability ∈ in-stock | out-of-stock | unknown</code> на рівні краулера та <b>книжкову</b> (не per-store) історію цін.</div>

        <div className="fz-legend">
          <span className="fz-leg"><span className="fz-key fz-key--a">W6a</span> їде на поточній моделі</span>
          <span className="fz-leg"><span className="fz-key fz-key--b">W6b</span> потребує нового беканду</span>
          <span className="fz-leg"><Imp level="none" label="немає" /></span>
          <span className="fz-leg"><Imp level="low" label="низький" /></span>
          <span className="fz-leg"><Imp level="medium" label="середній" /></span>
          <span className="fz-leg"><Imp level="high" label="високий" /></span>
        </div>

        <section className="mx-section">
          <h2 className="mx-h2">Інвентар полів API</h2>
          <p className="mx-sub">Кожне поле, якого торкається інтелектуальний шар: де воно потрібне, чи існує сьогодні, беканд-вплив і чи безпечне для MVP.</p>
          <div className="fz-tablewrap">
            <table className="fz-table fz-table--fields">
              <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
              <thead><tr><th>Поле API</th><th>Що це</th><th>Стани</th><th>Існує?</th><th>Беканд-вплив</th><th>MVP-safe</th></tr></thead>
              <tbody>
                {FZ_FIELDS.map((r, i) => (
                  <tr key={i}>
                    <td><code>{r.f}</code></td>
                    <td><span className="fz-field">{r.d}</span>{r.note ? <div className="fz-muted" style={{ marginTop: 4 }}>{r.note}</div> : null}</td>
                    <td className="fz-muted">{r.used}</td>
                    <td><Mark v={r.exists} /></td>
                    <td><Imp level={r.imp[0]} label={r.imp[1]} /></td>
                    <td><Mark v={r.mvp} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-section">
          <h2 className="mx-h2">Матриця міграції станів</h2>
          <p className="mx-sub">Сім станів їдуть як W6a (S6 — гібрид: базово зараз, осмислений тай-брейк пізніше). Три потребують нового беканду.</p>
          <div className="fz-tablewrap">
            <table className="fz-table fz-table--states">
              <colgroup><col /><col /><col /><col /><col /><col /></colgroup>
              <thead><tr><th>Стан</th><th>Рівень</th><th>Потрібні нові поля</th><th>Беканд-вплив</th><th>MVP-safe</th><th>Примітка</th></tr></thead>
              <tbody>
                {FZ_STATES.map((r) => (
                  <tr key={r.id}>
                    <td><span className="fz-state-name">{lbl(r.id)}</span></td>
                    <td><Tier t={r.tier} /></td>
                    <td className="fz-muted">{r.fields}</td>
                    <td><Imp level={r.imp[0]} label={r.imp[1]} /></td>
                    <td><Mark v={r.mvp} /></td>
                    <td>{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-section">
          <h2 className="mx-h2">Дорожня карта реалізації</h2>
          <p className="mx-sub">W6a відвантажується першим без змін краулера. Подальші фази вмикають W6b-стани в порядку «цінність ÷ зусилля».</p>
          <div className="fz-road">
            {FZ_ROAD.map((p, i) => (
              <div className="fz-phase" key={i}>
                <div className="fz-phase__tag"><span className="fz-phase__no">{p.no}</span><span className="fz-phase__when">{p.when}</span></div>
                <div>
                  <p className="fz-phase__title">{p.title}</p>
                  <div className="fz-phase__body"><ul>{p.items.map((it, j) => <li key={j}>{it}</li>)}</ul></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-section">
          <h2 className="mx-h2">Підсумок</h2>
          <ul className="mx-list">
            <li><FZ.Icon name="check" size={15} /><span><b>W6a (MVP зараз):</b> {['normal', 'cheapest', 'cheapestOut', 'samePrice', 'empty', 'loading', 'error'].map(lbl).join(' · ')}. Потребує лише виставлення наявного списку оферів + прокидання <code>availability: unknown</code>.</span></li>
            <li><FZ.Icon name="check" size={15} /><span><b>W6b (новий беканд):</b> {['bestOverall', 'cheapestStale', 'providerUnavailable'].map(lbl).join(' · ')}. Жодне не блокує MVP — усі деградують спокійно (відсутній сигнал = тихо прихований).</span></li>
            <li><FZ.Icon name="check" size={15} /><span><b>Найбезпечніша рання цінність:</b> S5 (найдешевша, але OOS) — найкорисніша «best ≠ cheapest» історія, що їде на нульовій зміні беканду.</span></li>
            <li><FZ.Icon name="check" size={15} /><span><b>Єдине дороге поле — <code>delivery</code></b> (високий). Усе інше — низький/середній; <code>verified</code> і <code>availability:unknown</code> — найдешевші перемоги.</span></li>
          </ul>
        </section>

        <p className="mx-foot">Knyhovo · W6 Store Offers Intelligence v1.0 · feasibility review · без редизайну візуалів, без нових станів · {new Date().getFullYear()}.</p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('so-root')).render(<FzFeasibility />);
