# Knigoland Provider PRD

> **Тип:** PRD (per-provider). **Статус:** Чорновик (2026-06-28, **складено після live-recon**).
> **Гілка:** `feat/knigoland-provider`.
>
> **Recon виконано (2026-06-28)** проти живого `knigoland.com.ua` — підтверджено:
> - **SSR без challenge.** `curl` повертає повний HTML (~600–760 KB на товар) з усіма JSON-LD-блоками.
>   Стек — **nginx + Next.js**, **жодного Cloudflare/WAF** (простіше за Laboratory, де CF присутній як
>   CDN). robots.txt дозволяє `/sitemaps/` і продуктові сторінки `/<slug>-item`; забороняє переважно
>   query-параметри (`*?sort=`, `*set_filter=`, …), `/personal/`, `/auth/`, `*/search/`.
> - **Discovery = sitemap-INDEX (traversal).** `robots.txt` оголошує
>   `https://knigoland.com.ua/sitemaps/sitemap.xml` — це `<urlset>` із під-sitemap (`<loc>` вказують на
>   `sitemaps/images/*`, `sitemaps/sections/*`). Продуктові — **`sections/catalog-products-1..5.xml`**
>   (по ~**10 000** `<loc>` кожен → ~**50 000** товарів), `changefreq: daily`, per-URL `lastmod`.
>   URL товару = `https://knigoland.com.ua/<slug>-item`. **Відмінність від Laboratory:** там constant
>   вказує напряму на flat product-sitemap; тут потрібен **обхід індексу** з фільтром під-sitemap.
> - **Дані товару — ДВА цільові JSON-LD-блоки + BreadcrumbList:** `@type:Product`
>   (`offers` = `@type:Offer`: `price` — **число** `200`, `priceCurrency:UAH`, `availability`, `url`;
>   `sku`, `mpn`, `brand.name`, `image[]`) **+** `@type:Book` (`isbn`, `author` = `Person.name`,
>   `inLanguage`, `publisher.name`, `image`, `offers`) **+** `@type:BreadcrumbList`. На сторінці також є
>   `LocalBusiness`, `WebSite`, `ImageObject` — **ігноруються**. Парсер **зливає** `Product` + `Book`.
> - **Немає `bookFormat`** (на відміну від Laboratory) → **paper/book-фільтр = наявність блоку
>   `@type:Book`** (перевірено на живому каталозі): кожна книга його має, а non-books
>   (подарунки/канцтовари/іграшки — «Канцтовари та ігри») мають лише `@type:Product`. **Breadcrumb-корінь
>   НЕ годиться як гейт** — він варіюється для легітимних книг (`Книги`, `Комікси та манга`,
>   `Навчальна література`, …), тож вимога «Книги» хибно відсіювала б цілі категорії. `BreadcrumbList`
>   читається лише довідково (не гейт). E-book-категорії на сайті немає (`/elektronni-knygy` → 404).
> - **ISBN-fallback** підтверджено в розмітці: `Book.isbn` присутній, але каскад
>   `Book.isbn → Product.sku → Product.mpn` лишаємо (sku/mpn = числовий товарний код, напр. `469152`).
> - **Availability у живому каталозі:** `https://schema.org/InStock` та `https://schema.org/OutOfStock`
>   (OOS-товари **зберігають ціну** — напр. `ҐАЛАПАҐОС`, price 250, OutOfStock).

>
> Підхід v1 (затверджено цим PRD): **sitemap-index-driven discovery + product-page JSON-LD
> (Product+Book merge) з breadcrumb-paper-фільтром**, **без Playwright**, **без зміни
> архітектури/shared-контрактів**. Knigoland лягає у наявний `ScraperProvider` — **клон пайплайну
> Laboratory**, з двома відмінностями: (1) discovery обходить sitemap-index, (2) paper-фільтр через
> breadcrumbs замість `bookFormat`.
> **Стандарт:** [provider-implementation-guide.md](./provider-implementation-guide.md) (структура,
> contract, тести, acceptance — цей PRD його **не дублює**, а конкретизує під Knigoland).
> **Споріднені доки:** [laboratory-provider.md](./laboratory-provider.md) (еталон пайплайну
> Product+Book), [nashformat-provider.md](./nashformat-provider.md) (Deferred/Blocked — контраст:
> Knigoland доступний без anti-bot).
>
> **Правило проєкту:** код під Knigoland **не пишеться** до підтвердження цього PRD.

---

## 1. TL;DR

- **Що:** `KnigolandScraper implements ScraperProvider` зі slug `'knigoland'`, що **обходить
  sitemap-index Knigoland**, фетчить продуктові sub-sitemap і сторінки товарів і повертає стабільний
  `RawProviderListing[]` (лише паперові книги).
- **Discovery:** sitemap-index (`/sitemaps/sitemap.xml`) → під-sitemap `sections/catalog-products-1..5.xml`
  (~50k URL, daily `lastmod`) → flat `<loc>` товарів `/<slug>-item`. URL індексу та патерн sub-sitemap —
  **деталь реалізації** у `constants.ts`, не частина контракту.
- **Джерело даних:** **два JSON-LD-блоки** на сторінці товару — `@type:Product` (ціна/наявність/sku) +
  `@type:Book` (isbn/author) — плюс `@type:BreadcrumbList` для paper-фільтра. Парсер зливає Product+Book
  у один listing. HTML-селектори — лише fallback.
- **Транспорт:** SSR без challenge → `FetchHtmlFetcher` (nginx + Next.js, без Cloudflare/WAF).
  **Без Playwright.**
- **Paper-фільтр:** немає `bookFormat` → паперова книга = присутній блок `@type:Book` (перевірений
  дискримінатор). Non-book (подарунки/канцтовари/іграшки) мають лише `@type:Product` → тихо
  пропускаються (не помилка). Breadcrumb-корінь не годиться як гейт (варіюється для книг).
- **Cap для v1:** провайдер-локальний default на кількість фетчів сторінок товару + наявний
  `options.maxPages` як override. **Без зміни shared `ScraperOptions`** (§2).
- **Slug:** `knigoland` (один токен; функції `knigolandPriceToKopecks`, клас `KnigolandScraper`).
- **Оцінка:** ~1 день (клон Laboratory; додаткова робота — index-traversal + breadcrumb-фільтр).

---

## 2. Що будуємо (v1 scope)

- Клас `KnigolandScraper implements ScraperProvider` (`name = 'knigoland'`), з DI `HtmlFetcher`
  (default `FetchHtmlFetcher`) — за патерном Laboratory
  ([packages/scrapers/src/providers/laboratory/](../../packages/scrapers/src/providers/laboratory/)).
- **Sitemap-index-driven discovery:** fetch index → `parseKnigolandSitemapIndex(xml)` (фільтр sub-sitemap
  під патерн `sections/catalog-products-N.xml`) → для кожного product-sub-sitemap fetch →
  `parseKnigolandSitemap(xml)` → список URL товарів, dedupe по `<loc>`. Це **локальні Knigoland-функції**,
  не загальний sitemap-crawler (§3).
- **Per-product fetch:** для кожного URL (до cap) fetch сторінки товару → `parseKnigolandListing(html)`
  → один `RawProviderListing`, **злитий із Product+Book** + paper-фільтр через наявність `@type:Book`.
  Network error / HTTP-помилка на товарі → `errors.push(...)`, продукт пропускається (не валить run).
- **Cap для v1 без зміни shared-контракту:** провайдер фетчить не більше `maxProducts` сторінок товару.
  Default — провайдер-локальна константа (конструктор-інжектована); `options.maxPages` трактується як
  override. **`ScraperOptions` не міняємо.**
- **JSON-LD-first** парсинг у чистих функціях (`parseKnigolandSitemapIndex`, `parseKnigolandSitemap`,
  `parseKnigolandListing`, `knigolandPriceToKopecks`, `parseKnigolandProduct`).
- Мапінг сирих даних у `RawProviderListing` (усередині `knigoland.parser.ts`, **без окремого**
  `mapper.ts` — guide §1).
- Збір помилок у `errors[]` (ніколи не throw), повернення `ScraperResult`.
- Реєстрація slug у **всіх чотирьох** scraper-точках (§13) + DB Provider enum (окремий commit, §13).
- Тести (sitemap-index / sitemap / listing-parser / product-state / scraper) на **real captured
  HTML+XML** фікстурах, coverage ≥ 80%.

---

## 3. Що НЕ будуємо у v1

- **Загальний sitemap/feed-crawler чи `FeedProvider`** — лише **локальні** Knigoland
  discovery-функції. Жодної спільної sitemap-абстракції в проєкті не вводимо (узагальнення
  BookChef+Laboratory+Knigoland — окремим PRD за потреби).
- **Інші sub-sitemap** Knigoland (`images/*`, `authors-items`, `blog-*`, `catalog-categories`,
  `pages`, `publishing-items`, `series-items`) — поза скоупом; v1 використовує лише
  `sections/catalog-products-1..5.xml`.
- **`enrichDescriptions`** — `description` (присутній у `Product`/`Book`) у v1 **не персистимо** —
  `description` лишається `null` (тривіальний future-add).
- **Реєстрація single-product парсера** у `SINGLE_PRODUCT_PARSERS`
  ([packages/scrapers/src/providers/single-product.ts](../../packages/scrapers/src/providers/single-product.ts))
  — `parseKnigolandProduct` існує як чиста функція й покривається тестами, але **не** під'єднується до
  refresh single-product-флоу у v1 (як у Laboratory/BookChef).
- **Playwright / будь-який обхід anti-bot** — Tier A на `FetchHtmlFetcher` (тут і не потрібен — CF немає).
- **Зміни архітектури чи shared-контрактів** (`ScraperProvider`, `ScraperOptions`,
  `RawProviderListing`, `Money`, …) — cap реалізуємо без правки `ScraperOptions` (§2).
- **Інші Tier A провайдери** — окремими PRD/PR.

---

## 4. Джерело даних Knigoland

- **Транспорт:** plain `fetch` через `FetchHtmlFetcher`
  ([packages/scrapers/src/http/html-fetcher.ts](../../packages/scrapers/src/http/html-fetcher.ts)),
  обов'язковий `timeoutMs` (security.md). nginx + Next.js, SSR повертає реальний HTML без JS-challenge,
  Cloudflare/WAF відсутній.
- **Discovery-джерело:**
  - **Index:** `https://knigoland.com.ua/sitemaps/sitemap.xml` — `<urlset>` із `<loc>` під-sitemap.
  - **Product sub-sitemaps:** `<loc>`, що збігаються з патерном `/sections/catalog-products-\d+\.xml$`
    (1..5), кожен — flat `<urlset>` із `<loc>` товарів (`/<slug>-item`).
  - **URL індексу та патерн — деталь реалізації** у `constants.ts` (`KNIGOLAND_SITEMAP_INDEX_URL`,
    `CATALOG_PRODUCTS_SITEMAP_PATTERN`), не частина контракту. Той самий `FetchHtmlFetcher` (XML — текст).
- **Дані товару:** блоки `script[type="application/ld+json"]` (на сторінці їх ~6; цільові — три):
  - `@type:Product` — `name`, `image` (масив), `description`, `sku`, `mpn`, `brand.name`,
    `offers` (`@type:Offer`: `price` число, `priceCurrency:UAH`, `availability`, `url`).
  - `@type:Book` — `name`, `image` (рядок), `isbn`, `author` (`Person.name`), `inLanguage`,
    `publisher.name`, `offers`.
  - `@type:BreadcrumbList` — присутній, але як paper-гейт **не використовується** (корінь варіюється:
    «Книги», «Комікси та манга», «Навчальна література», …); читається лише довідково (ігнорується у v1).
- **Constants** (`constants.ts`): `KNIGOLAND_BASE_URL`, `KNIGOLAND_SITEMAP_INDEX_URL`,
  `CATALOG_PRODUCTS_SITEMAP_PATTERN`, `JSON_LD_SELECTOR`, `DEFAULT_MAX_PRODUCTS`,
  `buildCoverUrl(image)`, provider-specific raw-інтерфейси JSON-LD. (URL товару беремо з
  `offers.url`/`Book.url`, тож окремий `buildProductUrl` опційний.)

---

## 5. JSON-LD parsing strategy (two-block merge + book-block filter)

Пріоритет джерел (guide §2.4): **JSON-LD → HTML-селектори лише fallback.** Knigoland — JSON-LD-first.

**Алгоритм парсера сторінки товару** (`parseKnigolandListing`, чиста функція, без мережі):

1. `cheerio.load(html)` → зібрати всі `script[type="application/ld+json"]`.
2. `JSON.parse` кожного блоку у `try/catch`; знайти `@type === 'Product'` та `@type === 'Book'`
   (кожен може бути у `@graph`/масиві).
3. **Paper-фільтр:** товар = паперова книга, якщо присутній блок `@type:Book` (перевірений
   дискримінатор). Якщо `Product` є, а `Book` немає (non-book: подарунки/канцтовари/іграшки) →
   `{ listing: null, errors: [] }` (**тихий пропуск**, не помилка — каталог змішаний). Breadcrumb-корінь
   як гейт **не використовується** (варіюється для книг — §4).
4. **Злити** `Product` + `Book` в один `RawProviderListing` (таблиця §5.1). `Product` дає
   ціну/наявність/sku; `Book` дає isbn/author. Ціна/url беруться з `Product.offers`, fallback `Book.offers`.
5. Будь-яка помилка (malformed JSON, немає жодного потрібного блоку, відсутні `url`/`title`) →
   запис у `errors[]` + `listing: null`, **ніколи throw**.

**Алгоритм sitemap-index-парсера** (`parseKnigolandSitemapIndex`, чиста функція, без мережі):

1. `cheerio.load(xml, { xml: true })` → зібрати всі `<loc>` (під-sitemap).
2. лишити лише ті, що збігаються з `CATALOG_PRODUCTS_SITEMAP_PATTERN`; dedupe у document order.
3. повернути `{ sitemapUrls: string[]; errors: string[] }`; порожньо/невалідно/нема збігів → `[]` + error.

**Алгоритм product-sitemap-парсера** (`parseKnigolandSitemap`, чиста функція, без мережі):

1. `cheerio.load(xml, { xml: true })` → зібрати всі `<loc>` з `<urlset>`.
2. dedupe у document order; повернути `{ urls: string[]; errors: string[] }`; порожній/невалідний XML
   або відсутність `<loc>` → `urls: []` + `errors[]`.

Публічні чисті функції:
- `parseKnigolandSitemapIndex(xml: string): { sitemapUrls: string[]; errors: string[] }`.
- `parseKnigolandSitemap(xml: string): { urls: string[]; errors: string[] }`.
- `parseKnigolandListing(html: string): { listing: RawProviderListing | null; errors: string[] }`.
- `knigolandPriceToKopecks(value: unknown): number | null` (§7).
- `parseKnigolandProduct(html: string): ParsedProductState` (single-product price/availability; тип з
  [single-product.ts](../../packages/scrapers/src/providers/single-product.ts)) — **не реєструється** у
  v1 (§3), але живе у парсері й покривається тестами.

### 5.1 Мапінг `RawProviderListing` ← JSON-LD (Product + Book)

| Поле listing | Джерело JSON-LD | Примітка |
|--------------|-----------------|----------|
| `provider` | — | константа `'knigoland'` |
| `title` | `Product.name` (fallback `Book.name`) | `trim`; відсутній → продукт пропущено + `errors[]` |
| `author` | `Book.author[].name` (fallback `Book.author`-рядок) | `Person`-обʼєкт/масив → один рядок через `, `; відсутній → `null` |
| `price` | `Product.offers.price` (fallback `Book.offers.price`) + `priceCurrency` | число `200` → копійки через `knigolandPriceToKopecks` (§7) |
| `availability` | `Product.offers.availability` (fallback `Book.offers.availability`) | mapping §9 (значення = повний `https://schema.org/…`) |
| `isbn` | `Book.isbn` (fallback `Product.sku`, далі `Product.mpn`) | через `normalizeIsbn()` (§8) |
| `coverUrl` | `Product.image` (fallback `Book.image`) | через `buildCoverUrl()` (§10); масив → перший валідний; відсутній → `null` |
| `url` | `Product.offers.url` (fallback `Book.offers.url`/`Book.url`) | ключ dedupe; відсутній → продукт пропущено + `errors[]` |
| `description` | — | у v1 завжди `null` (§3) |

---

## 6. Sitemap / catalog discovery strategy

- **v1 = sitemap-index-driven discovery** (надбудова над Laboratory). Каталог Knigoland — SSR, але
  index-обхід sitemap (повний, daily-оновлюваний, ~50k URL) **простіший і повніший** за пагінацію
  каталогу й максимально перевикористовує Laboratory-пайплайн.
  1. fetch `KNIGOLAND_SITEMAP_INDEX_URL` → `parseKnigolandSitemapIndex(xml)` → список product-sub-sitemap;
  2. для кожного sub-sitemap: fetch → `parseKnigolandSitemap(xml)` → URL товарів; помилка на одному
     sub-sitemap → `errors.push(...)`, решта продовжуються;
  3. dedupe URL по всіх sub-sitemap; обрізати до `maxProducts` (cap, §2);
  4. для кожного URL — fetch сторінки товару → `parseKnigolandListing(html)`.
- **Чому це не загальна архітектура:** `parseKnigolandSitemapIndex`/`parseKnigolandSitemap` — **локальні**
  функції у `knigoland.parser.ts`. Узагальнення sitemap-провайдерів — окремим PRD.

---

## 7. Price parsing у копійках

Гроші — `Money { amount: <копійки, ціле>, currency: 'UAH' }`
([packages/shared/src/types/money.ts](../../packages/shared/src/types/money.ts)).

```ts
export function knigolandPriceToKopecks(value: unknown): number | null {
  // null для 0 / негативних / нескінченних / нечислових
  // інакше Math.round(value * 100)
}
```

- Джерело — `Product.offers.price` (число `200` / числовий рядок) з `priceCurrency: 'UAH'`.
- `null` → listing з `price: null` (валідний; рахується у `skippedNoPrice`, guide §2.9) та
  `availability: 'out-of-stock'` (інваріант §9).
- Per-provider (як `laboratoryPriceToKopecks`) — не виносимо у shared.

---

## 8. ISBN handling

- **Каскад:** `Book.isbn` → fallback `Product.sku` → fallback `Product.mpn`.
- Кожен кандидат проганяється через shared `normalizeIsbn()`
  ([packages/scrapers/src/canonical/isbn.ts](../../packages/scrapers/src/canonical/isbn.ts)):
  ISBN-10 → ISBN-13 + перевірка checksum; невалідний → `null`, переходимо до наступного кандидата.
  (`sku`/`mpn` Knigoland — числовий товарний код, напр. `469152`; майже завжди провалить checksum і дасть
  `null` — каскад захисний, але дешевий.)
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
| `offers.availability` = `PreOrder` | `in-stock` (політика Vivat/Yakaboo/BookChef/Laboratory) |
| Невизначено / нерозпізнано | `unknown` |

(Значення приходить як повний URL `https://schema.org/InStock` — нормалізувати до суфікса перед
порівнянням, як у Laboratory. У живому каталозі спостережено `InStock`/`OutOfStock` (OOS зберігає ціну);
решта гілок — захисні, покриваються unit-тестами через perturbed real markup.)

---

## 10. Cover extraction

- `buildCoverUrl(image)` у `constants.ts` резолвить: absolute (pass-through), protocol-relative
  (`//cdn/..` → `https:`), site-relative (`/...` → base URL). Дзеркало Laboratory-хелпера.
- `image` у JSON-LD — масив (Knigoland `Product.image`) або рядок (`Book.image`) → перший валідний рядок.
  Cover-хости — `admin.knigoland.com.ua/assets/...` (absolute, pass-through).
- **Відсутній/нерядковий cover → `null`, і це ніколи не ламає listing** (поле опціональне, guide §2.8).

---

## 11. scrapeErrors

- `errors: string[]` **збираються**, **ніколи не кидаються** зі `scrape()` (guide §2.10).
- Network error на **index** → `errors.push(...)`, повернути `ScraperResult` з порожнім `listings`.
- Network error на **окремому product-sub-sitemap** → `errors.push(...)`, sub-sitemap пропускається,
  решта продовжуються.
- Fetch-помилка на **окремій сторінці товару** (network error **або** HTTP 404/410/інший не-2xx) →
  `errors.push(...)`, товар пропускається, цикл **продовжується**.
- Malformed JSON-LD / немає потрібного блоку / missing `url`|`title` → запис у `errors[]`, продукт
  пропускається. Non-book (paper-фільтр) — **тихий пропуск без error**.
- `errors[]` повертається у `ScraperResult` і потрапляє у `scrapeErrors` summary
  ([packages/api/src/pipeline/run-scrape.ts](../../packages/api/src/pipeline/run-scrape.ts)).

---

## 12. Blocked provider behavior

- Класифікація через `detectProviderBlock(errors)`
  ([packages/scrapers/src/lib/blocked-status.ts](../../packages/scrapers/src/lib/blocked-status.ts))
  → `ProviderBlock` (`cloudflare` | `http-403`); HTML-детект —
  [packages/scrapers/src/http/blocked-page.ts](../../packages/scrapers/src/http/blocked-page.ts).
- **Tier A не має блокуватись.** Knigoland на recon **без anti-bot**; поява блоку = сигнал переглянути
  стратегію провайдера, а **не** привід обходити захист. Index/sub-sitemap, що повернув 0 URL,
  класифікується через `classifyBlockedPage` (як у Laboratory).

---

## 13. Registration points

> `FETCHER_FACTORY` — exhaustive `Record<ProviderName, …>`, тож додавання slug у `ProviderName`
> **примусово ламає typecheck**, доки запис не доданий у фабрику. Аналогічно DB Provider enum-мапи.

| # | Точка | Файл | Що додати | Commit |
|---|-------|------|-----------|--------|
| 1 | `ProviderName` union | [packages/shared/src/types/provider.ts](../../packages/shared/src/types/provider.ts) | `\| 'knigoland'` | 5 |
| 2 | Barrel scrapers | [packages/scrapers/src/providers/index.ts](../../packages/scrapers/src/providers/index.ts) | `export { KnigolandScraper } from './knigoland/index.js';` | 5 |
| 3 | Кореневий barrel | [packages/scrapers/src/index.ts](../../packages/scrapers/src/index.ts) | додати `KnigolandScraper` у named-export | 5 |
| 4 | `FETCHER_FACTORY` | [packages/api/src/refresh/fetcher-registry.ts](../../packages/api/src/refresh/fetcher-registry.ts) | `knigoland: getFetchFetcher` (SSR без challenge) | 5 |
| 5 | DB `Provider` enum + slug-мапи + migration + persist-listing | `schema.prisma`, `prisma/migrations/`, persist-listing, exhaustive `Record<Provider, …>` мапи | `knigoland` enum + маппінги | 6 |

**Поза v1:** реєстрація у `SINGLE_PRODUCT_PARSERS` (single-product refresh) — не додаємо (§3).

---

## 14. Tests

Структура — за патерном Laboratory (`providers/laboratory/__tests__/`). **Без мережі**, fetcher завжди
мокається, детермінізм (testing.md). Coverage нових модулів ≥ 80%.

**Фікстури:** `__fixtures__/` — **real captured** артефакти Knigoland (recon 2026-06-28),
верифіковані проти живого сайту:
- `sitemap-index.xml` — реальний (повний, ~3.7 KB) index із під-sitemap (`images/*`, `sections/*`),
  у т.ч. `catalog-products-1..5.xml` — для тесту фільтра sub-sitemap.
- `sitemap-products.xml` — реальний (обрізаний) фрагмент `catalog-products-1.xml` із `<loc>` товарів.
- `product-instock.html` — `/his-last-bow-item` (InStock, isbn `9789660396999`, price 200,
  author «Артур Конан Дойл», breadcrumb «Книги»).
- `product-outofstock.html` — `/galapagos-item` (OutOfStock, isbn `9786176141594`, price 250,
  author «Курт Воннегут») — OOS зберігає ціну.
- `product-instock-2.html` — `/gra-v-biser-item` (InStock, isbn `9789660392595`, price 780,
  author «Герман Гессе») — друга in-stock-варіація для author/dedupe.
- `product-nonbook.html` — `/kartonnyy-konstruktor-cartonic-3d-puzzle-boxer-item` (лише `@type:Product`,
  breadcrumb «Канцтовари та ігри», **без `@type:Book`**) — non-book, має тихо пропуститися.

Synthetic/мінімальні JSON-LD блоки **не приймаються**; error-гілки, яких живий сайт не емітить
(malformed JSON, missing name/url, absent isbn → sku-fallback, author-array), відтворюються
**perturbed real markup** in-memory або мінімальним inline-рядком — як у Laboratory.

### Sitemap-index + sitemap + listing parser — `knigoland.parser.test.ts`
- [ ] `knigolandPriceToKopecks`: `200`/`"200"` → копійки; `null` для 0/негативних/нечислових.
- [ ] `parseKnigolandSitemapIndex`: реальний index → лише `catalog-products-1..5.xml` (images/authors/
      blog/pages відфільтровано, dedupe); порожній/невалідний/нема збігів → `[]` + `errors[]`.
- [ ] `parseKnigolandSitemap`: реальний XML → масив URL товарів (dedupe); порожній/невалідний → `[]` + error.
- [ ] `parseKnigolandListing`: коректні `provider`, `title`, `author`, `price`, `url`, `availability`,
      `coverUrl`, `isbn` (instock + instock-2 + outofstock fixtures).
- [ ] **Paper-фільтр:** non-book (real `product-nonbook.html` — лише `@type:Product`, без `@type:Book`)
      → `listing: null`, `errors: []` (тихий пропуск).
- [ ] `isbn` ← `Product.sku` fallback (perturbed: порожній `Book.isbn`); усі кандидати невалідні → `null`.
- [ ] Null/відсутня price → `price: null`, availability `out-of-stock` (perturbed).
- [ ] Malformed: немає Product/Book-блоку / невалідний JSON-LD → `listing: null` + error.
- [ ] Missing `url`/`title` → `listing: null` + запис у `errors[]`.
- [ ] Author: `Person`-обʼєкт → рядок; масив Person → `, `-join; рядок; відсутній → `null`.
- [ ] Cover: array (Product.image) → перший; string (Book.image); absolute pass-through; відсутній → `null`.

### Product-state — у тому ж файлі або `knigoland.product-state.test.ts`
- [ ] `parseKnigolandProduct`: price + availability зі сторінки товару (in-stock + out-of-stock).
- [ ] No-price → `{ price: null, availability: 'out-of-stock' }`.
- [ ] Missing/unparseable дані → `{ price: null, availability: 'unknown' }` (**non-throwing**).

### Scraper (mocked fetcher) — `knigoland.scraper.test.ts`
- [ ] Fetcher повертає index для index-URL, product-sub-sitemap для кожного sub-sitemap-URL і відповідну
      HTML для кожного product-URL.
- [ ] Index-traversal: лише `catalog-products-*` sub-sitemap фетчаться; URL із усіх sub-sitemap зливаються.
- [ ] Combine listings; dedupe ідентичних URL; non-book товари відсіяні.
- [ ] `maxProducts` cap дотримано (override через `options.maxPages`); `delayMs: 0` (без реального sleep).
- [ ] Network error на товарі / на одному sub-sitemap → запис у `errors[]`, **не throw**, цикл продовжується.
- [ ] Network error на index → порожній `listings`, error у `errors[]`, **не throw**.
- [ ] `ScraperResult` shape: `provider: 'knigoland'`, `listings[]`, `scrapedAt` (ISO), `errors[]`.

Blocked-page тести — **не потрібні** (Tier A без challenge); додаються лише якщо recon виявить challenge.

---

## 15. Acceptance criteria

- [ ] **Scraper tests pass** (parser + product-state + scraper).
- [ ] **API tests pass** — pipeline/persist не зламані новим slug `knigoland`.
- [ ] **`pnpm typecheck` + `pnpm build` + `pnpm test`** — зелені на всьому монорепо.
- [ ] Провайдер повертає **стабільний `RawProviderListing`** — усі обов'язкові поля (`provider`,
      `title`, `author`, `isbn`, `price`, `url`, `availability`) присутні й коректно типізовані.
- [ ] **Фікстури — real captured** артефакти Knigoland (index + фрагмент product-sitemap + сторінки
      товарів), верифіковані проти живого сайту; synthetic не приймаються.
- [ ] **Index-traversal** — discovery фільтрує `catalog-products-1..5.xml`, зливає URL з усіх sub-sitemap.
- [ ] **Two-block merge** — listing коректно зливає `@type:Product` (ціна/наявність/sku) та
      `@type:Book` (isbn/author); ISBN-fallback `Book.isbn → Product.sku → Product.mpn`.
- [ ] **Paper-фільтр** — non-book (лише `@type:Product`, без `@type:Book`) тихо пропускається.
- [ ] **Discovery через sitemap-index**; cap `maxProducts` дотримано; `ScraperOptions` не змінено.
- [ ] **Стійкість до битих URL/sub-sitemap** — HTTP 404/410 окремих товарів та помилки окремих
      sub-sitemap логуються у `scrapeErrors`, пропускаються, цикл продовжується.
- [ ] **No anti-bot bypass** — блок → статус `BLOCKED`. **No Playwright** — `getFetchFetcher`.
- [ ] Slug зареєстровано у **всіх чотирьох** scraper-точках (§13) **+ DB Provider enum** (commit 6).
- [ ] Coverage нових модулів ≥ 80%.
- [ ] Conventional Commits, feature branch `feat/knigoland-provider`, зелений CI перед merge (git.md).

---

## 16. Файлова структура

Папка `packages/scrapers/src/providers/knigoland/` (slug-префікс на файлах парсера/скрапера):

| Файл | Призначення |
|------|-------------|
| `constants.ts` | `KNIGOLAND_BASE_URL`, `KNIGOLAND_SITEMAP_INDEX_URL`, `CATALOG_PRODUCTS_SITEMAP_PATTERN`, `JSON_LD_SELECTOR`, `DEFAULT_MAX_PRODUCTS`, `buildCoverUrl`, raw-інтерфейси JSON-LD (Product+Book). |
| `knigoland.parser.ts` | Чисті функції: `parseKnigolandSitemapIndex`, `parseKnigolandSitemap`, `parseKnigolandListing` (two-block merge + book-block paper-фільтр), `knigolandPriceToKopecks`, `parseKnigolandProduct`, мапінг у `RawProviderListing`. |
| `knigoland.scraper.ts` | `KnigolandScraper implements ScraperProvider` (index → sub-sitemaps → per-product fetch, cap, dedupe, paper-фільтр, збір помилок). |
| `index.ts` | Barrel-експорт скрапера + публічних парсер-функцій/типів. |
| `__tests__/knigoland.parser.test.ts` | Sitemap-index + sitemap + listing + product-state + constants тести. |
| `__tests__/knigoland.scraper.test.ts` | Scraper-тести (mocked fetcher). |
| `__fixtures__/sitemap-index.xml`, `sitemap-products.xml`, `product-*.html` | Real captured фікстури. |

---

## 17. Proposed commit message

```
docs(prd): add Nash Format deferred note and Knigoland PRD
```
