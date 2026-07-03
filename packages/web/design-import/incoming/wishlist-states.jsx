// Knyhovo Wishlist — page states + mascot exploration.
// EXPLORATION ONLY — not approved for implementation.
// States are demonstrated on the Variant C (Balanced) chassis; the same rules apply
// to A, B and D. Item-level states (price-drop, rise, partial data, unavailable)
// live INSIDE every variant's default list — see the variant artboards.

const WLS = window.WL;

/* ---------------- Loading (frozen skeleton spec: warm surfaces, one-shot stagger) ------- */
function WLSkRow() {
  return (
    <div className="wl-row" style={{ boxShadow: 'var(--shadow-sm)' }} aria-hidden="true">
      <WLS.Sk w={56} h={82} r="var(--radius-xs)" />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <WLS.Sk w="56%" h={15} />
        <WLS.Sk w="34%" h={11} />
        <WLS.Sk w="44%" h={10} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <WLS.Sk w={74} h={20} />
        <WLS.Sk w={52} h={10} />
      </span>
      <span style={{ display: 'flex', gap: 6 }}>
        <WLS.Sk w={36} h={36} r="var(--radius-sm)" />
        <WLS.Sk w={36} h={36} r="var(--radius-sm)" />
      </span>
    </div>
  );
}

function StateLoading({ theme }) {
  const stagger = WLS.useStagger();
  return (
    <WLS.Shell theme={theme} label="State · loading" searchSkeleton>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <WLS.Sk w={300} h={11} style={{ marginBottom: 14 }} />
        <WLS.Sk w={220} h={30} style={{ marginBottom: 12 }} />
        <WLS.Sk w={420} h={13} />
      </div>
      <div className="wlc-grid">
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-6)' }}>
            <WLS.Sk w={92} h={36} r="var(--radius-pill)" />
            <WLS.Sk w={118} h={36} r="var(--radius-pill)" />
            <WLS.Sk w={140} h={36} r="var(--radius-pill)" />
          </div>
          <div className={'wl-rows' + stagger} data-screen-label="Skeleton rows">
            <WLSkRow /><WLSkRow /><WLSkRow /><WLSkRow /><WLSkRow /><WLSkRow />
          </div>
        </div>
        <aside className="wlc-panel" aria-hidden="true">
          <WLS.Sk w={120} h={18} style={{ marginBottom: 18 }} />
          <div className="wlc-panelstats">
            <span><WLS.Sk w={44} h={24} style={{ marginBottom: 6 }} /><WLS.Sk w={88} h={9} /></span>
            <span><WLS.Sk w={44} h={24} style={{ marginBottom: 6 }} /><WLS.Sk w={96} h={9} /></span>
            <span><WLS.Sk w={44} h={24} style={{ marginBottom: 6 }} /><WLS.Sk w={84} h={9} /></span>
            <span><WLS.Sk w={56} h={24} style={{ marginBottom: 6 }} /><WLS.Sk w={108} h={9} /></span>
          </div>
          <WLS.Sk w="100%" h={130} r="var(--radius-md)" style={{ background: 'var(--accent-weak)' }} />
        </aside>
      </div>
    </WLS.Shell>
  );
}

/* ---------------- Empty state — reading-chair Knyhovyk hero composition ----------------- */
function StateEmpty({ theme }) {
  const { Button, Chip } = WLS.DS;
  return (
    <WLS.Shell theme={theme} label="State · empty">
      <div className="wl-empty" data-screen-label="Empty state">
        <WLS.Scene theme={theme} fade="all" />
        <h1 className="wl-empty__title">Яку книгу чекаєте? <em>Knyhovo постереже.</em></h1>
        <p className="wl-empty__text">
          Збережіть книгу — і ми щодня перевірятимемо її ціну у 5 книгарнях.
          Впаде ціна чи з’явиться наклад — ви дізнаєтесь першими.
        </p>
        <Button variant="primary" size="lg"><WLS.Icon name="search" size={17} /> Знайти книгу</Button>
        <div className="wl-chips" style={{ marginTop: 'var(--space-5)', justifyContent: 'center' }}>
          <Chip>Відьмак</Chip>
          <Chip>Атомні звички</Chip>
          <Chip>Кобзар</Chip>
          <Chip>Сапієнс</Chip>
        </div>
        <div className="wl-steps" data-screen-label="Як це працює">
          <div className="wl-step">
            <span className="wl-step__icon"><WLS.Icon name="bookmark" size={19} /></span>
            <p className="wl-step__title">Збережіть</p>
            <p className="wl-step__text">Кнопка «До вішлиста» є на сторінці кожної книги.</p>
          </div>
          <div className="wl-step">
            <span className="wl-step__icon"><WLS.Icon name="clock" size={19} /></span>
            <p className="wl-step__title">Ми стежимо</p>
            <p className="wl-step__text">Щодня о 08:00 звіряємо ціни у 5 книгарнях.</p>
          </div>
          <div className="wl-step">
            <span className="wl-step__icon"><WLS.Icon name="bell" size={19} /></span>
            <p className="wl-step__title">Сповістимо</p>
            <p className="wl-step__text">Лист, щойно ціна впаде або книга з’явиться.</p>
          </div>
        </div>
      </div>
    </WLS.Shell>
  );
}

/* ---------------- First-use: mascot right, large, gradient-blended ------------------ */
function StateFirstUse({ theme }) {
  const { Button } = WLS.DS;
  const first = {
    id: 'first', title: 'Відьмак. Останнє бажання', author: 'Анджей Сапковський',
    price: 320, prev: 320, store: 'Yakaboo', avail: 'in',
    tracking: true, alert: true, target: null, added: 'сьогодні',
  };
  return (
    <WLS.Shell theme={theme} label="State · first use">
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 460px', gap: 'var(--space-6)', alignItems: 'start' }}>
        {/* left: content */}
        <div>
          <div className="wl-head" style={{ marginBottom: 'var(--space-2)' }}>
            <div className="wl-head__main">
              <p className="wl-eyebrow">ВІШЛИСТ · ПЕРША КНИГА · СТЕЖЕННЯ УВІМКНЕНО</p>
              <h1 className="wl-h1">Гарний початок</h1>
            </div>
          </div>
          <div className="wl-hint" style={{ marginBottom: 'var(--space-5)' }} data-screen-label="First-use guidance">
            <WLS.Icon name="info" size={16} />
            <span>
              Готово — ми вже стежимо. Щодня о 08:00 перевірятимемо ціну «Відьмака» у 5 книгарнях
              і напишемо, щойно вона впаде. Хочете точніше? Встановіть цільову ціну.
            </span>
          </div>
          <div className="wl-rows" style={{ maxWidth: 760 }}>
            <WLS.Row item={first} checked />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)', alignItems: 'center' }}>
            <WLS.Target item={first} />
            <Button variant="ghost" size="sm">Додати ще книгу</Button>
          </div>
        </div>
        {/* right: large mascot, all-edge blend */}
        <WLS.Scene theme={theme} fade="all"
          style={{ height: 340, borderRadius: 0, border: 'none', background: 'transparent', boxShadow: 'none', marginTop: 'calc(-1 * var(--space-4))' }} />
      </div>
    </WLS.Shell>
  );
}

/* ---------------- No active alerts — quiet week, no mascot, simple banner -------------- */
function StateNoAlerts({ theme }) {
  const items = WLS.getItems('Тихий тиждень');
  return (
    <WLS.Shell theme={theme} label="State · no active alerts">
      <div className="wl-head" data-screen-label="Page head">
        <div className="wl-head__main">
          <p className="wl-eyebrow">ВІШЛИСТ · {items.length} КНИГ · ПЕРЕВІРЕНО СЬОГОДНІ О 08:00</p>
          <h1 className="wl-h1">Вішлист</h1>
        </div>
      </div>
      <div className="wl-hint" style={{ marginBottom: 'var(--space-6)', maxWidth: 760 }}
        data-screen-label="Quiet week banner">
        <WLS.Icon name="clock" size={16} />
        <span>Цього тижня без змін — ціни стабільні. Ми перевіряємо щодня о 08:00 і повідомимо першими.</span>
      </div>
      <div className="wl-rows" style={{ maxWidth: 880 }}>
        {items.slice(0, 4).map((i) => <WLS.Row key={i.id} item={i} />)}
      </div>
    </WLS.Shell>
  );
}

/* ---------------- Many items (50+) — groups, density, frozen pagination ----------------- */
function WLPager() {
  const { Button } = WLS.DS;
  // Frozen Search Results pagination algorithm: first + last + current ±1, ellipsis if gap > 1.
  return (
    <div className="wl-pager" data-screen-label="Pagination">
      <Button variant="secondary" size="sm">Назад</Button>
      <Button variant="ghost" size="sm">1</Button>
      <Button variant="primary" size="sm" aria-current="page">2</Button>
      <Button variant="ghost" size="sm">3</Button>
      <span style={{ color: 'var(--text-faint)', padding: '0 4px' }}>…</span>
      <Button variant="ghost" size="sm">6</Button>
      <Button variant="secondary" size="sm">Далі</Button>
    </div>
  );
}

function StateManyItems({ theme }) {
  const { Button, Chip } = WLS.DS;
  const items = WLS.getItems('Звичайний тиждень');
  return (
    <WLS.Shell theme={theme} label="State · 50+ books">
      <div className="wl-head">
        <div className="wl-head__main">
          <p className="wl-eyebrow">ВІШЛИСТ · 52 КНИГИ · ПЕРЕВІРЕНО СЬОГОДНІ О 08:00</p>
          <h1 className="wl-h1">Вішлист</h1>
        </div>
        <div className="wl-head__aside">
          <Button variant="secondary" size="sm"><WLS.Icon name="archive" size={15} /> Архів · 11</Button>
          <span className="wl-checked">обрати кілька — для масових дій</span>
        </div>
      </div>
      <div className="wl-toolbar">
        <div className="wl-chips">
          <Chip selected>Усі · 52</Chip>
          <Chip>Зі змінами · 7</Chip>
          <Chip>Зі сповіщеннями · 14</Chip>
          <Chip>Недоступні · 3</Chip>
        </div>
        <div className="wl-toolbar__right">
          <Button variant="ghost" size="sm">За зміною ціни <WLS.Icon name="chevron-down" size={14} /></Button>
          <Button variant="ghost" size="sm">Обрати</Button>
        </div>
      </div>
      <div className="wl-rows">
        {items.map((i) => <WLS.Row key={i.id} item={i} />)}
      </div>
      <WLPager />
      <p className="wl-checked" style={{ marginTop: 'var(--space-3)' }}>
        Сторінка 2 із 6 · 10 книг на сторінці · сортування скидає на першу сторінку (успадковане правило)
      </p>
    </WLS.Shell>
  );
}

/* ================== MASCOT EXPLORATION — reading-chair Knyhovyk ==================
   The character is a PROTECTED asset: the scenes below are illustration BRIEFS
   (placeholders + copy in context), never redrawn art. Reserved exclusively for
   Wishlist emotional moments: empty state, first use, no active alerts. */

function MascotIdentity({ theme }) {
  const { Badge } = WLS.DS;
  return (
    <div className="wl-doc" data-theme={theme} data-screen-label="Mascot identity reference">
      <div className="wl-doc__badge-row">
        <Badge tone="accent">Exploration only</Badge>
        <Badge tone="neutral">Брендовий актив — захищений</Badge>
      </div>
      <h2>Knyhovyk — що лишається незмінним</h2>
      <p className="wl-doc__sub">Затверджені рендери персонажа:</p>
      <div style={{ display: 'flex', gap: 'var(--space-4)', margin: 'var(--space-4) 0', flexWrap: 'wrap' }}>
        <figure style={{ margin: 0, textAlign: 'center' }}>
          <img className="wl-mascot-ref" src="assets/mascot/mascot-magnifier.png" alt="Knyhovyk із лупою (затверджено)" />
          <figcaption style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 6 }}>Лупа · Пошук</figcaption>
        </figure>
        <figure style={{ margin: 0, textAlign: 'center' }}>
          <img className="wl-mascot-ref" src="assets/mascot/mascot-lantern.png" alt="Knyhovyk із ліхтарем (затверджено)" />
          <figcaption style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 6 }}>Ліхтар · Темні порожні стани</figcaption>
        </figure>
        <figure style={{ margin: 0, textAlign: 'center' }}>
          <img className="wl-mascot-ref" src="assets/mascot/mascot-reading-chair-light-final.png" alt="Knyhovyk у кріслі, світла тема" />
          <figcaption style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 6 }}>Крісло · Вішлист (світла)</figcaption>
        </figure>
        <figure style={{ margin: 0, textAlign: 'center' }}>
          <img className="wl-mascot-ref" src="assets/mascot/mascot-reading-chair-dark-final.png" alt="Knyhovyk у кріслі при лампі, темна тема" />
          <figcaption style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)', marginTop: 6 }}>Крісло · Вішлист (темна)</figcaption>
        </figure>
      </div>
      <h3>Незмінне</h3>
      <ul>
        <li><span className="uc">·</span><span>Обличчя, пропорції, форма сторінок, шарф, стиль ілюстрації, тепла паперова текстура.</span></li>
        <li><span className="uc">·</span><span>Змінюються лише поза й мінімальні аксесуари — жодних костюмів.</span></li>
        <li><span className="uc">·</span><span>Сцена «у кріслі» затверджена в двох темах: світла (чашка з логотипом) і темна (лампа — прецедент сяйва ліхтаря).</span></li>
      </ul>
      <h3>Сцена для вішлиста</h3>
      <p>Knyhovyk сидить у м’якому читацькому кріслі, у маленьких круглих окулярах, читає відкриту книгу
        під пледом. Емоція: передчуття, тепло, довге товаришування, виважена покупка.</p>
      <h3>Де можна</h3>
      <ul>
        <li><span className="pro">+</span><span>Порожній стан вішлиста (герой) · перша книга (бокова сцена).</span></li>
      </ul>
      <h3>Де не можна</h3>
      <ul>
        <li><span className="con">−</span><span>Навігація, іконки, кожен елемент списку, будь-які сторінки поза вішлистом.</span></li>
      </ul>
    </div>
  );
}

/* Three alternative compositions of the same scene — same emotional intent. */
function MascotComposition({ theme, mode }) {
  const { Button } = WLS.DS;
  if (mode === 'hero') {
    return (
      <div className="wl-page" data-theme={theme} data-screen-label="Composition · hero"
        style={{ padding: 'var(--space-10) var(--space-8)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <WLS.Scene theme={theme} fade="all" style={{ width: 480, height: 320, marginBottom: 'var(--space-6)' }} />
        <h2 className="wl-empty__title">Яку книгу чекаєте? <em>Knyhovo постереже.</em></h2>
        <p className="wl-empty__text" style={{ marginBottom: 'var(--space-5)' }}>Центральна композиція: сцена — герой, текст і дія під нею.</p>
        <Button variant="primary" size="lg">Знайти книгу</Button>
        <p className="wl-checked" style={{ marginTop: 'var(--space-6)' }}>Використання: порожній стан вішлиста (230px заввишки на десктопі / 180px ≤900px — успадковане правило)</p>
      </div>
    );
  }
  if (mode === 'side') {
    return (
      <div className="wl-page" data-theme={theme} data-screen-label="Composition · side"
        style={{ padding: 'var(--space-10) var(--space-8)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '380px minmax(0,1fr)', gap: 'var(--space-8)', alignItems: 'center' }}>
          <WLS.Scene theme={theme} fade="left-bottom" style={{ height: 300 }} />
          <div>
            <p className="wl-eyebrow">ПЕРША КНИГА ЗБЕРЕЖЕНА</p>
            <h2 className="wl-empty__title" style={{ textAlign: 'left' }}>Тепер чекаємо разом.</h2>
            <p className="wl-empty__text" style={{ textAlign: 'left', margin: '0 0 var(--space-4)' }}>
              Бічна композиція: сцена ліворуч, пояснення і наступний крок праворуч.
              Knyhovyk «дивиться» в бік контенту — погляд веде до дії.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Button variant="primary" size="md">Встановити цільову ціну</Button>
              <Button variant="ghost" size="md">Пізніше</Button>
            </div>
          </div>
        </div>
        <p className="wl-checked" style={{ marginTop: 'var(--space-6)' }}>Використання: перший досвід (first-use) після збереження першої книги</p>
      </div>
    );
  }
  return (
    <div className="wl-page" data-theme={theme} data-screen-label="Composition · vignette"
      style={{ padding: 'var(--space-10) var(--space-8)' }}>
      <WLS.Scene variant="vignette" theme={theme}
        desc="Цього тижня без змін — ціни стабільні. Пильнуємо далі." />
      <p className="wl-checked" style={{ marginTop: 'var(--space-6)' }}>
        Використання: стан «без активних сповіщень» — тихий тиждень. Та сама сцена, компактний кадр (висота ~88px).
      </p>
    </div>
  );
}

window.WLStates = {
  StateLoading, StateEmpty, StateFirstUse, StateNoAlerts, StateManyItems,
  MascotIdentity, MascotComposition,
};
