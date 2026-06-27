# BookChef Provider PRD

> **Тип:** PRD (per-provider). **Статус:** Чорновик (2026-06-27, **переглянуто після live-recon**).
> **Гілка:** `feat/bookchef-provider`.
>
> **⚠️ Правка після recon (2026-06-27).** Live-перевірка `bookchef.ua` спростувала вихідне
> припущення PRD (пагінація каталогу + JSON-LD на картках). Реальність:
> - **Каталог/категорійні сторінки client-rendered** (Livewire + Vue mode, `wire:snapshot`,
>   `isVueMode:true`): у SSR-HTML `products-count-value=0` і **жодної картки товару** — лише
>   підкатегорії. `FetchHtmlFetcher` не бачить товарів, пагінація `?page=N` нефункціональна.
> - JSON-LD каталогу = тільки `Organization`/`WebSite`/`BreadcrumbList`, **без `@type:Product`**.
> - **Сторінки товарів** — повний SSR з багатим JSON-LD `@type:Product` (`isbn`, `gtin13`,
>   `price`, `priceCurrency:UAH`, `availability`, `author[]`, `image`, `description`).
> - **Discovery → sitemap продуктів BookChef** (повний публічний sitemap товарів, дозволений
>   robots.txt; конкретний URL — деталь реалізації, не контракту). v1 = sitemap → fetch сторінки
>   товару → парс JSON-LD.
>
> Підхід v1 (затверджено): **варіант A** — sitemap-driven discovery + product-page JSON-LD,
> **без Playwright**, **без Livewire-endpoint**, **без загального sitemap-crawler/FeedProvider**
> (лише локальна BookChef discovery-функція). Реалізація лишається `ScraperProvider`.
> **Скоуп:** додавання першого Tier A scraper-провайдера **BookChef** за єдиним стандартом
> [provider-implementation-guide.md](./provider-implementation-guide.md). Архітектуру не змінюємо —
> BookChef лягає у наявний `ScraperProvider`.
> **Стандарт:** [provider-implementation-guide.md](./provider-implementation-guide.md) (структура,
> contract, тести, acceptance — цей PRD його **не дублює**, а конкретизує під BookChef).
> **Споріднені доки:** [bookstore-feasibility.md](../research/bookstore-feasibility.md) (ранжування,
> BookChef = Tier A #1), [provider-integration-strategy.md](../research/provider-integration-strategy.md)
> (типологія провайдерів і трек для blocked).
>
> **Правило проєкту:** код під BookChef **не пишеться** до підтвердження цього PRD.

---

## 1. TL;DR

- **Що:** `BookChefScraper implements ScraperProvider` зі slug `'bookchef'`, що **читає sitemap
  продуктів BookChef**, фетчить сторінки товарів і повертає стабільний `RawProviderListing[]`.
- **Discovery:** повний публічний sitemap продуктів BookChef — стабільний. Конкретний URL sitemap
  **не є частиною контракту** й визначається реалізацією провайдера (BookChef може перейменувати
  sitemap без зміни архітектури). Каталог client-rendered (Livewire/Vue), тож пагінація `?page=N`
  нефункціональна (див. правку recon).
- **Джерело даних:** **JSON-LD `@type:Product`** на **сторінках товарів** — найкраще structured-джерело
  серед Tier A (один блок дає `isbn` + `gtin13` + `price` + `priceCurrency:UAH` + `availability` +
  `author`). HTML-селектори — лише fallback.
- **Транспорт:** SSR без challenge → `FetchHtmlFetcher` (Cloudflare у BookChef лише як CDN).
  **Без Playwright. Без Livewire-endpoint.**
- **Cap для v1:** провайдер обмежує кількість фетчів сторінок товару (щоб не тягнути весь sitemap у
  тестах/ручних запусках) — через провайдер-локальний default + наявний `options.maxPages`
  (як cap на кількість товарів). **Без зміни shared `ScraperOptions`** (§2).
- **Slug:** `bookchef` (один токен; функції `bookChefPriceToKopecks`, клас `BookChefScraper`).
- **Оцінка:** ~1 день (bookstore-feasibility Tier A, low maintenance).

---

## 2. Що будуємо (v1 scope)

- Клас `BookChefScraper implements ScraperProvider` (`name = 'bookchef'`), з DI `HtmlFetcher`
  (default `FetchHtmlFetcher`) — за патерном Vivat
  ([packages/scrapers/src/providers/vivat/](../../packages/scrapers/src/providers/vivat/)).
- **Sitemap-driven discovery:** fetch sitemap продуктів → парс у список URL товарів
  (`parseBookChefSitemap(xml)`), dedupe по `listing.url`. Це **локальна BookChef-функція**, не
  загальний sitemap-crawler (§3).
- **Per-product fetch:** для кожного URL (до cap) fetch сторінки товару → `parseBookChefListing(html)`
  → один `RawProviderListing` з JSON-LD `@type:Product`. Network error на товарі → `errors.push(...)`,
  продукт пропускається (не валить run).
- **Cap для v1 без зміни shared-контракту:** провайдер фетчить не більше `maxProducts` сторінок
  товару. Default — провайдер-локальна константа (конструктор-інжектована, як `catalogUrl` у Vivat);
  наявний `options.maxPages` трактується як override цього cap. **`ScraperOptions` не міняємо**
  (архітектура/shared-контракти лишаються незмінні — обмеження PRD).
- **JSON-LD-first** парсинг у чистих функціях (`parseBookChefSitemap`, `parseBookChefListing`,
  `bookChefPriceToKopecks`, `parseBookChefProduct` для single-product state).
- Мапінг сирих даних у `RawProviderListing` (усередині `bookchef.parser.ts`, **без окремого**
  `mapper.ts` — guide §1).
- Збір помилок у `errors[]` (ніколи не throw), повернення `ScraperResult`.
- Реєстрація slug у **всіх чотирьох** точках (див. §13).
- Тести (sitemap / listing-parser / product-state / scraper) на **real captured HTML+XML**
  фікстурах, coverage ≥ 80%.

---

## 3. Що НЕ будуємо у v1

- **Загальний sitemap/feed-crawler чи `FeedProvider`** — будуємо **лише локальну** BookChef
  discovery-функцію (`parseBookChefSitemap`), що читає sitemap продуктів BookChef. Жодної
  спільної sitemap-утиліти/абстракції в проєкті не вводимо.
- **Livewire / AJAX-endpoint каталогу** (`/livewire/update`) — не реверсимо (крихко, internal,
  все одно без `isbn`/`gtin13`).
- **Інші sub-sitemap** BookChef (categories, authors, publishers, promotions, …) — поза скоупом;
  v1 використовує тільки sitemap продуктів.
- **`enrichDescriptions`** — окремий opt-in product-page-pass **не активуємо**. (Сторінка товару
  й так фетчиться для даних, але `description` у v1 не персистимо — `description` лишається `null`;
  тривіальний future-add із того ж JSON-LD.)
- **Реєстрація single-product парсера** у `SINGLE_PRODUCT_PARSERS`
  ([packages/scrapers/src/providers/single-product.ts](../../packages/scrapers/src/providers/single-product.ts))
  — `parseBookChefProduct` може існувати як чиста функція й покриватись тестами, але **не**
  під'єднується до refresh single-product-флоу у v1.
- **Playwright / будь-який обхід anti-bot** — Tier A на `FetchHtmlFetcher`.
- **Зміни архітектури чи shared-контрактів** (`ScraperProvider`, `ScraperOptions`,
  `RawProviderListing`, `Money`, …) — cap реалізуємо без правки `ScraperOptions` (§2).
- **Інші Tier A провайдери** (Лабораторія, Старий Лев, КСД, Книголенд, Readeat) — окремими PRD/PR.

---

## 4. Джерело даних BookChef

- **Транспорт:** plain `fetch` через `FetchHtmlFetcher`
  ([packages/scrapers/src/http/html-fetcher.ts](../../packages/scrapers/src/http/html-fetcher.ts)),
  обов'язковий `timeoutMs` (security.md). Cloudflare присутній лише як CDN. SSR повертає реальний
  HTML без JS-challenge **на сторінках товарів**; **каталог/категорії — client-rendered** (Livewire
  Vue), тож для discovery використовуємо sitemap, а не каталог (правка recon).
- **Discovery-джерело:** sitemap продуктів BookChef — flat `<urlset>` із `<loc>` товарів (повний
  sitemap товарів). **Конкретний URL sitemap не є частиною контракту** — він живе у `constants.ts`
  як деталь реалізації (`BOOKCHEF_PRODUCTS_SITEMAP_URL`) і може змінитись без правки архітектури/PRD.
  Той самий `FetchHtmlFetcher` (XML — це теж текст).
- **Дані товару:** JSON-LD `script[type="application/ld+json"]` → блок `@type:Product` на сторінці
  товару (підтверджено recon: `name`, `description`, `image`, `sku`, `isbn`, `gtin13`, `brand`,
  `author[]`, `offers{price, priceCurrency, availability, url}`).
- **Constants** (`constants.ts`): `BOOKCHEF_BASE_URL`, `BOOKCHEF_PRODUCTS_SITEMAP_URL`, селектор
  JSON-LD (`script[type="application/ld+json"]`), `isPaperBookType(...)`, `buildCoverUrl(image)`,
  default cap (`DEFAULT_MAX_PRODUCTS`), provider-specific інтерфейси сирих даних. (URL товару
  беремо напряму з sitemap / `offers.url`, тож окремий `buildProductUrl` не обов'язковий.)
- **Recon виконано (2026-06-27):** base/sitemap URL, форма JSON-LD `@type:Product` і відсутність
  товарів у SSR-каталозі підтверджені проти живого сайту; фікстури знімаються з реальних
  відповідей (§14–15). **Recon-айтем на час імплементації:** сигнал paper-vs-non-paper на сторінці
  товару (`isPaperBookType`) — формат/категорія у JSON-LD або HTML; sitemap містить і не-книжки
  (merch). Поки сигнал не підтверджено — фільтр консервативний (напр. наявність `isbn`/`gtin13`).

---

## 5. JSON-LD parsing strategy

Пріоритет джерел (стабільність спадає згори вниз, guide §2.4):

1. **JSON-LD** `@type:Product` (за потреби `@type:Book`) — **основне** джерело BookChef.
2. Embedded JSON — у BookChef не потрібне.
3. **HTML-селектори** — лише fallback, якщо JSON-LD відсутній (крихко; уникати).

**Алгоритм парсера сторінки товару** (`parseBookChefListing`, чиста функція, без мережі):

1. `cheerio.load(html)` → знайти всі `script[type="application/ld+json"]`.
2. `JSON.parse` кожного блоку у `try/catch`; вибрати блок із `@type === 'Product'` (та вкладений `offers`).
3. Мапінг у **один** `RawProviderListing` (таблиця нижче).
4. Будь-яка помилка (malformed JSON, немає Product-блоку, відсутні `url`/`title`) → запис у
   `errors[]` + `listing: null`, **ніколи throw**.

**Алгоритм sitemap-парсера** (`parseBookChefSitemap`, чиста функція, без мережі):

1. Дістати всі `<loc>…</loc>` з `<urlset>` (regex або cheerio-xml).
2. Повернути `{ urls: string[]; errors: string[] }`; порожній/невалідний XML → `errors[]`, `urls: []`.

Публічні чисті функції:
- `parseBookChefSitemap(xml: string): { urls: string[]; errors: string[] }` — discovery з sitemap.
- `parseBookChefListing(html: string): { listing: RawProviderListing | null; errors: string[] }`
  — один товар → listing з JSON-LD `@type:Product`.
- `bookChefPriceToKopecks(value: unknown): number | null` (§7).
- `parseBookChefProduct(html: string): ParsedProductState` (single-product price/availability; тип з
  [single-product.ts](../../packages/scrapers/src/providers/single-product.ts)) — **не реєструється** у
  v1 (§3), але живе у парсері й покривається тестами (guide §1).

### Мапінг `RawProviderListing` ← JSON-LD `@type:Product`

| Поле listing | Джерело JSON-LD | Примітка |
|--------------|-----------------|----------|
| `provider` | — | константа `'bookchef'` |
| `title` | `name` | `trim`; відсутній → продукт пропущено + `errors[]` |
| `author` | `author[].name` (fallback `brand.name`) | масив об'єктів `{@type:Person,name}` / рядок → один рядок або `null` |
| `price` | `offers.price` + `offers.priceCurrency` | рядок `"320.00"` → копійки через `bookChefPriceToKopecks` (§7) |
| `availability` | `offers.availability` | mapping §9 (значення = повний `https://schema.org/…` URL) |
| `isbn` | `isbn` (fallback `gtin13`) | через `normalizeIsbn()` (§8) |
| `coverUrl` | `image` | через `buildCoverUrl()` (§10); відсутній → `null` |
| `url` | `offers.url` (fallback URL із sitemap) | ключ dedupe; відсутній → продукт пропущено + `errors[]` |
| `description` | — | у v1 завжди `null` (§3) |

---

## 6. Sitemap / catalog discovery strategy

- **v1 = sitemap-driven discovery.** Каталог client-rendered (Livewire Vue) → пагінація `?page=N`
  нефункціональна з `FetchHtmlFetcher` (recon). Замість неї:
  1. fetch `BOOKCHEF_PRODUCTS_SITEMAP_URL` → `parseBookChefSitemap(xml)` → масив URL товарів;
  2. dedupe URL; обрізати до `maxProducts` (cap, §2);
  3. для кожного URL — fetch сторінки товару → `parseBookChefListing(html)`.
- **Чому це не загальна архітектура:** `parseBookChefSitemap` — **локальна** функція BookChef у
  `bookchef.parser.ts`. Жодної спільної sitemap-абстракції / `FeedProvider` не вводимо (§3). Якщо
  згодом кілька провайдерів захочуть sitemap-discovery — узагальнення піде окремим PRD.
- **Інші sub-sitemap** (categories/authors/publishers/promotions) — поза скоупом v1.

---

## 7. Price parsing у копійках

Гроші — `Money { amount: <копійки, ціле>, currency: 'UAH' }`
([packages/shared/src/types/money.ts](../../packages/shared/src/types/money.ts)).

```ts
export function bookChefPriceToKopecks(value: unknown): number | null {
  // null для 0 / негативних / нескінченних / нечислових
  // інакше Math.round(value * 100)
}
```

- Джерело — `offers.price` (число або числовий рядок у JSON-LD) з `priceCurrency: 'UAH'`.
- `null` → listing з `price: null` (валідний; рахується у `skippedNoPrice`, guide §2.9) та
  `availability: 'out-of-stock'` (інваріант §10).
- Per-provider (як `vivatPriceToKopecks`) — не виносимо у shared, бо формат ціни різний між провайдерами.

---

## 8. ISBN / gtin13 handling

- Джерело: `isbn` з JSON-LD; **fallback на `gtin13`**, якщо `isbn` відсутній/невалідний.
- Обидва проганяються через shared `normalizeIsbn()`
  ([packages/scrapers/src/canonical/isbn.ts](../../packages/scrapers/src/canonical/isbn.ts)):
  ISBN-10 → ISBN-13 + перевірка checksum; невалідний → `null`.
- Обидва відсутні/невалідні → `isbn: null` (доповниться під час canonical matching).

---

## 9. Availability mapping

`Availability = 'in-stock' | 'out-of-stock' | 'unknown'`
([packages/shared/src/types/provider.ts:16](../../packages/shared/src/types/provider.ts#L16)). Правила
guide §2.6:

| Умова | Результат |
|-------|-----------|
| Немає валідної ціни | `out-of-stock` (**інваріант**, перевага над усім) |
| `offers.availability` = `InStock` | `in-stock` |
| `offers.availability` = `OutOfStock` / `SoldOut` | `out-of-stock` |
| `offers.availability` = `PreOrder` | `in-stock` (політика Vivat/Yakaboo) |
| Невизначено | `unknown` |

(Schema.org-значення можуть приходити як повний URL `https://schema.org/InStock` — нормалізувати до
суфікса перед порівнянням.)

---

## 10. Cover extraction

- `buildCoverUrl(image)` у `constants.ts` резолвить: site-relative (`/storage/a.jpg`),
  protocol-relative (`//cdn/..` → `https:`), absolute (pass-through).
- `image` у JSON-LD може бути рядком або масивом → брати перший валідний рядок.
- **Відсутній/нерядковий cover → `null`, і це ніколи не ламає listing** (поле опціональне, guide §2.8).

---

## 11. scrapeErrors

- `errors: string[]` **збираються**, **ніколи не кидаються** зі `scrape()` (guide §2.10).
- Network error на **sitemap** → `errors.push(...)`, повернути `ScraperResult` з порожнім
  `listings` (run не падає).
- Fetch-помилка на **окремій сторінці товару** (network error **або** HTTP 404/410/інший не-2xx
  від битого/видаленого URL у sitemap) → `errors.push(...)`, цей товар пропускається, цикл
  **продовжується** (на відміну від `break` у каталог-пагінації Vivat — тут товари незалежні).
  Див. acceptance §15.
- Malformed JSON-LD / немає Product-блоку / missing `url`|`title` → запис у `errors[]`, продукт пропускається.
- `errors[]` повертається у `ScraperResult` і потрапляє у `scrapeErrors` summary
  ([packages/api/src/pipeline/run-scrape.ts](../../packages/api/src/pipeline/run-scrape.ts)).

---

## 12. Blocked provider behavior

- Класифікація через `detectProviderBlock(errors)`
  ([packages/scrapers/src/lib/blocked-status.ts](../../packages/scrapers/src/lib/blocked-status.ts))
  → `ProviderBlock` (`cloudflare` | `http-403`); HTML-детект —
  [packages/scrapers/src/http/blocked-page.ts](../../packages/scrapers/src/http/blocked-page.ts).
- **Tier A не має блокуватись.** Поява блоку = сигнал переглянути стратегію провайдера (провести як
  `blocked`/`disabled`, трек переговорів — provider-integration-strategy §3–4), а **не** привід
  обходити anti-bot.

---

## 13. Registration points

> **Уточнення до guide §1 (там вказано три точки — фактично їх чотири).** `FETCHER_FACTORY` —
> exhaustive `Record<ProviderName, …>`, тож додавання slug у `ProviderName` **примусово ламає
> typecheck**, доки запис не доданий у фабрику. Це гарантує, що жодна точка не забута.

| # | Точка | Файл | Що додати |
|---|-------|------|-----------|
| 1 | `ProviderName` union | [packages/shared/src/types/provider.ts:9](../../packages/shared/src/types/provider.ts#L9) | `\| 'bookchef'` |
| 2 | Barrel scrapers | [packages/scrapers/src/providers/index.ts](../../packages/scrapers/src/providers/index.ts) | `export { BookChefScraper } from './bookchef/index.js';` |
| 3 | Кореневий barrel | [packages/scrapers/src/index.ts](../../packages/scrapers/src/index.ts) | додати `BookChefScraper` у named-export список |
| 4 | `FETCHER_FACTORY` | [packages/api/src/refresh/fetcher-registry.ts](../../packages/api/src/refresh/fetcher-registry.ts) | `bookchef: getFetchFetcher` (SSR без challenge) |

**Поза v1:** реєстрація у `SINGLE_PRODUCT_PARSERS` (single-product refresh) — не додаємо (§3).

---

## 14. Tests

Структура — за патерном `providers/vivat/__tests__/`. **Без мережі**, fetcher завжди мокається,
детермінізм (testing.md). Coverage нових модулів ≥ 80%.

**Фікстури:** `__fixtures__/` (на рівні провайдера, як у Vivat) — **real captured** артефакти
BookChef (recon 2026-06-27),
**верифіковані проти живого сайту**:
- `sitemap-products.xml` — реальний (за потреби обрізаний) фрагмент sitemap продуктів BookChef.
- `product-page.html` — сторінка товару in-stock з повним JSON-LD (напр. `na-vershynu-svitu`).
- `product-preorder.html` / `product-out-of-stock.html` — варіанти availability.
- `product-no-isbn.html` або edge-варіант для `gtin13`-fallback / non-paper.
Synthetic/мінімальні JSON-LD блоки у v1 **не приймаються** (acceptance §15).

### Sitemap + listing parser — `bookchef.parser.test.ts`
- [ ] `bookChefPriceToKopecks`: `"320.00"`/число → копійки; `null` для 0/негативних/нечислових.
- [ ] `parseBookChefSitemap`: реальний XML → масив URL; порожній/невалідний → `urls: []` + `errors[]`.
- [ ] `parseBookChefListing`: коректні `provider`, `title`, `author`, `price`, `url`, `availability`, `coverUrl`, `isbn`.
- [ ] `isbn` ← `gtin13` fallback; обидва відсутні/невалідні → `isbn: null`.
- [ ] Null/відсутня price → `price: null`, availability `out-of-stock`.
- [ ] Malformed: немає Product-блоку / невалідний JSON-LD → `listing: null` + error у `errors[]`.
- [ ] Missing `url`/`title` → `listing: null` + запис у `errors[]`.
- [ ] Cover: site-relative → absolute, protocol-relative → `https:`, absolute pass-through, відсутній → `null`.

### Product-state — `bookchef.product-state.test.ts`
- [ ] `parseBookChefProduct`: price + availability зі сторінки товару.
- [ ] No-price → `{ price: null, availability: 'out-of-stock' }`.
- [ ] Missing/unparseable дані → `{ price: null, availability: 'unknown' }` (**non-throwing**).

### Scraper (mocked fetcher) — `bookchef.scraper.test.ts`
- [ ] Fetcher повертає sitemap для sitemap-URL і відповідну HTML для кожного product-URL.
- [ ] Combine listings; dedupe ідентичних URL (sitemap може дублювати).
- [ ] `maxProducts` cap дотримано (override через `options.maxPages`); `delayMs: 0` (без реального sleep).
- [ ] Network error на товарі → запис у `errors[]`, **не throw**, цикл продовжується.
- [ ] Network error на sitemap → порожній `listings`, error у `errors[]`, **не throw**.
- [ ] `ScraperResult` shape: `provider: 'bookchef'`, `listings[]`, `scrapedAt` (ISO), `errors[]`.

Blocked-page тести — **не потрібні** (Tier A без challenge); додаються лише якщо recon виявить challenge.

---

## 15. Acceptance criteria

- [ ] **Scraper tests pass** (parser + product-state + scraper).
- [ ] **API tests pass** — pipeline/persist не зламані новим slug `bookchef`.
- [ ] **`pnpm build` pass** (typecheck + build усього монорепо; `FETCHER_FACTORY` оновлено).
- [ ] Провайдер повертає **стабільний `RawProviderListing`** — усі обов'язкові поля (`provider`,
      `title`, `author`, `isbn`, `price`, `url`, `availability`) присутні й коректно типізовані.
- [ ] **Фікстури — real captured** артефакти BookChef (фрагмент sitemap продуктів + сторінки
      товарів), верифіковані проти живого сайту; synthetic не приймаються.
- [ ] **Discovery через sitemap продуктів** (а не каталог-пагінацію); cap `maxProducts`
      дотримано; `ScraperOptions` не змінено.
- [ ] **Стійкість до битих URL у sitemap.** Якщо sitemap містить биті/видалені/тимчасово недоступні
      product URL, scrape **не падає**: HTTP 404/410 (та інші помилки) окремих товарів логуються у
      `scrapeErrors`, такий URL пропускається, а цикл продовжується для решти товарів.
- [ ] **No anti-bot bypass** — жодного обходу challenge; блок → статус `BLOCKED`.
- [ ] **No Playwright** — `bookchef` на `FetchHtmlFetcher` (`getFetchFetcher`).
- [ ] **Scrape summary читабельний** — `Status: OK`, `Scraped > 0`, зрозумілі `scrapeErrors`.
- [ ] Slug зареєстровано у **всіх чотирьох** точках (§13).
- [ ] Coverage нових модулів ≥ 80%.
- [ ] Conventional Commit, feature branch `feat/bookchef-provider`, зелений CI перед merge (git.md).

---

## 16. Файлова структура

Папка `packages/scrapers/src/providers/bookchef/` (slug-префікс на файлах парсера/скрапера, guide §1):

| Файл | Призначення |
|------|-------------|
| `constants.ts` | `BOOKCHEF_BASE_URL`, `BOOKCHEF_PRODUCTS_SITEMAP_URL`, JSON-LD селектор, `DEFAULT_MAX_PRODUCTS`, `isPaperBookType`, `buildCoverUrl`, raw-інтерфейси JSON-LD. |
| `bookchef.parser.ts` | Чисті функції: `parseBookChefSitemap`, `parseBookChefListing`, `bookChefPriceToKopecks`, `parseBookChefProduct`, мапінг у `RawProviderListing`. |
| `bookchef.scraper.ts` | `BookChefScraper implements ScraperProvider` (sitemap → per-product fetch, cap, dedupe, збір помилок). |
| `index.ts` | Barrel-експорт скрапера + публічних парсер-функцій/типів. |
| `__tests__/bookchef.parser.test.ts` | Sitemap + listing parser тести. |
| `__tests__/bookchef.product-state.test.ts` | Product-state тести. |
| `__tests__/bookchef.scraper.test.ts` | Scraper-тести (mocked fetcher). |
| `__fixtures__/sitemap-products.xml`, `__fixtures__/*.html` | Real captured фікстури (sitemap + сторінки товарів). |

---

## 17. Proposed commit message

```
docs(prd): revise BookChef discovery to sitemap after live recon
```
