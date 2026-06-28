# КСД (BookClub) — GraphQL API Recon

> **Тип:** research / recon. **Дата:** 2026-06-28. **Ціль:** `https://prod-api.ksd.ua/graphql`.
> **Питання дослідження:** чи можна реалізувати КСД як **перший API-provider** через GraphQL **без HTML-парсингу**.
> **Короткий висновок:** **Так.** 🟢 Tier A API-provider. Discovery — `catalogProducts(format:paper)`; per-product дані — `productPage(slug)`. Slug провайдера — існуючий `book-club`.
> **Зв'язок:** `bookclub.ua` → 301 → `ksd.ua`; без Cloudflare/WAF; auth не потрібна; introspection увімкнено.

## 1. GraphQL schema / introspection

Introspection **повністю доступний** (підтверджено: `__schema`, `__type` повертають дані). Endpoint: `POST https://prod-api.ksd.ua/graphql`, `Content-Type: application/json`, тіло `{query, variables}`. CORS `*`, без cookies/токенів.

> Примітка: запит `__type(name:"НеіснуючийТип")` повертає `Internal server error` (а не `null`) — дрібний quirk сервера, на роботу не впливає.

### Ключові root-запити (Query)
| Запит | Повертає | Призначення |
|-------|----------|-------------|
| `productPage(slug)` | `ProductPageType` | Повна картка книги (з ISBN) — **основне джерело даних** |
| `catalogProducts(per_page,page,category_slug,author_slug,publishing_house_slug,series_slug,third_one_discounted_slug,format,sort)` | `ProductCardTypePagination` | Пагінований каталог — **основний discovery** |
| `searchProductsResult(per_page,page,category_id,format,search,sort)` | `ProductCardTypePagination` | Пошук — fallback/debug |
| `authorPage(slug)` | `AuthorPageType` | Сторінка автора |
| `seriesPage(slug)`, `publishingHousePage(slug)`, `catalogCategoryPage(slug)` | відповідні Page-типи | Довідники |

### ProductPageType (повна картка)
| Поле | Тип | Примітка |
|------|-----|----------|
| `id` | String! | внутрішній id |
| `name` | String! | назва (title) |
| `isbn` | String | повний ISBN; формат непослідовний (paper з дефісами `978-617-15-2007-3`, ebook без `9786171519435`) |
| `code` | String | артикул (sku/mpn) |
| `type` | ProductTypesEnum! | `paper`/`ebook`/`audio`/`other` |
| `cost` | Float | поточна ціна, грн |
| `crossed_out_cost` | Float | стара ціна (знижка), грн або null |
| `available` | Boolean! | у наявності |
| `in_stock` | Int | к-сть на складі; **null для ebook** |
| `pages` | Int | сторінок |
| `publishing_year` | Int | рік |
| `original_name` | String | оригінальна назва (для перекладів) |
| `translators` | String | перекладачі |
| `authors` | [AuthorType!]! | автори |
| `publishing_house` | PublishingHouseType | видавництво |
| `series` | SeriesType | серія |
| `categories` | [CategoryType!]! | категорії |
| `image` | ProductCoverImageType | обкладинка (багато розмірів) |
| `gallery` | [...] | галерея |
| `specifications` | [SpecificationType!]! | хар-ки: Мова, Обкладинка, Формат, Ілюстрації… |
| `e_version` / `paper_version` | RelatedProductVersionType | крос-лінк електронна↔паперова |
| `labels` | [LabelType!]! | мітки (EBOOK, esupport…) |
| `description`, `main_text` | String | опис |
| `rating`, `reviews_count` | Float/Int | відгуки |
| `coins_per_purchase`, `age_restrictions`, `weight`, `circulation`, `quantity_in_kit`, `release_date` | — | додаткові |

### ProductCardType (елемент листингу catalogProducts/search)
`id, slug!, name!, type!, available!, has_page!, image, cost, crossed_out_cost, authors, labels, rating, reviews_count`
**Бракує: `isbn`, `publishing_house`, `series`, `pages`, `specifications`** → для ISBN потрібен `productPage` enrichment.

### Допоміжні типи
| Тип | Поля |
|-----|------|
| `AuthorType` | `id, name!, surname, slug!, has_page, image` — **повне ім'я = `name + " " + surname`** |
| `AuthorPageType` | `id, name!, surname, main_text, image, h1, title, description, keywords, categories` |
| `PublishingHouseType` | `id, name!, slug!, has_page, image` |
| `SeriesType` | `id, name!, slug!, has_page, image` |
| `CategoryType` | `id, slug!, name!` |
| `ProductCoverImageType` | розміри `xs, small, small2, medium, medium2, m_small, m_medium, tiktok, *_x2` — кожен `[ImageUrlType!]` |
| `ImageUrlType` | `format: ImageFormatEnum!, url!` (url відносний → префікс `https://ksd.ua`) |
| `SpecificationType` | `name, values[]{name}` |
| `LabelType` | `id, name!, alias: LabelEnumType, text_color, background_color` |
| `RelatedProductVersionType` | `id, name, slug, type, available, cost` |
| `PaginationMeta` | `total, per_page, current_page, from, to, last_page, has_more_pages` |

### Enums
- `ProductTypesEnum`: `paper, ebook, audio, other`
- `BookFormatEnum` (фільтр): `paper, ebook, audio`
- `ProductSortingEnum`: `by_popularity, by_price_asc, by_price_desc, by_date_asc, by_date_desc`
- `LabelEnumType`: `ebook, esupport`
- `ImageFormatEnum`: `jpg, jpeg, png, gif, bmp, svg, webp`

## 2. productPage(slug) — перевірка на реальних товарах

| slug | type | isbn | cost / crossed | available / in_stock | author(name+surname) | publisher |
|------|------|------|----------------|----------------------|----------------------|-----------|
| `drakula` | paper | `978-617-15-2007-3` | 540 / 590 | true / 623 | Брем Стокер | КСД |
| `nesterpna-shistka-tristy` | paper | `978-617-15-1987-9` | 570 / — | true | Пенелопа Дуглас | — |
| `100-bazhan-...-tom-2` | paper | `978-617-8396-69-5` | 240 / — | false / 0 | Харо (Асо)* | Наша Ідея |
| `zaproshennia-e` | ebook | `9786171519435` | 235 / — | true / null | — | — |

**Стабільно доступні:** name, type, isbn, cost, available, authors, image, categories, specifications. **publisher/series** — присутні, але можуть бути null. **in_stock** — Int для paper, **null для ebook**. canonical URL у відповіді немає → будується як `https://ksd.ua/product/{slug}`.

### Імена авторів — питання вирішено
- `AuthorType` має окремі `name` **і `surname`**. Раніше «обрізані» значення ("Харо", "Ден") — це лише `name` без `surname`.
- Повне ім'я = `name + " " + surname` (підтверджено: "Брем Стокер", "Пенелопа Дуглас").
- `authorPage(slug)` дає ті самі `name`+`surname` — **окремий запит не потрібен**.
- **Висновок:** `authors[].name + surname` безпечно використовувати як автора. Для canonical matching: брати перший автор або join усіх.
- *Виняток: японські імена ("Асо Харо") можуть мати інверсований порядок name/surname — рідкісний edge case, прийняти як є для v1.

## 3. catalogProducts(...) — discovery

- Пагінація: `per_page` + `page` (offset-based, не cursor). **max `per_page` = 100** (>100 → validation error).
- `meta`: `total, last_page, current_page, from, to, has_more_pages` — весь каталог обходимо.
- **Покриття (підтверджено):** без фільтра `total = 5271` (точно = к-сть `/product/` у sitemap). `format:paper` → **4606**, `format:ebook` → **665**, `format:audio` → **0**. (4606+665 = 5271.)
- Фільтри: `category_slug`, `author_slug`, `publishing_house_slug`, `series_slug`, **`format`** (paper-only одразу), `sort`.
- Листинг **НЕ містить ISBN/publisher/series** → потрібен `productPage(slug)` enrichment на кожен товар.
- Весь paper-каталог: `catalogProducts(format:paper, per_page:100)` × ~47 сторінок → 4606 slug.

## 4. searchProductsResult(...)

- Повертає той самий `ProductCardTypePagination` (ProductCardType). Обов'язковий арг `search: String!`.
- Підтверджено: `search:"дракула"` → 4 результати, з `meta.total/last_page`.
- **Для scraping не потрібен** (catalogProducts повніший для обходу). Корисний як **fallback/debug** або для майбутньої фічі пошуку конкретної книги.

## 5. Discovery strategy — порівняння

| | A. Sitemap | B. GraphQL pagination |
|---|---|---|
| Джерело | `ksd.ua/sitemap.xml` (плоский, 7676 URL, 5271 `/product/`) | `catalogProducts` meta.total/last_page |
| Paper-only | ❌ не розрізняє paper/ebook | ✅ `format:paper` → 4606 |
| Запитів на discovery | 1 (весь файл) | ~47 (per_page 100) |
| Узгодженість з даними | окремий канал (HTML) | той самий API, що й дані |
| Свіжість | залежить від регенерації sitemap | live |

**Рекомендація:**
- **Primary discovery: GraphQL `catalogProducts(format:paper)`** — одразу paper-only, один транспорт (GraphQL) для всього flow, live.
- **Fallback: sitemap** — якщо API-обхід ламається; дає 5271 slug (з фільтрацією type на етапі productPage).
- Обидва дають однакове покриття (5271 total), тож вибір — про paper-фільтр і єдиний транспорт.

## 6. Paper-only filter

Проєкт агрегує тільки паперові книги українською.
- `ProductTypesEnum`: `paper, ebook, audio, other`. `BookFormatEnum`: `paper, ebook, audio`.
- **Надійне відсіювання: `catalogProducts(format:paper)`** на рівні discovery (серверний фільтр) + перестрахування `productPage.type === "paper"`.
- `audio` зараз = 0, але enum існує → фільтр захищає на майбутнє. `other` у каталог не потрапляє через format-фільтр.
- **Мова:** окремого top-level поля немає; мова в `specifications` → "Мова" ("українська"). Для v1 КСД — фактично весь каталог укр.; за потреби фільтрувати по specification "Мова".
- **bundles / non-book:** `quantity_in_kit` сигналізує комплект; окремого «non-book» типу немає. Format-фільтр `paper` + перевірка `type` достатні для v1.
- **Достатньо `type === "paper"`** на рівні картки + серверний `format:paper`. Додаткова перевірка categories не обов'язкова.

## 7. Rate limits / safety

- Заголовки на КОЖНІЙ відповіді: `X-RateLimit-Limit: 300`, `X-RateLimit-Remaining: N` (зменшується на 1/запит).
- **Немає** `Retry-After` / `X-RateLimit-Reset` у звичайній відповіді (з'являються лише на 429 — патерн Laravel `ThrottleRequests`).
- **Window:** найімовірніше **300 запитів/хвилину** (Laravel default `throttle:300,1`). До 429 навмисно не доводили (safety).
- **Рекомендований throttle v1:** ~2 req/s (`delayMs ≈ 400–500ms`) → ~120–150/хв, з великим запасом під ліміт 300/хв. На 429 — backoff + повага до `Retry-After`.
- **maxProducts v1:** обмежити (напр. 500–1000) для першого прогону; повний paper-каталог 4606 × 1 `productPage` ≈ 4606 запитів ≈ 30+ хв при безпечному throttle — прийнятно для фонового scrape з cap. (З alias-batch — значно швидше, див. §12.)
- **1 `productPage` на товар — безпечно** за умови throttle; це і є модель enrichment.

## 8. Architecture recommendation (мінімальна зміна)

**КСД лишається `ScraperProvider`** — без нового великого абстрактного шару.
- Додати `book-club` provider у `packages/scrapers/src/providers/book-club/`, що в методі `scrape()` повертає `RawProviderListing[]` як і всі інші.
- Замість HTML-fetch — інкапсулювати GraphQL-доступ у власний клієнт (напр. `KsdGraphqlClient` / `GraphqlFetcher`) усередині provider/http-шару пакета scrapers. **HTML-провайдери не чіпати.**
- **Контракт `RawProviderListing` не змінювати.**
- **Новий `ApiProvider` interface НЕ створювати зараз.** Поки API-провайдер один — це передчасна абстракція (YAGNI). Винести спільний `GraphqlFetcher`/`ApiProvider` у спільний шар варто **на другому** API-провайдері, коли проявиться реальний спільний патерн.
- Fetcher-ін'єкція через конструктор (як у решти) для тестування; production-default — GraphQL-клієнт із `fetch` + явним `timeout`.

## 9. Mapping → RawProviderListing

| RawProviderListing | GraphQL джерело | Трансформація |
|--------------------|-----------------|---------------|
| `provider` | — | константа `'book-club'` |
| `title` | `productPage.name` | trim |
| `author` | `authors[].name + " " + surname` | join авторів або перший; trim |
| `isbn` | `productPage.isbn` | `normalizeIsbn()` (shared) — прибрати дефіси/валідація |
| `price.amount` | `productPage.cost` | `Math.round(cost * 100)` (копійки); null якщо немає |
| `price.currency` | — | `'UAH'` (API завжди UAH) |
| `availability` | `available` (+`in_stock`) | true→`in-stock`, false→`out-of-stock`; інваріант: немає ціни → `out-of-stock` |
| `url` | `slug` | `https://ksd.ua/product/${slug}` |
| `coverUrl` | `image.small[].url` (jpg, fallback webp) | префікс `https://ksd.ua` |
| `description` | `productPage.description`/`main_text` | sanitize; v1 опційно (null) |
| publisher* | `publishing_house.name` | поза базовим контрактом — за потреби |
| categories* | `categories[].slug/name` | поза базовим контрактом |
| series* | `series.slug/name` | поза базовим контрактом |
| language* | `specifications` "Мова" | поза базовим контрактом |
| type paper/ebook | `productPage.type` | discovery вже фільтрує `paper`; перестрахування |

\* поля поза поточним `RawProviderListing` — використати лише якщо/коли контракт розшириться; **зараз контракт не міняємо**.

### Slug провайдера: `book-club` (не новий `ksd`)
Підтверджено в БД: `enum Provider { BOOK_CLUB @map("book-club") }` ([packages/api/prisma/schema.prisma:18](../../packages/api/prisma/schema.prisma#L18)) та в `ProviderName` ([packages/shared/src/types/provider.ts:9](../../packages/shared/src/types/provider.ts#L9)). КСД — це ребрендинг bookclub.ua (та сама компанія, Клуб Сімейного Дозвілля). **Використовувати існуючий `book-club`.** Новий slug `ksd` створив би дубль провайдера в БД — не робити.

## 10. Risks

| Ризик | Оцінка / мітигація |
|-------|--------------------|
| Неофіційний публічний GraphQL | Може змінитися без попередження → покрити fixture-тестами; моніторити introspection-діфи |
| Зміна схеми | Парсер стійкий до відсутніх полів (null-safe); алерт при падінні % успішних карток |
| Обрізані імена авторів | **Знято** — `name + surname` дає повне ім'я |
| Rate limit | 300/хв; throttle ~2 req/s + backoff на 429 |
| catalogProducts ≠ весь каталог | total 5271 точно = sitemap → покриття підтверджено; fallback sitemap |
| sitemap неповний | Використовується лише як fallback; primary — API total |
| paper/ebook cross-links | `productPage` ebook повертає `paper_version` (і навпаки) — не плутати; брати дані самого продукту, не пов'язаної версії |
| productPage віддає related електронну версію | `e_version`/`paper_version` — окремі поля, не основні дані; ігнорувати при мапінгу listing |
| ISBN формат непослідовний | `normalizeIsbn()` нормалізує дефіси |

## 11. Final recommendation

- **Tier A API-provider:** ✅ **Так.** Публічний GraphQL, без auth/WAF, чисті дані, серверний paper-фільтр, передбачуваний rate-limit.
- **Primary discovery:** `catalogProducts(format:paper, per_page:100)` (offset-пагінація). **Fallback:** sitemap.
- **Primary data source:** `productPage(slug)` (єдине джерело з ISBN).
- **Архітектура:** `ScraperProvider` + інкапсульований `GraphqlFetcher`; **без** нового `ApiProvider` абстрактного шару (відкласти до 2-го API-провайдера).
- **Slug:** існуючий `book-club`.
- **Писати PRD:** ✅ Так — `docs/prd/bookclub-provider.md` за патерном `laboratory-provider.md`.
- **Порядок реалізації:** ✅ Доцільно робити наступним після Knigoland — найнижчий ризик/зусилля з невпроваджених.

### Open questions перед кодом
1. Discovery primary: підтвердити API-пагінацію vs sitemap (рекомендовано API `format:paper`).
2. Автор: join усіх авторів чи лише перший у `RawProviderListing.author`?
3. maxProducts і throttle для v1 (рекомендовано cap ~500–1000, ~2 req/s).
4. Чи розширювати `RawProviderListing` під publisher/series/language зараз чи пізніше (рекомендовано — пізніше, окремим PRD).

## 12. Batch GraphQL

**Batch підтримується двома способами (обидва перевірено live):**
- **Aliases в одному query** — `{ a0:productPage(slug:"…"){…} a1:productPage(slug:"…"){…} … }`. Перевірено **50 aliases в одному запиті** → HTTP 200, усі 50 повернулись, без помилок складності. Ліміту complexity/depth не виявлено на 50.
- **JSON-array batch** — тіло `[{query},{query}]` → сервер повертає масив результатів (патерн Lighthouse batched queries).

**Ключове для rate-limit:** alias-batch з 30 `productPage` коштує **рівно 1** одиницю rate-limit (підтверджено: `X-RateLimit-Remaining` зменшився лише на 1 за весь batch). Тобто batching радикально економить ліміт.

**Рекомендована batch strategy:**
- Збирати slug пачками (напр. **30** на запит — безпечний баланс розмір відповіді/ризик) і слати alias-batch `productPage`.
- Весь paper-каталог 4606 / 30 ≈ **154 запити** (замість 4606 одиночних) → ~154 одиниці rate-limit ⇒ повний прогін вкладається навіть у одне хвилинне вікно (ліміт 300/хв) із запасом.
- Перевага aliases над JSON-array: простіша обробка (один `data`-об'єкт), частковий успіх (помилка одного alias не валить решту — повертається в `errors[]` з `path`).
- Тримати batch помірним (≤50), щоб відповідь не роздувалась і легше було ретраїти.

## 13. HTTP cache

`productPage` і `catalogProducts` (POST) повертають **`Cache-Control: no-cache, private`**. **Немає** `ETag`, `Last-Modified`, `Expires`. `If-None-Match` сервер **ігнорує** (повертає `HTTP 200`, не 304).

**Висновок:** HTTP-рівневого кешування / conditional requests **немає**. Incremental sync **не можна** будувати на ETag/If-Modified-Since.
**Incremental на майбутнє (поза HTTP):** використовувати `ProductSortingEnum: by_date_desc` у `catalogProducts` для виявлення нових/змінених позицій зверху списку, або порівнювати локальний знімок (за `code`/`isbn`/`cost`/`available`) між прогонами. Для v1 — повний re-scrape з cap.

## 14. Альтернативні / batch queries в схемі

За introspection кореневого `Query` **немає** запитів для масового/прямого вибору:
- `product(isbn)` → "Cannot query field \"product\"" ❌
- `products(ids)` / `products(slugs)` → "Cannot query field \"products\"" ❌
- `productBySlug(slug)` → не існує ❌
- `product(code)` → не існує ❌

Єдиний шлях до повної картки — **`productPage(slug)`** (по одному slug). Споріднені: `productBranchStocks`, `productReviews`, `viewedProducts`, `productCarousels` — не дають повної картки.
**Тому N productPage неминучі — але alias-batch (§12) робить їх дешевими** (30-50 за 1 HTTP-запит = 1 rate-limit одиниця).

---

## Final implementation notes

- **Batch можливий?** ✅ **Так.** Aliases (перевірено 50/запит) і JSON-array. Alias-batch з 30 productPage = **1** rate-limit одиниця. Рекомендація: alias-batch по ~30 slug.
- **Caching можливий?** ❌ **Ні** на HTTP-рівні (no-cache/private, без ETag/Last-Modified, If-None-Match ігнорується). Incremental sync — лише app-level (`by_date_desc` + дифи знімків), не зараз.
- **Потрібен productPage enrichment?** ✅ **Так** — листинг `catalogProducts` не має ISBN, а прямого `product(isbn)`/`products(slugs)` немає. Але **кращий шлях = alias-batch productPage** (не одиночні): ~154 запити на весь paper-каталог замість 4606.
- **Provider готовий до PRD без додаткового recon?** ✅ **Так.** Закрито: schema/типи, повнота полів, повні імена авторів (`name+surname`), discovery (`catalogProducts format:paper`, 4606), paper-фільтр, rate-limit, batch, відсутність кешу, відсутність alt-queries, slug (`book-club`). Відкриті питання — продуктові рішення для PRD (§ open questions), не recon. **Можна писати `docs/prd/bookclub-provider.md`.**

### Рекомендований scrape flow (для PRD)
1. `catalogProducts(format:paper, per_page:100, sort:by_date_desc)` → ітерувати `page` до `meta.last_page` → зібрати ~4606 slug (+ базові поля).
2. Розбити slug на пачки по ~30 → alias-batch `productPage` → повні картки з ISBN.
3. Мапити → `RawProviderListing` (§9). Throttle ~2 req/s, backoff на 429, cap `maxProducts` для v1.
4. Fallback discovery — sitemap, якщо API-обхід недоступний.

---

## Verification (команди для перепровірки)
```bash
# повний paper-каталог:
curl -s -X POST https://prod-api.ksd.ua/graphql -H 'Content-Type: application/json' \
  --data '{"query":"{catalogProducts(per_page:1,page:1,format:paper){meta{total last_page}}}"}'
# повна картка з ISBN + повне ім'я автора:
curl -s -X POST https://prod-api.ksd.ua/graphql -H 'Content-Type: application/json' \
  --data '{"query":"{productPage(slug:\"drakula\"){name isbn type cost crossed_out_cost available in_stock authors{name surname slug} publishing_house{name} specifications{name values{name}}}}"}'
# rate-limit headers:
curl -sI -X POST https://prod-api.ksd.ua/graphql -H 'Content-Type: application/json' --data '{"query":"{globalSettings{__typename}}"}' | grep -i ratelimit
# alias-batch (кілька productPage за 1 запит):
curl -s -X POST https://prod-api.ksd.ua/graphql -H 'Content-Type: application/json' \
  --data '{"query":"{a:productPage(slug:\"drakula\"){isbn} b:productPage(slug:\"zaproshennia\"){isbn}}"}'
# HTTP cache (очікувано no-cache/private, без ETag):
curl -sI -X POST https://prod-api.ksd.ua/graphql -H 'Content-Type: application/json' --data '{"query":"{globalSettings{__typename}}"}' | grep -iE 'cache-control|etag'
```
