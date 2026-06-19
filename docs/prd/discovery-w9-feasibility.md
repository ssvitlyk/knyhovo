# Technical Feasibility Review: W9a Discovery Foundation

> Статус: **Technical feasibility review** — не PRD, не змінює scope. Документ верифікує кожне допущення
> `docs/prd/discovery-w9.md` проти **фактичного коду** станом на 2026-06-19 (гілка
> `feature/w9-discovery-prd`), валідує архітектуру, оцінює складність/ризик per-вимога й пропонує порядок
> реалізації, фази та тест-стратегію. **Жодного коду, жодних міграцій, жодних змін існуючих файлів** цей
> крок не вносить.
>
> **Легенда статусів:** ✅ already supported · 🔧 requires change · ⚠️ risk / caveat · ❌ blocker.
>
> **Найважливіший висновок наперед:** три допущення PRD потребують корекції перед реалізацією —
> (1) **скрапер BookClub не існує** (реалізований лише Yakaboo); (2) скрапери ходять **лише по каталогу**,
> per-book product-page fetch **відсутній** як механізм; (3) **обкладинка майже напевно доступна вже на
> catalog-картці**, тоді як **опис — лише на product-сторінці**. Це розщеплює W9a на дешевий шлях (covers)
> і дорогий (description) і впливає на фазування.

---

## 1. Верифікація допущень PRD проти коду

| # | Допущення з `discovery-w9.md` | Вердикт | Доказ у коді |
|---|-------------------------------|---------|--------------|
| A1 | CM уже реалізований, працює online | ✅ Підтверджено | `packages/scrapers/src/canonical/match-canonical.ts` (`matchOrCreate`, ISBN→норм-ключ→fuzzy 0.85/0.80/0.85→conflict); викликається у `packages/api/src/pipeline/run-scrape.ts` |
| A2 | Enrichment лягає на `provider_listings`, не на `canonical_books` | ✅ Здійсненно | `ProviderListing` модель — `schema.prisma:74–98`; per-listing зберігання узгоджується з CM-агностичністю |
| A3 | `BookDetailsDto.coverUrl`/`description` зараз hard-coded `null` | ✅ Підтверджено | `packages/api/src/books/mapper.ts:58–59`; DTO-коментарі `books/dto.ts:37–40` |
| A4 | `WishlistItemDto.coverUrl` зараз `null` | ✅ Підтверджено | `wishlist/dto.ts:44–45`; маппер хардкодить `coverUrl: null` |
| A5 | `SearchItemDto` **не має** `coverUrl` | ✅ Підтверджено | `search/dto.ts:27–37` — поля немає взагалі (треба додати, не «наповнити») |
| A6 | `RawProviderListing` без cover/description | ✅ Підтверджено | `packages/shared/src/types/provider.ts:37–50` |
| A7 | Обкладинка/опис лежать на **product-сторінках** Yakaboo та BookClub | ⚠️ Частково / неточно | Опис — так (тільки product-page). **Обкладинка — імовірно вже на catalog-картці** (`<img src>` у fixture). **BookClub-скрапера не існує** — див. §10 (B-NEW-1) |
| A8 | Скрапери читають каталог, product-page потребує per-book запиту (B3) | ✅ Підтверджено + загострено | `yakaboo.scraper.ts` ходить лише `…/books.html?page=N`; **механізму product-page fetch немає взагалі** — це net-new, не розширення |
| A9 | Author shelf реалізовний на наявному `GET /api/search` | ✅ Підтверджено, з застереженням | search шукає substring по title/author (`search/repository.ts`); веб має `searchBooks()` (server) і `clientSearch()` (browser). Якість — ⚠️ §9 |
| A10 | Frozen-екрани вже реалізовані, плейсхолдери на місці | ✅ Підтверджено | `BookCard.tsx` має `cover?`-prop і `<img>`/placeholder; `BookDetails.tsx:21–41` рендерить cover+description з fallback; wishlist — placeholder-only (cover-prop ще немає) |
| A11 | Гроші в копійках, UI ÷100 | ✅ Підтверджено | `MoneyDto.amount` (kopiyky) у всіх трьох DTO |
| A12 | Hotlink обкладинок реалізовний для MVP (R5) | ✅ Здійсненно | UI використовує plain `<img>`, **не** `next/image`; `next.config.mjs` без `images` — hotlink працює без конфігурації. Застереження — §«hotlink», §10 |

**Підсумок верифікації:** усе ядро PRD підтверджується кодом. Три уточнення (A7/A8/A9) не ламають scope,
але змінюють **послідовність і вартість** реалізації — деталізовано нижче.

---

## 2. Валідація архітектури

### 2.1 Scraper architecture — ✅ структурно готова, ⚠️ лише каталог, ❌ лише Yakaboo

- Структура: `packages/scrapers/src/providers/yakaboo/` (`*.scraper.ts` оркеструє пагінацію,
  `*.parser.ts` парсить через **cheerio**, `constants.ts` тримає CSS-селектори, `__tests__/__fixtures__/`
  з реальним HTML). Контракт `ScraperProvider.scrape()` (`shared/types/provider.ts:85–89`) — «must not
  throw; collect errors».
- HTTP: `http/html-fetcher.ts` (native `fetch` + `AbortController`, timeout-параметр) для dev/test;
  **`http/playwright-html-fetcher.ts`** для прод (Cloudflare-обхід, `networkidle`-очікування).
- Timeout/throttle: `DEFAULT_TIMEOUT_MS = 10_000`, `DEFAULT_DELAY_MS = 500` між сторінками; **без
  retry-loop** — узгоджено з security rule.
- Помилки: акумулюються у `ScraperResult.errors` (page-level і card-level `try/catch`).
- ❌ **BookClub-скрапер відсутній** — `providers/index.ts` експортує лише `YakabooScraper`; директорії
  `book-club/` немає. Enum `BOOK_CLUB` і slug `'book-club'` лише оголошені в типах. Значить, **сьогодні всі
  листинги — Yakaboo**, і product-page enrichment фізично можливий лише для Yakaboo (B-NEW-1, §10).
- ⚠️ **Per-book product-page fetch як механізм не існує.** Скрапер не має кроку «для кожного листингу
  завантажити його `url` і допарсити». Його треба **спроєктувати з нуля** (новий етап у scraper або
  окремий enrichment-pass), з власним throttle/timeout.

### 2.2 Provider-listing pipeline — ✅ готовий, точка вставки чітка

`packages/api/src/pipeline/run-scrape.ts` → `persistListing` / `markUnavailable`
(`pipeline/persist-listing.ts`). На create і на update запис іде в `tx.providerListing.{create,update}`.
**Це єдина точка**, куди треба додати запис `coverUrl`/`description`. Update сьогодні оновлює
title/author/price/availability щоразу, а `isbn` — лише коли був `null`; для cover/description треба
визначити політику оновлення (рекомендація §4).

### 2.3 Canonical matching integration — ✅ не торкаємось

`matchOrCreate` приймає `RawProviderListing` і повертає `MatchResult`. Додавання двох опційних полів у
`RawProviderListing` **не впливає** на сигнатуру чи логіку matching (поля не читаються в
`match-canonical.ts`). W9a лишається CM-агностичним — підтверджено на рівні коду.

### 2.4 Database schema — ✅ просте, беквард-сумісне розширення

`ProviderListing` (`schema.prisma:74–98`) — додати два nullable `String?`: `coverUrl` (`@map("cover_url")`)
та `description` (`@map("description")`). Унікальний ключ `@@unique([provider, url])` і append-only
`price_history` не зачіпаються. Міграція — additive (§«migration risks», §10).

### 2.5 Search DTOs — 🔧 нове поле + display-вибір

`SearchItemDto` (`search/dto.ts:27–37`) **не має** `coverUrl` → додати. `search/repository.ts` використовує
`include: { listings: true }` → нові колонки **підхопляться автоматично** у row, але `ListingRow`-тип і
`toSearchItem` (`search/mapper.ts`) треба оновити, щоб **вибрати display-cover** (зараз маппер будує лише
`{provider, price}`).

### 2.6 Book details DTOs — 🔧 наповнити + оновити explicit select

`BookDetailsDto` уже має `coverUrl`/`description` (hard-coded `null`). ⚠️ `books/repository.ts` використовує
**explicit `select`** на вкладених `listings` → нові колонки **НЕ** підхопляться без правки select.
`toBookDetails` (`books/mapper.ts:53–63`) має наповнити обидва поля display-вибором.

### 2.7 Wishlist DTOs — 🔧 наповнити + оновити explicit select

`WishlistBookDto.coverUrl` — hard-coded `null`. ⚠️ `wishlist/repository.ts` — **explicit nested `select`** →
треба додати `coverUrl` (опис у wishlist не потрібен — поза scope картки). Маппер замінює `coverUrl: null`
на display-вибір.

### 2.8 Current placeholder handling — ✅ fallback уже на місці

- `BookCard.tsx:41–45` — `cover ? <img src> : <div placeholder>`; **plain `<img>`**, не `next/image`.
- `BookDetails.tsx:21–27` (cover) і `:33–41` (description) — обидва вже мають реальний рендер + fallback;
  достатньо, щоб бекенд почав віддавати непорожні значення.
- `WishlistRow.tsx:42–43` і `WishlistCard.tsx:59` — **лише placeholder-`<span>`, cover-prop немає** → треба
  додати рендер `<img>` (мала фронт-зміна).

### 2.9 Author shelf feasibility — ✅ інфраструктура є, ⚠️ якість

Секції related-полиць у `BookDetails` **немає взагалі** — це net-new UI-компонент. Дані: веб має
`searchBooks()` (server-side RSC, `API_BASE_URL`, 8s timeout) — ідеально для author shelf у server-компоненті.
Бекенд-search підтримує лише `q/page/pageSize` (`search/schema.ts`), max `pageSize` 50 (web-proxy ріже до 10),
**без `sort`-параметра**. Якість збігу автора — substring, не канонікалізований → ризик шуму (§9).

---

## 3. Per-requirement: підтримка / зміна / ризик / складність

| Вимога W9a | Стан | Що потрібно | Ризик | Складність |
|------------|------|-------------|-------|------------|
| `RawProviderListing` + 2 опц. поля | 🔧 requires change | додати `coverUrl?`, `description?` у `shared` | Низький | XS |
| Scraper: cover (Yakaboo) | 🔧 requires change | селектор `<img>` на catalog-картці; **product-page fetch не обов'язковий** | Низький-серед. | S |
| Scraper: description (Yakaboo) | 🔧 requires change | **новий product-page fetch** per-book + парс + sanitize | Високий | L |
| Scraper: BookClub (cover+desc) | ❌ blocker | **скрапера немає** — спершу побудувати провайдера | Високий | XL (поза W9a-кошторисом) |
| Schema: 2 nullable колонки | 🔧 requires change | міграція additive | Низький | XS |
| Persist: запис cover/description | 🔧 requires change | додати поля у create+update у `persist-listing.ts` | Низький | S |
| `SearchItemDto.coverUrl` (нове) | 🔧 requires change | поле в DTO + display-вибір у `search/mapper.ts` (repo `include` авто) | Низький | S |
| `BookDetailsDto.coverUrl`+`description` | 🔧 requires change | **оновити explicit select** + маппер | Низький-серед. | S |
| `WishlistItemDto.coverUrl` | 🔧 requires change | **оновити explicit nested select** + маппер | Низький | S |
| Display-cover selection (deterministic) | 🔧 requires change | спільна чиста функція вибору (§4) | Середній | M |
| Frontend: Search covers | ✅ already supported | пробросити `coverUrl` у `BookCard.cover` | Низький | XS |
| Frontend: Book Details cover+опис | ✅ already supported | бекенд віддає непорожні значення | Низький | XS |
| Frontend: Wishlist covers | 🔧 requires change | додати `<img>` у `WishlistRow`/`WishlistCard` | Низький | S |
| Author shelf (UI + дані) | 🔧 requires change | новий RSC-компонент через `searchBooks()`; виключити поточну книгу; graceful hide | Середній | M |
| Description sanitize → plain text | 🔧 requires change | очистка HTML до тексту на межі (scraper/API) | Середній (XSS) | S |

> Складність: XS < S < M < L < XL (відносна, не людино-години).

---

## 4. Верифікація ключових технічних рішень

### 4.1 coverUrl storage strategy — ✅ підтверджено
Колонка `cover_url` на `provider_listings` (per-listing). Узгоджено з CM-агностичністю: кожен листинг
несе власну обкладинку. На update — **перезаписувати щоразу** (обкладинка може змінитись), на відміну від
`isbn` (який пишеться лише коли був null). Низький ризик.

### 4.2 description storage strategy — ✅ підтверджено, ⚠️ джерело дороге
Колонка `description` на `provider_listings`. **Джерело — лише product-сторінка** (на catalog-картці опису
немає). Це означає: щоб мати опис, скрапер мусить зробити **per-book product fetch** (нова можливість),
до того ж через Playwright у прод — головний performance-ризик (§10). Зберігати **санітизований plain
text** (не HTML).

### 4.3 deterministic display-cover/description selection — 🔧 спроєктувати чисту функцію
Маппери вже сортують листинги за ціною ↑ і фільтрують `OUT_OF_STOCK`. Рекомендоване правило (чисте,
детерміноване, без random/часу — testing rule):

1. кандидати = листинги книги, відсортовані за **(пріоритет провайдера, ціна ↑)**;
2. display = **перший кандидат із непорожнім полем**;
3. ⚠️ **важливий нюанс Book Details:** сторінка показується навіть коли всі листинги `OUT_OF_STOCK`
   (`books/mapper.ts` ніколи не повертає null). Тому для cover/description вибір має дивитись на **усі**
   листинги книги, **а не лише на in-stock-набір `providers`**, інакше у out-of-stock книги обкладинка
   зникне. Для search це неважливо (книга без in-stock листингів і так відсіюється, `toSearchItem`→null).
4. нічого не знайдено → `null` → UI показує placeholder/hint.

### 4.4 provider priority rules — 🔧 визначити порядок
Сьогодні впорядкування лише за ціною. Треба ввести явний фіксований порядок провайдерів (напр.
`yakaboo` > `book-club`) як первинний ключ display-вибору, ціна — вторинний. Доки існує лише Yakaboo, правило
тривіальне, але має бути закладене явно й покрите тестом (детермінізм при появі BookClub).

### 4.5 hotlink feasibility — ✅ технічно так, ⚠️ операційні застереження
- UI вживає plain `<img src>` (BookCard, BookDetails) — **без `next/image`** і без `images.remotePatterns`
  у `next.config.mjs` → hotlink працює без конфігурації.
- ⚠️ Провайдер може віддавати 403 за `Referer`/hotlink-захистом або CDN-обмеженням; зображення тоді просто
  не вантажиться — fallback-placeholder спрацює (graceful), але візуальна цінність втрачається.
- ⚠️ Авторські права/ToS hotlink-у — відкрите рішення (B1); зберігання/проксі відкладено (R5).
- Рекомендація: для MVP hotlink + placeholder fallback прийнятний; передбачити `referrerPolicy="no-referrer"`
  на `<img>` як дешеву мітигацію 403 (деталь реалізації, не вимога PRD).

### 4.6 author shelf search quality — ⚠️ найслабша ланка
- Запит за рядком автора → `OR(title contains, author contains)` — **substring, регістронезалежний**, без
  exact-match і без author-канонікалізації. Поширені/короткі прізвища дадуть шум; різні написання автора
  дадуть пропуски.
- Немає dedicated author-фільтра — збіги по `title` теж потраплять у результат.
- Мітигація (у дусі W7a Author Jump): рендерити полицю **лише** коли ≥N валідних related-книг після
  клієнтського відсіву (виключити поточну книгу за `id`; за бажанням — лишати тільки ті, де `author`
  достатньо збігається); інакше **повністю ховати**. Це утримує фічу best-effort і не блокує сторінку.

---

## 5. Приховані блокери, ризики міграції, performance та контрактні ризики

### 5.1 Hidden blockers
- **B-NEW-1 (❌ найбільший): BookClub-скрапер не існує.** PRD припускає enrichment «Yakaboo + BookClub», але
  реалізований лише Yakaboo. Для BookClub немає ні каталог-, ні product-скрапінгу. **Рішення для PRD-scope:**
  W9a enrichment постачається **для Yakaboo**; BookClub-обкладинки/опис недосяжні, доки не побудовано
  BookClub-провайдера (окрема, більша робота — кандидат у W9b чи окремий тікет). Усі листинги сьогодні —
  Yakaboo, тож вплив на користувача мінімальний, але PRD-формулювання «Yakaboo + BookClub» треба
  скоригувати.
- **B-NEW-2 (⚠️): product-page fetch — net-new підсистема, а не «розширення».** Опис (і, за потреби,
  надійніша обкладинка) вимагає нового етапу скрапінгу з власним throttle/timeout/Playwright-менеджментом.
  Недооцінка цього — головний ризик строків.
- **B-NEW-3 (⚠️): explicit `select` у books/wishlist repo.** Легко забути додати нові колонки у вкладений
  `select` — тоді поля «тихо» лишаться відсутніми попри наявність у БД. Search (`include`) такого ризику не
  має. Покрити тестом маппера/репозиторію.
- **B-NEW-4 (⚠️): out-of-stock cover на Book Details** (див. §4.3.3) — якщо вибір cover обмежити in-stock
  набором, у недоступних книг обкладинка зникне. Легко пропустити.

### 5.2 Migration risks — низькі
- Два nullable `String?` — additive, беквард-сумісно; існуючі рядки → `NULL` → UI placeholder. Без бекфілу.
- `description` — потенційно великий текст: тип `String` (Postgres `text`) прийнятний; **обрізати** до
  розумної межі при скрапінгу, щоб уникнути роздутих рядків.
- Дотримати робочий процес проєкту: Node 22 для pnpm/prisma; згенерувати міграцію стандартно (не вручну).

### 5.3 Scraper performance risks — від низьких (cover) до високих (description)
- **Cover з catalog** — ~нуль додаткових запитів (поле вже в HTML картки). Низький ризик.
- **Description з product-pages** — множить запити: N книг = N додаткових fetch. Через **Playwright**
  (Cloudflare) кожен fetch коштовний (новий page, `networkidle`-очікування). При сотнях/тисячах книг це
  години прогону + ризик rate-limit/блокування. Мітигація: явний `delayMs` (агресивніший за 500ms для
  product-pages), послідовний enrichment-pass після каталогу, чанкінг/ліміт за прогін, можливо окремий job.
  Без прихованих retry-loop (security rule).
- Часткові збої не мають валити прогін: «errors collected, not thrown» уже діє — зберегти для product-pass.

### 5.4 API contract risks — низькі, але є
- `SearchItemDto` отримує **нове поле** `coverUrl` — additive, опційно-сумісне для клієнтів; узгодити тип у
  веб-клієнті (`packages/web/src/lib/api`), щоб TS не відставав.
- `description` віддається як **plain text** — контракт має це гарантувати (UI не повинен рендерити HTML;
  XSS-межа на боці API/скрапера).
- Author shelf **не додає** ендпоінтів — лишається на `GET /api/search`; контракт search не змінюється
  (без `sort`, без author-фільтра — підтверджує, що popularity/new-сортування поза scope).

---

## 6. Рекомендований порядок реалізації

Принцип: спершу дешевий, високоцінний шлях (covers), що не вимагає product-page інфраструктури; опис —
другою, ізольованою фазою; BookClub — поза W9a.

1. **Shared + Schema (фундамент).** Додати `coverUrl?`/`description?` у `RawProviderListing`; міграція двох
   nullable-колонок на `provider_listings`. (XS, низький ризик.)
2. **Persist.** Писати cover/description у `persist-listing.ts` (create+update; cover перезаписувати,
   description перезаписувати при непорожньому). (S.)
3. **Cover scrape (Yakaboo, catalog).** Селектор `<img>` на картці → `coverUrl`; абсолютизувати URL;
   оновити fixtures/тести. (S, низький-середній.)
4. **Display-selection + API covers.** Чиста функція вибору (provider priority → ціна → перший непорожній,
   з урахуванням §4.3.3); `SearchItemDto.coverUrl` (нове поле, repo `include` авто); оновити **explicit
   select** у books та wishlist repo; наповнити маппери. (M.)
5. **Frontend covers.** Пробросити `coverUrl` у `BookCard` (Search); Book Details уже рендерить;
   додати `<img>` у `WishlistRow`/`WishlistCard`. (S.)
6. **Description scrape (Yakaboo, product-page) — окрема фаза.** Новий per-book product fetch +
   парс опису + **sanitize→plain text** + throttle; наповнити `BookDetailsDto.description`. (L, високий —
   ізолювати, щоб не блокувати covers.)
7. **Author shelf.** Новий RSC через `searchBooks()`; виключити поточну книгу; graceful hide за низької
   якості; верстка 4-col / горизонтальний скрол. (M.)

> **BookClub enrichment — поза цим порядком** (потребує спершу самого BookClub-скрапера; окремий тікет).

---

## 7. Фази реалізації

| Фаза | Зміст | Кроки §6 | Ризик | Залежності |
|------|-------|----------|-------|------------|
| **F0 — Foundation** | shared-поля + міграція + persist | 1–2 | Низький | — |
| **F1 — Covers (наскрізно)** | Yakaboo catalog cover → API (3 DTO) → UI (Search/Details/Wishlist) | 3–5 | Низький-серед. | F0 |
| **F2 — Description** | product-page fetch + sanitize → Book Details опис | 6 | **Високий** | F0; ізольовано від F1 |
| **F3 — Author shelf** | RSC-полиця через наявний search + graceful degradation | 7 | Середній | наявний `/api/search` |
| **(поза W9a) — BookClub** | побудувати BookClub-провайдера, тоді enrichment | — | Високий | новий скрапер |

F1 уже дає видиму користувацьку цінність (візуальні списки) без дорогого product-page шляху. F2/F3
незалежні між собою й від F1 — можна вести паралельно/відкласти F2 без втрати covers.

---

## 8. Тест-стратегія

Узгоджено з `.claude/rules/testing.md` (немає prod-коду без тестів; coverage нових модулів ≥ 80%;
детерміновано — без random/часу без mock).

- **Scraper (unit, vitest + HTML fixtures).** Розширити Yakaboo-fixtures карткою з `<img>` → перевірити
  парс `coverUrl` (абсолютний URL, відсутній img → `null`). Для F2 — fixture product-сторінки → парс
  `description` + перевірка sanitize (HTML вкидання → лишається лише текст; XSS-вектор знешкоджено).
  Перевірити «errors collected, not thrown» при відсутніх елементах.
- **Display-selection (unit).** Таблиця кейсів: один листинг; кілька з різними провайдерами (перевірка
  provider priority); порожні поля → fallback на наступний; **усі OUT_OF_STOCK** → cover все одно
  обирається (нюанс §4.3.3); жодного непорожнього → `null`. Детерміновано (однаковий вхід → однаковий вибір).
- **Persist (integration/unit з fake Prisma).** cover/description пишуться на create і на update; політика
  перезапису; canonicalBookId не змінюється; CM-логіка не зачеплена.
- **Repository (integration).** books/wishlist **explicit select** повертає нові колонки (захист від
  B-NEW-3); search `include` повертає їх автоматично.
- **Mappers (unit).** `SearchItemDto.coverUrl`, `BookDetailsDto.coverUrl/description`,
  `WishlistItemDto.coverUrl` наповнюються правильним display-значенням; `null` → коректний контракт.
- **API (integration).** `/api/search` повертає `coverUrl`; `/api/books/:id` повертає cover+description;
  `description` — plain text (без HTML).
- **Frontend (smoke/component).** Search-картка показує `<img>` при cover і placeholder без; Book Details
  cover+опис vs fallback-hint; Wishlist-рядок/картка показують `<img>`; author shelf рендериться при ≥N
  валідних книгах і **прихований** інакше; поточна книга не в полиці.
- **Author shelf якість (unit).** Детермінований тест відсіву: виключення поточної книги; поріг
  мінімальної кількості; шумні збіги → полиця прихована.

---

## 9. Зведення: чи готовий W9a до реалізації?

**Так — з трьома корекціями PRD перед стартом:**

1. **Scope провайдерів:** W9a enrichment — **для Yakaboo**; BookClub винести (немає скрапера). Уточнити
   формулювання «Yakaboo + BookClub» у `discovery-w9.md`.
2. **Джерело даних:** обкладинка — з **catalog-картки** (дешево, без product-page); опис — з
   **product-сторінки** (нова підсистема, дорого). Розщепити на фази F1/F2.
3. **Точки контракту:** врахувати explicit `select` у books/wishlist repo (B-NEW-3) і out-of-stock cover на
   Book Details (B-NEW-4) — обидва легко пропустити.

Жодного фундаментального блокера для covers + author shelf немає; CM не торкаємось; міграція additive;
hotlink працює без конфігурації. Найбільший залишковий ризик — **вартість/крихкість product-page скрапінгу
для опису** (F2) і **якість author shelf** (best-effort, graceful hide). Обидва ізольовані й не загрожують
основній цінності F1.
