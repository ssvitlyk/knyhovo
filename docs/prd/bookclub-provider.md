# BookClub (КСД) Provider PRD

> **Тип:** PRD (per-provider). **Статус:** Чорновик (2026-06-28, **складено після live-recon**).
> **Гілка:** `feat/bookclub-provider`.
>
> **Recon виконано** проти живого `https://prod-api.ksd.ua/graphql` — повний звіт у
> [docs/research/ksd-graphql-api.md](../research/ksd-graphql-api.md). Підтверджено:
> - **Публічний GraphQL API без auth/WAF.** `bookclub.ua` → 301 → `ksd.ua`; introspection увімкнено,
>   CORS `*`, без cookies/токенів. Це **перший API-provider** проєкту — реалізується **через GraphQL,
>   без жодного HTML-парсингу та без Playwright**.
> - **Discovery = `catalogProducts(format:paper, per_page:100)`** (offset-пагінація, `meta.last_page`,
>   `meta.has_more_pages`). Серверний фільтр `format:paper` дає рівно **4606** паперових позицій
>   (весь каталог 5271 = paper 4606 + ebook 665). Листинг (`ProductCardType`) дає `slug` + базові поля,
>   але **не містить ISBN/publisher** → потрібен enrichment через `productPage`.
> - **Per-product дані = `productPage(slug)`** (`ProductPageType`) — єдине джерело з `isbn`. Прямих
>   `product(isbn)`/`products(slugs)` у схемі **немає** (§14 recon), тож N `productPage` неминучі —
>   **але дешеві через alias-batching**.
> - **Alias-batching (перевірено live):** `{ p0:productPage(slug:"…"){…} p1:… }` — до 50 aliases в
>   одному запиті, **усі повертаються**; alias-batch із 30 `productPage` коштує **рівно 1** одиницю
>   rate-limit (`X-RateLimit-Remaining` -1 за весь batch). Частковий успіх: помилка одного alias →
>   `errors[].path:["pN"]`, решта в `data` живі. Неіснуючий slug → `data.pN: null` **без** error.
> - **Rate-limit:** `X-RateLimit-Limit: 300` (Laravel `throttle:300,1` → ~300 req/хв); `Retry-After`
>   з'являється лише на 429. Throttle v1 ~2 req/s + backoff на 429.
> - **ProductPageType — підтверджені поля** (real batch): `name`, `isbn` (формат непослідовний:
>   `978-617-15-2007-3` / `9786171713253`), `code`, `type` (`paper`/`ebook`/…), `cost`,
>   `crossed_out_cost`, `available` (Boolean!), `in_stock` (Int для paper, **null для ebook**),
>   `authors[]{name, surname, slug}`, `image.small[]{format, url}`. **`slug` у `ProductPageType` НЕ
>   існує** — canonical URL будується з того slug, який ми передали (`https://ksd.ua/product/{slug}`).
>
> Підхід v1 (затверджено цим PRD): **GraphQL discovery (`catalogProducts format:paper`) → alias-batch
> `productPage` enrichment → мапінг у `RawProviderListing`**, інкапсульований у **локальний GraphQL-клієнт**
> цього провайдера. **Без зміни архітектури/shared-контрактів.** КСД лягає у наявний `ScraperProvider`.
> **Стандарт:** [provider-implementation-guide.md](./provider-implementation-guide.md) (структура,
> contract, тести, acceptance — цей PRD його **не дублює**, а конкретизує під BookClub/GraphQL).
> **Споріднені доки:** [knigoland-provider.md](./knigoland-provider.md) (попередній провайдер; контраст:
> там HTML+JSON-LD, тут GraphQL).
>
> **Правило проєкту:** код під BookClub **не пишеться** до підтвердження цього PRD.

---

## 1. TL;DR

- **Що:** `BookClubScraper implements ScraperProvider` зі slug `'book-club'` (вже у `ProviderName` та DB
  enum — placeholder з MVP, **новий slug/enum/міграція НЕ потрібні**). Скрапер ходить у **GraphQL API**
  КСД і повертає стабільний `RawProviderListing[]` (лише паперові книги).
- **Транспорт:** **локальний GraphQL-клієнт** (`graphql-client.ts`) на native `fetch`, без сторонніх
  бібліотек, з DI через конструктор. **Не** використовує спільний `HtmlFetcher`/Playwright. **Новий
  `ApiProvider`-абстракт НЕ створюємо** (YAGNI — поки API-провайдер один; recon §8).
- **Discovery:** `catalogProducts(format:paper, per_page:100, page:N, sort:by_date_desc)` → ітерувати
  `page` поки `meta.has_more_pages` (і не досягнуто cap) → зібрати `slug`-и. **Fallback** (sitemap) —
  поза v1 (§3).
- **Enrichment:** slug-и пачками по ~**30** → **alias-batch** `productPage` → повні картки з ISBN.
- **Paper-фільтр:** серверний `format:paper` на discovery **+** перестрахування `productPage.type === 'paper'`
  (ebook/audio → тихий skip без error).
- **Throttle:** ~2 req/s (default `delayMs ≈ 500`) між запитами; backoff на HTTP 429 (повага до
  `Retry-After`) — **у клієнті**. `maxProducts` cap для v1.
- **Slug:** `book-club`; функції `bookClubPriceToKopecks`, клас `BookClubScraper`.
- **Оцінка:** ~1 день.

---

## 2. Що будуємо (v1 scope)

- **Локальний GraphQL-клієнт** `book-club/graphql-client.ts`:
  - інтерфейс `GraphqlClient { request(query, variables, timeoutMs): Promise<GraphqlResponse> }` (DI-seam);
  - default `HttpGraphqlClient` — `POST` на endpoint, `Content-Type: application/json`, тіло `{query,variables}`,
    обов'язковий `timeoutMs` через `AbortController` (security.md), `fetch`-impl інжектований для тестів;
  - 429-backoff усередині клієнта (до N ретраїв, повага до `Retry-After`; `sleep` інжектований →
    детерміновані тести);
  - повертає **повний** GraphQL-envelope `{ data, errors }` (потрібен для часткового успіху alias-batch).
- Клас `BookClubScraper implements ScraperProvider` (`name = 'book-club'`), з DI `GraphqlClient`
  (default `HttpGraphqlClient`) та конфіг-параметрами (`maxProducts`, `batchSize`).
- **GraphQL discovery:** fetch `catalogProducts(format:paper, …)` посторінково → `parseCatalogProducts`
  → slug-и + `meta`; стоп на `!has_more_pages`, досягненні cap або network error.
- **Alias-batch enrichment:** slug-и пачками `batchSize` → `buildProductPageBatchQuery(slugs)` →
  `client.request` → `parseProductPageBatch(response, slugs)` → `RawProviderListing[]`.
- Мапінг сирих GraphQL-даних у `RawProviderListing` (усередині `book-club.parser.ts`, **без окремого**
  `mapper.ts` — guide §1).
- `maxProducts` cap **без зміни shared-контракту**: `options.maxPages` трактується як override
  (як Knigoland/Laboratory). **`ScraperOptions` не міняємо.**
- Збір помилок у `errors[]` (ніколи не throw), повернення `ScraperResult`.
- Реєстрація slug у **двох** scraper-barrel-точках (§13).
- Тести (catalog-parser / batch-parser / price / mapping / scraper / graphql-client) на **real captured
  GraphQL** фікстурах (recon 2026-06-28), coverage ≥ 80%.

---

## 3. Що НЕ будуємо у v1

- **Спільний `ApiProvider` / `GraphqlFetcher`-абстракт у `packages/shared` чи `http/`** — клієнт
  **локальний** для провайдера. Узагальнення — на 2-му API-провайдері (recon §8, YAGNI).
- **Зміна `RawProviderListing` / `ScraperProvider` / `ScraperOptions` / `Money`** — контракти недоторкані.
- **Sitemap-fallback discovery** (`ksd.ua/sitemap.xml`) — описаний у recon як резерв, **не** реалізуємо
  у v1 (primary GraphQL-обхід достатній і повніший).
- **`searchProductsResult`** — не для scrape (recon §4); можливий future для пошуку конкретної книги.
- **`enrichDescriptions`** — `description` лишається `null` (тривіальний future-add; recon §9).
- **Поля поза контрактом** (`publisher`, `series`, `language`, `categories`) — не мапимо (recon §9);
  розширення `RawProviderListing` — окремим PRD.
- **JSON-array batch** (`[{query},…]`) — обрано **alias-batch** (простіший `data`-об'єкт + частковий
  успіх; recon §12). JSON-array не реалізуємо.
- **HTTP-кеш / incremental sync** — API віддає `no-cache/private` без ETag (recon §13); v1 = повний
  re-scrape з cap.
- **Реєстрація single-product парсера** у `SINGLE_PRODUCT_PARSERS` — **немає HTML single-product-флоу**
  для GraphQL-провайдера; `book-club` лишається **відсутнім** у мапі (як зараз — коментар у
  [single-product.ts](../../packages/scrapers/src/providers/single-product.ts)). `FETCHER_FACTORY`
  `book-club → getFetchFetcher` — також лишається як є (не використовується скрапером, бо клієнт власний).
- **Реєстрація у `run-scrape.ts`** — за прецедентом Laboratory/Knigoland (їх там немає) у скоуп цього PR
  **не входить**.
- **Playwright / HTML-парсинг будь-де** — провайдер чисто GraphQL.

---

## 4. Джерело даних BookClub (GraphQL)

- **Endpoint:** `POST https://prod-api.ksd.ua/graphql`, `Content-Type: application/json`,
  тіло `{query, variables}`. Без auth. **Base site URL** для canonical/cover: `https://ksd.ua`.
- **Discovery query** (`catalogProducts`):
  ```graphql
  {
    catalogProducts(per_page: 100, page: <N>, format: paper, sort: by_date_desc) {
      meta { total per_page current_page last_page has_more_pages }
      data { slug name type available cost authors { name surname } image { small { format url } } }
    }
  }
  ```
  (Для v1 з листингу беремо лише `slug` — повні дані тягнемо `productPage`; решта полів листингу —
  на майбутнє/діагностику.)
- **Enrichment query** (alias-batch `productPage`):
  ```graphql
  {
    p0: productPage(slug: "drakula") { ...Fields }
    p1: productPage(slug: "bukvar")  { ...Fields }
    …
  }
  ```
  де `Fields = { name isbn code type cost crossed_out_cost available in_stock authors { name surname } image { small { format url } } }`.
- **Constants** (`constants.ts`): `KSD_GRAPHQL_ENDPOINT`, `KSD_BASE_URL`, `DEFAULT_CATALOG_PER_PAGE` (100),
  `DEFAULT_BATCH_SIZE` (30), `DEFAULT_MAX_PRODUCTS` (cap для manual/test runs), `DEFAULT_TIMEOUT_MS`,
  `DEFAULT_DELAY_MS` (~500), `buildProductUrl(slug)`, `buildCoverUrl(image)`, білдери запитів
  (`buildCatalogProductsQuery(page, perPage)`, `buildProductPageBatchQuery(slugs)`), raw-інтерфейси
  GraphQL-типів (untrusted).

---

## 5. Parsing strategy (pure functions, no IO)

Усі парсер-функції — **чисті**, без мережі, ніколи не throw; помилки → `errors[]`.

- `bookClubPriceToKopecks(value: unknown): number | null` — `cost` (number/числовий рядок) → копійки
  `Math.round(value*100)`; `null` для 0/негативних/нескінченних/нечислових (§7).
- `parseCatalogProducts(response: GraphqlResponse): { slugs: string[]; meta: CatalogMeta | null; errors }`
  — з `data.catalogProducts.data[]` зібрати непорожні `slug` (dedupe у document order); прочитати
  `meta` (`has_more_pages`, `last_page`, …); врахувати top-level `errors[]`. Невалідна форма → `slugs:[]`
  + error.
- `parseProductPageBatch(response: GraphqlResponse, slugs: string[]): { listings: RawProviderListing[]; errors }`
  — для кожного `slugs[i]` читати `data["p"+i]`:
  - `null` без відповідного `errors[].path` → **тихий skip** (неіснуючий slug; не error);
  - присутній → `mapProductPage(raw, slug)`; `type !== 'paper'` → тихий skip;
  - top-level `errors[].path:["pN"]` → запис у `errors[]` (частковий успіх batch), цей alias пропускається.
- `mapProductPage(raw, slug)` (внутрішня) — будує `RawProviderListing` (§5.1).

### 5.1 Мапінг `RawProviderListing` ← `productPage`

| Поле listing | GraphQL джерело | Примітка |
|--------------|-----------------|----------|
| `provider` | — | константа `'book-club'` |
| `title` | `productPage.name` | `trim`; відсутній → alias пропущено + `errors[]` |
| `author` | `authors[].name + " " + surname` | повне ім'я на автора (recon §2.1); **join усіх** через `, `; відсутній → `null` |
| `isbn` | `productPage.isbn` | через `normalizeIsbn()` (дефіси/checksum, §8); невалідний → `null` |
| `price` | `productPage.cost` + UAH | через `bookClubPriceToKopecks` (§7); відсутній → `null` |
| `availability` | `available` (+ price-інваріант) | mapping §9 |
| `url` | переданий `slug` | `buildProductUrl(slug)` = `https://ksd.ua/product/${slug}` (ключ dedupe) |
| `coverUrl` | `image.small[]` | `buildCoverUrl` (§10); відсутній → `null` |
| `description` | — | у v1 завжди `null` (§3) |

> **Рішення (recon open-Q2):** `author` = **join усіх** авторів `"name surname"` через `, ` (узгоджено з
> Knigoland multi-author). Canonical matching за потреби візьме перший токен.

---

## 6. Discovery / batching strategy

1. **Discovery:** `page = 1..` fetch `catalogProducts(format:paper, per_page:DEFAULT_CATALOG_PER_PAGE, page)`;
   `parseCatalogProducts` → накопичувати slug-и (dedupe). Стоп, коли: `meta.has_more_pages === false`,
   зібрано ≥ `maxProducts` slug-ів, **або** network error на сторінці (push error + break — зберігаємо
   зібране). Throttle `delayMs` між сторінками.
2. **Cap:** `slugs = slugs.slice(0, maxProducts)`.
3. **Enrichment:** розбити slug-и на пачки по `batchSize` → для кожної: `buildProductPageBatchQuery` →
   `client.request` → `parseProductPageBatch(response, batchSlugs)` → push listings (dedupe по `url`).
   Network error на batch → push error, **continue** наступний batch. Throttle `delayMs` між batch-ами.
4. Повернути `ScraperResult { provider:'book-club', listings, scrapedAt, errors }`.

`maxProducts` default — провайдер-локальна константа (конструктор-інжектована); `options.maxPages`
override (як Knigoland). **`ScraperOptions` не змінюємо.** `batchSize` ≤ 50 (recon §12).

---

## 7. Price parsing у копійках

`Money { amount: <копійки, ціле>, currency: 'UAH' }`
([money.ts](../../packages/shared/src/types/money.ts)). API завжди UAH.

```ts
export function bookClubPriceToKopecks(value: unknown): number | null {
  // null для 0 / негативних / нескінченних / нечислових; інакше Math.round(value * 100)
}
```

`null` → listing з `price: null` (валідний; `skippedNoPrice`, guide §2.9) та `availability: 'out-of-stock'`
(інваріант §9). Per-provider — не у shared.

---

## 8. ISBN handling

- Джерело — `productPage.isbn` (один; листинг ISBN не дає). Формат непослідовний: paper з дефісами
  (`978-617-15-2007-3`), деякі без (`9786171713253`).
- Прогін через shared `normalizeIsbn()`
  ([canonical/isbn.ts](../../packages/scrapers/src/canonical/isbn.ts)): прибирає дефіси, ISBN-10→13 +
  checksum; невалідний/відсутній → `isbn: null` (доповниться під час canonical matching).
- Каскаду на `code` **немає** (recon: `code` = внутрішній артикул, не ISBN) — лише `isbn`.

---

## 9. Availability mapping

`Availability = 'in-stock' | 'out-of-stock' | 'unknown'`. Правила guide §2.6:

| Умова | Результат |
|-------|-----------|
| Немає валідної ціни | `out-of-stock` (**інваріант**, перевага над усім) |
| `available === true` | `in-stock` |
| `available === false` | `out-of-stock` |
| `available` не boolean (захисне) | `unknown` |

`available` — `Boolean!` (завжди присутній), тож гілка `unknown` — суто захисна (покривається perturbed-тестом).
`in_stock` (Int, null для ebook) **не** використовується для mapping — `available` авторитетний; ebook
відсіюється раніше paper-фільтром.

---

## 10. Cover extraction

- `buildCoverUrl(image)` у `constants.ts`: з `image.small[]` (масив `{format, url}`) обрати **перший
  не-`webp`** (jpg/jpeg/png), fallback — `webp`, fallback — перший наявний. URL site-relative
  (`/storage/...`) → префікс `KSD_BASE_URL` (`https://ksd.ua`); absolute → pass-through.
- **Відсутній/нерозпізнаний cover → `null`, ніколи не ламає listing** (поле опціональне, guide §2.8).

---

## 11. scrapeErrors

- `errors: string[]` **збираються**, **ніколи не кидаються** зі `scrape()` (guide §2.10).
- Network error на **catalog-сторінці** → push error + **break** discovery (зберігаємо вже зібрані slug-и).
- Network error на **batch** → push error, batch пропускається, цикл продовжується.
- **GraphQL top-level `errors[]`** (catalog або batch partial) → додаються у `errors[]` з контекстом alias/page.
- `productPage` alias `null` **без** matching `errors[].path` → **тихий skip** (неіснуючий slug — не error).
- Non-paper (`type !== 'paper'`) → **тихий skip без error** (очікувано для перестрахування).
- Malformed envelope / missing `name` → запис у `errors[]`, alias пропускається.
- `errors[]` → `ScraperResult` → `scrapeErrors` summary ([run-scrape.ts](../../packages/api/src/pipeline/run-scrape.ts)).

---

## 12. Blocked / rate-limit behavior

- **Tier A API без anti-bot** — `detectProviderBlock`/`classifyBlockedPage` (HTML-орієнтовані) тут **не
  застосовні**; блок-репортинг через них **не** робимо.
- **Rate-limit 429:** `HttpGraphqlClient` робить backoff (повага до `Retry-After`, до N ретраїв); якщо
  429 не зникає — фінальна помилка піднімається як network error на рівні scraper → push у `errors[]`.
- Throttle ~2 req/s (default `delayMs ≈ 500`) тримає прогін значно нижче ліміту 300/хв (alias-batch
  робить enrichment дешевим — recon §7, §12).

---

## 13. Registration points

> `book-club` **вже** є у `ProviderName`, Prisma `Provider` enum (`BOOK_CLUB @map("book-club")`),
> persist/мапер-таблицях та `FETCHER_FACTORY` (MVP-placeholder). Тому **DB-міграція, enum і persist —
> НЕ потрібні**. Лишаються лише **scraper-barrel** точки.

| # | Точка | Файл | Що додати |
|---|-------|------|-----------|
| 1 | `ProviderName` union | [provider.ts](../../packages/shared/src/types/provider.ts) | **вже є** `'book-club'` — без змін |
| 2 | Barrel scrapers | [providers/index.ts](../../packages/scrapers/src/providers/index.ts) | `export { BookClubScraper } from './book-club/index.js';` |
| 3 | Кореневий barrel | [scrapers/index.ts](../../packages/scrapers/src/index.ts) | додати `BookClubScraper` у named-export |
| 4 | `FETCHER_FACTORY` | [fetcher-registry.ts](../../packages/api/src/refresh/fetcher-registry.ts) | **вже є** `book-club` — без змін (скрапер не використовує) |
| 5 | DB `Provider` enum / persist / мапери | schema.prisma, persist-listing, mappers | **вже є** `BOOK_CLUB` — без змін, без міграції |

**Поза v1:** `SINGLE_PRODUCT_PARSERS` — `book-club` лишається відсутнім (немає HTML single-product-флоу).

---

## 14. Tests

Структура — за патерном попередніх провайдерів (`providers/*/__tests__/`). **Без мережі**, GraphQL-клієнт
завжди мокається, детермінізм (testing.md). Coverage нових модулів ≥ 80%.

**Фікстури:** `__fixtures__/` — **real captured GraphQL** відповіді (recon 2026-06-28,
`prod-api.ksd.ua/graphql`), **JSON, не HTML**:
- `catalog-page.json` — `catalogProducts(format:paper, page:1, per_page:5)` — 5 paper-slug-ів,
  `meta.has_more_pages:true`, `last_page:922`.
- `catalog-last-page.json` — `page:922` — 1 slug, `meta.has_more_pages:false` (стоп discovery).
- `product-batch.json` — alias-batch p0..p4: 3 paper (`drakula` isbn з дефісами, `bukvar`, `shchaslyvytsia`),
  1 ebook (`zaproshennia-e` — paper-фільтр), 1 `null` (неіснуючий slug — тихий skip без error).
- `product-batch-partial-error.json` — **perturbed real** (guide-санкціоновано): `data.p0` живий,
  `data.p1:null` + `errors:[{path:["p1"]}]` — гілка часткового успіху batch.

Synthetic-вигадані картки **не приймаються**; error-гілки, яких API не емітить (malformed envelope,
missing name, невалідний ISBN, non-boolean `available`), відтворюються **perturbed real** in-memory.

### GraphQL client — `book-club.graphql-client.test.ts`
- [ ] `request`: POST на endpoint, тіло `{query,variables}`, `Content-Type: application/json`; повертає
      `{data, errors}` (мок `fetch`).
- [ ] `timeoutMs` → `AbortController.abort` (мок повертає abort-помилку).
- [ ] non-2xx (не 429) → throw з HTTP-статусом.
- [ ] **429 backoff:** перший виклик 429 (+`Retry-After`), другий 200 → ретрай успішний; `sleep`
      інжектований (без реального очікування); вичерпання ретраїв → throw.

### Parser — `book-club.parser.test.ts`
- [ ] `bookClubPriceToKopecks`: `540`/`"540"` → 54000; `null` для 0/негативних/нечислових.
- [ ] `parseCatalogProducts`: real `catalog-page.json` → 5 slug-ів, `meta.has_more_pages:true`;
      `catalog-last-page.json` → 1 slug, `has_more_pages:false`; невалідна форма → `[]` + error.
- [ ] `parseProductPageBatch`: real `product-batch.json` → коректні `provider/title/author/price/url/
      availability/coverUrl/isbn` для 3 paper; ebook (`type:ebook`) **тихо** пропущено; `null`-alias
      тихо пропущено (без error).
- [ ] **ISBN:** з дефісами (`978-617-15-2007-3`) нормалізується; невалідний (perturbed) → `null`.
- [ ] **Author:** `name+surname` join усіх через `, `; порожні surname; відсутні автори → `null`.
- [ ] **Cover:** `small[]` → перший не-webp; лише webp → webp; site-relative → `https://ksd.ua/...`;
      відсутній → `null`.
- [ ] Null/відсутня price (perturbed) → `price:null`, availability `out-of-stock`.
- [ ] `available:false` (perturbed з OOS) → `out-of-stock`; non-boolean → `unknown`.
- [ ] **Partial error:** `product-batch-partial-error.json` → p0 у listings, p1 у `errors[]` (path).
- [ ] Missing `name` (perturbed) → alias пропущено + `errors[]`.

### Scraper (mocked client) — `book-club.scraper.test.ts`
- [ ] Клієнт повертає catalog-сторінки по `page`, потім batch-відповідь(і) для productPage-запитів.
- [ ] Discovery зупиняється на `has_more_pages:false`; slug-и злиті й дедуплікація.
- [ ] Alias-batching: slug-и > `batchSize` → кілька batch-запитів; усі listings злиті, dedupe по `url`.
- [ ] ebook у batch → відсіяно; `null`-alias → пропущено без error.
- [ ] `maxProducts` cap дотримано (override через `options.maxPages`); `delayMs:0` (без sleep).
- [ ] Network error на catalog-сторінці → push error, **break**, повернути зібране (не throw).
- [ ] Network error на batch → push error, наступні batch продовжуються (не throw).
- [ ] `ScraperResult` shape: `provider:'book-club'`, `listings[]`, `scrapedAt` (ISO), `errors[]`.

---

## 15. Acceptance criteria

- [ ] **Scraper tests pass** (graphql-client + parser + scraper).
- [ ] **API tests pass** — pipeline/persist не зламані (slug `book-club` вже існував).
- [ ] **`pnpm lint` + `pnpm typecheck` + `pnpm build` + `pnpm test`** — зелені на всьому монорепо.
- [ ] Провайдер повертає **стабільний `RawProviderListing`** — усі обов'язкові поля (`provider`,
      `title`, `author`, `isbn`, `price`, `url`, `availability`) присутні й коректно типізовані.
- [ ] **Фікстури — real captured GraphQL** відповіді (JSON, не HTML), верифіковані проти живого API;
      synthetic не приймаються.
- [ ] **GraphQL alias-batching працює** — slug-и > batchSize розбиваються на кілька batch-запитів;
      частковий успіх (`errors[].path`) обробляється, решта alias-ів живі.
- [ ] **Paper-фільтр** — серверний `format:paper` + перестрахування `type==='paper'`; ebook/audio тихо
      пропускаються.
- [ ] **HTML не використовується. Playwright не використовується.** Клієнт — чистий GraphQL на `fetch`.
- [ ] **`RawProviderListing` не змінено. `ScraperProvider`/`ScraperOptions` не змінено.** Новий
      `ApiProvider`-абстракт не створено; GraphQL-клієнт **локальний** для провайдера.
- [ ] `maxProducts` cap дотримано; backoff на 429 у клієнті; явний `timeoutMs` (security.md).
- [ ] Slug зареєстровано у **двох** scraper-barrel-точках (§13); DB enum/міграція **не** потрібні.
- [ ] Coverage нових модулів ≥ 80%.
- [ ] Conventional Commits, feature branch `feat/bookclub-provider`, зелений CI перед merge (git.md).

---

## 16. Файлова структура

Папка `packages/scrapers/src/providers/book-club/` (slug-префікс на файлах парсера/скрапера):

| Файл | Призначення |
|------|-------------|
| `graphql-client.ts` | `GraphqlClient` interface + `HttpGraphqlClient` (native `fetch`, `{query,variables}`, timeout, 429-backoff, повертає `{data,errors}`); типи `GraphqlResponse`, `GraphqlError`. |
| `constants.ts` | `KSD_GRAPHQL_ENDPOINT`, `KSD_BASE_URL`, `DEFAULT_CATALOG_PER_PAGE`, `DEFAULT_BATCH_SIZE`, `DEFAULT_MAX_PRODUCTS`, `DEFAULT_TIMEOUT_MS`, `DEFAULT_DELAY_MS`, `buildProductUrl`, `buildCoverUrl`, `buildCatalogProductsQuery`, `buildProductPageBatchQuery`, raw GraphQL-інтерфейси. |
| `book-club.parser.ts` | Чисті функції: `bookClubPriceToKopecks`, `parseCatalogProducts`, `parseProductPageBatch` (+ внутрішній `mapProductPage`), мапінг у `RawProviderListing`. |
| `book-club.scraper.ts` | `BookClubScraper implements ScraperProvider` (GraphQL discovery → alias-batch enrichment, cap, dedupe, throttle, paper-фільтр, збір помилок). |
| `index.ts` | Barrel-експорт скрапера + публічних парсер-функцій/типів + клієнт-типів. |
| `__tests__/book-club.graphql-client.test.ts` | Client-тести (mock `fetch`): POST-форма, timeout, 429-backoff. |
| `__tests__/book-club.parser.test.ts` | Catalog/batch/price/mapping/ISBN/cover/availability/partial-error тести. |
| `__tests__/book-club.scraper.test.ts` | Scraper-тести (mocked client): discovery, batching, cap, dedupe, помилки. |
| `__fixtures__/catalog-page.json`, `catalog-last-page.json`, `product-batch.json`, `product-batch-partial-error.json` | Real captured GraphQL фікстури. |

---

## 17. Proposed commit messages

```
docs(prd): add BookClub provider PRD
feat(scrapers): add BookClub GraphQL client
test(scrapers): add BookClub GraphQL fixtures
feat(scrapers): add BookClub parser
feat(scrapers): add BookClub scraper
feat(scrapers): register BookClub provider
```
