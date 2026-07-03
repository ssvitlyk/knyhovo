// Knyhovo · W6 — Offer States Matrix (documentation deliverable).
// Signals reference · 10-state matrix with live panels · component guidance ·
// copy rules · accessibility · Claude Code implementation notes. Light + dark.
'use strict';

const MX = window.SO;
const { useState } = React;

function MxIcon(props) { return <MX.Icon {...props} />; }
function Check() { return <MX.Icon name="check" size={15} />; }

/* ── Signals reference ─────────────────────────────────────────────────── */
const MX_SIGNALS = [
  { icon: 'check', title: 'Пояснення найкращого вибору', desc: 'Найкраща пропозиція пояснює, ЧОМУ вона найкраща — не лише ціною. 1–3 короткі причини під ціною.', copy: <span><code>Найкраща ціна</code> коли = найдешевша · <code>Найкращий вибір</code> коли ≠ найдешевша</span> },
  { icon: 'arrow-down', title: 'Найдешевша ціна', desc: 'Коли найдешевша книгарня не є найкращим вибором — позначається нейтральним маркером, без зеленого.', copy: <code>Найдешевша</code> },
  { icon: 'shield-check', title: 'Надійність книгарні', desc: 'Тиха позначка перевіреності біля назви. Завжди muted — ніколи не конкурує з назвою чи ціною.', copy: <code>Перевірена книгарня</code> },
  { icon: 'truck', title: 'Доставка', desc: 'Підказка про доставку в статус-лінії. Якщо невідомо — чесно про це кажемо.', copy: <span><code>Доставка: 1–3 дні</code> · <code>Доставка уточнюється у книгарні</code></span> },
  { icon: 'check', title: 'Наявність', desc: 'Кольорова крапка + підпис: наявна (зелена) · закінчується (акцент) · немає (faint) · уточнюється (контур).', copy: <span><code>В наявності</code> · <code>Закінчується</code> · <code>Наявність уточнюється</code></span> },
  { icon: 'clock', title: 'Свіжість ціни', desc: 'Загальна примітка «оновлено сьогодні» внизу; застарілу ціну позначаємо в рядку.', copy: <span><code>Оновлено сьогодні о 08:00</code> · <code>Ціна могла змінитися</code></span> },
  { icon: 'trending-down', title: 'Ціна змінилася', desc: 'Зміна з останньої перевірки. Падіння — зелене (позитив), зростання — muted (ніколи червоне).', copy: <code>Ціна впала з 289 ₴</code> },
  { icon: 'alert-triangle', title: 'Книгарня недоступна', desc: 'Магазин тимчасово лежить — рядок приглушено, кнопка вимкнена, ціна лишається як доказ перевірки.', copy: <code>Книгарня тимчасово недоступна</code> },
  { icon: 'link-off', title: 'Посилання недоступне', desc: 'Партнерське посилання не працює — кнопка вимкнена, ціна лишається видимою.', copy: <code>Посилання недоступне</code> },
  { icon: 'layers', title: 'Обʼєднані дублікати', desc: 'Кілька однакових пропозицій від одного провайдера згортаються в один рядок з тихою приміткою.', copy: <code>Схожі пропозиції обʼєднано · 2</code> },
];

/* ── Per-state spec rows ───────────────────────────────────────────────── */
const MX_SPEC = {
  normal: { trigger: 'Усі книгарні відповіли; ціни свіжі.', behaviour: 'Найдешевша = найкраща (зелений). Вторинні рядки несуть наявність · доставку · надійність тихою лінією.', signals: 'Найкраща ціна · наявність · доставка · надійність · обʼєднані дублікати' },
  cheapest: { trigger: 'Найдешевша книгарня також наявна й з актуальною ціною.', behaviour: 'Пояснення веде ціною («на N ₴ дешевше за наступну»).', signals: 'Найкраща ціна · різниця в ціні · наявність' },
  bestOverall: { trigger: 'Найдешевша книгарня неперевірена / з невідомою доставкою.', behaviour: '«Найкращий вибір» — трохи дорожчий, але надійний. Примітка чесно називає найдешевший і причину.', signals: 'Найкращий вибір · Найдешевша · надійність · доставка' },
  cheapestStale: { trigger: 'Найнижчу ціну давно не перевіряли.', behaviour: 'Рядок позначено «Ціна могла змінитися»; рекомендується книгарня з актуальною ціною.', signals: 'Найкращий вибір · Найдешевша · свіжість (stale)' },
  cheapestOut: { trigger: 'Найнижча ціна — у книгарні без наявності.', behaviour: 'Рядок видно як доказ перевірки (приглушено, кнопка off); рекомендується наявний варіант.', signals: 'Найкращий вибір · Найдешевша · наявність (out)' },
  samePrice: { trigger: 'Дві+ книгарні з однаковою ціною.', behaviour: 'Вибір розв’язується доставкою / надійністю — і це сказано прямо. Інший рядок: «Така сама ціна».', signals: 'Найкращий вибір · Така сама ціна · доставка' },
  providerUnavailable: { trigger: 'Магазин лежить · посилання не працює.', behaviour: 'Недоступні рядки лишаються (приглушені, кнопка off) як доказ; рекомендується доступна книгарня.', signals: 'Книгарня недоступна · посилання недоступне · наявність уточнюється' },
  empty: { trigger: 'Книги немає в жодній книгарні.', behaviour: 'Спокійне пояснення + «Стежити за наявністю». Без великого маскота (рівень панелі).', signals: 'Empty body' },
  loading: { trigger: 'Запит цін у процесі / після зміни.', behaviour: 'Теплі плейсхолдери в розмір реальної панелі — без зсуву. Ніколи холодний сірий.', signals: 'Loading body' },
  error: { trigger: 'Запит цін не вдався.', behaviour: 'Локальна відновлювана помилка + «Спробувати ще раз». Решта Book Details доступна.', signals: 'Error body' },
};

function MxState({ id }) {
  const s = MX.STATES[id];
  const sp = MX_SPEC[id];
  return (
    <div className="mx-state">
      <div className="mx-state__panel"><MX.Panel state={id} /></div>
      <div className="mx-state__spec">
        <h3 className="mx-state__label">{s.label}</h3>
        <p className="mx-state__summary">{s.summary}</p>
        <dl className="mx-deflist">
          <dt>Тригер</dt><dd>{sp.trigger}</dd>
          <dt>Поведінка</dt><dd>{sp.behaviour}</dd>
          <dt>Сигнали</dt><dd>{sp.signals}</dd>
        </dl>
      </div>
    </div>
  );
}

/* ── Rule / list helpers ───────────────────────────────────────────────── */
function Rule({ k, children }) { return <div className="mx-rule"><div className="mx-rule__k">{k}</div><div className="mx-rule__v">{children}</div></div>; }
function LItem({ children }) { return <li><Check />{children}</li>; }

function MxMatrix() {
  const [theme, setTheme] = useState('light');
  const logo = MX.ASSET + (theme === 'dark' ? 'assets/logo/knyhovo-logo-dark.png' : 'assets/logo/knyhovo-logo-light.png');
  const { ThemeToggle } = MX.DS;
  return (
    <div className="mx-page" data-theme={theme}>
      <div className="mx-wrap">
        <div className="mx-topbar">
          <div className="mx-brand"><img src={logo} alt="Knyhovo" /><span className="mx-pill">W6 · Offers Intelligence</span></div>
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>

        <p className="mx-eyebrow">Book Details · OffersPanel extension</p>
        <h1 className="mx-h1">Store Offers Intelligence — матриця станів</h1>
        <p className="mx-lead">Тонкий інтелектуальний шар, доданий до замороженого OffersPanel: він допомагає зрозуміти, яка пропозиція найкраща — а не лише найдешевша. Layout, типографіка, кнопки, бейджі та ціновий рейтинг успадковані без змін.</p>
        <div className="mx-note"><b>Принцип:</b> Knyhovo знаходить ціни. Книговик радить. Тон — спокійний, корисний, непромоційний. Жодного FOMO. Зелений — лише для позитиву (наявність, найдешевша, падіння ціни); зростання цін лишаються muted, ніколи не червоні.</div>

        <section className="mx-section">
          <h2 className="mx-h2">Сигнали інтелекту</h2>
          <p className="mx-sub">Десять легких сигналів. Кожен — це бейдж, крапка наявності або тихий факт у статус-лінії. Максимум один сильний бейдж на рядок.</p>
          <div className="mx-grid">
            {MX_SIGNALS.map((sg, i) => (
              <div className="mx-card" key={i}>
                <div className="mx-card__head">
                  <span className="mx-card__icon"><MxIcon name={sg.icon} size={17} /></span>
                  <span className="mx-card__title">{sg.title}</span>
                </div>
                <p className="mx-card__desc">{sg.desc}</p>
                <p className="mx-card__copy">{sg.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-section">
          <h2 className="mx-h2">Матриця станів</h2>
          <p className="mx-sub">Десять станів — кожен показано живою панеллю поруч зі специфікацією. Перемкніть тему вгорі, щоб перевірити обидві.</p>
          {MX.ORDER.map((id) => <MxState key={id} id={id} />)}
        </section>

        <section className="mx-section">
          <h2 className="mx-h2">Рекомендації на рівні компонентів</h2>
          <div className="mx-rules">
            <Rule k="Best-блок">Заморожена композиція <b>.bdc-best</b> зберігається. Додано лише список причин <b>.so-reasons</b> (між рядком книгарні та CTA) і чесну примітку <b>.so-best-note</b>, коли вибір ≠ найдешевший.</Rule>
            <Rule k="Бейдж best-блоку"><b>Найкраща ціна</b> (зелений) лише коли найдешевша = найкраща. Інакше — <b>Найкращий вибір</b> (зелений) + примітка про найдешевшу.</Rule>
            <Rule k="Рядок пропозиції">Заморожений однорядковий <b>.bdc-row</b> розширено до двох рядків: верх (книгарня · ціна · CTA), низ — тиха статус-лінія. CTA охоплює обидва рядки.</Rule>
            <Rule k="Ціновий рейтинг">Незмінний: ціна — serif акцент; стара ціна — muted закреслена; назва книгарні — завжди muted, ніколи акцент.</Rule>
            <Rule k="Один бейдж на рядок">Пріоритет: Найдешевша → Така сама ціна → −N%. Свіжість / доставка / надійність — це факти статус-лінії, не бейджі.</Rule>
            <Rule k="Надійність">Тиха позначка <b>shield-check</b> у <b>--icon-muted</b> біля назви. Без рейтингів і відгуків (поза скоупом).</Rule>
            <Rule k="Недоступність">Рядки store-down / link-down лишаються видимими, приглушені (opacity .62), кнопка off — як доказ перевірки.</Rule>
            <Rule k="Системні тіла">Empty / loading / error замінюють лише ТІЛО панелі. Eyebrow і рамка лишаються; решта сторінки доступна.</Rule>
          </div>
        </section>

        <section className="mx-section">
          <h2 className="mx-h2">Правила копірайту</h2>
          <div className="mx-rules">
            <Rule k="Тон">Спокійний · корисний · непромоційний. Жодного «Найкраще!», окликів, FOMO чи зворотного відліку.</Rule>
            <Rule k="Ролі">Knyhovo <b>знаходить / перевіряє</b> ціни (інструмент). Книговик <b>радить / підказує</b> (помічник). Рекомендація ніколи не звучить як від книгарні.</Rule>
            <Rule k="Найкращий вибір">Завжди супроводжується причиною. Якщо не найдешевший — назвати найдешевшу ціну й книгарню чесно.</Rule>
            <Rule k="Невідоме">Казати прямо: «Доставка уточнюється у книгарні», «Наявність уточнюється» — ніколи не вигадувати.</Rule>
            <Rule k="Свіжість">Точний час: «Оновлено сьогодні о 08:00». Сумнів — «Ціна могла змінитися».</Rule>
            <Rule k="Ціна">Формат «240 ₴» (пробіл перед ₴). Назва книгарні після «у» / середньої крапки.</Rule>
          </div>
        </section>

        <section className="mx-section">
          <h2 className="mx-h2">Доступність</h2>
          <ul className="mx-list">
            <LItem><b>Наявність не лише кольором.</b> Кольорова крапка завжди супроводжується текстовим підписом («В наявності»), тож стан зрозумілий без сприйняття кольору.</LItem>
            <LItem><b>Найкращий вибір не лише кольором.</b> Зелений бейдж дублюється текстом причини — рекомендація читається скрін-рідером.</LItem>
            <LItem><b>Вимкнені кнопки</b> (out / store-down / link-down) отримують <code>disabled</code> + текстову причину в рядку; не покладатися на саму лише приглушеність.</LItem>
            <LItem><b>Статус-лінія</b> — звичайний текст із <code>·</code>-роздільниками (псевдоелемент, прихований від AT), читається як єдина фраза.</LItem>
            <LItem><b>Сенсорні цілі</b> ≥ 44px на мобільному (кнопка «Перейти»).</LItem>
            <LItem><b>Focus-ring</b> — успадкований 3px акцентний ring DS на всіх інтерактивних елементах.</LItem>
            <LItem><b>Завантаження</b> — <code>aria-hidden</code>; reduced-motion вимикає пульс і stagger, лишаючи статичний контент.</LItem>
            <LItem><b>Контраст</b> — увесь текст на токенах DS (muted ≥ 4.5:1 на surface в обох темах).</LItem>
          </ul>
        </section>

        <section className="mx-section">
          <h2 className="mx-h2">Нотатки для імплементації (Claude Code)</h2>
          <ul className="mx-list">
            <LItem><b>Дані рядка пропозиції:</b> <code>{'{ store, price, oldPrice, avail: in|low|out|unknown, fresh: today|stale|changed, changedFrom, delivery: string|"unknown"|null, verified, storeDown, linkDown, grouped, cheapestTag, sameTag }'}</code>.</LItem>
            <LItem><b>Вибір best-offer:</b> серед наявних, зі свіжою ціною й робочим посиланням — найдешевша. Якщо найдешевша не проходить → бейдж «Найкращий вибір» + примітка з найдешевшою ціною/книгарнею.</LItem>
            <LItem><b>Маркер «Найдешевша»</b> ставиться на рядок з мінімальною ціною лише коли він ≠ best-offer.</LItem>
            <LItem><b>Сортування:</b> наявні за зростанням ціни; недоступні (out / store-down / link-down) — в кінці, але видимі.</LItem>
            <LItem><b>Свіжість:</b> <code>stale</code>, якщо ціну не оновлювали понад поріг бекенду; <code>changed</code> з <code>changedFrom</code> для дельти. Падіння — зелене, зростання — muted.</LItem>
            <LItem><b>Системні стани</b> змінюють лише тіло панелі; eyebrow «ЦІНИ У КНИГАРНЯХ» і рамка лишаються. Помилка локальна й відновлювана — ніколи не глобальна сторінка.</LItem>
            <LItem><b>Тільки токени DS.</b> Класи <code>.so-*</code> — це шар поверх <code>.bdc-*</code>; нові кольори/типи/радіуси/тіні не вводити.</LItem>
            <LItem><b>Поза скоупом:</b> checkout, оплати, відгуки про книгарні, редизайн layout / Wishlist / Price History.</LItem>
          </ul>
        </section>

        <p className="mx-foot">Knyhovo · W6 Store Offers Intelligence v1.0 · розширення замороженого Book Details v1.1 · {new Date().getFullYear()} · дизайн-специфікація, без імплементаційного коду.</p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('so-root')).render(<MxMatrix />);
