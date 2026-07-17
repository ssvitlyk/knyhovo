/* ═══════════════════════════════════════════════════════════════════
   wl22-app.jsx — Бажанки v2.2 · фіналізація мобільної взаємодії · 2026-07-07
   Desktop — без змін (v2.1). Mobile: featured hero (тапабельна картка +
   шеврон-афорданс) → «Зараз вигідно купити» як stacked-карусель
   (свайп, peek наступної картки, крапки); картки без «Деталі» —
   єдина CTA «Купити за N ₴», статус-бейдж над обкладинкою-«книгою».

   Оновлення 2026-07-08 — продуктова логіка «Зараз вигідно купити»: секція
   тепер керується мотором рекомендацій (wl-buying-reasons.js,
   window.KnyhovoBuyingReasons). Візуал НЕ змінювався — тільки джерело
   даних, зміст бейджа і сортування. Деталі: «Claude Code - Buying Reason
   Engine.md». Порада Книговика (featured hero) — НЕ підключена, лишається
   незалежною вручну курованою рекомендацією.

   Ревізія 2026-07-08 (той самий день, довіра до даних) — звужено до 3
   причин, що доводять РЕАЛЬНИЙ історичний рух ціни за власним трекінгом
   Knyhovo: TARGET_REACHED, LOWEST_90_DAYS, PRICE_DROPPED. Прибрано
   BEST_OFFER / BIG_DISCOUNT / BACK_IN_STOCK / GOOD_DEAL — вони не
   доводили падіння ціни в часі (порівняння книгарень, «знижка» як така чи
   подія наявності). Немає фолбек-причини: без одного з цих 3 сигналів
   книга просто не показується тут.
   ═══════════════════════════════════════════════════════════════════ */

const WL21_DS = window.KnyhovoDesignSystem_9fa616;

/* ── Icons (Lucide outline, inline) ── */
const WL21_ICONS = {
  'arrow-up-down': '<path d="m21 16-4 4-4-4"></path><path d="M17 20V4"></path><path d="m3 8 4-4 4 4"></path><path d="M7 4v16"></path>',
  'chevron-down': '<path d="m6 9 6 6 6-6"></path>',
  'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>',
  check: '<path d="M20 6 9 17l-5-5"></path>',
  'chevron-left': '<path d="m15 18-6-6 6-6"></path>',
  'chevron-right': '<path d="m9 18 6-6-6-6"></path>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>',
  'arrow-down': '<path d="M12 5v14"></path><path d="m19 12-7 7-7-7"></path>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path>',
  'trending-down': '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline>',
  target: '<circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle>',
  search: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>',
};
function WL21Icon({ name, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: WL21_ICONS[name] || '' }} />
  );
}

const WL21_COVER = (id) => 'assets/covers/' + id + '.png?v=2';
const wl21uah = (n) => n + ' ₴';

/* ── Mock data (той самий каталог, що v2.0) ── */
const WL21_FEATURED = {
  id: 'atomni', title: 'Атомні звички', author: 'Джеймс Клір',
  price: 199, prev: 245, store: 'Yakaboo', save: 46, target: 210,
};

/* ── Каталог-кандидатів «Зараз вигідно купити» — СИРІ дані книгарень.
   Причину купівлі (BuyingReason) обчислює бізнес-рівень нижче
   (window.KnyhovoBuyingReasons, wl-buying-reasons.js) — ця картка даних
   лише постачає факти з ВЛАСНОГО щоденного трекінгу Knyhovo: поточну
   ціну, попередню відстежену ціну (prevPrice — НІКОЛИ «стара ціна» від
   книгарні), цільову ціну користувача (targetPrice) та 90-денний мінімум
   (min90). Жодних порівнянь між книгарнями і жодних заявлених знижок —
   це і є довіра (див. «Claude Code - Buying Reason Engine.md», §1). Ті
   самі 12 книг, що й раніше — жодної нової книги, лише відкориговані
   ціни (там, де треба було перетнути поріг чи прибрати випадкове
   співпадіння з іншим правилом). genre/added — фолбек-поля на випадок,
   якщо книга не набере жодної з 3 причин і піде у «Решта бажанок»
   (див. WL21_SALE_OVERFLOW). */
const WL21_SALE_CANDIDATES = [
  { id: 'harry', title: 'Гаррі Поттер і келих вогню', author: 'Дж. К. Ролінг', price: 320, prevPrice: 365, store: 'Yakaboo', genre: 'Дитячі', added: 9 },
  { id: 'dofamin', title: 'Дофамінове покоління', author: 'Анна Лембке', price: 285, prevPrice: 285, store: 'Книгарня «Є»', genre: 'Нонфікшн', added: 6 },
  { id: 'b1984', title: '1984', author: 'Джордж Орвелл', price: 176, prevPrice: 208, min90: 176, store: 'Книгарня «Є»', genre: 'Класика', added: 11 },
  { id: 'tygrolovy', title: 'Тигролови', author: 'Іван Багряний', price: 150, prevPrice: 175, targetPrice: 155, store: 'Rozetka', genre: 'Класика', added: 8 },
  { id: 'sapiens', title: 'Сапієнс. Людина розумна', author: 'Ювал Ной Харарі', price: 315, prevPrice: 399, store: 'Yakaboo', genre: 'Нонфікшн', added: 10 },
  { id: 'majster', title: 'Майстер і Маргарита', author: 'Михайло Булгаков', price: 280, prevPrice: 340, store: 'Rozetka', genre: 'Класика', added: 15 },
  { id: 'feliks', title: 'Фелікс Австрія', author: 'Софія Андрухович', price: 195, prevPrice: 240, store: 'Книгарня «Є»', genre: 'Сучасна проза', added: 5 },
  { id: 'internat', title: 'Інтернат', author: 'Сергій Жадан', price: 220, prevPrice: 220, store: 'Yakaboo', genre: 'Сучасна проза', added: 17 },
  { id: 'sto-rokiv', title: 'Сто років самотності', author: 'Габріель Гарсія Маркес', price: 310, prevPrice: 310, store: 'BookChef', genre: 'Класика', added: 6 },
  { id: 'pryntz', title: 'Маленький принц', author: 'Антуан де Сент-Екзюпері', price: 150, prevPrice: 185, store: 'Yakaboo', genre: 'Дитячі', added: 9 },
  { id: 'drabyna', title: 'Драбина', author: 'Євгенія Кузнєцова', price: 240, prevPrice: 285, store: 'Книгарня «Є»', genre: 'Сучасна проза', added: 13 },
  { id: 'tonke', title: 'Тонке мистецтво забивати', author: 'Марк Менсон', price: 260, prevPrice: 310, store: 'Rozetka', genre: 'Нонфікшн', added: 16 },
];

/* Бізнес-рівень вирішує ЄДИНУ причину на книгу і одразу повертає готовий
   порядок показу (пріоритет → економія ₴, спадно). UI нижче більше НІЧОГО
   не сортує і не вирішує — тільки рендерить. */
const WL21_SALE_EVAL = window.KnyhovoBuyingReasons.evaluateCatalog(WL21_SALE_CANDIDATES);
const WL21_SALE_ELIGIBLE_IDS = new Set(WL21_SALE_EVAL.map((b) => b.id));
/* Книги без підстави НЕ зникають — приєднуються до звичайних бажанок
   (WL21_REST нижче), як і вимагає правило «без причини → звичайні бажанки». */
const WL21_SALE_OVERFLOW = WL21_SALE_CANDIDATES
  .filter((b) => !WL21_SALE_ELIGIBLE_IDS.has(b.id))
  .map((b) => ({ id: b.id, title: b.title, author: b.author, genre: b.genre, price: b.price, status: 'Ще може подешевшати', added: b.added }));

const WL21_REST_BASE = [
  { id: 'dumai', title: 'Думай повільно… вирішуй швидко', author: 'Деніел Канеман', genre: 'Нонфікшн', price: 390, status: 'Книговик стежить', added: 12 },
  { id: 'tini', title: 'Тіні забутих предків', author: 'Михайло Коцюбинський', genre: 'Класика', price: 180, status: 'Ще може подешевшати', added: 3 },
  { id: 'lisova', title: 'Лісова пісня', author: 'Леся Українка', genre: 'Класика', price: 165, status: 'Книговик стежить', added: 4 },
  { id: 'kobzar', title: 'Кобзар', author: 'Тарас Шевченко', genre: 'Класика', price: null, status: 'Очікуємо наявності', added: 2, out: true },
  { id: 'eneida', title: 'Енеїда', author: 'Іван Котляревський', genre: 'Класика', price: 230, status: 'Книговик стежить', added: 5 },
  { id: 'misto', title: 'Місто', author: 'Валер\u02BCян Підмогильний', genre: 'Класика', price: 175, status: 'Ще може подешевшати', added: 7 },
  { id: 'perekop', title: 'За Перекопом є земля', author: 'Анастасія Левкова', genre: 'Сучасна проза', price: 205, status: 'Книговик стежить', added: 1 },
  { id: 'dotsia', title: 'Доця', author: 'Тамара Горіха Зерня', genre: 'Сучасна проза', price: 210, status: 'Книговик стежить', added: 19 },
  { id: 'svitlo', title: 'Доки світло не згасне', author: 'Макс Кідрук', genre: 'Сучасна проза', price: null, status: 'Збираємо дані', added: 20 },
  { id: 'dveri', title: 'Той, хто відчиняє двері', author: 'Ілларіон Павлюк', genre: 'Сучасна проза', price: 265, status: 'Книговик стежить', added: 14 },
  { id: 'toreadory', title: 'Тореадори з Васюківки', author: 'Всеволод Нестайко', genre: 'Дитячі', price: 190, status: 'Книговик стежить', added: 13 },
];

/* Книги, що не пройшли рушій рекомендацій (WL21_SALE_OVERFLOW), приєднуються
   сюди автоматично — нічого не губиться і нічого не дублюється вручну. */
const WL21_REST = [...WL21_REST_BASE, ...WL21_SALE_OVERFLOW];

const WL21_TOTAL = 1 + WL21_SALE_CANDIDATES.length + WL21_REST_BASE.length;
const WL21_MOMENT = 1 + WL21_SALE_EVAL.length;

/* Реальний перелік жанрів — з книг у бажанках, найбільші зверху */
const WL21_GENRES = (() => {
  const m = new Map();
  WL21_REST.forEach((b) => m.set(b.genre, (m.get(b.genre) || 0) + 1));
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'uk'))
    .map(([g, c]) => ({ id: g, label: g, count: c }));
})();

/* Сортування (жанр — тепер фільтр, не режим сортування) */
const WL21_SORTS = {
  added: { label: 'Нещодавно додані', fn: (a, b) => b.added - a.added },
  title: { label: 'За назвою', fn: (a, b) => a.title.localeCompare(b.title, 'uk') },
  author: { label: 'За автором', fn: (a, b) => a.author.localeCompare(b.author, 'uk') || a.title.localeCompare(b.title, 'uk') },
};

/* ── Універсальний dropdown (заморожений cd-sort рецепт) ── */
function WL21Dropdown({ value, options, onChange, icon, ariaLabel, valueLabel }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="cd-sort" ref={ref}>
      <button type="button" className="cd-sort__btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="cd-sort__val"><WL21Icon name={icon} size={16} />{valueLabel}</span>
        <span className="cd-sort__caret"><WL21Icon name="chevron-down" size={18} /></span>
      </button>
      {open ? (
        <ul className="cd-sort__menu" role="listbox" aria-label={ariaLabel}>
          {options.map((opt) => (
            <li key={opt.id}>
              <button type="button" role="option" aria-selected={opt.id === value}
                className={'cd-sort__opt' + (opt.id === value ? ' cd-sort__opt--active' : '')}
                onClick={() => { onChange(opt.id); setOpen(false); }}>
                <span className={'cd-sort__check' + (opt.id === value ? '' : ' cd-sort__check--hidden')}><WL21Icon name="check" size={16} /></span>
                {opt.label}
                {opt.count != null ? <span className="cd-sort__optcount">{opt.count}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ── Пагінація — заморожений компонент Search Results ── */
function wl21PageItems(page, pages) {
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const sorted = [...set].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap === 2) out.push(sorted[i] - 1);
      else if (gap > 2) out.push('\u2026');
    }
    out.push(sorted[i]);
  }
  return out;
}
function WL21Pagination({ page, pages, onPage }) {
  const { Button } = WL21_DS;
  if (pages <= 1) return null;
  return (
    <nav className="kn-pagination" aria-label="Сторінки бажанок" data-screen-label="Pagination">
      <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => onPage(page - 1)}>← Назад</Button>
      <div className="kn-pagination__pages">
        {wl21PageItems(page, pages).map((item, i) =>
          item === '\u2026'
            ? <span key={'e' + i} className="kn-pagination__ellipsis">…</span>
            : <Button key={item} variant={item === page ? 'primary' : 'ghost'} size="sm"
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPage(item)}>{item}</Button>
        )}
      </div>
      <Button variant="secondary" size="sm" disabled={page === pages} onClick={() => onPage(page + 1)}>Далі →</Button>
    </nav>
  );
}

/* ── 1 · Hero — 3 варіанти композиції, акцент «5 із 24» + KPI ── */
function WL21Hero({ theme, variant }) {
  const mascot = theme === 'dark'
    ? 'assets/mascot/mascot-reading-chair-dark-final.png'
    : 'assets/mascot/mascot-reading-chair-light-hybrid.png';
  const m = WL21_MOMENT;
  const t = WL21_TOTAL;
  const fresh = (
    <span className="sec-fresh wl21-hero__fresh"><span className="sec-fresh__dot"></span>Перевірено сьогодні</span>
  );
  const savingsKpi = (
    <div className="wl21-kpi">
      <span className="wl21-kpi__label">Вже заощадили</span>
      <b className="wl21-kpi__num">412 ₴</b>
    </div>
  );
  return (
    <div className="page">
      <section className="wl21-hero reveal" data-screen-label="Hero">
        <img className="wl21-hero__mascot" src={mascot} alt="Книговик читає у кріслі" />
        <div className="wl21-hero__main">
          <span className="wl21-hero__badge">Бажанки · {t} книги під наглядом</span>
          {variant === 'B' ? (
            <React.Fragment>
              <div className="wl21-hero__bignum"><b>{m}</b><span>із {t}</span></div>
              <p className="wl21-hero__bigsub">книг вигідно купувати вже сьогодні</p>
            </React.Fragment>
          ) : variant === 'C' ? (
            <h1 className="wl21-hero__title">{m} книг вже вигідно купувати.</h1>
          ) : (
            <h1 className="wl21-hero__title">Сьогодні вигідний момент для <b>{m} із {t}</b> ваших книг.</h1>
          )}
          <p className="wl21-hero__desc">Knyhovo щодня стежить за цінами і повідомляє, коли настав вигідний момент.</p>
        </div>
        <div className="wl21-hero__side">
          {variant === 'C' ? (
            <div className="wl21-hero__kpiduo">
              <div className="wl21-kpi wl21-kpi--moment">
                <span className="wl21-kpi__label">Вигідний момент</span>
                <b className="wl21-kpi__num">{m} із {t}</b>
              </div>
              {savingsKpi}
            </div>
          ) : savingsKpi}
          {fresh}
        </div>
      </section>
    </div>
  );
}

/* ── Статусний бейдж поради — повторно використовуваний компонент.
   Стани: goal · best · drop · deal · low90 · none (без бейджа).
   Лише позитивні події → завжди зелена тональність (заморожене правило).
   Іконки — Lucide outline (DS: без емодзі). ── */
const WL21_STATUSES = {
  goal: { icon: 'check', label: 'Ціль досягнута' },
  best: { icon: 'flame', label: 'Найкраща ціна' },
  drop: { icon: 'arrow-down', label: 'Ціна впала' },
  deal: { icon: 'zap', label: 'Велика знижка' },
  low90: { icon: 'trending-down', label: 'Мінімум за 90 днів' },
};
function WL21StatusBadge({ status, className }) {
  const s = WL21_STATUSES[status];
  if (!s) return null;
  return (
    <span className={'wl21-badge wl21-badge--green' + (className ? ' ' + className : '')}>
      <WL21Icon name={s.icon} size={12} />{s.label}
    </span>
  );
}

/* ── Мотор рекомендацій «Зараз вигідно купити» — презентаційний шар.
   window.KnyhovoBuyingReasons (wl-buying-reasons.js) вирішує ЯКА причина
   застосовується до книги (бізнес-логіка, платформо-незалежний enum). Це
   ЄДИНЕ місце, де UI мапить той enum на іконку+підпис. Мобільна і десктопна
   картки (WL22MobCard, WL21SaleCard) використовують ЦЮ саму мапу —
   однакова поведінка, різна лише презентація (вимога специфікації). ── */
const WL21_BR = window.KnyhovoBuyingReasons.BuyingReason;
/* Ревізія 2026-07-08 (довіра до даних) — лише 3 причини, кожна доводить
   РЕАЛЬНИЙ історичний рух ціни за власним трекінгом Knyhovo. BEST_OFFER /
   BIG_DISCOUNT / BACK_IN_STOCK / GOOD_DEAL прибрані з мапи разом з enum —
   не повертати без окремого продуктового рішення (див. CLAUDE.md). */
const WL21_REASON_META = {
  [WL21_BR.TARGET_REACHED]: { icon: 'target', label: 'Досягнуто вашої цілі' },
  [WL21_BR.LOWEST_90_DAYS]: { icon: 'trending-down', label: 'Найнижча за 90 днів' },
  [WL21_BR.PRICE_DROPPED]: { icon: 'arrow-down', label: 'Подешевшала' },
};
function wl21ReasonMeta(reason) {
  return WL21_REASON_META[reason] || WL21_REASON_META[WL21_BR.PRICE_DROPPED];
}

/* ── Адаптивна ціна-CTA: «Купити за N ₴», а якщо повний напис не вміщується
   по ширині — автоматичний фолбек до «N ₴». Без зменшення шрифту, без
   перенесення, без збільшення висоти (вимір прихованим span + RO). ── */
function WL21FeatBuyCta({ price, href, className }) {
  const btnRef = React.useRef(null);
  const mRef = React.useRef(null);
  const [full, setFull] = React.useState(true);
  const fullLabel = 'Купити за ' + wl21uah(price);
  React.useLayoutEffect(() => {
    const check = () => {
      const btn = btnRef.current;
      const m = mRef.current;
      if (!btn || !m) return;
      const cs = getComputedStyle(btn);
      const avail = btn.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      /* 2px запас безпеки проти суб-піксельних округлень */
      setFull(m.offsetWidth <= avail - 2);
    };
    check();
    /* повторний вимір після завантаження шрифтів (Lora змінює ширину напису) */
    let alive = true;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (alive) requestAnimationFrame(check); });
    }
    if (typeof ResizeObserver === 'undefined' || !btnRef.current) return undefined;
    const ro = new ResizeObserver(() => requestAnimationFrame(check));
    ro.observe(btnRef.current);
    if (mRef.current) ro.observe(mRef.current); /* span теж: шрифт/текст міняє його ширину без зміни кнопки */
    return () => { alive = false; ro.disconnect(); };
  }, [price]);
  return (
    <a ref={btnRef} className={'wl-btn ' + (className || 'wl21-featm__buy')} href={href}
      aria-label={fullLabel} onClick={(e) => e.stopPropagation()}>
      <span ref={mRef} className="wl21-featm__measure" aria-hidden="true">{fullLabel}</span>
      {full ? fullLabel : wl21uah(price)}
    </a>
  );
}

/* ── 2 · «Ціль досягнута» — момент виконання цілі користувача, НЕ порада
   Книговика (маскот прибраний повністю, брифом заборонений). Штамп
   (завжди зелений — фризнене правило «лише позитивні події») по центру
   зверху картки, ніби печатка на офіційному документі. Заголовок і текст
   пояснюють ФАКТ (чому картку показано), а не рекомендують. Desktop і
   mobile — та сама паперова картка з пунктирною внутрішньою рамкою;
   mobile — вертикальна композиція. Єдина CTA-ціна (WL21FeatBuyCta,
   спільна з мобільним рецептом) — головна дія; «Деталі книги» — тиха
   другорядна лінк-кнопка, що не конкурує з покупкою. ── */
const WL21_FEAT_COPY = {
  goal: {
    eyebrow: 'Настав момент купити',
    msg: (b) => <React.Fragment>Ви встановили бажану ціну <b>{wl21uah(b.target)}</b>. Сьогодні книга коштує <b>{wl21uah(b.price)}</b> — це найнижча ціна за останні 6 місяців.</React.Fragment>,
  },
  best: {
    eyebrow: 'Найкраща ціна за весь час',
    msg: (b) => <React.Fragment>Відколи ви додали книгу до бажанок, ціна ще ніколи не була нижчою за <b>{wl21uah(b.price)}</b>.</React.Fragment>,
  },
  drop: {
    eyebrow: 'Ціна щойно знизилася',
    msg: (b) => <React.Fragment>Із моменту, коли ви додали книгу до бажанок, ціна знизилася на <b>{wl21uah(b.save)}</b> — до {wl21uah(b.price)}.</React.Fragment>,
  },
  deal: {
    eyebrow: 'Вигідна знижка сьогодні',
    msg: (b) => <React.Fragment>{b.store} пропонує книгу за <b>{wl21uah(b.price)}</b> замість {wl21uah(b.prev)} — суттєво вигідніше, ніж зазвичай.</React.Fragment>,
  },
  low90: {
    eyebrow: 'Найнижча ціна за 90 днів',
    msg: (b) => <React.Fragment>За останні 90 днів книга ще не коштувала менше, ніж сьогоднішні <b>{wl21uah(b.price)}</b>.</React.Fragment>,
  },
  none: {
    eyebrow: 'Вигідний момент купити',
    msg: (b) => <React.Fragment>{b.store}: <b>{wl21uah(b.price)}</b> — вигідна ціна серед книг у ваших бажанках.</React.Fragment>,
  },
};
const WL21_FEAT_DATE = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });

function WL21Featured({ status }) {
  const b = WL21_FEATURED;
  const detailsHref = 'Book Details - Exploration.html';
  const copy = WL21_FEAT_COPY[status] || WL21_FEAT_COPY.none;
  const s = WL21_STATUSES[status];
  const stampLabel = s ? s.label : null;
  const [isMobile, setIsMobile] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const stamp = stampLabel ? (
    <div className={isMobile ? 'wl21-featm__stamp' : 'wl21-feat__stamp'} role="img" aria-label={stampLabel + ', ' + WL21_FEAT_DATE}>
      <em><WL21Icon name="check" size={isMobile ? 11 : 13} />{stampLabel}</em>
      <small>{WL21_FEAT_DATE}</small>
    </div>
  ) : null;

  if (isMobile) {
    return (
      <div className="sec">
        <div className="page">
          <section className={'wl21-featm reveal' + (stampLabel ? '' : ' wl21-featm--nostamp')} data-screen-label={copy.eyebrow}>
            {stamp}
            <span className="wl21-featm__eyebrow">{copy.eyebrow}</span>
            <div className="wl21-goalm__book"><img src={WL21_COVER(b.id)} alt="" /></div>
            <h2 className="wl21-featm__title">{b.title}</h2>
            <p className="wl21-featm__author">{b.author}</p>
            <p className="wl21-featm__msg">{copy.msg(b)}</p>
            <div className="wl21-featm__price"><b>{wl21uah(b.price)}</b><s>{wl21uah(b.prev)}</s></div>
            <span className="wl21-goalm__store">{b.store} · економія {b.save} ₴</span>
            <WL21FeatBuyCta price={b.price} href="#" />
            <a className="wl21-featm__details" href={detailsHref} onClick={(e) => e.stopPropagation()}>Деталі книги</a>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="sec">
      <div className="page">
        <section className={'wl21-feat reveal' + (stampLabel ? '' : ' wl21-feat--nostamp')} data-screen-label={copy.eyebrow}>
          {stamp}
          <div className="wl21-feat__cover">
            <div className="wl21-feat__coverclip"><img src={WL21_COVER(b.id)} alt="" /></div>
          </div>
          <div className="wl21-feat__body">
            <span className="wl21-feat__eyebrow">{copy.eyebrow}</span>
            <h2 className="wl21-feat__title">{b.title}</h2>
            <p className="wl21-feat__author">{b.author}</p>
            <p className="wl21-feat__msg">{copy.msg(b)}</p>
          </div>
          <div className="wl21-feat__side">
            <div className="wl21-feat__price"><b>{wl21uah(b.price)}</b><s>{wl21uah(b.prev)}</s></div>
            <span className="wl21-feat__store">{b.store} · економія {b.save} ₴</span>
            <WL21FeatBuyCta price={b.price} href="#" className="wl21-feat__buy" />
            <a className="wl21-feat__details" href={detailsHref}>Деталі книги</a>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── 3 · Зараз вигідно купити — преміальна viewport-карусель (desktop) ──
   Книги з бажанок, які подешевшали. Одна «сторінка» = 2×2 сітка з 4 книг;
   уся сітка з'їжджає горизонтально як єдине ціле. М'який peek наступної
   сторінки праворуч (і попередньої ліворуч на 2+ сторінці), тонкий
   прогрес-бар, дві кругові стрілки. Ціна — герой, знижка одразу помітна.
   На мобільному (≤768px) — тихий вертикальний стек тих самих карток. */

function WL21SaleCard({ b }) {
  const rm = wl21ReasonMeta(b.reason);
  const hasDiscount = b.prevPrice != null && b.prevPrice > b.price;
  return (
    <article className="wl21-sale">
      <a className="wl21-sale__coverlink" href="Book Details - Exploration.html" tabIndex={-1} aria-hidden="true">
        <span className="wl21-sale__coverclip"><img src={WL21_COVER(b.id)} alt="" /></span>
      </a>
      <div className="wl21-sale__body">
        <span className="wl21-sale__disc"><WL21Icon name={rm.icon} size={12} />{rm.label}</span>
        <h3 className="wl21-sale__title">
          <a href="Book Details - Exploration.html">{b.title}</a>
        </h3>
        <p className="wl21-sale__author">{b.author}</p>
        <div className="wl21-sale__foot">
          <div className="wl21-sale__pricecol">
            <span className="wl21-sale__priceline">
              <b className="wl21-sale__price">{wl21uah(b.price)}</b>
              {hasDiscount ? <s className="wl21-sale__old">{wl21uah(b.prevPrice)}</s> : null}
            </span>
            <span className="wl21-sale__store">{b.store}{b.savingsUAH > 0 ? ' · економія ' + b.savingsUAH + ' ₴' : ''}</span>
          </div>
          <a className="wl-btn wl-btn--primary wl21-sale__buy" href="#">До книгарні</a>
        </div>
      </div>
    </article>
  );
}

/* ── v2.2 mobile · картка каруселі: вся картка тапабельна → Деталі;
   єдина кнопка — «Купити за N ₴» (фолбек «N ₴»); шеврон-афорданс
   у правому верхньому куті; опційний статус-бейдж над обкладинкою-
   «книгою» (ряд зарезервований — висота карток фіксована). ── */
function WL22MobCard({ b }) {
  const rm = wl21ReasonMeta(b.reason);
  const hasDiscount = b.prevPrice != null && b.prevPrice > b.price;
  const disc = hasDiscount ? Math.round((1 - b.price / b.prevPrice) * 100) : 0;
  const openDetails = (e) => {
    if (e && e.target && e.target.closest && e.target.closest('a, button')) return;
    window.location.href = 'Book Details - Exploration.html';
  };
  return (
    <article className="wl22-mob" role="link" tabIndex={0} aria-label={'Деталі книги: ' + b.title}
      onClick={openDetails}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetails(e); } }}>
      <span className="wl22-chev" aria-hidden="true"><WL21Icon name="chevron-right" size={16} /></span>
      <div className="wl22-mob__badgerow">
        <span className="wl21-badge wl21-badge--green"><WL21Icon name={rm.icon} size={12} />{rm.label}</span>
      </div>
      <div className="wl22-mob__left">
        <div className="wl21-featm__book wl22-mob__book"><img src={WL21_COVER(b.id)} alt="" draggable={false} /></div>
      </div>
      <div className="wl22-mob__body">
        <div className="wl22-mob__head">
          <h3 className="wl22-mob__title">{b.title}</h3>
          <p className="wl22-mob__author">{b.author}</p>
        </div>
        <div className="wl22-mob__rule" aria-hidden="true"></div>
        <span className="wl21-featm__store wl22-mob__store">{b.store}</span>
        {hasDiscount ? (
          <div className="wl21-featm__priceline wl22-mob__priceline">
            <s className="wl21-featm__old">{wl21uah(b.prevPrice)}</s>
            <span className="wl21-featm__disc">−{disc}%</span>
          </div>
        ) : null}
        <WL21FeatBuyCta price={b.price} href="#" className="wl21-featm__buy wl22-mob__buy" />
      </div>
    </article>
  );
}

/* Мінімальні крапки пагінації — не конкурують із карткою */
function WL22Dots({ count, active }) {
  if (count < 2) return null;
  return (
    <div className="wl22-dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={'wl22-dot' + (i === active ? ' wl22-dot--on' : '')}></span>
      ))}
    </div>
  );
}

/* v2.2 mobile · Стрічкова карусель (track-based, у стилі App Store Today).
   Усі картки одразу існують у горизонтальному треку; анімується ЛИШЕ трек
   (translate3d) — картки ніколи не створюються, не зникають і не міняють
   позицій одна відносно одної. Свайп симетричний в обидва боки: однакові
   швидкість, easing, momentum і peek. Список СКІНЧЕННИЙ (без зациклення):
   перша картка притиснута до лівого краю контенту (без лівого peek),
   остання — до правого (без правого peek), середні визирають з обох боків.
   На межах — м'який iOS-подібний rubber-band і повернення. Пагінація
   оновлюється ПІСЛЯ завершення анімації. Тінь (glow) належить кожній
   картці й їде разом із нею. Драг можна почати будь-де; тап і свайп
   розводяться за рухом (5px), click після драгу гаситься. ←/→ з клавіатури.
   touch-action: pan-y — вертикальний скрол сторінки лишається природним. */
function WL22Rail({ items }) {
  const N = items.length;
  const viewRef = React.useRef(null);
  const trackRef = React.useRef(null);
  const [pagerIdx, setPagerIdx] = React.useState(0);

  React.useEffect(() => {
    const view = viewRef.current;
    const track = trackRef.current;
    if (!view || !track || N < 2) return undefined;

    const GAP = 12;   /* тримати синхронно з gap у .wl22-track (CSS) */
    const PEEK = 16;  /* видима смужка сусідньої картки (середина стрічки) */
    const EDGE = 20;  /* відступ крайніх карток = гутер .page (вирівняно із заголовком) */
    const DUR = 340;
    const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'; /* iOS-подібний ease-out */
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const cells = Array.from(track.children);
    const st = { index: 0, x: 0, cardW: 0, step: 0, Tmin: 0, Tmax: EDGE, w: 0, timer: 0 };

    /* Геометрія: картка = viewport − 2·(GAP+PEEK) → однаковий peek з обох
       боків для середніх карток; клампи Tmax/Tmin притискають крайні. */
    const measure = () => {
      const Vf = view.clientWidth;
      st.w = Vf;
      st.cardW = Math.max(180, Math.round(Vf - 2 * (GAP + PEEK)));
      st.step = st.cardW + GAP;
      cells.forEach((c) => { c.style.flexBasis = st.cardW + 'px'; });
      st.Tmax = EDGE;
      const trackW = N * st.cardW + (N - 1) * GAP;
      st.Tmin = Math.min(st.Tmax, Vf - EDGE - trackW);
    };
    const restT = (i) => {
      const center = (st.w - st.cardW) / 2; /* = GAP+PEEK: центрує картку */
      return Math.max(st.Tmin, Math.min(st.Tmax, center - i * st.step));
    };
    const apply = (x, animate) => {
      st.x = x;
      track.style.transition = (animate && !reduce) ? ('transform ' + DUR + 'ms ' + EASE) : 'none';
      track.style.transform = 'translate3d(' + x + 'px, 0, 0)';
    };
    const a11y = () => {
      cells.forEach((c, i) => {
        c.setAttribute('aria-hidden', i === st.index ? 'false' : 'true');
        const card = c.firstElementChild;
        if (card) card.tabIndex = i === st.index ? 0 : -1;
      });
    };
    /* Єдина точка зміни сторінки: рухає ТІЛЬКИ трек; пагінацію оновлює
       після завершення анімації (таймер = DUR), тож крапки не «біжать»
       попереду руху. Індекс клампиться — ніякого зациклення. */
    const commit = (i, animate) => {
      st.index = Math.max(0, Math.min(N - 1, i));
      apply(restT(st.index), animate);
      a11y();
      clearTimeout(st.timer);
      if (animate && !reduce) st.timer = setTimeout(() => setPagerIdx(st.index), DUR);
      else setPagerIdx(st.index);
    };

    measure();
    commit(0, false);

    const curX = () => {
      try { return new DOMMatrixReadOnly(getComputedStyle(track).transform).m41; }
      catch (_) { return st.x; }
    };

    /* Драг: трек 1:1 стежить за пальцем; за межами діапазону — rubber-band
       (0.35 опір). Тап і свайп розводяться за рухом (5px). Симетрично в
       обидва боки — одна й та сама математика для вліво/вправо. */
    let down = false, decided = false, ok = false, pid = null, sx = 0, sy = 0, startX = 0;
    let samples = [];
    const onDown = (e) => {
      down = true; decided = false; ok = false; pid = e.pointerId; sx = e.clientX; sy = e.clientY;
      samples = [{ t: e.timeStamp, x: e.clientX }];
    };
    const onMove = (e) => {
      if (!down) return;
      const dxRaw = e.clientX - sx, dyRaw = e.clientY - sy;
      if (!decided) {
        if (Math.abs(dxRaw) < 5 && Math.abs(dyRaw) < 5) return;
        decided = true; ok = Math.abs(dxRaw) > Math.abs(dyRaw);
        if (!ok) return;
        try { view.setPointerCapture(pid); } catch (_) {}
        startX = curX();          /* перехопити поточну (можливо, летючу) позицію */
        apply(startX, false);     /* заморозити — далі стежимо за пальцем без переходу */
        sx = e.clientX; sy = e.clientY;
        samples = [{ t: e.timeStamp, x: e.clientX }];
      }
      if (!ok) return;
      e.preventDefault();
      const dx = e.clientX - sx;
      samples.push({ t: e.timeStamp, x: e.clientX });
      while (samples.length > 1 && e.timeStamp - samples[0].t > 120) samples.shift();
      let raw = startX + dx;
      if (raw > st.Tmax) raw = st.Tmax + (raw - st.Tmax) * 0.35;
      else if (raw < st.Tmin) raw = st.Tmin + (raw - st.Tmin) * 0.35;
      apply(raw, false);
    };
    const squelch = (e) => { e.stopPropagation(); e.preventDefault(); };
    const onUp = (e) => {
      if (!down) return; down = false;
      if (!ok) return;
      /* після горизонтального драгу гасимо наступний click — картка тапабельна */
      view.addEventListener('click', squelch, true);
      setTimeout(() => view.removeEventListener('click', squelch, true), 60);
      const dx = e.clientX - sx;
      const s0 = samples[0] || { t: e.timeStamp, x: e.clientX };
      const dt = e.timeStamp - s0.t;
      const v = dt > 0 ? (e.clientX - s0.x) / dt : 0; /* px/ms; <0 = вліво = наступна */
      const flick = Math.abs(v) > 0.4 && Math.abs(dx) > 6;
      const passed = Math.abs(dx) > Math.min(80, st.step * 0.2);
      let dir = 0;
      if (flick) dir = v < 0 ? 1 : -1;
      else if (passed) dir = dx < 0 ? 1 : -1;
      commit(st.index + dir, true); /* dir=0 або край → плавне повернення (rubber-band) */
    };
    /* Клавіатура: ← попередня, → наступна; фокус — на новій активній картці */
    const onKey = (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      commit(st.index + (e.key === 'ArrowRight' ? 1 : -1), true);
      const card = cells[st.index] && cells[st.index].firstElementChild;
      if (card && view.contains(document.activeElement)) card.focus({ preventScroll: true });
    };

    view.addEventListener('pointerdown', onDown);
    view.addEventListener('pointermove', onMove, { passive: false });
    view.addEventListener('pointerup', onUp);
    view.addEventListener('pointercancel', onUp);
    view.addEventListener('keydown', onKey);

    let rt = 0;
    const onResize = () => {
      clearTimeout(rt);
      rt = setTimeout(() => { measure(); apply(restT(st.index), false); }, 120);
    };
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(st.timer); clearTimeout(rt);
      view.removeEventListener('pointerdown', onDown);
      view.removeEventListener('pointermove', onMove);
      view.removeEventListener('pointerup', onUp);
      view.removeEventListener('pointercancel', onUp);
      view.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [N, items.map((i) => i.id).join(',')]);

  if (N === 1) return <div className="wl22-solo"><WL22MobCard b={items[0]} /></div>;
  return (
    <div>
      <div className="wl22-railwrap" ref={viewRef}>
        <div className="wl22-track" ref={trackRef} role="group" aria-roledescription="карусель" aria-label="Книги зі знижками">
          {items.map((b) => (
            <div className="wl22-cell" key={b.id}><WL22MobCard b={b} /></div>
          ))}
        </div>
      </div>
      <WL22Dots count={N} active={pagerIdx} />
      <span className="wl22-sr" role="status">{'Книга ' + (pagerIdx + 1) + ' з ' + N + ': ' + items[pagerIdx].title}</span>
    </div>
  );
}

function WL21Discounts({ forceEmpty }) {
  const items = forceEmpty ? [] : WL21_SALE_EVAL;
  const PER = 4;
  const pages = [];
  for (let i = 0; i < items.length; i += PER) pages.push(items.slice(i, i + PER));
  const total = pages.length;

  const [isDesktop, setIsDesktop] = React.useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 769px)').matches
  );
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const on = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const [page, setPage] = React.useState(0);
  const cur = Math.min(page, total - 1);
  const hasPrev = cur > 0;
  const hasNext = cur < total - 1;

  /* translate у % ширини viewport: сторінка 88% + gap 3% (крок 91%).
     перша — впритул ліворуч; остання — впритул праворуч; проміжні —
     по центру, тож невеликий peek видно з обох боків. */
  function trackX(i) {
    if (total <= 1) return 0;
    const base = -(i * 91);
    if (i === 0) return base;
    if (i === total - 1) return base + 12;
    return base + 6;
  }

  const head = (
    <div className="sec-head">
      <div className="sec-head__left">
        <span className="sec-eyebrow">Ваші бажанки · момент настав</span>
        <h2 className="sec-title">Зараз вигідно купити</h2>
        <p className="sec-sub">Книги з ваших бажанок, які зараз можна придбати найвигідніше.</p>
      </div>
      {isDesktop && total > 1 ? (
        <div className="wl21-caro__nav">
          <button type="button" className="wl21-caro__arrow" aria-label="Попередні книги"
            disabled={!hasPrev} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <WL21Icon name="chevron-left" size={20} />
          </button>
          <button type="button" className="wl21-caro__arrow" aria-label="Наступні книги"
            disabled={!hasNext} onClick={() => setPage((p) => Math.min(total - 1, p + 1))}>
            <WL21Icon name="chevron-right" size={20} />
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="band band--green" data-screen-label="Зараз вигідно купити">
      <div className="page">
        {head}
        {items.length === 0 ? (
          <div className="wl21-saleempty reveal">
            <span className="wl21-saleempty__icon"><WL21Icon name="search" size={22} /></span>
            <p className="wl21-saleempty__title">Сьогодні вигідних пропозицій ще немає.</p>
            <p className="wl21-saleempty__sub">Книговик стежить за цінами і повідомить, щойно з'явиться щось цікаве.</p>
          </div>
        ) : isDesktop ? (
          <div className="wl21-caro reveal">
            <div className="wl21-caro__viewport">
              <div className="wl21-caro__track" style={{ transform: 'translateX(' + trackX(cur) + '%)' }}>
                {pages.map((chunk, ci) => (
                  <div className="wl21-caro__page" key={ci} aria-hidden={ci !== cur}>
                    {chunk.map((b) => <WL21SaleCard b={b} key={b.id} />)}
                  </div>
                ))}
              </div>
              <div className={'wl21-caro__fade wl21-caro__fade--left' + (hasPrev ? ' is-on' : '')}></div>
              <div className={'wl21-caro__fade wl21-caro__fade--right' + (hasNext ? ' is-on' : '')}></div>
            </div>
            {total > 1 ? (
              <div className="wl21-caro__progress">
                <div className="wl21-caro__bar"><span style={{ width: ((cur + 1) / total) * 100 + '%' }}></span></div>
                <span className="wl21-caro__count">{cur + 1} / {total}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="reveal"><WL22Rail items={items} /></div>
        )}
      </div>
    </div>
  );
}

/* ── 4 · Решта бажанок — жанровий фільтр + сортування + сітка ── */
/* Щільність compact-картки: паддінг картки / відступ під обкладинкою / відступ над ціною */
const WL21_REST_DENSITY = {
  'Щільна':    { pad: '8px',  gap: '8px',  foot: '6px'  },
  'Стандарт':  { pad: '10px', gap: '10px', foot: '8px'  },
  'Повітряна': { pad: '13px', gap: '13px', foot: '12px' },
};

function WL21Rest({ perPage, cardFs, cardDensity, cardCoverH }) {
  const [genre, setGenre] = React.useState('all');
  const [sort, setSort] = React.useState('added');
  const [page, setPage] = React.useState(1);
  const filtered = React.useMemo(
    () => (genre === 'all' ? WL21_REST : WL21_REST.filter((b) => b.genre === genre)),
    [genre]
  );
  const sorted = React.useMemo(() => [...filtered].sort(WL21_SORTS[sort].fn), [filtered, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / perPage));
  const safePage = Math.min(page, pages);
  const slice = sorted.slice((safePage - 1) * perPage, safePage * perPage);
  const genreOptions = [{ id: 'all', label: 'Усі жанри', count: WL21_REST.length }, ...WL21_GENRES];
  const sortOptions = Object.keys(WL21_SORTS).map((id) => ({ id, label: WL21_SORTS[id].label }));
  const dens = WL21_REST_DENSITY[cardDensity] || WL21_REST_DENSITY['Стандарт'];
  const gridVars = {
    '--bkc-fs-base': cardFs + 'px',
    '--bkc-pad-base': dens.pad,
    '--bkc-gap-base': dens.gap,
    '--bkc-foot-base': dens.foot,
    '--bkc-cover-ar': '100 / ' + cardCoverH,
  };
  return (
    <div className="sec" data-screen-label="Решта бажанок">
      <div className="page">
        <div className="sec-head">
          <div className="sec-head__left">
            <h2 className="sec-title">Решта бажанок</h2>
            <p className="sec-sub">Книговик стежить далі — щойно ціна впаде, книга підніметься нагору.</p>
          </div>
        </div>
        <div className="wl21-sortbar">
          <span className="wl21-count">
            {genre === 'all' ? WL21_REST.length + ' книг' : filtered.length + ' · ' + genre}
            {pages > 1 ? ' · сторінка ' + safePage + ' з ' + pages : ''}
          </span>
          <div className="wl21-controls">
            <WL21Dropdown icon="book-open" ariaLabel="Фільтр за жанром" value={genre}
              valueLabel={genre === 'all' ? 'Усі жанри' : genre}
              options={genreOptions}
              onChange={(g) => { setGenre(g); setPage(1); }} />
            <WL21Dropdown icon="arrow-up-down" ariaLabel="Сортування бажанок" value={sort}
              valueLabel={WL21_SORTS[sort].label}
              options={sortOptions}
              onChange={(s) => { setSort(s); setPage(1); }} />
          </div>
        </div>
        <div className="wl21-grid" style={gridVars}>
          {slice.map((b) => (
            <a className={'bkc' + (b.out ? ' bkc--out' : '')} key={b.id}
              href="Book Details - Exploration.html"
              aria-label={b.title + ' — ' + b.author + (b.price != null ? ', ' + wl21uah(b.price) : '')}>
              <span className="bkc__coverclip"><img className="bkc__cover" src={WL21_COVER(b.id)} alt="" loading="lazy" /></span>
              <span className="bkc__body">
                <span className="bkc__title">{b.title}</span>
                <span className="bkc__author">{b.author}</span>
                {b.price != null
                  ? <span className="bkc__price">{wl21uah(b.price)}</span>
                  : <span className="bkc__price bkc__price--none">—</span>}
              </span>
            </a>
          ))}
        </div>
        <WL21Pagination page={safePage} pages={pages} onPage={(p) => setPage(p)} />
      </div>
    </div>
  );
}

function WL21Footer({ theme }) {
  const logo = theme === 'dark' ? 'assets/logo/knyhovo-logo-dark-trans.png' : 'assets/logo/knyhovo-logo-light-trans.png';
  return (
    <footer className="wl-footer"><div className="page"><div className="wl-footer__in">
      <img className="wl-footer__logo" src={logo} alt="Knyhovo" />
      <nav className="wl-footer__links"><a href="#">Про нас</a><a href="#">Книгарні</a><a href="#">Контакти</a></nav>
      <span className="wl-footer__copy">© 2026 Knyhovo</span>
    </div></div></footer>
  );
}

/* ── Root ── */
const WL21_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "heroVariant": "A",
  "featStatus": "goal",
  "perPage": 10,
  "saleEmpty": false,
  "restFs": 16.5,
  "restDensity": "Стандарт",
  "restCoverH": 150
}/*EDITMODE-END*/;

function WL21App() {
  const [t, setTweak] = useTweaks(WL21_TWEAK_DEFAULTS);
  const [loggedIn, setLoggedIn] = window.KnHeader.useAuth();
  const [theme, setTheme] = React.useState(() => localStorage.getItem('kn-theme') || document.documentElement.getAttribute('data-theme') || 'light');
  React.useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  function onTheme(next) { setTheme(next); try { localStorage.setItem('kn-theme', next); } catch (e) {} }
  return (
    <React.Fragment>
      <window.KnHeader.Header theme={theme} onToggleTheme={onTheme}
        active="bazhanky" wishCount={WL21_TOTAL} />
      <main data-screen-label="Бажанки v2.2">
        <WL21Hero theme={theme} variant={t.heroVariant} />
        <WL21Featured status={t.featStatus} />
        <WL21Discounts forceEmpty={t.saleEmpty} />
        <WL21Rest perPage={t.perPage} cardFs={t.restFs} cardDensity={t.restDensity} cardCoverH={t.restCoverH} />
      </main>
      <WL21Footer theme={theme} />
      <TweaksPanel>
        <TweakSection label="Hero" />
        <TweakRadio label="Композиція" value={t.heroVariant}
          options={['A', 'B', 'C']}
          onChange={(v) => setTweak('heroVariant', v)} />
        <TweakSection label="Порада Книговика" />
        <TweakSelect label="Статус" value={t.featStatus}
          options={[
            { value: 'goal', label: 'Ціль досягнута' },
            { value: 'best', label: 'Найкраща ціна' },
            { value: 'drop', label: 'Ціна впала' },
            { value: 'deal', label: 'Велика знижка' },
            { value: 'low90', label: 'Мінімум за 90 днів' },
            { value: 'none', label: 'Без бейджа' },
          ]}
          onChange={(v) => setTweak('featStatus', v)} />
        <TweakSection label="Зараз вигідно купити" />
        <TweakToggle label="Показати порожній стан" value={t.saleEmpty}
          onChange={(v) => setTweak('saleEmpty', v)} />
        <TweakSection label="Решта бажанок — картка" />
        <TweakSlider label="Назва, px" value={t.restFs} min={15} max={19} step={0.5}
          onChange={(v) => setTweak('restFs', v)} />
        <TweakRadio label="Щільність" value={t.restDensity}
          options={['Щільна', 'Стандарт', 'Повітряна']}
          onChange={(v) => setTweak('restDensity', v)} />
        <TweakSlider label="Рамка обкладинки, %" value={t.restCoverH} min={130} max={160} step={5}
          onChange={(v) => setTweak('restCoverH', v)} />
        <TweakSection label="Списки" />
        <TweakSlider label="Книг на сторінці" value={t.perPage} min={5} max={20} step={5}
          onChange={(v) => setTweak('perPage', v)} />
        <TweakSection label="Акаунт" />
        <TweakToggle label="Користувач увійшов" value={loggedIn} onChange={setLoggedIn} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<WL21App />);
