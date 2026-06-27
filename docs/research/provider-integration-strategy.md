# Provider Integration Strategy

> **Тип:** research / design. Статус: чорновик.
> **Дата:** 2026-06-27
> **Скоуп:** легальний і стабільний шлях інтеграції провайдерів, у яких scraper стабільно блокується (Yakaboo, Книгарня Є). Жодних змін у коді — лише проєктування.

## TL;DR

- Поточний scraper pipeline працює; **Vivat** скрапиться стабільно.
- **Yakaboo** стабільно повертає `BLOCKED` (HTTP 403, anti-bot).
- **Книгарня Є (book-ye)** стабільно повертає `BLOCKED` (Cloudflare Turnstile).
- **Обхід anti-bot / captcha / Turnstile не розглядається** — ні технічно, ні в MVP. Це не питання інженерії, а питання легального джерела даних.
- Рішення: ввести явну типологію provider adapters (`ScraperProvider` / `ApiProvider` / `FeedProvider` / `DisabledProvider`) і ставити провайдера в `active` лише за наявності **стабільного й легального** джерела.
- У MVP: **active providers only**. Заблоковані провайдери лишаються видимими у внутрішньому scrape health, але **search API не повертає провайдера без валідних listings**.

---

## 1. Поточний статус провайдерів

| Provider | Slug | Джерело | Статус | Блок | Кандидат на |
|----------|------|---------|--------|------|-------------|
| Vivat | `vivat` | catalog scrape | ✅ OK | — | лишається `ScraperProvider` (active) |
| Yakaboo | `yakaboo` | catalog scrape | ⛔ BLOCKED | HTTP 403 (anti-bot) | офіційний / partner / publisher API |
| Книгарня Є | `book-ye` | catalog scrape | ⛔ BLOCKED | Cloudflare Turnstile | sitemap / structured data / feed / партнерський доступ |
| BookClub | `book-club` | — | ⏳ не реалізовано | — | поза скоупом цього доку |

Блок розпізнається централізовано у [`detectProviderBlock`](../../packages/scrapers/src/lib/blocked-status.ts) (`kind: 'cloudflare' | 'http-403'`). Повідомлення про блок генерують самі scraper'и, а pipeline збирає їх у `ProviderRunResult.scrapeErrors` ([run-scrape.ts](../../packages/api/src/pipeline/run-scrape.ts)). Тобто інфраструктура для звітності про блок **вже є** — бракує лише легального джерела даних для заблокованих провайдерів.

### Чому не обходимо блок

- HTTP 403 та Cloudflare Turnstile — це **навмисний сигнал відмови** від власника сайту. Обхід (residential proxies, headless-fingerprinting, captcha-solving сервіси) — це:
  - порушення ToS провайдера → юридичний ризик;
  - крихка інженерія → постійна гонка озброєнь, нестабільні результати, шум у scrape health;
  - сумнівна якість даних → не можна гарантувати коректність цін.
- Стабільний продукт потребує **угоди про доступ**, а не технічного трюку. Тому трек для Yakaboo і BookYe — це **переговори + альтернативні легальні джерела**, а не покращення scraper'а.

---

## 2. Архітектура provider adapters

Сьогодні всі провайдери реалізують єдиний інтерфейс [`ScraperProvider`](../../packages/shared/src/types/provider.ts) (`name` + `scrape(options) → ScraperResult`). Цього достатньо, поки джерело завжди — HTML-скрап. Але Yakaboo/BookYe потребують **інших джерел даних** з тим самим виходом (`RawProviderListing[]`).

Пропозиція: зберегти єдиний **вихідний контракт** (`ScraperResult` / `RawProviderListing`), але дозволити різні **джерела отримання**. Вводимо явну типологію адаптерів.

### 2.1 Спільний контракт

Усі адаптери, незалежно від джерела, повертають той самий `ScraperResult` (вже визначено у `packages/shared`). Pipeline (`run-scrape.ts`) не має знати, звідки взялися listings — він уже працює з абстрактним `provider.scrape()`. Це ключ: **canonical matching, persistence та search не змінюються** при зміні джерела.

```
              ┌────────────────────────────┐
   джерело →  │  ProviderAdapter            │  → ScraperResult (єдиний контракт)
              │  .fetchListings(options)    │     { provider, listings[], scrapedAt, errors[] }
              └────────────────────────────┘
                         │
          ┌──────────────┼──────────────┬───────────────┐
   ScraperProvider   ApiProvider    FeedProvider    DisabledProvider
   (HTML scrape)     (офіц. API)    (sitemap/feed)  (no source / blocked)
```

### 2.2 Чотири типи адаптерів

| Адаптер | Джерело | Коли застосовувати | Стабільність |
|---------|---------|--------------------|--------------|
| **`ScraperProvider`** | HTML-сторінки каталогу/товару | Сайт віддає контент без anti-bot блоку (наприклад Vivat) | середня (залежить від верстки) |
| **`ApiProvider`** | Офіційний / partner / marketplace API | Провайдер надає документований ендпоінт або partner-доступ | висока (контракт + SLA) |
| **`FeedProvider`** | sitemap.xml, RSS/Atom, product feed (Google Merchant / Schema.org JSON-LD), CSV/price-list | Є машинно-читане джерело без блоку, навіть якщо без офіц. API | висока–середня |
| **`DisabledProvider`** | немає легального джерела | Блок без альтернативи; провайдер відомий системі, але не скрапиться | n/a (свідомо вимкнений) |

#### `ScraperProvider` (існує)
Поточний контракт. Без змін для Vivat. Лишається первинним типом, поки сайт віддає дані.

#### `ApiProvider` (нове, дизайн)
- Той самий вихід (`ScraperResult`), але `fetch` іде в HTTP API (JSON), не в HTML.
- Конфіг: base URL, auth (API key / OAuth — через env, ніколи в коді), rate limits.
- Мапінг API-полів → `RawProviderListing` живе у провайдер-специфічному парсері, як зараз.
- Перевага: стабільні поля, ISBN частіше присутній, ціни авторитетні.

#### `FeedProvider` (нове, дизайн)
- Джерело — періодичний feed або sitemap, що **не захищений** Turnstile (часто sitemap/feed віддаються відкрито для SEO/партнерів, навіть коли каталог за Cloudflare).
- Парсер витягує listings із XML/JSON-LD замість DOM каталогу.
- Підходить як проміжний крок для BookYe, якщо feed доступний, а API — ні.

#### `DisabledProvider` (нове, дизайн)
- Адаптер, що **свідомо не виконує мережевих запитів**: одразу повертає порожній `ScraperResult` із пояснювальним записом у `errors` (наприклад `"disabled: no legal data source — see provider-integration-strategy.md"`).
- Призначення: провайдер лишається у `ProviderName` та у внутрішньому scrape health як `disabled`, але **не шумить** блок-помилками і не дає listings у search.
- Відрізняється від `blocked`: `blocked` — це фактична відмова сайту під час спроби; `disabled` — наше рішення не намагатися. Обидва не дають active listings, але `disabled` — це кероване, тихе вимкнення.

### 2.3 Стани провайдера (для scrape health)

```
active    — є валідні listings, стабільне легальне джерело
blocked   — спроба була, джерело відмовило (403 / Turnstile)  → detectProviderBlock()
disabled  — свідомо вимкнено, спроби не робимо               → DisabledProvider
```

`active` ≠ «реалізований адаптер». `active` = «дає валідні listings зі стабільного легального джерела». Vivat → `active`. Yakaboo, BookYe → `blocked` або `disabled`, доки немає легального джерела.

---

## 3. Трек Yakaboo

**Ціль:** знайти стабільне легальне джерело замість заблокованого scrape. **Не** включати Yakaboo як active provider у MVP, доки джерела немає.

### 3.1 Кроки дослідження (research spike)
1. **Офіційний API.** Перевірити наявність публічного/документованого API Yakaboo (developer portal, api-docs, відкриті endpoint'и).
2. **Marketplace / partner API.** Yakaboo — маркетплейс; перевірити партнерську/seller-програму, affiliate-API (напр. через мережі типу admitad/Salesdoor), B2B-інтеграції для прайс-фідів.
3. **Publisher integration.** Альтернативний шлях: брати дані не з Yakaboo, а від видавців/дистриб'юторів, чиї книги Yakaboo продає (тоді Yakaboo стає лише «де купити», а ціна — з іншого джерела). Оцінити, чи це взагалі в скоупі продукту.
4. **Feed/sitemap fallback.** Перевірити, чи доступний sitemap або product feed без anti-bot (як проміжний `FeedProvider`).

### 3.2 Лист-запит до Yakaboo (чернетка)
Підготувати офіційний запит на партнерський/API-доступ. Орієнтовний зміст:

> **Тема:** Запит на партнерський доступ до каталогу/API
>
> Доброго дня! Ми розробляємо сервіс **Knyhovo** — пошук паперових книг і порівняння цін між українськими книгарнями з wishlist та price-алертами. Ми скеровуємо покупців безпосередньо на сторінки книгарень-партнерів.
>
> Хочемо коректно і легально відображати асортимент та ціни Yakaboo. Чи є у вас:
> 1. офіційний або партнерський API для каталогу/цін;
> 2. product feed / прайс-лист (XML/CSV) для партнерів;
> 3. affiliate-програма з доступом до даних?
>
> Ми готові дотримуватись ваших умов щодо частоти запитів, атрибуції та посилань. Дякуємо!

*(Фіналізувати тон/реквізити перед відправкою; контакт — через partner/PR-канал Yakaboo.)*

### 3.3 Рішення для MVP
- Yakaboo **не active** у MVP.
- Поки немає джерела → `DisabledProvider` (тихо) або лишити `blocked` у scrape health для видимості проблеми.
- Перемикання на `ApiProvider`/`FeedProvider` — окремий тікет, коли джерело підтверджене.

---

## 4. Трек Книгарня Є (book-ye)

**Ціль:** знайти легальне машинно-читане джерело в обхід Cloudflare Turnstile **без** обходу самого Turnstile.

### 4.1 Кроки дослідження
1. **sitemap.xml.** Перевірити `/sitemap.xml` та вкладені sitemap'и — часто віддаються відкрито для SEO навіть за Cloudflare. Дають перелік URL товарів (без цін, але як індекс).
2. **Structured data (Schema.org).** Перевірити `JSON-LD` / microdata на product-сторінках (`Product`, `Offer`, `price`, `availability`, `isbn`). Якщо сторінка віддається без challenge для звичайного GET — це чисте легальне джерело.
3. **Product feed.** Google Merchant feed / Facebook catalog feed / партнерський XML — типові для e-commerce.
4. **Партнерські можливості.** Affiliate/партнерська програма Книгарні Є; прямий запит на доступ (аналогічний лист, як для Yakaboo).

### 4.2 Рішення для MVP
- Якщо знайдено легальне джерело (feed/sitemap+structured data/API) → реалізувати `FeedProvider` або `ApiProvider`, перевести в `active`.
- Якщо офіційного доступу немає → лишити **`disabled`/`blocked` у MVP**. Не обходимо Turnstile.

> Релевантна нотатка: Книгарня Є вже має Cloudflare JS challenge у scrape-шляху (PlaywrightHtmlFetcher має чекати на product-селектор, не `networkidle`). Це підтверджує, що каталог за challenge — тому пріоритет на feed/sitemap/structured data, а не на «докрутити» Playwright.

---

## 5. MVP-рішення (acceptance)

1. **Active providers only if stable and legal.**
   Провайдер потрапляє у `active` лише з підтвердженим стабільним легальним джерелом. На сьогодні це **тільки Vivat**.

2. **Blocked/disabled providers видимі внутрішньо у scrape health.**
   Заблоковані/вимкнені провайдери лишаються у `ProviderName` і фігурують у внутрішній звітності scrape run (`scrapeErrors` + `detectProviderBlock` → `blocked`; `DisabledProvider` → `disabled`). Це для операторів, не для кінцевих користувачів.

3. **Search API не показує провайдера без валідних listings.**
   Це вже виконується природно: persistence пропускає listings без ціни (`priceAmount` NOT NULL), а [search repository](../../packages/api/src/search/repository.ts) повертає лише канонічні книги з реальними listings; фільтрація/обчислення найнижчої ціни — у mapper/service. Провайдер без валідних listings **просто не з'являється у відповіді** search. Жодного «порожнього» чи «заблокованого» провайдера в публічному API.

   > Гарантія, яку треба зберегти при додаванні нових адаптерів: жоден `blocked`/`disabled` провайдер не повинен витікати у публічний search-вихід. Внутрішній scrape health і публічний search — **різні поверхні**.

---

## 6. Наступні кроки (не входять у цей док, окремі тікети)

- [ ] Research spike: Yakaboo API/partner/feed (розділ 3.1).
- [ ] Research spike: BookYe sitemap/structured data/feed (розділ 4.1).
- [ ] Відправити листи-запити (Yakaboo, BookYe).
- [ ] PRD/design на адаптери `ApiProvider` / `FeedProvider` / `DisabledProvider`, якщо джерело підтверджено.
- [ ] Рішення про `provider status` (`active`/`blocked`/`disabled`) як явну модель у scrape health.

> За правилом проєкту: **код під ці адаптери не пишеться до підтвердження відповідного PRD.** Цей док — research, не дозвіл на імплементацію.
