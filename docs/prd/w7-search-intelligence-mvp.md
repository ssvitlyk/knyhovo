# PRD: W7a Search Intelligence MVP

> Статус: Чорновик — не затверджено. Технологічний стек: **Next.js (App Router)** + **Fastify** + **Prisma/PostgreSQL**.
> W7 — це шар інтелекту **навколо** замороженого Search Results v1.0 та глобального SearchBar. Сторінка
> результатів, поле пошуку, BookCard, пагінація, сортування, типографіка, кольори й відступи **не редизайняться**.
> Усі екрани збираються лише з наявних DS-компонентів (`window.KnyhovoDesignSystem_9fa616`) + токенів DS v1.0.
> Джерело тиризації — `packages/web/design-import/.../search-intelligence-v1` (`Feasibility - W7 Tiers.html`,
> `Search Intelligence - Principles & States.html`), з ревізією scope нижче.

## Business Goals

- Підняти успішність пошуку, коли запит неточний: друкарські помилки, частковий запит, ISBN, ім'я автора, або книги ще немає в базі
- Жоден запит не веде в глухий кут — кожен нульовий/помилковий результат пропонує наступний крок
- Зробити W7a **малим, безпечним і реалізовним поверх поточної архітектури** з мінімальним або нульовим бекендом
- Закласти UX-патерни (typeahead, ISBN, переходи), що масштабуються у W7b/W7c без редизайну

## Що робимо (W7a)

W7a містить **рівно 8 спроможностей** — нічого більше:

1. **Auto-correction** — авто-виправлення за курованим словником топ-помилок відомих назв; результати показуються за виправленим запитом, з оборотним «натомість шукати оригінал»
2. **Typeahead** — нещодавні запити (localStorage) + debounced підказки через **наявний** search flow, з клавіатурною навігацією та доступністю
3. **ISBN detection** — розпізнавання ISBN у полі (клієнтська регулярка), рядок «Розпізнано ISBN»
4. **ISBN exact match** — точний ISBN → одне видання → перехід на сторінку книги
5. **Author jump** — картка-перехід над результатами **лише** коли запит точно збігається з відомим автором, виявленим наявною пошуковою інфраструктурою
6. **Empty state** — інформаційний порожній стан (мускот + повідомлення), **без залежності від `canonicalBookId`** та alert-інфраструктури
7. **Search error state** — локальна відновлювана помилка пошуку + «спробувати ще раз»; запит збережено, ніколи не глобальна сторінка
8. **Partial index warning** — **опційний (progressive enhancement)**: показується лише якщо API вже повертає metadata про те, які книгарні відповіли

## Що НЕ робимо (в W7a) / Scope boundaries

**Явний перелік виключень W7a** (нічого з цього не входить у W7a):

- Series Jump *(W7b)*
- Did-you-mean *(W7b)*
- Multiple editions selector *(W7b)*
- Canonical work page *(W7b)*
- Author collection pages *(W7b)*
- Request book flow *(W7b)*
- «Стежити за появою» *(W7b)*
- «Попросити додати книгу» *(W7b)*
- Fuzzy author matching *(W7b)*
- Author/title decomposition *(W7c)*
- Full series navigation *(W7c)*
- Cross-language recovery *(W7c)*
- Semantic similarity *(W7c)*
- ML suggestions *(W7c)*
- AI suggestions *(W7c)*
- Dedicated suggest endpoint *(W7b)*
- Search ranking engine *(W7b)*

Окремо поза scope W7a:

- Жодного редизайну frozen-патернів (Search Results v1.0, SearchBar, BookCard, пагінація, сортування, empty-state композиція)
- Жодних обов'язкових змін бекенду чи нових API як вимоги W7a (повний перелік заборонених бекенд-додатків — у секції «Backend changes»)
- **Лише Author Jump.** Series Jump — W7b. Жодного *узагальненого jump-фреймворку* для W7a не потрібно
- Author Jump **не** включає: fuzzy author matching, author indexing, author aggregation, окремі author-таблиці, author recommendation, author ranking
- Author Jump **graceful degradation:** якщо наявні пошукові дані не дають точного збігу автора — Author Jump **прихований**; це не блокує пошук, не показує fallback-UI і не додає бекенд-роботи (критерій — у «Acceptance Criteria»)
- Empty state **не** включає жодних дій, що залежать від `canonicalBookId`, wishlist-логіки, request-book-логіки чи alerts (усі — W7b)
- Typeahead **не** включає: окремий suggest-ендпоінт, ranking engine, fuzzy/ML/semantic/AI підказки
- AI-chat, рекомендаційний фід, checkout/оплата, відгуки/рейтинги книгарень

> **Правило вирішення конфліктів:** коли цей PRD суперечить вихідному feasibility-документу — перемагає PRD.
> Перевага меншому scope, меншій кількості бекенд-залежностей, graceful degradation і прихованню недоступних
> станів замість бекенд-роботи. Для вилучених зі scope фіч **не додаються замінні фічі**.

## Класифікація станів — W7a / W7b / W7c

16-станний інвентар дизайн-шару, перетиризований під ревізований scope. Тир — пріоритет реалізації. Це
«source of truth» секція; усі інші секції узгоджені з нею.

| # | Стан | Тригер | Відповідь інтелекту | Тир | Бекенд |
|---|------|--------|---------------------|-----|--------|
| 1 | Авто-виправлення | Друкарська помилка, близька до відомої назви («гари потер») | Запит виправляється автоматично + «натомість шукати оригінал» | **W7a** | Курований статичний словник (клієнт) |
| 2 | Did-you-mean | Неоднозначний / іншомовний запит («ведьмак») | Чипи кандидатів + найближчі збіги | W7b | Fuzzy/trigram suggest-ендпоінт |
| 3a | **Author jump** | Запит точно збігається з відомим автором | Картка-перехід над результатами | **W7a** | Немає (наявний search) |
| 3b | **Series jump** | Запит збігається з назвою серії | Картка-перехід над результатами | **W7b** | Потрібна модель серій |
| 4 | Розбір назви+автора | Змішаний транслітерований запит | Назва й автор розпізнаються окремо | W7c | NLP-парсер сутностей |
| 5 | Typeahead · idle | Фокус на порожньому полі | Нещодавні запити (localStorage) | **W7a** | Немає |
| 6 | Typeahead · ввід | ≥1 символ | Згруповані debounced підказки через наявний search | **W7a** | Наявний search API + дебаунс |
| 7 | Typeahead · ISBN | Ввід схожий на ISBN | Рядок «Розпізнано ISBN» + Enter | **W7a** | Немає (клієнтська регулярка) |
| 8 | ISBN · точний збіг | ISBN → одне видання | Перехід до книги | **W7a** | Наявний search (ISBN indexed) |
| 9 | ISBN · кілька видань | ISBN → твір з кількома виданнями | Вибір видання | W7b | ISBN→workId індекс + модель work |
| 10 | ISBN · не знайдено | Невідомий ISBN | Інформаційний порожній стан | **W7a** | Немає |
| 11 | Канонічний твір | Популярна назва з багатьма виданнями | Один твір + згруповані видання | W7b | Модель work→editions |
| 12 | Добірка автора | Запит лише з іменем автора | Лендинг автора + таби сортування | W7b | Author-агрегації |
| 13 | Навігація серією | Запит — серія / том | Усі томи в порядку читання | W7c | Метадані серій |
| 14 | Порожньо · не знайдено | Нуль результатів | **W7a:** мускот + інформаційне повідомлення. **W7b:** дії «стежити» / «попросити додати» | **W7a** (стан) / W7b (дії) | W7a: немає · W7b: alerts + request-queue |
| 15 | Помилка пошуку | Збій сервісу пошуку | Локальна відновлювана помилка, запит збережено | **W7a** | Немає (обробка збою) |
| 16 | Частковий індекс | Частина книгарень не відповідає | Спокійне «X з N» над результатами (опційно) | **W7a** (optional) | Опційно: responded-stores metadata |

## Залежності від наявних систем Knyhovo

| Система | Файли / контракт | Роль у W7a |
|---------|------------------|------------|
| Search API | `GET /api/search?q=&page=&pageSize=` — `packages/api/src/search/` | Основа typeahead, author jump, ISBN exact match, auto-correction |
| Search UI | `packages/web/src/app/search/page.tsx`, `components/search/SearchControl.tsx`, `ResultsGrid.tsx` | Хост для інтелект-шару (композиція навколо) |
| DS-компоненти | `window.KnyhovoDesignSystem_9fa616`: SearchBar, BookCard, Chip, Badge, Button + токени `src/styles/ds/*` | Усі нові екрани збираються лише з них |
| Book Details flow | `GET /api/books/:id` — `packages/api/src/books/`, `packages/web/src/app/books/[id]/page.tsx` | Ціль переходів (ISBN exact match, author jump → книга) |
| Shared типи | `packages/shared/src/types/` (CanonicalBook, ProviderListing, Money, Availability) | Контракти даних; без дублювання |
| Canonical matching | `docs/prd/canonical-matching.md`, `packages/scrapers/src/canonical/` | Контекст (ISBN indexed, not unique); не змінюється |
| **W4 Wishlist/Alerts** | (W4) | **Залежність W7b**, не W7a — для дій порожнього стану |

## API needs

- **W7a будується поверх наявного `GET /api/search`. Жодних обов'язкових змін API.**
- **Typeahead:** дебаунс наявного `/api/search` (150–250мс) для підказок книг/авторів; нещодавні запити — у localStorage. **Без** окремого suggest-ендпоінта.
- **ISBN detection:** суто клієнтська регулярка (10–13 цифр, префікси 978–979). **Без** API.
- **ISBN exact match / Author jump:** наявний `/api/search` (ISBN indexed; author matchable). **Без** нових ендпоінтів.
- **Partial index (опційно, progressive enhancement):** якщо `/api/search` **уже** повертає metadata про те, які книгарні відповіли — показуємо «X з N». Якщо metadata немає — стан **прихований повністю**, без fallback-UI, без деградації. Це поле **не** є вимогою W7a і не блокує реліз.
- W7b+ (не входить у W7a): suggest/fuzzy-ендпоінт, work→editions (стабільний `workId`), ISBN→workId індекс, author-агрегації, request-queue.

## Backend changes

- **W7a: нуль обов'язкового бекенду.** Уся 8-пунктова функціональність реалізовна на фронтенді поверх наявного `/api/search`. W7a має лишатися реалізовним з мінімальними або нульовими змінами бекенду.
- Якщо в майбутньому з'явиться responded-stores metadata у відповіді search — Partial index підхопить її автоматично; до того часу стан прихований. Додавання цього поля — **опційне**, не блокер W7a.
- **W7a явно НЕ вводить** (усе нижче — W7b/W7c, не вимога W7a):
  - author tables
  - author indexes
  - author aggregation
  - author recommendation infrastructure
  - series tables
  - series metadata model
  - request queues
  - fuzzy indexes
  - dedicated suggest endpoint

## Frontend changes

Усе W7a — **нові композиції** з наявних DS-компонентів. Frozen Search Results / SearchBar visual / BookCard internals / пагінація / сортування — **не змінюються**.

- **Typeahead** — combobox-поле + listbox-меню: нещодавні (localStorage) + debounced результати наявного search; групи «книги · автори»; `↑ ↓ ↵ Esc`, `aria-activedescendant`; десктоп — popover під полем, мобільний — повноекранний аркуш.
- **ISBN-детект рядок** — UI-гілка typeahead при ISBN-подібному вводі.
- **AuthorJump (лише author)** — картка-перехід над результатами **тільки** на точний збіг автора → author-scoped пошук. W7a підтримує **лише Author Jump**; Series Jump — W7b. Узагальнений jump-фреймворк для W7a **не потрібен**. Якщо точний збіг автора не визначається з наявних пошукових даних — компонент **не рендериться** (graceful degradation, без fallback-UI).
- **SIEmpty** — мускот (magnifier/lantern за темою) + інформаційне повідомлення; **без** alert/wishlist-кнопок і `canonicalBookId`.
- **SISysError** — локальний відновлюваний блок помилки + «спробувати ще раз» (повторює останній запит).
- **SICorrectNotice** — повідомлення про авто-виправлення + оборотне «натомість шукати оригінал».
- **SIPartial** — умовний рендер «X з N» лише за наявності metadata; інакше нічого не рендериться.

**A11y та копірайт (успадковано):** combobox/listbox, `↑ ↓ ↵ Esc`, ≥44px дотик, мобільний typeahead = повноекранний аркуш, `aria-live="polite"` на зведенні результатів, підсвітка активного рядка не лише кольором. Тон: спокій, без FOMO/окликів; роль **Knyhovo шукає/перевіряє** (інструмент) vs **Книговик радить/підказує** (помічник); виправлення завжди оборотне; ціна `245 ₴` (пробіл перед ₴), назва книгарні після «·», завжди `--text-muted`.

## User flows

Сценарії, розмічені під ревізований scope:

- **A · Друкарська помилка → результати (W7a).** «гари потер» → авто-виправлено на «Гаррі Поттер» (висока впевненість) → результати + оборотне «натомість шукати оригінал».
- **B · Автор → книга (W7a лише jump).** «Стівен Кінг» точно збігається з відомим автором → картка-перехід → author-scoped пошук → книга. *Багата добірка/лендинг автора з табами — W7b.*
- **C · ISBN → книга (W7a лише exact).** Вставлено ISBN → розпізнано в полі → точний збіг → перехід до книги. *Вибір серед кількох видань — W7b.*
- **D · Не знайдено → інформація (W7a).** Нуль результатів → мускот + інформаційне повідомлення (чесно про прогалину). *Дії «стежити за появою» / «попросити додати» — W7b.*
- **Series-flow — W7b.** Запит-серія / навігація томами виключені з W7a.

## Acceptance Criteria

**Auto-correction**
- Виправлення лише за курованим статичним словником відомих топ-помилок; результати показуються за виправленим запитом
- Завжди присутнє оборотне «натомість шукати оригінал», що повертає оригінальний запит
- Невідомий/неоднозначний запит **не** виправляється (fuzzy did-you-mean — W7b)

**Typeahead**
- Idle: показує нещодавні запити з localStorage; ввід: debounced (150–250мс) підказки через наявний `/api/search`
- Клавіатура `↑ ↓ ↵ Esc`; `role=combobox`/`role=listbox`; `aria-activedescendant`; рядки ≥44px; мобільний — повноекранний аркуш
- **Без** окремого suggest-ендпоінта, ranking, fuzzy/ML/semantic/AI підказок

**ISBN detection + exact match**
- Клієнтська регулярка розпізнає 10–13 цифр / префікси 978–979 → рядок «Розпізнано ISBN»
- Точний ISBN з одним виданням → перехід до сторінки книги; кілька видань — поза W7a (W7b)

**Author jump**
- Показується **лише** на точний збіг запиту з відомим автором, визначений за наявними пошуковими даними
- **Без** fuzzy matching, author indexing/aggregation, окремих author-таблиць, recommendation/ranking; лише наявні дані
- **Graceful degradation:** якщо наявні пошукові дані **не** дають точного збігу автора — Author Jump прихований; це **не** блокує пошук, **не** показує fallback-UI і **не** додає бекенд-роботи
- W7a підтримує лише Author Jump; Series Jump (W7b) не реалізується; узагальнений jump-фреймворк не потрібен

**Empty state**
- Інформаційний: мускот + повідомлення; **без** `canonicalBookId`, wishlist/alert-кнопок, request-логіки
- Дії «стежити за появою» / «попросити додати» **відсутні** у W7a (W7b)

**Search error state**
- Локальний відновлюваний блок + «спробувати ще раз» (повторює останній запит); запит збережено; ніколи не глобальна сторінка

**Partial index warning (optional)**
- Рендериться **лише** за наявності responded-stores metadata у відповіді API; копірайт «X з N» (N = поточна к-сть книгарень)
- За відсутності metadata — стан прихований повністю, без fallback-UI; **ніколи** не блокує пошук, ранжування, рендеринг чи реліз W7a

## Декомпозиція (фази)

| Реліз | Опис | Залежності |
|-------|------|------------|
| **Реліз 1 (W7a)** | 8 спроможностей: auto-correction · typeahead (recent) · ISBN detection · ISBN exact match · author jump · empty state · search error · partial index (optional) | Наявний `/api/search`; нуль обов'язкового бекенду |
| **Реліз 2 (W7b)** | Series jump · did-you-mean (fuzzy) · multiple editions selector · canonical work page · author collection pages · request book flow · empty-state actions | Suggest-ендпоінт, модель серій, work→editions, author-агрегації, request-queue, W4 alerts |
| **Реліз 3 (W7c)** | Author/title decomposition (NLP) · full series navigation · cross-language recovery · semantic similarity | NLP/ML, збагачені метадані серій, embeddings |

## Майбутній розвиток (поза W7a)

- **W7b** — потребує бекенду: fuzzy did-you-mean, групування видань (work→editions, стабільний `workId`), ISBN → кілька видань, **Series jump** (потребує моделі серій), добірка/лендинг автора, request book flow, дії порожнього стану («стежити» через W4 alerts, «попросити додати» через request-queue).
- **W7c** — майбутній інтелект: NLP-розбір «назва+автор», повна навігація серією у порядку читання, кросмовне відновлення (рос./англ. → українське видання), семантична близькість (embeddings). Не блокує W7a/W7b.

## Risks / open questions

Справді невирішені питання W7a:

1. **Auto-correction словник** — курований статичний список топ-помилок. Хто веде/наповнює і який обсяг достатній для MVP?
2. **Author Jump exact-match** — чи достатньо **наявних пошукових даних**, щоб надійно визначити точний збіг автора (збіг із `author` у результатах), без додаткового бекенду? Якщо ні — Author Jump просто прихований (graceful degradation), а надійніший механізм — W7b.

### Прийняті рішення / винесене (не є відкритими питаннями)

- **Series Data Gap** — поточна архітектура не має first-class моделі серій. **Рішення:** Series Jump → W7b, Full Series Navigation → W7c; архітектура metadata серій (`seriesId`, порядок, тип) проектується на старті W7b. Для W7a — не блокер.
- **Partial index** — опційний (progressive enhancement): «X з N» лише за наявності responded-stores metadata, інакше прихований. Не блокує реліз. Прийнято.
- **Typeahead source** — дебаунс наявного `/api/search` прийнятний для MVP-обсягу; легший suggest-ендпоінт відкладено у W7b. Прийнято.
- **Empty state без `canonicalBookId`** — W7a empty лише інформаційний; усі дії, що потребують ідентифікатора книги чи alerts (W4), винесені у W7b. Прийнято.
