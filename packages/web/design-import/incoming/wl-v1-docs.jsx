// Knyhovo Wishlist v1.0 — Documentation: panel spec, mascot board, annotations, approval.
// Depends on window.WL + window.V1.
'use strict';

const _DW = window.WL;
const _DDS = window.KnyhovoDesignSystem_9fa616;
const _DV = window.V1;

/* ── Annotation pill ──────────────────────────────────────────────────── */
function Ann({ children }) {
  return <span className="v1-ann">{children}</span>;
}
function Spec({ label, children }) {
  return (
    <div className="v1-spec-row">
      <span className="v1-spec-label">{label}</span>
      <span className="v1-spec-val">{children}</span>
    </div>
  );
}
function DocSection({ title, eyebrow, children, theme }) {
  return (
    <div className="v1-doc-section" data-theme={theme} data-screen-label={'Doc · ' + title}>
      {eyebrow && <p className="v1-eyebrow" style={{ marginBottom: 8 }}>{eyebrow}</p>}
      <h2 className="v1-doc-h2">{title}</h2>
      {children}
    </div>
  );
}

/* ── Panel specification ─────────────────────────────────────────────── */
function V1DocPanelSpec({ theme }) {
  return (
    <div className="v1-doc-page" data-theme={theme} data-screen-label="Doc · Panel spec">
      <div className="v1-doc-wrap">
        <p className="v1-eyebrow">СПЕЦИФІКАЦІЯ КОМПОНЕНТА</p>
        <h1 className="v1-h1">Панель моніторингу</h1>
        <p className="v1-doc-lead">
          Права колонка на desktop (460 px фіксована ширина). На mobile — collapsible-блок,
          вбудований у flow між шапкою і списком книг.
        </p>

        <div className="v1-doc-grid-2">
          {/* Live preview */}
          <div data-screen-label="Panel live preview">
            <_DV.Panel items={_DW.getItems('Хвиля знижок')} />
          </div>

          {/* Spec */}
          <div className="v1-spec-list">
            <h3 className="v1-doc-h3">Блок 1 · Лічильник заощаджень</h3>
            <Spec label="Мета">Зробити цінність видимою</Spec>
            <Spec label="Текст">Заощаджено з Knyhovo: 412 ₴</Spec>
            <Spec label="Стиль">Великий serif — accent color, субтитр muted</Spec>
            <Spec label="Оновлення">Після кожної успішної покупки через Knyhovo</Spec>

            <h3 className="v1-doc-h3" style={{ marginTop: 24 }}>Блок 2 · Сигнал перевірки</h3>
            <Spec label="Мета">Довіра — система жива</Spec>
            <Spec label="Текст">Остання перевірка: сьогодні о 08:00</Spec>
            <Spec label="Стиль">Muted, icon clock, font-size sm</Spec>
            <Spec label="Оновлення">Щодня о 08:00 автоматично</Spec>

            <h3 className="v1-doc-h3" style={{ marginTop: 24 }}>Блок 3 · Дайджест тижня</h3>
            <Spec label="Мета">Редакційний сигнал, не маркетинг</Spec>
            <Spec label="Текст">«Відьмак» впав до 240 ₴ — найнижча за 3 місяці</Spec>
            <Spec label="Стиль">Surface card, serif price, accent, посилання ghost</Spec>
            <Spec label="Умова">Показується, якщо є хоча б один drop; інакше — спокійний текст</Spec>

            <h3 className="v1-doc-h3" style={{ marginTop: 24 }}>Блок 4 · Статистика стеження</h3>
            <Spec label="Лічильники">Стежимо · Знижок · Цілей досягнуто</Spec>
            <Spec label="Стиль">Три колонки, serif числа, uppercase labels</Spec>
            <Spec label="Акцент">Знижки → accent; Цілі → green</Spec>

            <h3 className="v1-doc-h3" style={{ marginTop: 24 }}>Блок 5 · Сповіщення</h3>
            <Spec label="Текст">Email-сповіщення · щодня о 08:00</Spec>
            <Spec label="Кнопка">Ghost «Змінити» → налаштування профілю</Spec>
          </div>
        </div>

        <div className="v1-doc-anno" style={{ marginTop: 40 }}>
          <h3 className="v1-doc-h3">Responsive поведінка</h3>
          <div className="v1-doc-grid-2">
            <div>
              <p className="v1-doc-b">Desktop ≥1024px</p>
              <p>Фіксована правa колонка 460px. Sticky top при scroll. Dividers між блоками.</p>
            </div>
            <div>
              <p className="v1-doc-b">Tablet 768–1023px</p>
              <p>Права колонка 340px. Лічильник заощаджень залишається; дайджест collapse.</p>
            </div>
            <div>
              <p className="v1-doc-b">Mobile &lt;768px</p>
              <p>Collapsible-рядок між шапкою і списком. Accordion-expand натисканням. Показує лічильник, check-signal і digest (якщо є drop).</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mascot usage board ──────────────────────────────────────────────── */
function V1DocMascotBoard({ theme }) {
  const USES = [
    { key: 'empty',    label: 'Порожній стан',   copy: 'Яку книгу читаєте? Knyhovyk постереже.', ok: true },
    { key: 'first',    label: 'Перша книга',      copy: 'Чудовий початок. Knyhovyk вже вмостився.', ok: true },
    { key: 'noalerts', label: 'Без активних сповіщень', copy: '—', ok: false,
      note: 'Прибрано — замінено нейтральним hint-блоком. Не потребує маскота.' },
    { key: 'unavail',  label: 'Недоступна книга', copy: 'Ми продовжуємо стежити.', ok: true },
  ];
  const NOUSE = [
    'Завантаження (skeleton)',
    'Знижки цього тижня',
    '50+ книг',
    'Навігація та заголовок',
    'Кожна картка книги',
  ];
  const light = 'assets/mascot/mascot-reading-chair-light-final.png';
  const dark  = 'assets/mascot/mascot-reading-chair-dark-final.png';
  const MASK  = [
    'linear-gradient(to bottom, black 82%, transparent 100%)',
    'linear-gradient(to top,    black 86%, transparent 100%)',
    'linear-gradient(to right,  transparent 0%, black 8%)',
    'linear-gradient(to left,   transparent 0%, black 8%)',
  ].join(', ');

  return (
    <div className="v1-doc-page" data-theme={theme} data-screen-label="Doc · Mascot board">
      <div className="v1-doc-wrap">
        <p className="v1-eyebrow">МАСКОТ · ВИКОРИСТАННЯ</p>
        <h1 className="v1-h1">Knyhovyk у вішлисті</h1>
        <p className="v1-doc-lead">
          Затверджена нова поведінка: сцена «у кріслі» з'являється лише в емоційно значущих
          моментах. Жодних костюмів — лише контекст і аксесуар.
        </p>

        {/* Two themes side by side */}
        <div className="v1-doc-grid-2" style={{ marginBottom: 40, alignItems: 'start' }}>
          <figure className="v1-mascot-fig" data-theme="light">
            <div style={{
              overflow: 'hidden', borderRadius: 12,
              background: '#f9f3ed',
              WebkitMaskImage: MASK, maskImage: MASK,
              WebkitMaskComposite: 'source-in', maskComposite: 'intersect',
            }}>
              <img src={light} alt="Knyhovyk · světla" style={{ width: '100%', display: 'block' }} />
            </div>
            <figcaption>
              <p className="v1-doc-b">Світла тема · читацьке крісло</p>
              <p>Чашка з логотипом Knyhovo, парою. Тепле природне світло. Без додаткових предметів.</p>
            </figcaption>
          </figure>
          <figure className="v1-mascot-fig" data-theme="dark">
            <div style={{
              overflow: 'hidden', borderRadius: 12,
              background: '#1c1916',
              WebkitMaskImage: MASK, maskImage: MASK,
              WebkitMaskComposite: 'source-in', maskComposite: 'intersect',
            }}>
              <img src={dark} alt="Knyhovyk · dark" style={{ width: '100%', display: 'block' }} />
            </div>
            <figcaption>
              <p className="v1-doc-b">Темна тема · нічне читання</p>
              <p>Підлогова лампа, тепле заокруглене світло. Та сама поза, ті ж пропорції.</p>
            </figcaption>
          </figure>
        </div>

        {/* Usage table */}
        <h3 className="v1-doc-h3">Де з'являється</h3>
        <div className="v1-mascot-table">
          {USES.map((u) => (
            <div key={u.key} className={'v1-mascot-row' + (u.ok ? '' : ' v1-mascot-row--no')}>
              <span className={'v1-mascot-dot v1-mascot-dot--' + (u.ok ? 'yes' : 'no')}></span>
              <span className="v1-mascot-row-label">{u.label}</span>
              <span className="v1-mascot-row-copy">{u.ok ? '«' + u.copy + '»' : u.note}</span>
            </div>
          ))}
        </div>

        {/* Forbidden */}
        <h3 className="v1-doc-h3" style={{ marginTop: 32 }}>Де не з'являється</h3>
        <ul className="v1-doc-ul">
          {NOUSE.map((n) => <li key={n}>{n}</li>)}
        </ul>

        {/* Protected rules */}
        <h3 className="v1-doc-h3" style={{ marginTop: 32 }}>Незмінне</h3>
        <div className="v1-doc-grid-2">
          {[
            ['Обличчя та пропорції', 'Форма голови, очі, усмішка, шарф — ніяких змін.'],
            ['Матеріал і стиль', "Тепла паперова текстура, м\u2019який 3D-рендер."],
            ['Аксесуари мінімальні', 'Крісло, окуляри, книга. Жодних костюмів чи тематичних нарядів.'],
            ['Еволюція через поведінку', 'Лише поза та один контекстний предмет — не редизайн.'],
          ].map(([t, d]) => (
            <div key={t} className="v1-spec-row" style={{ flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
              <span className="v1-spec-label">{t}</span>
              <span className="v1-spec-val">{d}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Implementation annotations ─────────────────────────────────────── */
function V1DocAnnotations({ theme }) {
  return (
    <div className="v1-doc-page" data-theme={theme} data-screen-label="Doc · Annotations">
      <div className="v1-doc-wrap">
        <p className="v1-eyebrow">АНОТАЦІЇ РЕАЛІЗАЦІЇ</p>
        <h1 className="v1-h1">Специфікація компонентів</h1>

        <DocSection title="Ієрархія інформації" theme={theme}>
          <ol className="v1-doc-ol">
            <li><b>Книги користувача</b> — основний контент, займає ліву колонку (≥640px).</li>
            <li><b>Сигнали довіри</b> — savings pill + check-signal у шапці сторінки.</li>
            <li><b>Цінові можливості</b> — drop-banner та акцентовані рядки з CTA.</li>
            <li><b>Панель моніторингу</b> — права колонка, завжди присутня на desktop.</li>
          </ol>
        </DocSection>

        <DocSection title="Сітка та відступи" theme={theme}>
          <div className="v1-doc-grid-2">
            <div>
              <p className="v1-doc-b">Desktop grid</p>
              <Spec label="Контейнер">max-width 1320px, padding 0 var(--space-8)</Spec>
              <Spec label="Колонки">1fr · 460px (gap var(--space-8))</Spec>
              <Spec label="Шапка сторінки">padding-top var(--space-10) · padding-bottom var(--space-6)</Spec>
              <Spec label="Рядок книги">padding var(--space-4) var(--space-5), мін. висота 88px</Spec>
              <Spec label="Панель">padding var(--space-6), gap між блоками var(--space-5)</Spec>
            </div>
            <div>
              <p className="v1-doc-b">Mobile grid</p>
              <Spec label="Контейнер">padding 0 var(--space-5)</Spec>
              <Spec label="Рядок книги">padding var(--space-3) 0, border-bottom</Spec>
              <Spec label="Monitoring block">margin-bottom var(--space-4), padding var(--space-4)</Spec>
              <Spec label="Sticky CTA">position fixed, bottom 0, safe-area-inset-bottom</Spec>
            </div>
          </div>
        </DocSection>

        <DocSection title="Адаптивна поведінка" theme={theme}>
          <div className="v1-doc-grid-2">
            {[
              ['≥1024px', 'Desktop: двоколонкова сітка, повна панель моніторингу.'],
              ['768–1023px', 'Tablet: сітка зберігається, панель 340px, дайджест-блок collapse.'],
              ['<768px', 'Mobile: одна колонка, collapsible monitoring, sticky CTA, 44px touch targets.'],
            ].map(([bp, desc]) => (
              <div key={bp}>
                <p className="v1-doc-b">{bp}</p>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 13 }}>{desc}</p>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection title="Компонентна композиція" theme={theme}>
          <p>Всі UI-примітиви — з <code>window.KnyhovoDesignSystem_9fa616</code>:</p>
          <div className="v1-doc-grid-2">
            {[
              ['Button', 'primary sm (CTA у рядку, empty CTA); secondary sm (допоміжні дії); ghost sm (деструктивні + bulk)'],
              ['Badge', 'tone="green" — Найкраща ціна; tone="solid" — -N%; tone="neutral" — Не в наявності'],
              ['Chip', 'Фільтр-таби над списком; selected для активного; pill-shaped'],
              ['SearchBar', 'У шапці сторінки — повна ширина на mobile, 640px max на desktop'],
              ['ThemeToggle', 'Праворуч у header — перемикає data-theme на <html>'],
              ['BookCard', 'Не використовується у вішлисті — замінений V1Row для додаткових колонок'],
            ].map(([comp, desc]) => (
              <div key={comp}>
                <p className="v1-doc-b">{comp}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </DocSection>

        <DocSection title="Нові примітиви (exploratory)" theme={theme}>
          <div className="v1-doc-anno">
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Ці елементи не є частиною DS v1.0. Потребують окремого затвердження перед включенням до системи.
            </p>
            {[
              ['V1Row', 'Розширений рядок книги: обкладинка 48px, title+author+metadata, delta, price stack, CTA, action icons. DS-компоненти всередині.'],
              ['V1Panel', 'Панель моніторингу з 5 блоками. Composed від DS-токенів та іконографії.'],
              ['V1Mascot', 'Контекстне розміщення зображення маскота з CSS mask gradient-blend.'],
              ['Savings pill', 'Малий pill-badge із accent-weak background. Може стати Badge-варіантом у DS v1.1.'],
              ['Group header', 'Рядок-роздільник для групування 50+ книг. Icon + label + count.'],
            ].map(([name, desc]) => (
              <div key={name} className="v1-spec-row">
                <span className="v1-spec-label"><code>{name}</code></span>
                <span className="v1-spec-val">{desc}</span>
              </div>
            ))}
          </div>
        </DocSection>
      </div>
    </div>
  );
}

/* ── Approval page ───────────────────────────────────────────────────── */
function V1DocApproval({ theme }) {
  return (
    <div className="v1-doc-page v1-doc-page--approval" data-theme={theme} data-screen-label="Doc · Approval">
      <div className="v1-doc-wrap v1-doc-wrap--narrow">
        <p className="v1-eyebrow" style={{ letterSpacing: '0.12em' }}>
          KNYHOVO · ВІШЛИСТ v1.0 · РЕКОМЕНДОВАНИЙ НАПРЯМ
        </p>
        <h1 className="v1-h1 v1-h1--large">
          Вішлист — затверджений напрям
        </h1>
        <p className="v1-approval-tagline">
          «Мої книги, за якими Knyhovo стежить.»
        </p>

        <div className="v1-approval-why">
          <h3 className="v1-doc-h3">Чому саме цей напрям</h3>
          <div className="v1-doc-grid-2">
            {[
              ['Варіант C як основа', 'Чистий двоколонковий layout балансує список книг і панель моніторингу. Низьке когнітивне навантаження, довгострокова зручність.'],
              ['D-елементи для цінності', 'Лічильник заощаджень і дайджест тижня з Variant D роблять цінність Knyhovo видимою, не нав\'язливою.'],
              ['Маскот у правильних місцях', 'Крісло-сцена в емоційних моментах (порожній, перша книга, недоступна книга). Не скрізь — тільки там, де це підсилює досвід.'],
              ['Тон голосу', 'Спокійний, довірливий, книголюбний. «Перевірено сьогодні о 08:00» замість «Не пропустіть!».'],
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
            <li>Двоколонна сітка (1fr · 460px) на desktop — незмінна структура.</li>
            <li>Панель моніторингу завжди присутня у всіх станах, крім empty і first-book.</li>
            <li>Savings counter і last-check signal — обов'язкові елементи шапки.</li>
            <li>Маскот (крісло) — лише у 3 станах: empty, first-book, unavailable.</li>
            <li>Drop-banner з'являється лише при наявності реальних знижок — без фейкової термінової мови.</li>
            <li>Mobile monitoring — accordion, не окрема сторінка.</li>
            <li>Sticky CTA «Додати книгу» на mobile завжди видимий.</li>
            <li>Копірайтинг: спокійний, довірливий, без FOMO.</li>
          </ol>
        </div>

        <div className="v1-approval-stamp">
          <p className="v1-eyebrow">СТАТУС</p>
          <p className="v1-approval-status">Knyhovo Wishlist v1.0 — рекомендований напрям</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
            Підготовлено для передачі у розробку · Knyhovo Design System v1.0
          </p>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { V1DocPanelSpec, V1DocMascotBoard, V1DocAnnotations, V1DocApproval });
