# Laboratory Provider PRD

> **Тип:** PRD (per-provider). **Статус:** Чорновик (2026-06-28, **складено після live-recon**).
> **Гілка:** `feat/laboratory-provider`.
>
> **Recon виконано (2026-06-28)** проти живого `laboratory.ua` — підтверджено:
> - **SSR без challenge.** `curl` повертає повний HTML (~210 KB), Cloudflare присутній лише як CDN
>   (`cf-cache-status: DYNAMIC`, **без** WAF / JS-challenge). robots.txt дозволяє sitemap і
>   продуктові сторінки (`/products/<slug>`); заборонено `/api/`, `*?`-параметри, cart/order/user.
> - **Discovery = sitemap продуктів.** `https://laboratory.ua/sitemap.xml` — `<sitemapindex>` із
>   sub-sitemap; `…/sitemap.xml/type-products` — **flat `<urlset>`** із **~6 271** `<loc>` товарів
>   (`/products/<slug>`), `changefreq: daily`, `lastmod` оновлюється щодня.
> - **Дані товару — ДВА JSON-LD-блоки** (унікально серед Tier A): `@type:Product`
>   (`offers` = `AggregateOffer`: `price`, `priceCurrency:UAH`, `availability`, `sku`, `mpn`, `url`)
>   **+** `@type:Book` (`isbn`, `author[]`, `bookFormat`, `numberOfPages`, `inLanguage`, `url`).
>   Парсер **зливає обидва блоки** в один `RawProviderListing`.
> - **ISBN-fallback підтверджено реально:** товар `abrykosy-donbasu` має **порожній `Book.isbn`**,
>   але `Product.sku = 9789664481080` — тож fallback `Book.isbn → Product.sku → Product.mpn`
>   обов'язковий, не теоретичний.
> - **Availability у живому каталозі:** `http://schema.org/InStock` та `http://schema.org/OutOfStock`.
>   `bookFormat` — `Hardcover` / `Paperback` (каталог paper-only на час recon).
>
> Підхід v1 (затверджено цим PRD): **sitemap-driven discovery + product-page JSON-LD (Product+Book)**,
> **без Playwright**, **без зміни архітектури/shared-контрактів**. Laboratory лягає у наявний
> `ScraperProvider` — **точний клон пайплайну BookChef**, з єдиною відмінністю: парсер читає й зливає
> **два** JSON-LD-блоки замість одного.
> **Стандарт:** [provider-implementation-guide.md](./provider-implementation-guide.md) (структура,
> contract, тести, acceptance — цей PRD його **не дублює**, а конкретизує під Laboratory).
> **Споріднені доки:** [bookstore-feasibility.md](../research/bookstore-feasibility.md) (Laboratory =
> Tier A #2, JSON-LD `Product`+`Book` з ISBN, daily sitemap, Low maintenance),
> [bookchef-provider.md](./bookchef-provider.md) (попередній sitemap-driven провайдер — еталон пайплайну).
>
> **Правило проєкту:** код під Laboratory **не пишеться** до підтвердження цього PRD.

---

## 1. TL;DR

- **Що:** `LaboratoryScraper implements ScraperProvider` зі slug `'laboratory'`, що **читає sitemap
  продуктів Laboratory**, фетчить сторінки товарів і повертає стабільний `RawProviderListing[]`.
- **Discovery:** flat product-sitemap (`…/sitemap.xml/type-products`, ~6 271 URL, daily `lastmod`) —
  стабільний. Конкретний URL sitemap **не є частиною контракту** й живе у `constants.ts` як деталь
  реалізації (`LABORATORY_PRODUCTS_SITEMAP_URL`).
- **Джерело даних:** **два JSON-LD-блоки** на сторінці товару — `@type:Product` (ціна/наявність/sku) +
  `@type:Book` (isbn/author/bookFormat). Парсер зливає їх у один listing. HTML-селектори — лише fallback.
- **Транспорт:** SSR без challenge → `FetchHtmlFetcher` (Cloudflare лише як CDN). **Без Playwright.**
- **Cap для v1:** провайдер-локальний default на кількість фетчів сторінок товару + наявний
  `options.maxPages` як override. **Без зміни shared `ScraperOptions`** (§2).
- **Slug:** `laboratory` (один токен; функції `laboratoryPriceToKopecks`, клас `LaboratoryScraper`).
- **Оцінка:** ~1 день (bookstore-feasibility Tier A #2, Low maintenance — ISBN прямо в JSON-LD,
  ідеальний кандидат для canonical matching).

---

## 2. Що будуємо (v1 scope)

- Клас `LaboratoryScraper implements ScraperProvider` (`name = 'laboratory'`), з DI `HtmlFetcher`
  (default `FetchHtmlFetcher`) — за патерном BookChef
  ([packages/scrapers/src/providers/bookchef/](../../packages/scrapers/src/providers/bookchef/)).
- **Sitemap-driven discovery:** fetch sitemap продуктів → парс у список URL товарів
  (`parseLaboratorySitemap(xml)`), dedupe по `<loc>`. Це **локальна Laboratory-функція**, не
  загальний sitemap-crawler (§3).
- **Per-product fetch:** для кожного URL (до cap) fetch сторінки товару → `parseLaboratoryListing(html)`
  → один `RawProviderListing`, **злитий із двох JSON-LD-блоків** (`@type:Product` + `@type:Book`).
  Network error / HTTP-помилка на товарі → `errors.push(...)`, продукт пропускається (не валить run).
- **Cap для v1 без зміни shared-контракту:** провайдер фетчить не більше `maxProducts` сторінок товару.
  Default — провайдер-локальна константа (конструктор-інжектована); `options.maxPages` трактується як
  override. **`ScraperOptions` не міняємо.**
- **JSON-LD-first** парсинг у чистих функціях (`parseLaboratorySitemap`, `parseLaboratoryListing`,
  `laboratoryPriceToKopecks`, `parseLaboratoryProduct` для single-product state).
- Мапінг сирих даних у `RawProviderListing` (усередині `laboratory.parser.ts`, **без окремого**
  `mapper.ts` — guide §1).
- Збір помилок у `errors[]` (ніколи не throw), повернення `ScraperResult`.
- Реєстрація slug у **всіх чотирьох** точках (§13) + DB Provider enum (окремий commit, §13).
- Тести (sitemap / listing-parser / product-state / scraper) на **real captured HTML+XML** фікстурах,
  coverage ≥ 80%.

---

## 3. Що НЕ будуємо у v1

- **Загальний sitemap/feed-crawler чи `FeedProvider`** — лише **локальна** Laboratory
  discovery-функція (`parseLaboratorySitemap`). Жодної спільної sitemap-абстракції в проєкті не вводимо
  (узагальнення BookChef+Laboratory — окремим PRD за потреби).
- **Інші sub-sitemap** Laboratory (`type-categories`, `type-authors`, `type-brands`, `type-blog`,
  `type-main`, `type-partners`) — поза скоупом; v1 використовує тільки `type-products`.
- **Sitemap-index traversal** — `LABORATORY_PRODUCTS_SITEMAP_URL` вказує **напряму** на
  `type-products` sub-sitemap; читати кореневий `<sitemapindex>` і резолвити sub-sitemap не потрібно.
- **`enrichDescriptions`** — `description` (присутній у `@type:Product`, але HTML-entity-encoded) у v1
  **не персистимо** — `description` лишається `null` (тривіальний future-add із того ж блоку).
- **Реєстрація single-product парсера** у `SINGLE_PRODUCT_PARSERS`
  ([packages/scrapers/src/providers/single-product.ts](../../packages/scrapers/src/providers/single-product.ts))
  — `parseLaboratoryProduct` існує як чиста функція й покривається тестами, але **не** під'єднується
  до refresh single-product-флоу у v1 (як у BookChef).
- **Playwright / будь-який обхід anti-bot** — Tier A на `FetchHtmlFetcher`.
- **Зміни архітектури чи shared-контрактів** (`ScraperProvider`, `ScraperOptions`,
  `RawProviderListing`, `Money`, …) — cap реалізуємо без правки `ScraperOptions` (§2).
- **Інші Tier A провайдери** (Старий Лев, КСД, Книголенд, Readeat) — окремими PRD/PR.

---

## 4. Джерело даних Laboratory

- **Транспорт:** plain `fetch` через `FetchHtmlFetcher`
  ([packages/scrapers/src/http/html-fetcher.ts](../../packages/scrapers/src/http/html-fetcher.ts)),
  обов'язковий `timeoutMs` (security.md). Cloudflare лише як CDN. SSR повертає реальний HTML без
  JS-challenge.
- **Discovery-джерело:** `…/sitemap.xml/type-products` — flat `<urlset>` із `<loc>` товарів
  (`/products/<slug>`), `lastmod`/`changefreq: daily`. **URL sitemap — деталь реалізації** у
  `constants.ts` (`LABORATORY_PRODUCTS_SITEMAP_URL`), не частина контракту. Той самий `FetchHtmlFetcher`
  (XML — це теж текст).
- **Дані товару:** два блоки `script[type="application/ld+json"]`:
  - `@type:Product` — `name`, `image`, `description`, `sku`, `mpn`, `brand.name`,
    `offers` (`@type:AggregateOffer`: `price`, `priceCurrency:UAH`, `availability`, `url`).
  - `@type:Book` — `name`, `image`, `isbn`, `author[]` (`Person.name`), `bookFormat`,
    `numberOfPages`, `inLanguage`, `publisher.name`, `url`.
- **Constants** (`constants.ts`): `LABORATORY_BASE_URL`, `LABORATORY_PRODUCTS_SITEMAP_URL`, селектор
  JSON-LD, `DEFAULT_MAX_PRODUCTS`, `isPaperBookType(bookFormat)`, `buildCoverUrl(image)`,
  provider-specific raw-інтерфейси JSON-LD. (URL товару беремо з `Book.url` / `offers.url`, тож
  окремий `buildProductUrl` не обов'язковий — як у BookChef лишаємо для симетрії, опційно.)

---

## 5. JSON-LD parsing strategy (two-block merge)

Пріоритет джерел (guide §2.4): **JSON-LD → HTML-селектори лише fallback.** Laboratory — JSON-LD-first.

**Алгоритм парсера сторінки товару** (`parseLaboratoryListing`, чиста функція, без мережі):

1. `cheerio.load(html)` → зібрати всі `script[type="application/ld+json"]`.
2. `JSON.parse` кожного блоку у `try/catch`; знайти блок `@type === 'Product'` **і** блок
   `@type === 'Book'` (обидва можуть бути у `@graph`/масиві).
3. **Злити** обидва блоки в один `RawProviderListing` (таблиця §5.1). `Product` дає
   ціну/наявність/sku; `Book` дає isbn/author/bookFormat/url. Відсутність `Book` — не помилка
   (price/title з `Product`); відсутність `Product` означає немає ціни/наявності.
4. Будь-яка помилка (malformed JSON, немає жодного потрібного блоку, відсутні `url`/`title`) →
   запис у `errors[]` + `listing: null`, **ніколи throw**.

**Алгоритм sitemap-парсера** (`parseLaboratorySitemap`, чиста функція, без мережі):

1. `cheerio.load(xml, { xml: true })` → зібрати всі `<loc>` з `<urlset>`.
2. dedupe у document order; повернути `{ urls: string[]; errors: string[] }`; порожній/невалідний XML
   або відсутність `<loc>` → `urls: []` + `errors[]`.

Публічні чисті функції:
- `parseLaboratorySitemap(xml: string): { urls: string[]; errors: string[] }`.
- `parseLaboratoryListing(html: string): { listing: RawProviderListing | null; errors: string[] }`.
- `laboratoryPriceToKopecks(value: unknown): number | null` (§7).
- `parseLaboratoryProduct(html: string): ParsedProductState` (single-product price/availability; тип з
  [single-product.ts](../../packages/scrapers/src/providers/single-product.ts)) — **не реєструється** у
  v1 (§3), але живе у парсері й покривається тестами.

### 5.1 Мапінг `RawProviderListing` ← JSON-LD (Product + Book)

| Поле listing | Джерело JSON-LD | Примітка |
|--------------|-----------------|----------|
| `provider` | — | константа `'laboratory'` |
| `title` | `Product.name` (fallback `Book.name`) | `trim`; відсутній → продукт пропущено + `errors[]` |
| `author` | `Book.author[].name` (fallback `Book.author`-рядок) | масив `{@type:Person,name}` → один рядок через `, `; відсутній → `null` |
| `price` | `Product.offers.price` + `priceCurrency` | рядок `"990"`/`"409"` → копійки через `laboratoryPriceToKopecks` (§7) |
| `availability` | `Product.offers.availability` | mapping §9 (значення = повний `http(s)://schema.org/…`) |
| `isbn` | `Book.isbn` (fallback `Product.sku`, далі `Product.mpn`) | через `normalizeIsbn()` (§8) — fallback **реальний** (`abrykosy-donbasu`) |
| `coverUrl` | `Product.image` (fallback `Book.image`) | через `buildCoverUrl()` (§10); відсутній → `null` |
| `url` | `Product.offers.url` (fallback `Book.url`) | ключ dedupe; відсутній → продукт пропущено + `errors[]` |
| `description` | — | у v1 завжди `null` (§3) |

---

## 6. Sitemap / catalog discovery strategy

- **v1 = sitemap-driven discovery** (як BookChef). Каталог Laboratory — SSR (на відміну від
  client-rendered BookChef), тож пагінація каталогу теоретично можлива; але flat product-sitemap
  (повний, daily-оновлюваний, ~6 271 URL) — **простіше, повніше й максимально перевикористовує щойно
  відпрацьований BookChef-пайплайн**. Тому обрано sitemap.
  1. fetch `LABORATORY_PRODUCTS_SITEMAP_URL` → `parseLaboratorySitemap(xml)` → масив URL товарів;
  2. dedupe URL; обрізати до `maxProducts` (cap, §2);
  3. для кожного URL — fetch сторінки товару → `parseLaboratoryListing(html)`.
- **Чому це не загальна архітектура:** `parseLaboratorySitemap` — **локальна** функція у
  `laboratory.parser.ts`, дзеркало `parseBookChefSitemap`. Узагальнення двох sitemap-провайдерів —
  окремим PRD.

---

## 7. Price parsing у копійках

Гроші — `Money { amount: <копійки, ціле>, currency: 'UAH' }`
([packages/shared/src/types/money.ts](../../packages/shared/src/types/money.ts)).

```ts
export function laboratoryPriceToKopecks(value: unknown): number | null {
  // null для 0 / негативних / нескінченних / нечислових
  // інакше Math.round(value * 100)
}
```

- Джерело — `Product.offers.price` (числовий рядок `"990"` / число) з `priceCurrency: 'UAH'`.
- `null` → listing з `price: null` (валідний; рахується у `skippedNoPrice`, guide §2.9) та
  `availability: 'out-of-stock'` (інваріант §9).
- Per-provider (як `bookChefPriceToKopecks`) — не виносимо у shared.

---

## 8. ISBN handling

- **Каскад:** `Book.isbn` → fallback `Product.sku` → fallback `Product.mpn`. Каскад **реальний**:
  `abrykosy-donbasu` має порожній `Book.isbn`, але валідний `Product.sku = 9789664481080`.
- Кожен кандидат проганяється через shared `normalizeIsbn()`
  ([packages/scrapers/src/canonical/isbn.ts](../../packages/scrapers/src/canonical/isbn.ts)):
  ISBN-10 → ISBN-13 + перевірка checksum; невалідний → `null`, переходимо до наступного кандидата.
- Усі кандидати відсутні/невалідні → `isbn: null` (доповниться під час canonical matching).

---

## 9. Availability mapping

`Availability = 'in-stock' | 'out-of-stock' | 'unknown'`
([packages/shared/src/types/provider.ts:16](../../packages/shared/src/types/provider.ts#L16)). Правила
guide §2.6:

| Умова | Результат |
|-------|-----------|
| Немає валідної ціни | `out-of-stock` (**інваріант**, перевага над усім) |
| `offers.availability` = `InStock` | `in-stock` |
| `offers.availability` = `OutOfStock` / `SoldOut` / `Discontinued` | `out-of-stock` |
| `offers.availability` = `PreOrder` | `in-stock` (політика Vivat/Yakaboo/BookChef) |
| Невизначено / нерозпізнано | `unknown` |

(Значення приходить як повний URL `http://schema.org/InStock` — нормалізувати до суфікса перед
порівнянням, як у BookChef. У живому каталозі спостережено `InStock`/`OutOfStock`; решта гілок —
захисні, покриваються unit-тестами через perturbed real markup.)

---

## 10. Cover extraction

- `buildCoverUrl(image)` у `constants.ts` резолвить: site-relative (`/files/...`), protocol-relative
  (`//cdn/..` → `https:`), absolute (pass-through). Дзеркало BookChef-хелпера.
- `image` у JSON-LD — рядок (Laboratory) або масив → перший валідний рядок.
- **Відсутній/нерядковий cover → `null`, і це ніколи не ламає listing** (поле опціональне, guide §2.8).

---

## 11. scrapeErrors

- `errors: string[]` **збираються**, **ніколи не кидаються** зі `scrape()` (guide §2.10).
- Network error на **sitemap** → `errors.push(...)`, повернути `ScraperResult` з порожнім `listings`.
- Fetch-помилка на **окремій сторінці товару** (network error **або** HTTP 404/410/інший не-2xx від
  битого/видаленого URL у sitemap) → `errors.push(...)`, товар пропускається, цикл **продовжується**.
- Malformed JSON-LD / немає потрібного блоку / missing `url`|`title` → запис у `errors[]`, продукт
  пропускається.
- `errors[]` повертається у `ScraperResult` і потрапляє у `scrapeErrors` summary
  ([packages/api/src/pipeline/run-scrape.ts](../../packages/api/src/pipeline/run-scrape.ts)).

---

## 12. Blocked provider behavior

- Класифікація через `detectProviderBlock(errors)`
  ([packages/scrapers/src/lib/blocked-status.ts](../../packages/scrapers/src/lib/blocked-status.ts))
  → `ProviderBlock` (`cloudflare` | `http-403`); HTML-детект —
  [packages/scrapers/src/http/blocked-page.ts](../../packages/scrapers/src/http/blocked-page.ts).
- **Tier A не має блокуватись.** Поява блоку = сигнал переглянути стратегію провайдера, а **не** привід
  обходити anti-bot. (Caveat bookstore-feasibility §6.5: «м'який CF» Laboratory може посилитись —
  закласти моніторинг, не bypass.)

---

## 13. Registration points

> `FETCHER_FACTORY` — exhaustive `Record<ProviderName, …>`, тож додавання slug у `ProviderName`
> **примусово ламає typecheck**, доки запис не доданий у фабрику. Аналогічно DB Provider enum-мапи.

| # | Точка | Файл | Що додати | Commit |
|---|-------|------|-----------|--------|
| 1 | `ProviderName` union | [packages/shared/src/types/provider.ts](../../packages/shared/src/types/provider.ts) | `\| 'laboratory'` | 5 |
| 2 | Barrel scrapers | [packages/scrapers/src/providers/index.ts](../../packages/scrapers/src/providers/index.ts) | `export { LaboratoryScraper } from './laboratory/index.js';` | 5 |
| 3 | Кореневий barrel | [packages/scrapers/src/index.ts](../../packages/scrapers/src/index.ts) | додати `LaboratoryScraper` у named-export | 5 |
| 4 | `FETCHER_FACTORY` | [packages/api/src/refresh/fetcher-registry.ts](../../packages/api/src/refresh/fetcher-registry.ts) | `laboratory: getFetchFetcher` (SSR без challenge) | 5 |
| 5 | DB `Provider` enum + slug-мапи + migration + persist-listing | `schema.prisma`, `prisma/migrations/`, persist-listing, exhaustive `Record<Provider, …>` мапи | `laboratory` enum + маппінги | 6 |

**Поза v1:** реєстрація у `SINGLE_PRODUCT_PARSERS` (single-product refresh) — не додаємо (§3).

---

## 14. Tests

Структура — за патерном BookChef (`providers/bookchef/__tests__/`). **Без мережі**, fetcher завжди
мокається, детермінізм (testing.md). Coverage нових модулів ≥ 80%.

**Фікстури:** `__fixtures__/` — **real captured** артефакти Laboratory (recon 2026-06-28),
верифіковані проти живого сайту:
- `sitemap-products.xml` — реальний (обрізаний) фрагмент `type-products` sitemap.
- `product-instock.html` — `/products/pro-vijnu` (InStock, isbn у `Book`, price 990, Hardcover).
- `product-outofstock.html` — `/products/abrykosy-donbasu` (OutOfStock, **порожній `Book.isbn`** →
  fallback `Product.sku`, price 350).
- `product-paperback.html` — `/products/krasyvi-divchata-tezh-pomyrayut` (InStock, isbn у `Book`,
  price 409, Paperback) — друга in-stock-варіація для author/format.

Synthetic/мінімальні JSON-LD блоки **не приймаються**; error-гілки, яких живий сайт не емітить
(malformed JSON, missing name/url, absent isbn), відтворюються **perturbed real markup** in-memory
або мінімальним inline-рядком — як у BookChef.

### Sitemap + listing parser — `laboratory.parser.test.ts`
- [ ] `laboratoryPriceToKopecks`: `"990"`/число → копійки; `null` для 0/негативних/нечислових.
- [ ] `parseLaboratorySitemap`: реальний XML → масив URL (dedupe); порожній/невалідний → `urls: []` + `errors[]`.
- [ ] `parseLaboratoryListing`: коректні `provider`, `title`, `author`, `price`, `url`, `availability`, `coverUrl`, `isbn` (in-stock + paperback fixtures).
- [ ] `isbn` ← `Product.sku` fallback (real `abrykosy-donbasu`); усі кандидати відсутні/невалідні → `isbn: null`.
- [ ] Null/відсутня price → `price: null`, availability `out-of-stock`.
- [ ] Malformed: немає Product/Book-блоку / невалідний JSON-LD → `listing: null` + error.
- [ ] Missing `url`/`title` → `listing: null` + запис у `errors[]`.
- [ ] Author: масив Person → `, `-join; рядок; відсутній → `null`.
- [ ] Cover: site-relative → absolute, protocol-relative → `https:`, absolute pass-through, відсутній → `null`.
- [ ] `isPaperBookType`: EBook/Audiobook → `false`; Hardcover/Paperback/порожній → `true`.

### Product-state — у тому ж файлі (як BookChef консолідує) або `laboratory.product-state.test.ts`
- [ ] `parseLaboratoryProduct`: price + availability зі сторінки товару (in-stock + out-of-stock).
- [ ] No-price → `{ price: null, availability: 'out-of-stock' }`.
- [ ] Missing/unparseable дані → `{ price: null, availability: 'unknown' }` (**non-throwing**).

### Scraper (mocked fetcher) — `laboratory.scraper.test.ts`
- [ ] Fetcher повертає sitemap для sitemap-URL і відповідну HTML для кожного product-URL.
- [ ] Combine listings; dedupe ідентичних URL.
- [ ] `maxProducts` cap дотримано (override через `options.maxPages`); `delayMs: 0` (без реального sleep).
- [ ] Network error на товарі → запис у `errors[]`, **не throw**, цикл продовжується.
- [ ] Network error на sitemap → порожній `listings`, error у `errors[]`, **не throw**.
- [ ] `ScraperResult` shape: `provider: 'laboratory'`, `listings[]`, `scrapedAt` (ISO), `errors[]`.

Blocked-page тести — **не потрібні** (Tier A без challenge); додаються лише якщо recon виявить challenge.

---

## 15. Acceptance criteria

- [ ] **Scraper tests pass** (parser + product-state + scraper).
- [ ] **API tests pass** — pipeline/persist не зламані новим slug `laboratory`.
- [ ] **`pnpm typecheck` + `pnpm build` + `pnpm test`** — зелені на всьому монорепо.
- [ ] Провайдер повертає **стабільний `RawProviderListing`** — усі обов'язкові поля (`provider`,
      `title`, `author`, `isbn`, `price`, `url`, `availability`) присутні й коректно типізовані.
- [ ] **Фікстури — real captured** артефакти Laboratory (фрагмент sitemap + сторінки товарів),
      верифіковані проти живого сайту; synthetic не приймаються.
- [ ] **Two-block merge** — listing коректно зливає `@type:Product` (ціна/наявність/sku) та
      `@type:Book` (isbn/author/format); ISBN-fallback `Book.isbn → Product.sku → Product.mpn`.
- [ ] **Discovery через sitemap продуктів**; cap `maxProducts` дотримано; `ScraperOptions` не змінено.
- [ ] **Стійкість до битих URL у sitemap** — HTTP 404/410 окремих товарів логуються у `scrapeErrors`,
      URL пропускається, цикл продовжується.
- [ ] **No anti-bot bypass** — блок → статус `BLOCKED`. **No Playwright** — `getFetchFetcher`.
- [ ] Slug зареєстровано у **всіх чотирьох** scraper-точках (§13) **+ DB Provider enum** (commit 6).
- [ ] Coverage нових модулів ≥ 80%.
- [ ] Conventional Commits, feature branch `feat/laboratory-provider`, зелений CI перед merge (git.md).

---

## 16. Файлова структура

Папка `packages/scrapers/src/providers/laboratory/` (slug-префікс на файлах парсера/скрапера):

| Файл | Призначення |
|------|-------------|
| `constants.ts` | `LABORATORY_BASE_URL`, `LABORATORY_PRODUCTS_SITEMAP_URL`, JSON-LD селектор, `DEFAULT_MAX_PRODUCTS`, `isPaperBookType`, `buildCoverUrl`, raw-інтерфейси JSON-LD (Product+Book). |
| `laboratory.parser.ts` | Чисті функції: `parseLaboratorySitemap`, `parseLaboratoryListing` (two-block merge), `laboratoryPriceToKopecks`, `parseLaboratoryProduct`, мапінг у `RawProviderListing`. |
| `laboratory.scraper.ts` | `LaboratoryScraper implements ScraperProvider` (sitemap → per-product fetch, cap, dedupe, збір помилок). |
| `index.ts` | Barrel-експорт скрапера + публічних парсер-функцій/типів. |
| `__tests__/laboratory.parser.test.ts` | Sitemap + listing + product-state + constants тести. |
| `__tests__/laboratory.scraper.test.ts` | Scraper-тести (mocked fetcher). |
| `__fixtures__/sitemap-products.xml`, `__fixtures__/*.html` | Real captured фікстури. |

---

## 17. Proposed commit message

```
docs(prd): add Laboratory provider PRD
```
