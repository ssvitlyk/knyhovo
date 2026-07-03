// Knyhovo · Price Alerts (W4) — Mobile Alert Configuration flow.
// Shows the COMPLETE mobile journey in real Book Details context:
// Book Details → tap bell → bottom sheet → choose intent → quiet
// confirmation → updated Book Details. 375px frames, light + dark.
// Reuses the frozen Book Details mobile chassis (bdm-*) + window.AL / ALC /
// ALData. NOTHING here redesigns Book Details, Wishlist or the config sheet —
// it assembles the existing pieces into the finalized flow. No new visuals.
'use strict';

const ALM_DS = window.KnyhovoDesignSystem_9fa616;
const AL = window.AL;
const ALM_C = window.ALC;
const ALM_D = window.ALData;
const ALM_Icon = ALM_D.Icon;
const B = ALM_D.BOOK;

/* a deliberately long title to prove the breadcrumb single-line ellipsis */
const LONG_BOOK = { ...B, title: 'Гаррі Поттер і Орден Фенікса: ілюстроване видання' };
const ALM_SearchBar = ALM_DS.SearchBar;

/* Responsive search placeholder — desktop / 375 / 320 variants. The shortest
   that fits is shown; if even that overflows the placeholder may clip, but the
   user's typed query never does (the input keeps priority for width). */
const ALM_PH = {
  lg: 'Назва книги, автор або ISBN…',  // desktop
  md: 'Назва, автор або ISBN…',         // ~375px
  sm: 'Назва, автор…',                  // ~320px
};

/* Breadcrumbs: «Головна · Каталог · » is always preserved; only the book title
   truncates — single line, ellipsis, no wrap, no second row, no layout shift. */
function AlmCrumbs({ title }) {
  return (
    <p className="bdm-crumbs">
      <span className="bdm-crumbs__path"><a href="#">Головна</a> · <a href="#">Каталог</a> · </span>
      <span className="bdm-crumbs__title">{title}</span>
    </p>
  );
}

/* ── Backdrop: a real mobile Book Details screen (frozen bdm-* chassis) ───── */
function AlmBook({ theme = 'light', toggle = 'saved', book = B }) {
  const { SearchBar, ThemeToggle } = ALM_DS;
  const logo = '../../assets/logo/knyhovo-logo-' + (theme === 'dark' ? 'dark' : 'light') + '.png';
  return (
    <div className="bdm" data-theme={theme} data-screen-label="Book Details · mobile">
      <div className="bdm-wrap">
        <header className="bdm-header">
          <img className="site-logo" src={logo} alt="Knyhovo" />
          <div className="bdm-header__actions">
            <span style={{ pointerEvents: 'none' }}><ThemeToggle theme={theme} /></span>
            <button className="bdm-iconbtn" type="button" aria-label="Меню"><ALM_Icon name="menu" size={20} /></button>
          </div>
        </header>
        <div className="bdm-search">
          <SearchBar placeholder={ALM_PH.md} data-ph-lg={ALM_PH.lg} data-ph-md={ALM_PH.md} data-ph-sm={ALM_PH.sm} />
        </div>
        <AlmCrumbs title={book.title} />
        <div className="bdm-hero">
          <div className="alm-cover"><span>{book.title}</span></div>
          <h1 className="bd-h1">{book.title}</h1>
          <p className="bd-author">{book.author}</p>
        </div>
        <ALM_C.BDPanel mobile book={book}>
          <ALM_C.BDToggle state={toggle} size="md" book={book} />
        </ALM_C.BDPanel>
      </div>
    </div>
  );
}

/* ── 375px device frame: status bar + screen + (optional) docked sheet + toast ── */
function AlmPhone({ theme = 'light', toggle = 'saved', sheet, toast, label, book }) {
  return (
    <div className="alm-phone" data-theme={theme} data-screen-label={label}>
      <div className="alm-statusbar">
        <span>9:41</span>
        <span className="alm-statusbar__dots">
          <i></i><i></i><i></i>
          <span className="alm-statusbar__batt"></span>
        </span>
      </div>
      <div className="alm-screen"><AlmBook theme={theme} toggle={toggle} book={book} /></div>
      {sheet ? (
        <div className="alm-overlay">
          <div className="alm-scrim"></div>
          <div className="al-sheet">
            <span className="al-sheet__grab"></span>
            {sheet}
          </div>
        </div>
      ) : null}
      {toast ? <div className="alm-toast-wrap"><AL.Toast>{toast}</AL.Toast></div> : null}
    </div>
  );
}

/* lightweight remove-confirmation sheet body (one decision; not a full form) */
function AlmRemoveSheet() {
  const { Button } = ALM_DS;
  return (
    <div className="al-config" data-screen-label="Alert remove · confirm">
      <div className="al-config__head">
        <span className="al-config__title">Прибрати сповіщення?</span>
        <span className="al-config__sub">«{B.title}»</span>
      </div>
      <div className="al-paused-note">
        <ALM_Icon name="bell-off" size={18} />
        <span>Книговик перестане стежити за ціною. Книга залишиться у бажанках — сповіщення можна ввімкнути знову будь-коли.</span>
      </div>
      <div className="al-config__actions">
        <Button variant="ghost" size="sm">Скасувати</Button>
        <span className="al-grow"><Button variant="primary" size="sm"><ALM_Icon name="x" size={14} /> Прибрати</Button></span>
      </div>
    </div>
  );
}

/* error sheet body — note on top (why + retry), form stays editable below */
function AlmErrorSheet() {
  return (
    <React.Fragment>
      <AL.Note kind="err" action={<AL.Retry label="Ще раз" />}>Не вдалося зберегти сповіщення. Спробуйте ще раз — книга залишається у бажанках.</AL.Note>
      <AL.Config initialIntent="below" />
    </React.Fragment>
  );
}

/* ── Button consistency audit: Before → After + DS rules (W4 final polish) ── */
function AuditCases({ mode }) {
  const { Button } = ALM_DS;
  const removeVariant = mode === 'after' ? 'primary' : 'secondary';
  return (
    <React.Fragment>
      <div className="almcmp__case">
        <span className="almcmp__case-name">Створення — [ Скасувати ] [ Увімкнути сповіщення ]</span>
        <div className="al-config__actions">
          <Button variant="ghost" size="sm">Скасувати</Button>
          <span className="al-grow"><Button variant="primary" size="sm"><ALM_Icon name="bell" size={14} /> Увімкнути сповіщення</Button></span>
        </div>
      </div>
      <div className="almcmp__case">
        <span className="almcmp__case-name">Підтвердження видалення — [ Скасувати ] [ Прибрати ]</span>
        <div className="al-config__actions">
          <Button variant="ghost" size="sm">Скасувати</Button>
          <span className="al-grow"><Button variant={removeVariant} size="sm"><ALM_Icon name="x" size={14} /> Прибрати</Button></span>
        </div>
      </div>
      <div className="almcmp__case">
        <span className="almcmp__case-name">Помилка → відновлення — «Ще раз»</span>
        <div className="almcmp__errrow">
          <span className="almcmp__errtext">Не вдалося зберегти сповіщення.</span>
          <span className="almcmp-retry"><Button variant="secondary" size="sm">Ще раз</Button></span>
        </div>
      </div>
    </React.Fragment>
  );
}

function ButtonAuditCard({ theme = 'light' }) {
  return (
    <div className="almcmp" data-theme={theme} data-screen-label={'Button audit · ' + theme}>
      <div className="almcmp__wrap">
        <p className="alm-eyebrow">W4 Mobile · Button consistency</p>
        <h1 className="alm-doc-h1">До → Після</h1>
        <p className="alm-doc-lead">Усі дії в нижніх листах тепер читаються як одна система: однакова висота 44px, вторинна (контурна) кнопка ніколи не вузька (min-width 120px), первинна — заповнює решту рядка, пара завжди [ контурна ] [ залита ].</p>
        <div className="almcmp__grid">
          <div className="almcmp__col almcmp-before">
            <span className="almcmp__tag"><ALM_Icon name="x" size={14} /> До — неузгоджено</span>
            <AuditCases mode="before" />
          </div>
          <div className="almcmp__col almcmp__col--after almcmp-after">
            <span className="almcmp__tag almcmp__tag--after"><ALM_Icon name="check" size={14} /> Після — одна система</span>
            <AuditCases mode="after" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ButtonRulesCard() {
  return (
    <div className="almrules" data-theme="light" data-screen-label="Button rules · DS docs">
      <div className="almrules__wrap">
        <p className="alm-eyebrow">Design System · Mobile alert buttons</p>
        <h1 className="alm-doc-h1">Правила кнопок</h1>
        <p className="alm-doc-lead">Канонічні правила для всіх дій у мобільних листах W4 — придатні для документації дизайн-системи.</p>
        <div className="almrules__grid">
          <div className="almrules__card">
            <span className="almrules__k">Висота <span className="almrules__chip">44px</span></span>
            <p>Кожна активна кнопка в листі — рівно <b>44px</b> (мінімальна ціль дотику). Без винятків — однаково для контурних, залитих і кнопки відновлення.</p>
          </div>
          <div className="almrules__card">
            <span className="almrules__k">Вторинна <span className="almrules__chip">min-width 120px</span></span>
            <p>Контурні дії з короткими підписами (<code>Прибрати</code>, <code>Зберегти</code>, <code>Ще раз</code>) — <b>min-width 120px</b>, ширина зростає за вмістом. Ніколи не вузький «чіп».</p>
          </div>
          <div className="almrules__card">
            <span className="almrules__k">Первинна</span>
            <p>CTA за вмістом (<code>Увімкнути сповіщення</code>, <code>Поновити</code>) — заповнює решту рядка через <code>al-grow flex:1</code>, але <b>не на всю ширину</b> сама по собі.</p>
          </div>
          <div className="almrules__card">
            <span className="almrules__k">Пара кнопок</span>
            <p>Рядок із двох дій: <b>[ Контурна ] [ Залита ]</b> — рівна висота, збалансовані ширини, спільні базові лінії, єдиний вертикальний ритм.</p>
          </div>
          <div className="almrules__card almrules__card--full">
            <span className="almrules__k">Підтвердження видалення — один патерн</span>
            <p>Option B всюди: <b>ліворуч — контурна «Скасувати»</b> (escape, ніколи не текстове посилання), <b>праворуч — залита кнопка-дія «Прибрати»</b> (commit). Текстові та контурні дії ніколи не змішуються між листами. Зелений — лише для спрацьованого сповіщення; червоний не використовується.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* one captioned phone artboard for the linear flow */
function Ph({ n, name, theme, toggle, sheet, toast, label, w = 375, h = 812 }) {
  return (
    <DCArtboard key={label} id={label} label={(n ? n + ' · ' : '') + name} width={w} height={h}>
      <AlmPhone theme={theme} toggle={toggle} sheet={sheet} toast={toast} label={label} />
    </DCArtboard>
  );
}

/* the seven-step journey, as a Fragment of DCArtboards (DesignCanvas flattens
   Fragments but NOT custom components, so these must be DCArtboard-typed). */
function flowRow(t) {
  return [
    Ph({ key: '1' + t, n: '1', name: 'Збережено → увімкнути', theme: t, toggle: 'saved', label: '1-saved-' + t }),
    Ph({ key: '2' + t, n: '2', name: 'Налаштувати сповіщення', theme: t, toggle: 'saved', sheet: <AL.Config initialIntent="below" />, label: '2-config-' + t }),
    Ph({ key: '3' + t, n: '3', name: 'Сповіщення створено', theme: t, toggle: 'alert', toast: 'Сповіщення увімкнено', label: '3-created-' + t }),
    Ph({ key: '4' + t, n: '4', name: 'Редагувати · керувати', theme: t, toggle: 'alert', sheet: <AL.Config initialIntent="below" editing manage />, label: '4-edit-' + t }),
    Ph({ key: '5' + t, n: '5', name: 'Призупинено', theme: t, toggle: 'paused', toast: 'Сповіщення призупинено', label: '5-paused-' + t }),
    Ph({ key: '6' + t, n: '6', name: 'Прибрано', theme: t, toggle: 'saved', toast: 'Сповіщення прибрано', label: '6-removed-' + t }),
    Ph({ key: '7' + t, n: '7', name: 'Помилка збереження', theme: t, toggle: 'saved', sheet: <AlmErrorSheet />, label: '7-error-' + t, h: 860 }),
  ];
}

function AlmFlowCanvas() {
  return (
    <DesignCanvas>
      <DCSection id="flow-light" title="Основний потік · Світла тема"
        subtitle="Повний мобільний шлях у реальному контексті Book Details: Книга у бажанках → тап на дзвіночок → нижній лист (bottom sheet) із трьома намірами → тихе підтвердження → оновлений стан Book Details. Максимум два рівні взаємодії, досяжно однією рукою на 375px, без повноекранного перекриття. Лист ніколи не ховає обкладинку, назву та ціну — а його заголовок дублює «зараз 240 ₴ у Yakaboo», тож контекст збережено навіть під листом.">
        {flowRow('light')}
      </DCSection>

      <DCSection id="flow-dark" title="Основний потік · Темна тема"
        subtitle="Ті самі сім кроків у темній темі. Мідь ↔ світло-помаранчевий, тепле чорнило — усе перемикається через токени. Дотик 44px збережено.">
        {flowRow('dark')}
      </DCSection>

      <DCSection id="specs" title="375px специфікації — додаткові стани листа"
        subtitle="Фінальні специмени станів, що не входять у лінійний потік: «Вигідна ціна», degraded без історії цін, призупинене (поновлення), спрацьоване (triggered) та власна ціна. По одному для кожної теми, де це доречно.">
        <DCArtboard id="spec-good-light" label="Намір «Вигідна ціна»" width={375} height={812}>
          <AlmPhone theme="light" toggle="saved" sheet={<AL.Config initialIntent="good" />} label="spec-good-light" />
        </DCArtboard>
        <DCArtboard id="spec-nohist-light" label="Degraded — без історії цін" width={375} height={812}>
          <AlmPhone theme="light" toggle="saved" sheet={<AL.Config initialIntent="below" noHistory />} label="spec-nohist-light" />
        </DCArtboard>
        <DCArtboard id="spec-custom-dark" label="Власна ціна (розкрито)" width={375} height={860}>
          <AlmPhone theme="dark" toggle="saved" sheet={<AL.Config initialIntent="below" openCustom />} label="spec-custom-dark" />
        </DCArtboard>
        <DCArtboard id="spec-resume-light" label="Призупинено · поновити" width={375} height={760}>
          <AlmPhone theme="light" toggle="paused" sheet={<AL.Config initialIntent="below" editing paused />} label="spec-resume-light" />
        </DCArtboard>
        <DCArtboard id="spec-resume-dark" label="Призупинено · поновити · темна" width={375} height={760}>
          <AlmPhone theme="dark" toggle="paused" sheet={<AL.Config initialIntent="below" editing paused />} label="spec-resume-dark" />
        </DCArtboard>
        <DCArtboard id="spec-remove-light" label="Прибрати · підтвердження" width={375} height={720}>
          <AlmPhone theme="light" toggle="alert" sheet={<AlmRemoveSheet />} label="spec-remove-light" />
        </DCArtboard>
        <DCArtboard id="spec-trig-light" label="Спрацювало · ціль досягнута" width={375} height={812}>
          <AlmPhone theme="light" toggle="trig" toast="Ціна досягла цілі — 228 ₴" label="spec-trig-light" />
        </DCArtboard>
        <DCArtboard id="spec-trig-dark" label="Спрацювало · темна" width={375} height={812}>
          <AlmPhone theme="dark" toggle="trig" toast="Ціна досягла цілі — 228 ₴" label="spec-trig-dark" />
        </DCArtboard>
      </DCSection>

      <DCSection id="responsive" title="Адаптивний пошук та хлібні крихти (W4 polish)"
        subtitle="Пошукова кнопка — CTA за вмістом (авто-ширина + горизонтальні відступи), а не фіксований широкий блок: поле вводу завжди отримує більшу частину рядка, а введений запит лишається повністю видимим. Placeholder адаптивний — desktop «Назва книги, автор або ISBN…» → 375px «Назва, автор або ISBN…» → 320px «Назва, автор…»; за потреби placeholder може обрізатися, текст користувача — ніколи. Хлібні крихти завжди зберігають «Головна · Каталог · », а назва книги скорочується в один рядок (ellipsis), без переносу та зсувів.">
        <DCArtboard id="resp-375" label="375px — placeholder «…або ISBN» + довга назва" width={375} height={560}>
          <AlmPhone theme="light" toggle="saved" book={LONG_BOOK} label="resp-375" />
        </DCArtboard>
        <DCArtboard id="resp-320" label="320px — короткий placeholder + та ж назва" width={320} height={560}>
          <AlmPhone theme="light" toggle="saved" book={LONG_BOOK} label="resp-320" />
        </DCArtboard>
        <DCArtboard id="resp-320-dark" label="320px · темна" width={320} height={560}>
          <AlmPhone theme="dark" toggle="saved" book={LONG_BOOK} label="resp-320-dark" />
        </DCArtboard>
        <DCArtboard id="resp-desktop" label="Desktop — повний placeholder, кнопка за вмістом" width={680} height={300}>
          <div className="alm-deskspec" data-theme="light" data-screen-label="Desktop search · adaptive">
            <div className="alm-deskspec__wrap">
              <p className="alm-eyebrow">Desktop · ≥ 460px</p>
              <ALM_SearchBar placeholder={ALM_PH.lg} data-ph-lg={ALM_PH.lg} data-ph-md={ALM_PH.md} data-ph-sm={ALM_PH.sm} />
              <p className="alm-spec-cap">Кнопка «Знайти» — за вмістом; поле вводу займає решту рядка.</p>
              <p className="alm-spec-crumbs">
                <span className="bdm-crumbs__path">Головна · Каталог · </span>
                <span className="bdm-crumbs__title">{LONG_BOOK.title}</span>
              </p>
            </div>
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection id="button-audit" title="Аудит кнопок — узгодженість (W4 final polish)"
        subtitle="Polish-прохід лише для кнопок у мобільних листах: висота 44px для всіх дій, вторинна (контурна) ніколи не вузька (min-width 120px), первинна — за вмістом і заповнює решту рядка, пара завжди [ контурна ] [ залита ]. Один патерн для підтвердження видалення (Option B). IA, копія, потік, стани, токени та кольори не змінюються.">
        <DCArtboard id="audit-light" label="До → Після · світла" width={900} height={560}>
          <ButtonAuditCard theme="light" />
        </DCArtboard>
        <DCArtboard id="audit-dark" label="До → Після · темна" width={900} height={560}>
          <ButtonAuditCard theme="dark" />
        </DCArtboard>
        <DCArtboard id="button-rules" label="Правила кнопок · DS docs" width={900} height={620}>
          <ButtonRulesCard />
        </DCArtboard>
      </DCSection>

      <DCSection id="notes" title="Нотатки для Claude Code (handoff)"
        subtitle="Детермінована поведінка мобільного потоку — без невирішених UX-рішень.">
        <DCArtboard id="handoff" label="Implementation notes" width={920} height={760}>
          <div className="alm-doc" data-theme="light">
            <div className="alm-doc-wrap">
              <p className="alm-eyebrow">Price Alerts (W4) · Mobile</p>
              <h1 className="alm-doc-h1">Mobile Alert Configuration — фіналізовано</h1>
              <p className="alm-doc-lead">Конфігурація сповіщень на мобільному = нижній лист (bottom sheet) поверх Book Details. Не модальне вікно, не нова навігація, не повноекранне перекриття. Один вхід (дзвіночок / «Сповістити про зниження ціни»), один лист, тихе підтвердження.</p>
              <div className="alm-notes">
                <h3>Правила</h3>
                <ul>
                  <li><b>Глибина ≤ 2 рівні.</b> Book Details (рівень 1) → нижній лист (рівень 2). Прибрати/призупинити живуть усередині листа редагування — без третього рівня.</li>
                  <li><b>Одна рука, 375px.</b> Усі дії листа в нижніх ~430px; кнопки на всю ширину, дотик ≥44px (<code>.al-sheet .kn-btn min-height:44px</code>, <code>.al-opt min-height:56px</code>).</li>
                  <li><b>Контекст збережено.</b> Лист закриває нижню частину екрана; обкладинка, назва та найкраща ціна лишаються видимими. Підзаголовок листа дублює ціну/книгарню.</li>
                  <li><b>Намір, а не число.</b> Три наміри (<code>any</code> · <code>below</code> · <code>good</code>) → <code>wishlist_items.target_price</code> (копійки). «Вказати свою ціну» — тихий другорядний шлях. «Вигідна ціна» вимикається, коли Price History ще без <code>typicalRange</code>.</li>
                  <li><b>Підтвердження тихі.</b> Плаваючий <code>AL.Toast</code> над safe-area; зникає сам (~4с), допускає свайп-закриття. Без святкування, без конфетті, ніколи не червоне.</li>
                  <li><b>Помилка локальна.</b> <code>AL.Note kind="err"</code> зверху листа + «Ще раз»; форма лишається активною, книга у бажанках, Book Details не блокується.</li>
                  <li><b>Стан Book Details після дії:</b> створено → <code>BDToggle state="alert"</code>; призупинено → <code>"paused"</code>; прибрано → <code>"saved"</code>; спрацювало → <code>"trig"</code>. Деривація стану з API — див. кореневий CLAUDE.md.</li>
                  <li><b>Reduced-motion.</b> Підйом листа та поява scrim/toast вимикаються через <code>prefers-reduced-motion</code> — кінцевий стан показується одразу.</li>
                  <li><b>Адаптивний пошук.</b> Кнопка «Знайти» — CTA за вмістом (<code>flex:0 0 auto; width:auto</code> + горизонтальні відступи), не фіксований широкий блок; <code>input</code> отримує решту рядка (<code>flex:1; min-width:0</code>), тож введений запит завжди видимий. Шрифт поля на мобільному — фіксовані 16px (<code>--fs-body</code>), а не <code>--fs-lead</code> (clamp із +0.4vw, що роздувається до ~19.7px): md-варіант вміщається без обрізання, 16px також уникає zoom-on-focus на iOS. Placeholder свопиться за шириною поля: ≥460px → «Назва книги, автор або ISBN…», ≥312px → «Назва, автор або ISBN…», інакше → «Назва, автор…» (<code>data-ph-*</code> + <code>ResizeObserver</code>; реальна реалізація — ті самі пороги через <code>@media</code>: desktop → lg, ≥375px → md, 320–374px → sm). За потреби placeholder обрізається; текст користувача — ніколи; горизонтального скролу немає.</li>
                  <li><b>Хлібні крихти.</b> «Головна · Каталог · » зберігаються завжди (<code>.bdm-crumbs__path flex:0 0 auto</code>); назва книги — окремий <code>.bdm-crumbs__title</code> (<code>min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap</code>) скорочується в один рядок. Без переносу, без другого рядка, без зсувів макета.</li>
                  <li><b>Дихання обкладинки ↔ назви.</b> Ієрархія обкладинка → назва → автор відновлена відступами (без змін макету чи типографіки). Під обкладинкою: <b>≥375px → 20px</b> (<code>--space-5</code>), <b>320–374px → 16px</b> (<code>--space-4</code>) — через container-query на рамці (реальна реалізація: <code>@media (max-width:374px)</code>). Крихти → обкладинка = 20px; назва → автор = 4px (<code>--space-1</code>, щільно); блок → панель = 24px. Світла/темна ідентичні (токени не залежать від теми); додаткового скролу не вводиться.</li>
                </ul>
              </div>
              <div className="alm-stamp"><b>W4 Mobile Alert Configuration — Final Freeze ready.</b> Розширення замороженої системи; жодних змін у Book Details, Wishlist, Price History чи десктопній конфігурації.</div>
            </div>
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('almf-root')).render(<AlmFlowCanvas />);

/* ── Responsive search placeholder (width-aware, container-query style) ──────
   The SearchBar carries data-ph-lg / -md / -sm; we pick the variant that suits
   the field's own width (offsetWidth — unaffected by canvas zoom transforms),
   so each artboard (desktop / 375 / 320) shows the right text. A ResizeObserver
   keeps it correct if the field ever resizes. Idempotent per field. */
function almSyncPlaceholder(field) {
  const input = field.querySelector('input');
  if (!input) return;
  const d = field.dataset;
  if (!d.phMd) return;
  const w = field.offsetWidth;
  let ph = d.phMd;
  if (w >= 460 && d.phLg) ph = d.phLg;
  else if (w < 312 && d.phSm) ph = d.phSm;
  if (input.placeholder !== ph) {
    input.placeholder = ph;
    input.setAttribute('aria-label', ph);
  }
}
function almInitPlaceholders() {
  document.querySelectorAll('.kn-field[data-ph-md]').forEach((field) => {
    almSyncPlaceholder(field);
    if (field.__almPhObserved) return;
    field.__almPhObserved = true;
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => almSyncPlaceholder(field)).observe(field);
    }
  });
}
// React mounts after this script runs — poll a few frames until the fields exist.
[0, 120, 320, 700].forEach((t) => setTimeout(almInitPlaceholders, t));
requestAnimationFrame(() => requestAnimationFrame(almInitPlaceholders));
