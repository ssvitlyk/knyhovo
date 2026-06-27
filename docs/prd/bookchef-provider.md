# BookChef Provider PRD

> **Тип:** PRD (per-provider). **Статус:** Чорновик (2026-06-27). **Гілка:** `feat/bookchef-provider`.
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

- **Що:** `BookChefScraper implements ScraperProvider` зі slug `'bookchef'`, що пагінує каталог
  BookChef і повертає стабільний `RawProviderListing[]`.
- **Джерело:** **JSON-LD `@type:Product`** на сторінках товару/картках — найкраще structured-джерело
  серед Tier A (один блок дає `isbn` + `gtin13` + `price` + `priceCurrency:UAH` + `availability` +
  `author`). HTML-селектори — лише fallback.
- **Транспорт:** SSR без challenge → `FetchHtmlFetcher` (Cloudflare у BookChef лише як CDN).
  **Без Playwright.**
- **Slug:** `bookchef` (один токен; функції `bookChefPriceToKopecks`, клас `BookChefScraper`).
- **Оцінка:** ~1 день (bookstore-feasibility Tier A, low maintenance).

---

## 2. Що будуємо (v1 scope)

- Клас `BookChefScraper implements ScraperProvider` (`name = 'bookchef'`), з DI `HtmlFetcher`
  (default `FetchHtmlFetcher`) — за патерном Vivat
  ([packages/scrapers/src/providers/vivat/](../../packages/scrapers/src/providers/vivat/)).
- **Пагінація каталогу** (`?page=N`), dedupe по `listing.url`, стоп на порожній сторінці або
  network error.
- **JSON-LD-first** парсинг у чистих функціях `parseBookChefPage(html)` / `parseBookChefProduct(html)`.
- Мапінг сирих даних у `RawProviderListing` (усередині `bookchef.parser.ts`, **без окремого**
  `mapper.ts` — guide §1).
- Збір помилок у `errors[]` (ніколи не throw), повернення `ScraperResult`.
- Реєстрація slug у **всіх чотирьох** точках (див. §14).
- Тести (parser / product-state / scraper) на **real captured HTML** фікстурах, coverage ≥ 80%.

---

## 3. Що НЕ будуємо у v1

- **Sitemap / feed-crawler** — discovery через sitemap (8 sub-sitemap BookChef) відкладено; v1 = пагінація.
- **`enrichDescriptions`** — за замовчуванням **off**; opt-in product-page-pass не активуємо.
- **Реєстрація single-product парсера** у `SINGLE_PRODUCT_PARSERS`
  ([packages/scrapers/src/providers/single-product.ts](../../packages/scrapers/src/providers/single-product.ts))
  — `parseBookChefProduct` може існувати як чиста функція й покриватись тестами, але **не**
  під'єднується до refresh single-product-флоу у v1.
- **Playwright / будь-який обхід anti-bot** — Tier A на `FetchHtmlFetcher`.
- **Зміни архітектури чи shared-контрактів** (`ScraperProvider`, `RawProviderListing`, `Money`, …).
- **Інші Tier A провайдери** (Лабораторія, Старий Лев, КСД, Книголенд, Readeat) — окремими PRD/PR.

---

## 4. Джерело даних BookChef

- **Транспорт:** plain `fetch` через `FetchHtmlFetcher`
  ([packages/scrapers/src/http/html-fetcher.ts](../../packages/scrapers/src/http/html-fetcher.ts)),
  обов'язковий `timeoutMs` (security.md). Cloudflare присутній лише як CDN — SSR повертає реальний
  HTML без JS-challenge.
- **Constants** (`constants.ts`): base URL, `BOOKCHEF_CATALOG_URL`, селектор JSON-LD
  (`script[type="application/ld+json"]`), `isPaperBookType(...)`, `buildProductUrl(...)`,
  `buildCoverUrl(image)`, provider-specific інтерфейси сирих даних.
- **Пагінація:** каталог `?page=N`, стоп на сторінці без продуктів (`hasNextPage === false`) або на
  network error — як Vivat (guide §2.2).
- **Recon перед кодом:** фактичні base/catalog URL, форму query-параметра пагінації та структуру
  JSON-LD **підтвердити проти живого сайту** при імплементації (та зафіксувати у фікстурах, §15).

---

## 5. JSON-LD parsing strategy

Пріоритет джерел (стабільність спадає згори вниз, guide §2.4):

1. **JSON-LD** `@type:Product` (за потреби `@type:Book`) — **основне** джерело BookChef.
2. Embedded JSON — у BookChef не потрібне.
3. **HTML-селектори** — лише fallback, якщо JSON-LD відсутній (крихко; уникати).

**Алгоритм парсера** (чиста функція, без мережі):

1. `cheerio.load(html)` → знайти `script[type="application/ld+json"]`.
2. `JSON.parse` кожного блоку у `try/catch`; навігація до `@type:Product` (та вкладеного `offers`).
3. Для кожного продукту — мапінг у `RawProviderListing` (таблиця нижче).
4. Будь-яка помилка (malformed JSON, не масив, відсутні поля) → запис у `errors[]`, **ніколи throw**.

Публічні чисті функції:
- `parseBookChefPage(html: string): ParseResult` (`{ listings, errors, hasNextPage }`).
- `parseBookChefProduct(html: string): ParsedProductState` (single-product price/availability;
  тип з [single-product.ts](../../packages/scrapers/src/providers/single-product.ts)).

### Мапінг `RawProviderListing` ← JSON-LD

| Поле listing | Джерело JSON-LD | Примітка |
|--------------|-----------------|----------|
| `provider` | — | константа `'bookchef'` |
| `title` | `name` | `trim` |
| `author` | `author` / `brand` | масив або рядок → нормалізувати в один рядок або `null` |
| `price` | `offers.price` + `offers.priceCurrency` | → копійки через `bookChefPriceToKopecks` (§8) |
| `availability` | `offers.availability` | mapping §10 |
| `isbn` | `isbn` (fallback `gtin13`) | через `normalizeIsbn()` (§9) |
| `coverUrl` | `image` | через `buildCoverUrl()` (§11); відсутній → `null` |
| `url` | URL товару | `buildProductUrl(...)`; ключ dedupe |

---

## 6. Sitemap / catalog discovery strategy

- **v1 = пагінація каталогу** (як Vivat): `?page=N`, стоп на `hasNextPage === false` або network
  error. Централізованої sitemap-утиліти в проєкті немає (guide §2.2).
- **Future (поза v1):** BookChef публікує ~8 sub-sitemap. Sitemap-driven discovery — кандидат на
  майбутній `FeedProvider` (provider-integration-strategy); задокументовано тут лише як напрям, **не**
  реалізується у цьому PRD.

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
- Network error на сторінці → `errors.push(...)` + `break` пагінації (не валить увесь run).
- Malformed JSON-LD / не масив / missing `url`|`title` → запис у `errors[]`, продукт пропускається.
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

**Фікстури:** `__tests__/__fixtures__/*.html` — **real captured HTML** зі сторінок BookChef
(catalog page, catalog empty/last, product page, edge-cases), **верифіковані проти живого сайту**.
Synthetic/мінімальні JSON-LD блоки у v1 **не приймаються** (acceptance §15) — щоб уникнути
розходження парсера зі справжньою розміткою.

### Parser — `bookchef.parser.test.ts`
- [ ] `bookChefPriceToKopecks`: грн → копійки; `null` для 0/негативних/нечислових.
- [ ] Чистий каталог: коректні `provider`, `title`, `author`, `price`, `url`, `availability`, `coverUrl`.
- [ ] Non-paper (e-book/audio) → тихо пропущено, без error.
- [ ] `isbn` ← `gtin13` fallback; обидва відсутні → `isbn: null`.
- [ ] Null/negative price → `price: null`, availability `out-of-stock`.
- [ ] Empty page → 0 listings, без errors, `hasNextPage: false`.
- [ ] Malformed: відсутній/невалідний JSON-LD, продукти не масив → error у `errors[]`.
- [ ] Missing `url`/`title` → продукт пропущено + запис у `errors[]`.
- [ ] Cover: site-relative → absolute, protocol-relative → `https:`, absolute pass-through, відсутній → `null`.

### Product-state — `bookchef.product-state.test.ts`
- [ ] `parseBookChefProduct`: price + availability зі сторінки товару.
- [ ] No-price → `{ price: null, availability: 'out-of-stock' }`.
- [ ] Missing/unparseable дані → `{ price: null, availability: 'unknown' }` (**non-throwing**).

### Scraper (mocked fetcher) — `bookchef.scraper.test.ts`
- [ ] `makeFetcher([...pages])` повертає сторінки по черзі.
- [ ] Multi-page combine; dedupe ідентичних URL; стоп на порожній сторінці.
- [ ] `maxPages` дотримано; `delayMs: 0` (без реального sleep).
- [ ] Network error → запис у `errors[]`, **не throw**, пагінація зупиняється.
- [ ] `ScraperResult` shape: `provider: 'bookchef'`, `listings[]`, `scrapedAt` (ISO), `errors[]`.

Blocked-page тести — **не потрібні** (Tier A без challenge); додаються лише якщо recon виявить challenge.

---

## 15. Acceptance criteria

- [ ] **Scraper tests pass** (parser + product-state + scraper).
- [ ] **API tests pass** — pipeline/persist не зламані новим slug `bookchef`.
- [ ] **`pnpm build` pass** (typecheck + build усього монорепо; `FETCHER_FACTORY` оновлено).
- [ ] Провайдер повертає **стабільний `RawProviderListing`** — усі обов'язкові поля (`provider`,
      `title`, `author`, `isbn`, `price`, `url`, `availability`) присутні й коректно типізовані.
- [ ] **Фікстури — real captured HTML** BookChef (catalog + product), верифіковані проти живого сайту;
      synthetic не приймаються.
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
| `constants.ts` | base/catalog URL, JSON-LD селектор, `isPaperBookType`, `buildProductUrl`, `buildCoverUrl`, raw-інтерфейси. |
| `bookchef.parser.ts` | Чисті функції: `parseBookChefPage`, `bookChefPriceToKopecks`, `parseBookChefProduct`, мапінг у `RawProviderListing`. |
| `bookchef.scraper.ts` | `BookChefScraper implements ScraperProvider` (пагінація, dedupe, збір помилок). |
| `index.ts` | Barrel-експорт скрапера + публічних парсер-функцій/типів. |
| `__tests__/bookchef.parser.test.ts` | Parser-тести. |
| `__tests__/bookchef.product-state.test.ts` | Product-state тести. |
| `__tests__/bookchef.scraper.test.ts` | Scraper-тести (mocked fetcher). |
| `__tests__/__fixtures__/*.html` | Real captured HTML фікстури. |

---

## 17. Proposed commit message

```
docs(prd): add BookChef provider PRD
```
