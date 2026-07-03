// Knyhovo · Price Alerts (W4) — Alert Transition Matrix specification.
// A deterministic spec of how an alert evolves over time: the seven states,
// every transition (trigger · visual · animation · confirmation · persistence),
// the quiet confirmation patterns, and the animation + persistence rules.
// Documentation only. Reuses window.AL / ALData + DS v1.0 tokens. Theme comes
// from <html data-theme> via the DS ThemeToggle — no redesign of anything.
'use strict';

const ALTR_DS = window.KnyhovoDesignSystem_9fa616;
const AL = window.AL;
const ALTR_D = window.ALData;
const Icon = ALTR_D.Icon;

/* ── The seven lifecycle states ──────────────────────────────────────────── */
const ALTR_STATES = [
  { glyph: 'bookmark', name: 'unsaved', meta: 'Книга не у бажанках. Сповіщення недоступне.', code: 'target_price ∅' },
  { glyph: 'bell', name: 'saved', meta: 'У бажанках, сповіщення не налаштоване. Доступно «Сповістити про ціну».', code: 'target_price = NULL', chip: null },
  { glyph: 'bell-dot', name: 'saved + active', meta: 'Книговик стежить за ціною; ціль ще не досягнута.', code: 'target_price = поріг', chip: 'watch' },
  { glyph: 'bell-ring', name: 'saved + triggered', meta: 'Ціна впала до цілі — лист надіслано. Добра новина (зелений).', code: 'price ≤ target', chip: 'trig' },
  { glyph: 'bell-off', name: 'saved + paused', meta: 'Стеження тимчасово вимкнене користувачем. Ціль збережена.', code: 'paused = true', chip: 'paused' },
  { glyph: 'bell-off', name: 'saved + unavailable', meta: 'Книга out-of-stock / немає даних для стеження. Системний стан.', code: 'out-of-stock', chip: 'unavail' },
  { glyph: 'bell', name: 'saved + removed', meta: 'Сповіщення прибране → стан дорівнює saved. Книга лишається у бажанках.', code: 'target_price → NULL', chip: null },
];

function StateLegend() {
  return (
    <div className="altr-legend">
      {ALTR_STATES.map((s, i) => (
        <div className="altr-state" key={i}>
          <span className="altr-state__glyph"><Icon name={s.glyph} size={20} /></span>
          <span className="altr-state__body">
            <span className="altr-state__name">{s.name}<code>{s.code}</code></span>
            <span className="altr-state__meta">{s.meta}</span>
            {s.chip ? <span style={{ marginTop: 2 }}><AL.Chip state={s.chip} /></span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Compact state map ───────────────────────────────────────────────────── */
function MapNode({ icon, label, tone }) {
  return <span className={'altr-node' + (tone ? ' altr-node--' + tone : '')}><Icon name={icon} size={14} />{label}</span>;
}
function Arrow({ label, bi }) {
  return (
    <span className={'altr-arrow' + (bi ? ' altr-arrow--bi' : '')}>
      {label ? <span>{label}</span> : null}
      <Icon name="arrow-right" size={16} />
      {bi ? <Icon name="arrow-right" size={16} /> : null}
    </span>
  );
}
function StateMap() {
  return (
    <div className="altr-map">
      <div className="altr-rail">
        <MapNode icon="bookmark" label="unsaved" />
        <Arrow label="зберегти" />
        <MapNode icon="bell" label="saved" />
        <Arrow label="увімкнути" />
        <MapNode icon="bell-dot" label="active" tone="active" />
        <Arrow label="ціна ≤ цілі" bi />
        <MapNode icon="bell-ring" label="triggered" tone="good" />
      </div>
      <div className="altr-branches">
        <div className="altr-branch">
          <span className="altr-branch__head"><Icon name="bell-off" size={13} /> Пауза (зворотний)</span>
          <span className="altr-branch__pair"><MapNode icon="bell-dot" label="active" tone="active" /><Arrow bi /><MapNode icon="bell-off" label="paused" /></span>
        </div>
        <div className="altr-branch">
          <span className="altr-branch__head"><Icon name="bell-off" size={13} /> Недоступність (зворотний)</span>
          <span className="altr-branch__pair"><MapNode icon="bell-dot" label="active" tone="active" /><Arrow bi /><MapNode icon="bell-off" label="unavailable" /></span>
        </div>
        <div className="altr-branch">
          <span className="altr-branch__head"><Icon name="x" size={13} /> Видалення (повернення)</span>
          <span className="altr-branch__pair"><MapNode icon="bell-dot" label="active" tone="active" /><Arrow /><MapNode icon="bell" label="saved" /></span>
        </div>
      </div>
    </div>
  );
}

/* ── Transition matrix rows ──────────────────────────────────────────────── */
const C = (children) => <code>{children}</code>;
const ALTR_ROWS = [
  {
    from: 'unsaved', to: 'saved',
    trig: 'Тап «До вішлиста» (bookmark).',
    vis: <>bookmark → bookmark-check, кнопка «У вішлисті». З'являється тихий лінк «Сповістити про зниження ціни».</>,
    anim: 'Іконка змінюється миттєво; лінк fade-in 160ms ease-out.',
    conf: 'Без тосту — стан кнопки сам є підтвердженням.',
    pers: <>POST /wishlist; {C('target_price = NULL')}.</>,
  },
  {
    from: 'saved', to: 'active',
    trig: 'Намір обрано у листі/поповері → «Увімкнути сповіщення».',
    vis: <>bell → bell-dot (accent); чип «Стежимо за ціною» + лінія цілі «нижче 240 ₴»; у Book Details Badge «Стежимо за ціною».</>,
    anim: 'Лист закривається 260ms; bell glyph swap 140ms; чип crossfade-in 160ms.',
    conf: <>Тихий toast «Сповіщення увімкнено» — auto 4с, swipe-dismiss.</>,
    pers: <>PATCH {C('target_price')} = намір→копійки; {C('paused=false')}. Optimistic; rollback при помилці.</>,
  },
  {
    from: 'active', to: 'triggered', good: true,
    trig: 'Перевірка о 08:00 → new_price ≤ target_price (один раз).',
    vis: <>Зелений moment-row; bell-ring; чип «Ціль досягнута» + економія; авто-промоут у «Книги зі знижками». Book Details: зелений чип + green target line.</>,
    anim: 'Один прохід — підсвічування fade-to-green 280ms ease-out. Без infinite. Reduced-motion: одразу зелений.',
    conf: 'Головний канал — e-mail (Resend). У застосунку лише тихий чип, без тосту.',
    pers: <>Server-side dedupe — лист ОДИН раз. {C('target')} лишається; alert НЕ авто-вимикається.</>,
  },
  {
    from: 'triggered', to: 'active',
    trig: 'Ціна знову вище target (наступна перевірка) або користувач змінив поріг.',
    vis: <>Green moment-row → звичайний рядок; bell-ring → bell-dot; чип знову «Стежимо за ціною»; виходить із зеленої секції.</>,
    anim: 'Колір рядка повертається 200ms; чип crossfade 160ms.',
    conf: 'Без підтвердження — тихий технічний перехід.',
    pers: <>Прапор dedupe скидається → лист може надіслатись знову при наступному падінні. {C('target')} незмінний.</>,
  },
  {
    from: 'active', to: 'paused',
    trig: '«Призупинити сповіщення» у листі редагування.',
    vis: <>bell-dot → bell-off (muted); чип «Призупинено»; лінія «Поновіть, щоб стежити далі»; Book Details: muted чип + «Поновити».</>,
    anim: 'Glyph swap 140ms; чип crossfade 160ms.',
    conf: <>Тихий toast «Сповіщення призупинено» — auto 4с.</>,
    pers: <>{C('paused=true')}; {C('target_price')} ЗБЕРІГАЄТЬСЯ; перевірки ігнорують рядок.</>,
  },
  {
    from: 'paused', to: 'active',
    trig: '«Поновити сповіщення».',
    vis: <>bell-off → bell-dot; чип «Стежимо за ціною» + лінія цілі; зникає muted-тон.</>,
    anim: 'Glyph swap 140ms; чип crossfade 160ms.',
    conf: <>Тихий toast «Сповіщення поновлено».</>,
    pers: <>{C('paused=false')}; {C('target')} незмінний; стеження з наступної перевірки о 08:00.</>,
  },
  {
    from: 'active', to: 'unavailable',
    trig: 'Книга out-of-stock усюди / немає даних. Системна подія, не дія користувача.',
    vis: <>bell-off faint (disabled); чип «Сповіщення недоступні»; рядок opacity .66; контроль вимкнений; Book Details: «Сповістимо, щойно з'явиться».</>,
    anim: 'Без анімації — системний стан показується одразу при завантаженні.',
    conf: 'Без тосту; пояснювальний текст у рядку/панелі.',
    pers: <>{C('target_price')} ЗБЕРІГАЄТЬСЯ (неактивне); жодних листів, доки недоступне.</>,
  },
  {
    from: 'unavailable', to: 'active',
    trig: 'Книга знову in-stock (перевірка о 08:00).',
    vis: <>faint bell-off → bell-dot accent; чип знову «Стежимо за ціною»; opacity відновлюється.</>,
    anim: 'fade-in рядка 200ms при завантаженні.',
    conf: <>Без тосту. Якщо ціна вже ≤ target → одразу <b>triggered</b> + e-mail.</>,
    pers: <>{C('paused')} лишається яким був; {C('target')} застосовується знову.</>,
  },
  {
    from: 'active', to: 'removed',
    trig: '«Прибрати» у листі (підтвердження) або bell у рядку → прибрати.',
    vis: <>Чип та лінія цілі зникають; bell-dot/off → bell (outline); рядок лишається з «Сповістити про ціну». Рядок НЕ видаляється.</>,
    anim: 'Чип fade-out 160ms. Без зсуву макета.',
    conf: <>Тихий toast «Сповіщення прибрано» (neutral) з «Скасувати» (undo 5с).</>,
    pers: <>{C('target_price → NULL')}; {C('paused→false')}; книга лишається у wishlist.</>,
  },
  {
    from: 'removed', to: 'saved',
    trig: 'Автоматично — removed дорівнює saved без alert (не окремий стан).',
    vis: <>Рядок у стані saved; «Сповістити про ціну» доступне знову.</>,
    anim: 'Без анімації (вже застосовано при видаленні).',
    conf: <>«Скасувати» в тості видалення відновлює попередній active.</>,
    pers: <>Ідентично saved ({C('target_price = NULL')}).</>,
  },
];

function TransitionTable() {
  return (
    <div className="altr-tablewrap">
      <table className="altr-table">
        <colgroup>
          <col className="c-tr" /><col className="c-trig" /><col className="c-vis" /><col className="c-anim" /><col className="c-conf" /><col className="c-pers" />
        </colgroup>
        <thead>
          <tr><th>Перехід</th><th>Тригер</th><th>Візуальне рішення</th><th>Анімація</th><th>Підтвердження</th><th>Персистентність</th></tr>
        </thead>
        <tbody>
          {ALTR_ROWS.map((r, i) => (
            <tr key={i} className={r.good ? 'altr-row--good' : ''}>
              <td><span className="altr-pair">{r.from}<em>↓</em><b>{r.to}</b></span></td>
              <td>{r.trig}</td><td>{r.vis}</td><td>{r.anim}</td><td>{r.conf}</td><td>{r.pers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Confirmations ───────────────────────────────────────────────────────── */
function Confirmations() {
  return (
    <div className="altr-confgrid">
      <div className="altr-conf">
        <span className="altr-conf__cap"><span className="altr-conf__name">Сповіщення створено</span><span className="altr-conf__rule">Inline (desktop) — спокійний зелений check. Не святкове, без вигуку.</span></span>
        <div className="altr-conf__demo"><AL.Note kind="ok"><b>Сповіщення увімкнено.</b> Книговик напише, коли ціна стане нижче 240 ₴.</AL.Note></div>
      </div>
      <div className="altr-conf">
        <span className="altr-conf__cap"><span className="altr-conf__name">Сповіщення оновлено</span><span className="altr-conf__rule">Той самий тон; повідомляє новий поріг.</span></span>
        <div className="altr-conf__demo"><AL.Note kind="ok"><b>Сповіщення оновлено.</b> Тепер стежимо за ціною нижче 285 ₴.</AL.Note></div>
      </div>
      <div className="altr-conf">
        <span className="altr-conf__cap"><span className="altr-conf__name">Сповіщення призупинено</span><span className="altr-conf__rule">Mobile — плаваючий toast. Auto-dismiss ~4с, swipe закриває.</span></span>
        <div className="altr-conf__demo"><AL.Toast>Сповіщення призупинено</AL.Toast></div>
      </div>
      <div className="altr-conf">
        <span className="altr-conf__cap"><span className="altr-conf__name">Сповіщення поновлено</span><span className="altr-conf__rule">Toast того ж сімейства. Зелений тільки на іконці-check.</span></span>
        <div className="altr-conf__demo"><AL.Toast>Сповіщення поновлено</AL.Toast></div>
      </div>
      <div className="altr-conf">
        <span className="altr-conf__cap"><span className="altr-conf__name">Сповіщення прибрано</span><span className="altr-conf__rule">Нейтральний (не зелений) — це не «добра новина». Містить «Скасувати» (undo 5с).</span></span>
        <div className="altr-conf__demo"><AL.Note kind="quiet" action={<button className="al-link al-link--sm" type="button">Скасувати</button>}>Сповіщення прибрано. Книга залишається у бажанках.</AL.Note></div>
      </div>
      <div className="altr-conf">
        <span className="altr-conf__cap"><span className="altr-conf__name">Помилка — не підтвердження</span><span className="altr-conf__rule">Muted, локальна, відновлювана. Ніколи не червона, ніколи не блокує сторінку.</span></span>
        <div className="altr-conf__demo"><AL.Note kind="err" action={<AL.Retry label="Ще раз" />}>Не вдалося зберегти сповіщення.</AL.Note></div>
      </div>
    </div>
  );
}

/* ── Animation + persistence cards ───────────────────────────────────────── */
function SpecCards() {
  return (
    <div className="altr-cards">
      <div className="altr-card">
        <h3>Анімація — детерміновано</h3>
        <ul>
          <li><b>Лише токени.</b> Усі переходи через <code>--dur-fast</code> (~140ms) / <code>--dur-base</code> (~220ms) + <code>--ease-out</code>. Без bounce.</li>
          <li><b>Тривалості:</b> bell glyph swap 140ms · чип crossfade 160ms · колір/промоут рядка 200–280ms · підйом листа 260ms · scrim fade 220ms · toast: підйом 260ms, hold ~4с, fade-out 200ms.</li>
          <li><b>Triggered підсвічування — один прохід</b> (fade-to-green), ніколи не циклічне. Жодних infinite-анімацій ніде.</li>
          <li><b>Без layout-зсувів.</b> Alert живе у зарезервованих слотах (chip / bell); <code>min-height</code> рядка та сітка незмінні при будь-якому переході.</li>
          <li><b>prefers-reduced-motion:</b> усі переходи = миттєвий кінцевий стан; scrim, лист і toast без руху.</li>
        </ul>
      </div>
      <div className="altr-card">
        <h3>Персистентність — детерміновано</h3>
        <ul>
          <li><b>Джерело істини:</b> <code>wishlist_items.target_price</code> (копійки, nullable) + <code>paused</code> (bool — W4 додає). Стан деривується: <code>null</code>→saved · out-of-stock→unavailable · <code>current ≤ target</code>→triggered · <code>paused</code>→paused · інакше→active.</li>
          <li><b>Optimistic update:</b> UI змінюється одразу; помилка → rollback до попереднього стану + <code>AL.Note err</code> «Ще раз». Книга лишається у бажанках.</li>
          <li><b>E-mail dedupe:</b> лист один раз на падіння нижче target; прапор скидається, коли ціна знову піднялась (triggered→active).</li>
          <li><b>Пауза / недоступність зберігають</b> <code>target_price</code>; перевіряється о 08:00 лише active + in-stock.</li>
          <li><b>removed</b> = <code>target_price NULL</code>, книга лишається у wishlist; undo (5с) відновлює попередній target.</li>
          <li><b>Toast — ефемерний UI-стан</b>, не персистується. Позиція скролу та фокус зберігаються після дії.</li>
        </ul>
      </div>
    </div>
  );
}

/* ── The document ────────────────────────────────────────────────────────── */
function TransitionDoc() {
  const { ThemeToggle } = ALTR_DS;
  const [theme, setTheme] = React.useState(document.documentElement.getAttribute('data-theme') || 'light');
  const logo = '../../assets/logo/knyhovo-logo-' + (theme === 'dark' ? 'dark' : 'light') + '.png';
  return (
    <div className="altr-doc">
      <header className="altr-header">
        <span className="altr-header__brand">
          <img src={logo} alt="Knyhovo" />
          <b>Alert Transition Matrix</b>
          <span>· W4 Price Alerts · v1.0</span>
        </span>
        <ThemeToggle theme={theme} onChange={(t) => { document.documentElement.setAttribute('data-theme', t); setTheme(t); }} />
      </header>
      <div className="altr-wrap">
        <p className="altr-eyebrow">Price Alerts (W4) · Specification</p>
        <h1 className="altr-h1">Як сповіщення змінюється з часом</h1>
        <p className="altr-lead">Детермінована специфікація життєвого циклу одного цінового сповіщення: сім станів і кожен перехід між ними — тригер, візуальне рішення, анімація, підтвердження та правила персистентності. Жодне рішення не лишається на розсуд реалізації. Розширює заморожені Wishlist v1.0 / Book Details v1.2.1 / Price History v1.2.1 — без змін у їхніх макетах.</p>

        <div className="altr-group">
          <h2 className="altr-group__title">Сім станів</h2>
          <p className="altr-group__note">Кожен стан має чотири розрізнення: гліф дзвіночка (колір — лише третій сигнал), текстовий чип, тон і похідне значення <code>target_price</code>. Колірно-безпечно за побудовою.</p>
          <StateLegend />
        </div>

        <div className="altr-group">
          <h2 className="altr-group__title">Карта переходів</h2>
          <p className="altr-group__note">Щасливий шлях зліва направо; пауза та недоступність — зворотні; видалення повертає до saved. Стрілки ⇄ — двосторонні переходи.</p>
          <StateMap />
        </div>

        <div className="altr-group">
          <h2 className="altr-group__title">Матриця переходів</h2>
          <p className="altr-group__note">Кожен рядок повністю визначає один перехід. Зелений рядок — єдина «добра новина» (triggered); жоден перехід не використовує червоний.</p>
          <TransitionTable />
        </div>

        <div className="altr-group">
          <h2 className="altr-group__title">Підтвердження — тихі</h2>
          <p className="altr-group__note">Subtle, без святкування, без конфетті, ніколи не червоні. Зникають самі; «Скасувати» там, де це доречно. Inline (desktop) та toast (mobile) — одне сімейство.</p>
          <Confirmations />
        </div>

        <div className="altr-group">
          <h2 className="altr-group__title">Анімація та персистентність</h2>
          <SpecCards />
        </div>

        <div className="al-stamp" style={{ marginTop: 'var(--space-9)' }}>
          <b>W4 Alert Transition Matrix — Final Freeze ready.</b> Розширення замороженої системи. Поведінка детермінована; жодних невирішених UX-рішень. Жодних змін у Wishlist, Book Details, Price History чи десктопних макетах — лише документація переходів.
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('altr-root')).render(<TransitionDoc />);
